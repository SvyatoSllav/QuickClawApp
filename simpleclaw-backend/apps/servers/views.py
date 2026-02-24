import hashlib
import json
import re
import shlex
import logging
import requests as http_requests
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

logger = logging.getLogger(__name__)

SKILLSMP_CACHE_TTL = 30 * 60  # 30 minutes


class SkillsSearchView(APIView):
    """GET /api/skills/search/ — proxy SkillsMP search with Redis caching"""

    def get(self, request):
        q = request.query_params.get('q', '') or '*'
        page = request.query_params.get('page', '1')
        limit = request.query_params.get('limit', '20')
        sort_by = request.query_params.get('sortBy', 'stars')

        cache_key = 'skillsmp:' + hashlib.md5(
            f'{q}:{page}:{limit}:{sort_by}'.encode()
        ).hexdigest()

        cached = cache.get(cache_key)
        if cached:
            return Response(json.loads(cached))

        base_url = getattr(settings, 'SKILLSMP_BASE_URL', 'https://skillsmp.com/api/v1')
        api_key = getattr(settings, 'SKILLSMP_API_KEY', '')

        try:
            resp = http_requests.get(
                f'{base_url}/skills/search',
                params={'q': q, 'page': page, 'limit': limit, 'sortBy': sort_by},
                headers={'Authorization': f'Bearer {api_key}', 'Accept': 'application/json'},
                timeout=10,
            )
            resp.raise_for_status()
            raw = resp.json()

            # Unwrap SkillsMP envelope: { success, data: { skills, pagination } }
            inner = raw.get('data', raw) if raw.get('success') else raw
            data = {
                'skills': inner.get('skills', []),
                'total': inner.get('pagination', {}).get('total', 0),
                'page': inner.get('pagination', {}).get('page', 1),
                'limit': inner.get('pagination', {}).get('limit', 20),
            }

            cache.set(cache_key, json.dumps(data), SKILLSMP_CACHE_TTL)
            return Response(data)
        except http_requests.RequestException as e:
            logger.warning('SkillsMP search failed: %s', e)
            return Response({'skills': [], 'total': 0, 'error': 'Marketplace unavailable'}, status=502)


class SkillDetailView(APIView):
    """GET /api/skills/<slug>/ — fetch skill detail via SkillsMP search + GitHub SKILL.md"""

    def get(self, request, slug):
        cache_key = f'skillsmp:detail:{slug}'
        cached = cache.get(cache_key)
        if cached:
            return Response(json.loads(cached))

        base_url = getattr(settings, 'SKILLSMP_BASE_URL', 'https://skillsmp.com/api/v1')
        api_key = getattr(settings, 'SKILLSMP_API_KEY', '')

        try:
            # SkillsMP has no per-skill endpoint; search by name and match by id
            resp = http_requests.get(
                f'{base_url}/skills/search',
                params={'q': slug, 'limit': 5, 'sortBy': 'stars'},
                headers={'Authorization': f'Bearer {api_key}', 'Accept': 'application/json'},
                timeout=10,
            )
            resp.raise_for_status()
            raw = resp.json()

            inner = raw.get('data', raw) if raw.get('success') else raw
            skills = inner.get('skills', [])

            # Try exact match by id first, then by name
            match = None
            for s in skills:
                if s.get('id') == slug or s.get('name') == slug:
                    match = s
                    break
            if not match and skills:
                match = skills[0]

            if not match:
                return Response({'error': 'Skill not found'}, status=404)

            # Enrich with SKILL.md from GitHub
            self._enrich_from_github(match)

            cache.set(cache_key, json.dumps(match), SKILLSMP_CACHE_TTL)
            return Response(match)
        except http_requests.RequestException as e:
            logger.warning('SkillsMP detail failed for %s: %s', slug, e)
            return Response({'error': 'Marketplace unavailable'}, status=502)

    def _enrich_from_github(self, skill: dict):
        """Fetch SKILL.md from GitHub and add readme + metadata to the skill dict."""
        github_url = skill.get('githubUrl', '')
        if not github_url:
            return

        raw_url = self._github_to_raw_url(github_url)
        if not raw_url:
            return

        try:
            resp = http_requests.get(raw_url, timeout=8)
            if resp.status_code != 200:
                return
            content = resp.text

            # Parse YAML frontmatter
            metadata, readme = self._parse_frontmatter(content)
            if readme:
                skill['readme'] = readme
            if metadata:
                skill['metadata'] = metadata
                if 'homepage' in metadata:
                    skill['homepage'] = metadata['homepage']
        except http_requests.RequestException:
            pass  # Non-critical: just skip enrichment

    @staticmethod
    def _github_to_raw_url(github_url: str) -> str | None:
        """Convert a GitHub tree URL to a raw.githubusercontent.com SKILL.md URL."""
        # https://github.com/{owner}/{repo}/tree/{branch}/{path}
        m = re.match(
            r'https?://github\.com/([^/]+)/([^/]+)/tree/([^/]+)/(.*)',
            github_url,
        )
        if m:
            owner, repo, branch, path = m.groups()
            return f'https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}/SKILL.md'

        # https://github.com/{owner}/{repo} (root)
        m = re.match(r'https?://github\.com/([^/]+)/([^/]+)/?$', github_url)
        if m:
            owner, repo = m.groups()
            return f'https://raw.githubusercontent.com/{owner}/{repo}/main/SKILL.md'

        return None

    @staticmethod
    def _parse_frontmatter(content: str) -> tuple[dict, str]:
        """Parse YAML frontmatter from SKILL.md content. Returns (metadata, body)."""
        fm_match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
        if not fm_match:
            return {}, content.strip()

        fm_text, body = fm_match.groups()
        metadata = {}
        for line in fm_text.split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            colon_idx = line.find(':')
            if colon_idx > 0:
                key = line[:colon_idx].strip()
                val = line[colon_idx + 1:].strip().strip('"').strip("'")
                metadata[key] = val
        return metadata, body.strip()


