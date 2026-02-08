import sys
import subprocess
from rest_framework.views import APIView
from rest_framework.response import Response
from .services import validate_telegram_token


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
