import re
import sys
import shlex
import subprocess
import logging
from rest_framework.views import APIView
from rest_framework.response import Response

logger = logging.getLogger(__name__)


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

        subprocess.Popen(
            [sys.executable, 'manage.py', 'deploy_server', str(request.user.id)],
            cwd='/home/simpleclaw-backend',
            stdout=open('/var/log/simpleclaw-deploy.log', 'a'),
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

        return Response({'status': 'redeploying'})


class ServerPoolStatusView(APIView):
    """Public endpoint to show available servers count"""
    from rest_framework.permissions import AllowAny
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


class ApprovePairingView(APIView):
    """POST /api/server/pairing/approve/ — подтвердить код сопряжения OpenClaw"""

    def post(self, request):
        code = request.data.get('code', '').strip()
        if not code:
            return Response({'error': 'Код не указан'}, status=400)

        # Валидация кода — только буквы, цифры, дефис, подчёркивание
        if not re.match(r'^[a-zA-Z0-9_-]+$', code):
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
                return Response({'error': f'Ошибка: {err or out}'}, status=400)

            logger.info('Pairing approved for user %s', request.user.id)
            return Response({'success': True, 'message': out.strip()})
        except Exception as e:
            logger.exception('Pairing approve error for user %s', request.user.id)
            return Response({'error': str(e)}, status=500)
        finally:
            manager.disconnect()
