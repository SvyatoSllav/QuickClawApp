import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .services import (
    create_first_payment,
    handle_payment_succeeded,
    handle_payment_canceled,
    cancel_subscription,
    reactivate_subscription,
)
from .models import Subscription
from .serializers import SubscriptionSerializer

logger = logging.getLogger(__name__)


class CreatePaymentView(APIView):
    def post(self, request):
        """Create first payment (redirect to YooKassa)"""
        try:
            telegram_token = request.data.get('telegram_token', '')
            selected_model = request.data.get('selected_model', 'claude-opus-4.5')
            result = create_first_payment(request.user, telegram_token, selected_model)
            return Response(result)
        except Exception as e:
            logger.error(f'Error creating payment: {e}')
            return Response({'error': str(e)}, status=400)


class YookassaWebhookView(APIView):
    """YooKassa webhook - no auth required"""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            data = request.data
            event_type = data.get('event')
            payment_obj = data.get('object', {})
            payment_id = payment_obj.get('id')

            logger.info(f'YooKassa webhook: {event_type}, payment_id: {payment_id}')

            if event_type == 'payment.succeeded':
                handle_payment_succeeded(payment_id, payment_obj)
            elif event_type == 'payment.canceled':
                handle_payment_canceled(payment_id)
            elif event_type == 'refund.succeeded':
                logger.info(f'Refund succeeded: {payment_id}')
            else:
                logger.info(f'Unknown event type: {event_type}')

            return Response({'status': 'ok'})
        except Exception as e:
            logger.error(f'Webhook error: {e}')
            return Response({'status': 'ok'})


class SubscriptionView(APIView):
    def get(self, request):
        """Get subscription status"""
        try:
            sub = request.user.subscription
            profile = request.user.profile
            
            return Response({
                'is_active': sub.is_active,
                'auto_renew': sub.auto_renew,
                'status': sub.status,
                'current_period_start': sub.current_period_start,
                'current_period_end': sub.current_period_end,
                'cancelled_at': sub.cancelled_at,
                'has_payment_method': bool(sub.yookassa_payment_method_id),
                'server_ip': profile.server.ip_address if hasattr(profile, 'server') and profile.server else None,
            })
        except Subscription.DoesNotExist:
            return Response({
                'is_active': False,
                'auto_renew': False,
                'status': 'none',
            })


class CancelSubscriptionView(APIView):
    def post(self, request):
        """
        Cancel subscription.
        
        Body params:
            immediate: bool - If true, cancel immediately. Default: false (cancel at period end)
        """
        immediate = request.data.get('immediate', False)
        result = cancel_subscription(request.user, immediate=immediate)
        
        if 'error' in result:
            return Response(result, status=400)
        
        return Response(result)


class ReactivateSubscriptionView(APIView):
    def post(self, request):
        """Re-enable auto-renewal for cancelled subscription"""
        result = reactivate_subscription(request.user)
        
        if 'error' in result:
            return Response(result, status=400)
        
        return Response(result)
