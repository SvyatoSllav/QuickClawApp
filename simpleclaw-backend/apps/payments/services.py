import uuid
import logging
import subprocess
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from yookassa import Configuration, Payment as YooPayment

from .models import Payment, Subscription

logger = logging.getLogger(__name__)

Configuration.account_id = settings.YOOKASSA_SHOP_ID
Configuration.secret_key = settings.YOOKASSA_SECRET_KEY


def _notify_admin(message):
    """Send notification to admin via Telegram (sync, no Celery)."""
    from apps.servers.tasks import send_telegram_message, ADMIN_TELEGRAM_ID
    send_telegram_message(ADMIN_TELEGRAM_ID, f'🤖 SimpleClaw\n\n{message}')


def create_first_payment(user, telegram_token='', selected_model='claude-sonnet-4'):
    """Create first payment with optional recurring setup"""
    amount = str(settings.SUBSCRIPTION_PRICE_RUB)
    idempotence_key = str(uuid.uuid4())

    yoo_payment = YooPayment.create({
        'amount': {
            'value': amount,
            'currency': 'RUB',
        },
        'confirmation': {
            'type': 'redirect',
            'return_url': f'{settings.FRONTEND_URL}/?payment=success',
        },
        'capture': True,
        'save_payment_method': True,
        'description': f'Подписка SimpleClaw — {user.email}',
        'metadata': {
            'user_id': str(user.id),
            'telegram_token': telegram_token or '',
            'selected_model': selected_model or 'claude-opus-4.5',
        },
    }, idempotence_key)

    payment = Payment.objects.create(
        user=user,
        amount=Decimal(amount),
        status='pending',
        description='Подписка SimpleClaw',
        yookassa_payment_id=yoo_payment.id,
        yookassa_status=yoo_payment.status,
        is_recurring=False,
    )

    logger.info(f'Created payment {payment.id} for {user.email}, YooKassa ID: {yoo_payment.id}')

    return {
        'payment_id': payment.id,
        'confirmation_url': yoo_payment.confirmation.confirmation_url,
        'yookassa_id': yoo_payment.id,
    }


def create_recurring_payment(subscription):
    """Create recurring payment using saved payment method"""
    if not subscription.yookassa_payment_method_id:
        logger.error(f'No payment method for {subscription.user.email}')
        return None

    amount = str(settings.SUBSCRIPTION_PRICE_RUB)
    idempotence_key = str(uuid.uuid4())

    try:
        yoo_payment = YooPayment.create({
            'amount': {
                'value': amount,
                'currency': 'RUB',
            },
            'capture': True,
            'payment_method_id': subscription.yookassa_payment_method_id,
            'description': f'Продление подписки SimpleClaw — {subscription.user.email}',
            'metadata': {
                'user_id': str(subscription.user.id),
                'is_recurring': 'true',
            },
        }, idempotence_key)

        payment = Payment.objects.create(
            user=subscription.user,
            amount=Decimal(amount),
            status='pending',
            description='Продление подписки SimpleClaw',
            yookassa_payment_id=yoo_payment.id,
            yookassa_status=yoo_payment.status,
            is_recurring=True,
        )

        logger.info(f'Created recurring payment for {subscription.user.email}, YooKassa ID: {yoo_payment.id}')
        return payment

    except Exception as e:
        logger.error(f'Failed to create recurring payment for {subscription.user.email}: {e}')
        return None