class SkillInstallView(APIView):
    """POST /api/server/skills/install/ — download skill files to user's server."""
    throttle_classes = [UserRateThrottle]

    def post(self, request):
        skill_name = (request.data.get('skill_name') or '').strip()
        github_url = (request.data.get('github_url') or '').strip()

        if not skill_name or not re.match(r'^[a-z0-9][a-z0-9-]*$', skill_name):
            return Response({'error': 'Invalid skill name'}, status=400)
        if not github_url or not github_url.startswith('https://github.com/'):
            return Response({'error': 'Invalid GitHub URL'}, status=400)

        profile = request.user.profile
        server = getattr(profile, 'server', None)
        if not server or not server.openclaw_running:
            return Response({'error': 'Server not ready'}, status=404)

        from .services import ServerManager
        manager = ServerManager(server)
        try:
            manager.connect()
            manager.install_marketplace_skill(skill_name, github_url)
            return Response({'success': True})
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            logger.exception('skill install error for user %s', request.user.id)
            return Response({'error': 'Internal error'}, status=500)
        finally:
            manager.disconnect()


class SkillUninstallView(APIView):
    """POST /api/server/skills/uninstall/ — remove skill files from user's server."""
    throttle_classes = [UserRateThrottle]

    def post(self, request):
        skill_name = (request.data.get('skill_name') or '').strip()

        if not skill_name or not re.match(r'^[a-z0-9][a-z0-9-]*$', skill_name):
            return Response({'error': 'Invalid skill name'}, status=400)

        profile = request.user.profile
        server = getattr(profile, 'server', None)
        if not server or not server.openclaw_running:
            return Response({'error': 'Server not ready'}, status=404)

        from .services import ServerManager
        manager = ServerManager(server)
        try:
            manager.connect()
            manager.uninstall_marketplace_skill(skill_name)
            return Response({'success': True})
        except Exception as e:
            logger.exception('skill uninstall error for user %s', request.user.id)
            return Response({'error': 'Internal error'}, status=500)
        finally:
            manager.disconnect()


