"""Mobile app API — chat config for direct OpenClaw connection."""
import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class MobileChatConfigView(APIView):
    """GET /api/mobile/chat-config/
    Returns OpenClaw HTTP chat endpoint details for the mobile app.
    The app connects directly to the server's OpenAI-compatible endpoint.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'No profile'}, status=404)

        server = getattr(profile, 'server', None)
        if not server or server.status != 'active' or not server.openclaw_running:
            return Response({
                'enabled': False,
                'reason': 'No active server',
            })

        if not server.gateway_token:
            return Response({
                'enabled': False,
                'reason': 'Server not configured for chat',
            })

        return Response({
            'enabled': True,
            'chat_url': f'http://{server.ip_address}:18789/v1/chat/completions',
            'gateway_token': server.gateway_token,
        })
