import hashlib
import json
import re
import shlex
import logging
import requests as http_requests
from django.conf import settings
from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

logger = logging.getLogger(__name__)

SKILLSMP_CACHE_TTL = 30 * 60  # 30 minutes


class SkillsSearchView(APIView):
    """GET /api/skills/search/ — proxy SkillsMP search with Redis caching"""

    def get(self, request):
        q = request.query_params.get('q', '')
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
            data = resp.json()

            cache.set(cache_key, json.dumps(data), SKILLSMP_CACHE_TTL)
            return Response(data)
        except http_requests.RequestException as e:
            logger.warning('SkillsMP search failed: %s', e)
            return Response({'skills': [], 'total': 0, 'error': 'Marketplace unavailable'}, status=502)


class ServerStatusView(APIView):
    def get(self, request):
        """Статус сервера пользователя"""
        profile = request.user.profile
        server = getattr(profile, 'server', None)

        if not server:
            return Response({'assigned': False})

        return Response({
            'assigned': True,
            'ip_address': server.ip_address,
            'status': server.status,
            'openclaw_running': server.openclaw_running,
            'gateway_token': server.gateway_token,
            'deployment_stage': server.deployment_stage,
            'last_health_check': server.last_health_check,
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