class InternalWsAuthView(APIView):
    """Internal nginx auth_request endpoint for WS proxy.
    Resolves gateway token → upstream server IP.
    Called only by nginx (internal location), no user auth required.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        from .models import Server

        token = request.META.get('HTTP_X_GATEWAY_TOKEN', '')
        if not token:
            return HttpResponse(status=403)

        try:
            server = Server.objects.get(
                gateway_token=token,
                status='active',
                openclaw_running=True,
            )
        except Server.DoesNotExist:
            return HttpResponse(status=403)

        resp = HttpResponse(status=200)
        resp['X-Ws-Upstream'] = f'{server.ip_address}:18789'
        return resp


class ServerStatusView(APIView):
    def get(self, request):
        """Статус сервера пользователя"""
        profile = request.user.profile
        server = getattr(profile, 'server', None)

        if not server:
            return Response({'assigned': False})

        ws_url = None
        if server.gateway_token and server.openclaw_running:
            ws_url = f'wss://install-openclow.ru/ws-proxy/?token={server.gateway_token}'

        return Response({
            'assigned': True,
            'ip_address': server.ip_address,
            'status': server.status,
            'openclaw_running': server.openclaw_running,
            'gateway_token': server.gateway_token,
            'deployment_stage': server.deployment_stage,
            'last_health_check': server.last_health_check,
            'ws_url': ws_url,
        })


class RedeployView(APIView):
    def post(self, request):
        """Перезапустить OpenClaw (после смены модели/токена)"""
        profile = request.user.profile
        server = getattr(profile, 'server', None)

        if not server:
            return Response({'error': 'Сервер не назначен'}, status=404)

        if not profile.telegram_bot_token:
            return Response({'error': 'Telegram-токен не установлен'}, status=400)

        if not server.openclaw_running:
            return Response({'error': 'Деплой в процессе, подождите'}, status=409)

        from .tasks import redeploy_openclaw
        redeploy_openclaw.delay(request.user.id)

        return Response({'status': 'redeploying'})


class ServerPoolStatusView(APIView):
    """Public endpoint to show available servers count"""
    permission_classes = [AllowAny]

    def get(self, request):
        from .models import Server

        available = Server.objects.filter(
            status='active',
            profile__isnull=True,
        ).count()

        total_active = Server.objects.filter(status='active').count()
        total_all = Server.objects.count()

        return Response({
            'available': available,
            'total_active': total_active,
            'total': total_all,
        })


class PairingThrottle(UserRateThrottle):
    rate = '10/min'


class SetModelView(APIView):
    """POST /api/server/set-model/ — change active model on running OpenClaw"""
    throttle_classes = [PairingThrottle]

    def post(self, request):
        model = request.data.get('model', '').strip()
        if not model or not re.match(r'^[a-zA-Z0-9._-]+$', model):
            return Response({'error': 'Invalid model'}, status=400)

        profile = request.user.profile
        server = getattr(profile, 'server', None)

        if not server or not server.openclaw_running:
            return Response({'error': 'Server not ready'}, status=404)

        from .services import ServerManager
        manager = ServerManager(server)
        try:
            manager.connect()
            success, message = manager.set_model(model)
            if not success:
                return Response({'error': message}, status=400)

            # Also update profile's selected_model
            profile.selected_model = model
            profile.save(update_fields=['selected_model'])

            return Response({'success': True, 'model': message})
        except Exception as e:
            logger.exception('set_model error for user %s', request.user.id)
            return Response({'error': 'Internal error'}, status=500)
        finally:
            manager.disconnect()


class ApprovePairingView(APIView):
    """POST /api/server/pairing/approve/ — подтвердить код сопряжения OpenClaw"""
    throttle_classes = [PairingThrottle]

    def post(self, request):
        code = request.data.get('code', '').strip()
        if not code:
            return Response({'error': 'Код не указан'}, status=400)

        # Валидация кода — только буквы, цифры, дефис, подчёркивание; макс 64 символа
        if len(code) > 64 or not re.match(r'^[a-zA-Z0-9_-]+$', code):
            return Response({'error': 'Неверный формат кода'}, status=400)

        profile = request.user.profile
        server = getattr(profile, 'server', None)

        if not server or not server.openclaw_running:
            return Response({'error': 'Сервер не готов'}, status=404)

        # SSH на сервер пользователя и запуск pairing approve
        from .services import ServerManager
        manager = ServerManager(server)
        try:
            manager.connect()
            safe_code = shlex.quote(code)
            out, err, exit_code = manager.exec_command(
                f'docker exec openclaw node /app/openclaw.mjs pairing approve telegram {safe_code}'
            )

            if exit_code != 0:
                logger.warning('Pairing approve failed for user %s: %s', request.user.id, err or out)
                return Response({'error': 'Код не принят. Проверьте код и попробуйте снова.'}, status=400)

            logger.info('Pairing approved for user %s', request.user.id)
            return Response({'success': True, 'message': out.strip()})
        except Exception as e:
            logger.exception('Pairing approve error for user %s', request.user.id)
            return Response({'error': 'Внутренняя ошибка. Попробуйте позже.'}, status=500)
        finally:
            manager.disconnect()
