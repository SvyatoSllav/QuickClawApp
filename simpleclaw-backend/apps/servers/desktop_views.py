"""Desktop app API — registration, status, usage, payment for SimpleClaw Desktop."""
import logging
import secrets
import uuid

import requests
from decimal import Decimal
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from yookassa import Configuration as YooConfig, Payment as YooPayment

from apps.accounts.models import UserProfile
from apps.payments.models import Payment, Subscription
from .openrouter import create_openrouter_key, check_key_usage, revoke_openrouter_key

logger = logging.getLogger(__name__)


class DesktopRegisterView(APIView):
    """POST /api/desktop/register/
    Register a desktop app user by bot token. Provisions an OpenRouter key.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        bot_token = request.data.get('bot_token', '').strip()
        model = request.data.get('model', 'claude-sonnet-4')
        platform = request.data.get('platform', 'unknown')

        if not bot_token:
            return Response({'error': 'bot_token is required'}, status=400)

        # Validate bot token via Telegram API
        try:
            resp = requests.get(
                f'https://api.telegram.org/bot{bot_token}/getMe',
                timeout=10,
            )
            data = resp.json()
            if not data.get('ok'):
                return Response({'error': 'Invalid bot token'}, status=400)
            bot_info = data.get('result', {})
            bot_username = bot_info.get('username', '')
        except Exception as e:
            logger.error(f'Telegram API error: {e}')
            return Response({'error': 'Could not validate bot token'}, status=502)

        # Find or create user by bot token (use bot token hash as identifier)
        # We use a deterministic username from the bot username
        username = f'desktop_{bot_username}'.lower()[:150]
        email = f'{username}@desktop.simpleclaw.local'

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email},
        )

        # Get or create profile
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.telegram_bot_token = bot_token
        profile.telegram_bot_username = bot_username
        profile.telegram_bot_validated = True
        profile.selected_model = model
        profile.subscription_status = 'active'

        # Provision OpenRouter key if not already set
        if not profile.openrouter_api_key:
            limit = float(getattr(settings, 'OPENROUTER_TOKEN_LIMIT', 15.0))
            key, key_hash = create_openrouter_key(email, limit_usd=limit)
            if key:
                profile.openrouter_api_key = key
                profile.openrouter_key_id = key_hash
                profile.tokens_used_usd = 0
            else:
                return Response(
                    {'error': 'Failed to provision API key. Try again later.'},
                    status=502,
                )

        profile.save()

        # Get or create DRF auth token
        token, _ = Token.objects.get_or_create(user=user)

        gateway_token = secrets.token_urlsafe(32)

        logger.info(
            f'Desktop register: user={username} platform={platform} model={model}'
        )

        return Response({
            'openrouter_key': profile.openrouter_api_key,
            'gateway_token': gateway_token,
            'auth_token': token.key,
        })


class DesktopStatusView(APIView):
    """GET /api/desktop/status/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'No profile'}, status=404)

        return Response({
            'subscription_active': profile.subscription_status == 'active',
            'openrouter_key_active': bool(profile.openrouter_api_key),
            'tokens_used': float(profile.tokens_used_usd),
            'token_limit': float(profile.token_limit_usd),
        })


class DesktopUsageView(APIView):
    """GET /api/desktop/usage/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'No profile'}, status=404)

        # Get real-time usage from OpenRouter
        if profile.openrouter_api_key:
            key_data = check_key_usage(profile.openrouter_api_key)
            if key_data:
                used = key_data.get('usage', 0)
                limit = key_data.get('limit', float(profile.token_limit_usd))
                # Update cached value
                profile.tokens_used_usd = used
                profile.save(update_fields=['tokens_used_usd'])
                return Response({
                    'used': used,
                    'limit': limit,
                    'remaining': max(0, limit - used),
                })

        # Fallback to cached values
        used = float(profile.tokens_used_usd)
        limit = float(profile.token_limit_usd)
        return Response({
            'used': used,
            'limit': limit,
            'remaining': max(0, limit - used),
        })


class DesktopRefreshKeyView(APIView):
    """POST /api/desktop/refresh-key/
    Revoke old key and create a new one.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'No profile'}, status=404)

        # Revoke old key
        if profile.openrouter_key_id:
            revoke_openrouter_key(profile.openrouter_key_id)

        # Create new key
        limit = float(getattr(settings, 'OPENROUTER_TOKEN_LIMIT', 15.0))
        key, key_hash = create_openrouter_key(
            request.user.email, limit_usd=limit
        )

        if not key:
            return Response(
                {'error': 'Failed to create new key'},
                status=502,
            )

        profile.openrouter_api_key = key
        profile.openrouter_key_id = key_hash
        profile.tokens_used_usd = 0
        profile.save()

        return Response({
            'openrouter_key': key,
            'message': 'Key refreshed successfully',
        })


