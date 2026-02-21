from datetime import datetime, timedelta, timezone as dt_tz
import logging
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .services import (
    create_first_payment,
    create_payment_with_token,
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


class CreatePaymentWithTokenView(APIView):
    def post(self, request):
        """Create payment using token from YooKassa Android SDK"""
        try:
            payment_token = request.data.get('payment_token')
            if not payment_token:
                return Response({'error': 'payment_token is required'}, status=400)

            telegram_token = request.data.get('telegram_token', '')
            selected_model = request.data.get('selected_model', 'gemini-3-flash')
            result = create_payment_with_token(
                request.user, payment_token, telegram_token, selected_model
            )
            return Response(result)
        except Exception as e:
            logger.error(f'Error creating token payment: {e}')
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


class RevenueCatWebhookView(APIView):
    """RevenueCat webhook for iOS in-app purchases — no auth required"""
    permission_classes = [AllowAny]

    def post(self, request):
        import sys
        import subprocess
        from django.contrib.auth.models import User

        # Validate: RevenueCat webhook key OR authenticated user
        auth_header = request.headers.get('Authorization', '')
        expected_key = settings.REVENUECAT_WEBHOOK_AUTH_KEY
        is_rc_auth = expected_key and auth_header == f'Bearer {expected_key}'
        is_user_auth = request.user and request.user.is_authenticated
        if not is_rc_auth and not is_user_auth:
            return Response({'error': 'Unauthorized'}, status=401)

        try:
            data = request.data
            event_type = data.get('event', {}).get('type', '')
            app_user_id = data.get('event', {}).get('app_user_id', '')

            logger.info(f'RevenueCat webhook: {event_type}, app_user_id: {app_user_id}')

            if not app_user_id:
                return Response({'status': 'ok'})

            try:
                user = User.objects.get(id=int(app_user_id))
            except (User.DoesNotExist, ValueError):
                logger.error(f'User not found for app_user_id: {app_user_id}')
                return Response({'status': 'ok'})

            now = timezone.now()

            if event_type in ('INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE'):
                expiration = data.get('event', {}).get('expiration_at_ms')
                period_end = None
                if expiration:
                    period_end = datetime.fromtimestamp(
                        expiration / 1000, tz=dt_tz.utc
                    )

                subscription, created = Subscription.objects.get_or_create(
                    user=user,
                    defaults={
                        'is_active': True,
                        'auto_renew': True,
                        'status': 'active',
                        'current_period_start': now,
                        'current_period_end': period_end or now + timedelta(days=30),
                    }
                )

                if not created:
                    subscription.is_active = True
                    subscription.auto_renew = True
                    subscription.status = 'active'
                    subscription.current_period_start = now
                    subscription.current_period_end = period_end or now + timedelta(days=30)
                    subscription.cancelled_at = None
                    subscription.save()

                profile = user.profile
                profile.subscription_status = 'active'
                profile.subscription_started_at = now
                profile.subscription_expires_at = subscription.current_period_end
                profile.save()

                # Deploy server if first purchase
                if event_type == 'INITIAL_PURCHASE' and not getattr(profile, 'server', None):
                    subprocess.Popen(
                        [sys.executable, 'manage.py', 'deploy_server', str(user.id)],
                        cwd='/home/simpleclaw-backend',
                        stdout=open('/var/log/simpleclaw-deploy.log', 'a'),
                        stderr=subprocess.STDOUT,
                        start_new_session=True,
                    )
                    logger.info(f'Spawned deploy_server for RevenueCat user {user.id}')

            elif event_type in ('CANCELLATION', 'EXPIRATION'):
                try:
                    subscription = user.subscription
                    if event_type == 'EXPIRATION':
                        subscription.is_active = False
                        subscription.status = 'expired'
                    else:
                        subscription.auto_renew = False
                        subscription.cancelled_at = now
                    subscription.save()

                    profile = user.profile
                    profile.subscription_status = 'cancelled' if event_type == 'EXPIRATION' else 'active'
                    profile.save()
                except Subscription.DoesNotExist:
                    pass

            return Response({'status': 'ok'})
        except Exception as e:
            logger.error(f'RevenueCat webhook error: {e}')
            return Response({'status': 'ok'})
