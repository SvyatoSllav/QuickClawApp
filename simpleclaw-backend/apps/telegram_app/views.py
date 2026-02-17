import re
import sys
import logging
import subprocess
from rest_framework.views import APIView
from rest_framework.response import Response
from .services import validate_telegram_token

logger = logging.getLogger(__name__)


class ValidateTelegramTokenView(APIView):
    def post(self, request):
        """Валидация и сохранение Telegram Bot Token"""
        token = request.data.get('token', '').strip()

        if not token:
            return Response({'error': 'Токен обязателен'}, status=400)

        bot_data, error = validate_telegram_token(token)
        if error:
            return Response({'error': error, 'valid': False}, status=400)

        profile = request.user.profile
        profile.telegram_bot_token = token
        profile.telegram_bot_username = bot_data.get('username', '')
        profile.telegram_bot_validated = True
        profile.save()

        # Если сервер уже назначен — перезапустить OpenClaw с новым токеном
        server = getattr(profile, 'server', None)
        if server and server.status == "active" and server.openclaw_running:
            subprocess.Popen(
                [sys.executable, 'manage.py', 'deploy_server', str(request.user.id)],
                cwd='/home/simpleclaw-backend',
                stdout=open('/var/log/simpleclaw-deploy.log', 'a'),
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )

        return Response({
            'valid': True,
            'bot_username': bot_data.get('username', ''),
            'bot_name': bot_data.get('first_name', ''),
        })

    def delete(self, request):
        """Удалить привязку Telegram бота"""
        profile = request.user.profile
        profile.telegram_bot_token = ''
        profile.telegram_bot_username = ''
        profile.telegram_bot_validated = False
        profile.save()

        return Response({'status': 'removed'})


class ApprovePairingView(APIView):
    def post(self, request):
        """Approve a Telegram pairing code on the user's OpenClaw server."""
        code = request.data.get('code', '').strip().upper()

        if not code or len(code) != 8:
            return Response({'error': 'Invalid code format', 'approved': False}, status=400)

        # Pairing codes: 8 chars, uppercase, no ambiguous chars (0O1I)
        if not re.match(r'^[A-HJ-NP-Z2-9]{8}$', code):
            return Response({'error': 'Invalid code format', 'approved': False}, status=400)

        profile = request.user.profile
        server = getattr(profile, 'server', None)

        if not server or server.status != 'active' or not server.openclaw_running:
            return Response({'error': 'No active server', 'approved': False}, status=400)

        from apps.servers.services import ServerManager
        manager = ServerManager(server)
        try:
            manager.connect()
            out, err, exit_code = manager.exec_command(
                f'docker exec openclaw node /app/openclaw.mjs pairing approve telegram {code}'
            )
            manager.disconnect()

            if exit_code != 0:
                error_msg = (err.strip() or out.strip() or 'Failed to approve pairing code')
                logger.warning(f'Pairing approval failed for user {request.user.id}: {error_msg}')
                return Response({'error': error_msg, 'approved': False}, status=400)

            return Response({'approved': True})
        except Exception as e:
            logger.error(f'Pairing approval error for user {request.user.id}: {e}')
            return Response({'error': str(e), 'approved': False}, status=500)
        finally:
            try:
                manager.disconnect()
            except Exception:
                pass
