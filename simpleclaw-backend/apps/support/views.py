import logging
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import SupportMessage
from .serializers import SupportMessageSerializer

logger = logging.getLogger(__name__)


class SendSupportMessageView(APIView):
    def post(self, request):
        serializer = SupportMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        SupportMessage.objects.create(
            user=request.user,
            message=serializer.validated_data['message'],
        )
        logger.info(f'Support message from {request.user.email}')

        return Response({'status': 'ok'})