class DesktopCreatePaymentView(APIView):
    """POST /api/desktop/pay/
    Create a Yookassa payment for the desktop app (test mode).
    Uses YOOKASSA_TEST_SHOP_ID / YOOKASSA_TEST_SECRET_KEY.
    Returns a confirmation_url for the user to complete payment.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'No profile'}, status=404)

        # Use test Yookassa credentials
        shop_id = getattr(settings, 'YOOKASSA_TEST_SHOP_ID', '') or settings.YOOKASSA_SHOP_ID
        secret_key = getattr(settings, 'YOOKASSA_TEST_SECRET_KEY', '') or settings.YOOKASSA_SECRET_KEY
        YooConfig.account_id = shop_id
        YooConfig.secret_key = secret_key

        amount = str(getattr(settings, 'SUBSCRIPTION_PRICE_RUB', 990))

        try:
            yoo_payment = YooPayment.create({
                'amount': {
                    'value': amount,
                    'currency': 'RUB',
                },
                'confirmation': {
                    'type': 'redirect',
                    'return_url': 'https://claw-paw.com/desktop-payment-success',
                },
                'capture': True,
                'save_payment_method': True,
                'description': f'SimpleClaw Desktop — {request.user.email}',
                'metadata': {
                    'user_id': str(request.user.id),
                    'source': 'desktop',
                    'telegram_token': profile.telegram_bot_token or '',
                    'selected_model': profile.selected_model or 'gemini-3-flash',
                },
            }, str(uuid.uuid4()))

            Payment.objects.create(
                user=request.user,
                amount=Decimal(amount),
                status='pending',
                description='SimpleClaw Desktop',
                yookassa_payment_id=yoo_payment.id,
                yookassa_status=yoo_payment.status,
                is_recurring=False,
            )

            logger.info(f'Desktop payment created for {request.user.email}: {yoo_payment.id}')

            return Response({
                'confirmation_url': yoo_payment.confirmation.confirmation_url,
                'payment_id': yoo_payment.id,
            })
        except Exception as e:
            logger.error(f'Desktop payment error: {e}')
            return Response({'error': str(e)}, status=500)


class DesktopPaymentWebhookView(APIView):
    """POST /api/desktop/webhook/
    Yookassa webhook for desktop payments.
    On success: provisions OpenRouter key + activates subscription.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        data = request.data
        event_type = data.get('event')
        payment_obj = data.get('object', {})
        payment_id = payment_obj.get('id')

        logger.info(f'Desktop webhook: {event_type}, payment_id={payment_id}')

        if event_type != 'payment.succeeded':
            return Response({'status': 'ok'})

        try:
            payment = Payment.objects.get(yookassa_payment_id=payment_id)
        except Payment.DoesNotExist:
            logger.warning(f'Desktop webhook: payment {payment_id} not found')
            return Response({'status': 'ok'})

        if payment.status == 'succeeded':
            return Response({'status': 'already_processed'})

        payment.status = 'succeeded'
        payment.yookassa_status = payment_obj.get('status', 'succeeded')
        payment.save()

        user = payment.user
        profile = getattr(user, 'profile', None)
        if not profile:
            return Response({'status': 'ok'})

        # Activate subscription
        profile.subscription_status = 'active'

        # Provision OpenRouter key if needed
        if not profile.openrouter_api_key:
            limit = float(getattr(settings, 'OPENROUTER_TOKEN_LIMIT', 15.0))
            key, key_hash = create_openrouter_key(user.email, limit_usd=limit)
            if key:
                profile.openrouter_api_key = key
                profile.openrouter_key_id = key_hash
                profile.tokens_used_usd = 0

        profile.save()

        # Create/update subscription record
        now = timezone.now()
        sub, _ = Subscription.objects.get_or_create(user=user)
        sub.is_active = True
        sub.status = 'active'
        sub.auto_renew = True
        sub.current_period_start = now
        sub.current_period_end = now + timezone.timedelta(days=30)
        method_id = payment_obj.get('payment_method', {}).get('id', '')
        if method_id:
            sub.yookassa_payment_method_id = method_id
        sub.save()

        logger.info(f'Desktop payment succeeded for {user.email}')
        return Response({'status': 'ok'})
