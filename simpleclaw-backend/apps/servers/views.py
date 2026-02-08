import sys
import subprocess
from rest_framework.views import APIView
from rest_framework.response import Response


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