def handle_payment_succeeded(yookassa_payment_id, payment_data):
    """Handle successful payment from YooKassa webhook"""
    try:
        payment = Payment.objects.get(yookassa_payment_id=yookassa_payment_id)
    except Payment.DoesNotExist:
        logger.error(f'Payment not found: {yookassa_payment_id}')
        return

    payment.status = 'succeeded'
    payment.yookassa_status = 'succeeded'
    payment.save()

    user = payment.user
    now = timezone.now()

    subscription, created = Subscription.objects.get_or_create(
        user=user,
        defaults={
            'is_active': True,
            'auto_renew': True,
            'status': 'active',
            'current_period_start': now,
            'current_period_end': now + timezone.timedelta(days=30),
        }
    )

    if not created:
        subscription.is_active = True
        subscription.auto_renew = True
        subscription.status = 'active'
        subscription.current_period_start = now
        subscription.current_period_end = now + timezone.timedelta(days=30)
        subscription.cancelled_at = None

    # Save payment method for recurring
    payment_method = payment_data.get('payment_method', {})
    if payment_method.get('saved') and payment_method.get('id'):
        subscription.yookassa_payment_method_id = payment_method['id']
        logger.info(f'Saved payment method {payment_method["id"]} for {user.email}')

    subscription.save()

    profile = user.profile
    profile.subscription_status = 'active'
    profile.subscription_started_at = now
    profile.subscription_expires_at = subscription.current_period_end

    # Save telegram token and model from payment metadata
    metadata = payment_data.get('metadata', {})
    telegram_token = metadata.get('telegram_token', '')
    selected_model = metadata.get('selected_model', 'claude-sonnet-4')

    if telegram_token:
        profile.telegram_bot_token = telegram_token
        logger.info(f'Saved telegram token for {user.email}')
    if selected_model:
        profile.selected_model = selected_model
        logger.info(f'Saved selected model {selected_model} for {user.email}')

    profile.save()

    logger.info(f'Payment {yookassa_payment_id} succeeded, subscription activated for {user.email}')

    # Check if user already has a server (recurring payment)
    if getattr(profile, "server", None):
        logger.info(f'Recurring payment for {user.email} - already has server {getattr(profile, "server").ip_address}')
        if profile.openrouter_key_id:
            from apps.servers.openrouter import enable_openrouter_key
            enable_openrouter_key(profile.openrouter_key_id)
            logger.info(f'Re-enabled OpenRouter key for {user.email}')
    else:
        # First payment - deploy in a separate process so it survives
        # gunicorn worker recycling (daemon threads get killed)
        import sys
        venv_python = sys.executable
        subprocess.Popen(
            [venv_python, 'manage.py', 'deploy_server', str(user.id)],
            cwd='/home/simpleclaw-backend',
            stdout=open('/var/log/simpleclaw-deploy.log', 'a'),
            stderr=subprocess.STDOUT,
            start_new_session=True,  # detach from parent process
        )
        logger.info(f'Spawned deploy_server process for user {user.id}')

    # Notify Telegram bot user about payment received
    try:
        tg_bot_user = user.telegram_bot_user
        from apps.telegram_bot.services import notify_user
        notify_user(
            tg_bot_user.chat_id,
            '✅ Оплата получена! Настраиваем ваш сервер...\n\n'
            'Это может занять от 30 секунд до нескольких минут.',
        )
    except Exception:
        pass  # User may not be a Telegram bot user


def handle_payment_canceled(yookassa_payment_id):
    """Handle canceled/failed payment"""
    try:
        payment = Payment.objects.get(yookassa_payment_id=yookassa_payment_id)
        payment.status = 'canceled'
        payment.yookassa_status = 'canceled'
        payment.save()

        logger.info(f'Payment {yookassa_payment_id} canceled for {payment.user.email}')
    except Payment.DoesNotExist:
        logger.error(f'Payment not found for cancel: {yookassa_payment_id}')


def cancel_subscription(user, immediate=False):
    """
    Cancel user subscription.

    Args:
        user: Django User object
        immediate: If True, deactivate immediately. If False, cancel at period end.
    """
    try:
        subscription = user.subscription
    except Subscription.DoesNotExist:
        return {'error': 'Подписка не найдена', 'code': 'not_found'}

    if not subscription.is_active:
        return {'error': 'Подписка уже неактивна', 'code': 'already_inactive'}

    now = timezone.now()
    profile = user.profile

    if immediate:
        subscription.is_active = False
        subscription.auto_renew = False
        subscription.status = 'cancelled'
        subscription.cancelled_at = now
        subscription.save()

        profile.subscription_status = 'cancelled'
        profile.save()

        # Disable OpenRouter key
        if profile.openrouter_key_id:
            from apps.servers.openrouter import disable_openrouter_key
            disable_openrouter_key(profile.openrouter_key_id)
            logger.info(f'Disabled OpenRouter key for {user.email} (immediate cancel)')

        _notify_admin(f'Немедленная отмена подписки: {user.email}')

        return {
            'status': 'cancelled',
            'message': 'Подписка отменена немедленно',
            'deactivated_at': now.isoformat(),
        }
    else:
        subscription.auto_renew = False
        subscription.cancelled_at = now
        subscription.save()

        profile.subscription_status = 'active'
        profile.save()

        _notify_admin(
            f'Отмена автопродления: {user.email}\n'
            f'Активна до: {subscription.current_period_end}'
        )

        return {
            'status': 'cancelled_pending',
            'message': 'Автопродление отменено. Подписка активна до конца периода.',
            'active_until': subscription.current_period_end.isoformat(),
            'cancelled_at': now.isoformat(),
        }


def reactivate_subscription(user):
    """Re-enable auto-renewal for cancelled subscription"""
    try:
        subscription = user.subscription
    except Subscription.DoesNotExist:
        return {'error': 'Подписка не найдена', 'code': 'not_found'}

    if not subscription.is_active:
        return {'error': 'Подписка истекла. Оформите новую.', 'code': 'expired'}

    if subscription.auto_renew:
        return {'error': 'Автопродление уже включено', 'code': 'already_active'}

    subscription.auto_renew = True
    subscription.cancelled_at = None
    subscription.save()

    _notify_admin(f'Возобновление автопродления: {user.email}')

    return {
        'status': 'reactivated',
        'message': 'Автопродление включено',
        'next_payment': subscription.current_period_end.isoformat(),
    }
