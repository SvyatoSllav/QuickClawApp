"""Business logic for the SimpleClaw Telegram bot."""

import logging
import requests
from django.conf import settings
from django.contrib.auth.models import User

from apps.accounts.models import UserProfile
from apps.telegram_app.services import validate_telegram_token
from apps.payments.services import create_first_payment, cancel_subscription

from .models import TelegramBotUser

logger = logging.getLogger(__name__)


def get_or_create_telegram_user(tg_user):
    """
    Create or update TelegramBotUser from a telegram.User object.
    Also creates Django User + UserProfile if needed.

    Returns TelegramBotUser instance.
    """
    tg_bot_user, created = TelegramBotUser.objects.update_or_create(
        telegram_id=tg_user.id,
        defaults={
            'chat_id': tg_user.id,
            'username': tg_user.username or '',
            'first_name': tg_user.first_name or '',
            'last_name': tg_user.last_name or '',
        },
    )

    if created:
        logger.info(f'New Telegram bot user: {tg_user.id} (@{tg_user.username})')

    # Ensure Django User + UserProfile exist
    if tg_bot_user.user is None:
        django_user, user_created = User.objects.get_or_create(
            username=f'tg_{tg_user.id}',
            defaults={
                'email': f'tg_{tg_user.id}@telegram.user',
                'first_name': tg_user.first_name or '',
                'last_name': tg_user.last_name or '',
            },
        )
        tg_bot_user.user = django_user
        tg_bot_user.save(update_fields=['user'])

        # Ensure UserProfile exists
        UserProfile.objects.get_or_create(user=django_user)

        if user_created:
            logger.info(f'Created Django user {django_user.username} for TG:{tg_user.id}')
    else:
        # Ensure profile exists for existing users too
        UserProfile.objects.get_or_create(user=tg_bot_user.user)

    return tg_bot_user


def validate_and_save_token(tg_bot_user, token):
    """
    Validate a bot token and save it to the TelegramBotUser.
    Returns (bot_data, error).
    """
    bot_data, error = validate_telegram_token(token)
    if error:
        return None, error

    tg_bot_user.pending_bot_token = token
    tg_bot_user.save(update_fields=['pending_bot_token'])

    # Also save to the user's profile
    if tg_bot_user.user:
        profile = tg_bot_user.user.profile
        profile.telegram_bot_token = token
        profile.telegram_bot_username = bot_data.get('username', '')
        profile.telegram_bot_validated = True
        profile.save(update_fields=[
            'telegram_bot_token',
            'telegram_bot_username',
            'telegram_bot_validated',
        ])

    return bot_data, None


def create_payment_for_user(tg_bot_user):
    """
    Create a YooKassa payment for a Telegram bot user.
    Uses test YooKassa credentials if configured (for testing).
    Returns {'confirmation_url': ...} or None on error.
    """
    if not tg_bot_user.user:
        return None

    try:
        # Use test YooKassa credentials if available
        from yookassa import Configuration
        original_shop_id = Configuration.account_id
        original_secret_key = Configuration.secret_key

        test_shop_id = getattr(settings, 'YOOKASSA_TEST_SHOP_ID', '')
        test_secret_key = getattr(settings, 'YOOKASSA_TEST_SECRET_KEY', '')

        if test_shop_id and test_secret_key:
            Configuration.account_id = test_shop_id
            Configuration.secret_key = test_secret_key
            logger.info(f'Using test YooKassa credentials for TG:{tg_bot_user.telegram_id}')

        try:
            result = create_first_payment(
                user=tg_bot_user.user,
                telegram_token=tg_bot_user.pending_bot_token,
                selected_model=tg_bot_user.selected_model,
            )
        finally:
            # Restore original credentials
            Configuration.account_id = original_shop_id
            Configuration.secret_key = original_secret_key

        logger.info(
            f'Payment created for TG:{tg_bot_user.telegram_id}, '
            f'URL: {result.get("confirmation_url", "N/A")}'
        )
        return result
    except Exception as e:
        logger.error(f'Payment creation failed for TG:{tg_bot_user.telegram_id}: {e}')
        return None


def check_deploy_status(user):
    """
    Check the subscription and server deployment status.
    Returns dict with keys: has_subscription, is_deploying, is_ready, bot_username.
    """
    result = {
        'has_subscription': False,
        'is_deploying': False,
        'is_ready': False,
        'bot_username': '',
    }

    try:
        sub = user.subscription
        result['has_subscription'] = sub.is_active
    except Exception:
        return result

    try:
        profile = user.profile
        server = getattr(profile, 'server', None)
        result['bot_username'] = profile.telegram_bot_username or ''

        if server:
            result['is_ready'] = server.openclaw_running
            result['is_deploying'] = not server.openclaw_running
        elif result['has_subscription']:
            # Subscription active but no server yet — deploying
            result['is_deploying'] = True
    except Exception:
        pass

    return result


def format_profile_message(user):
    """Build a profile message string for the user."""
    from . import messages as msg

    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        return msg.PROFILE_INACTIVE.format(header=msg.PROFILE_HEADER)

    try:
        sub = user.subscription
    except Exception:
        return msg.PROFILE_INACTIVE.format(header=msg.PROFILE_HEADER)

    if not sub.is_active:
        return msg.PROFILE_INACTIVE.format(header=msg.PROFILE_HEADER)

    expires = sub.current_period_end.strftime('%d.%m.%Y') if sub.current_period_end else '—'
    model = profile.selected_model or 'claude-sonnet-4'
    used = f'{profile.tokens_used_usd:.4f}'
    limit = f'{profile.token_limit_usd:.0f}'

    if not sub.auto_renew:
        return msg.PROFILE_CANCELLING.format(
            header=msg.PROFILE_HEADER,
            model=model,
            expires=expires,
            used=used,
            limit=limit,
        )

    return msg.PROFILE_ACTIVE.format(
        header=msg.PROFILE_HEADER,
        model=model,
        expires=expires,
        used=used,
        limit=limit,
    )


def cancel_user_subscription(user):
    """Cancel subscription for user. Returns (success, message)."""
    from . import messages as msg

    try:
        result = cancel_subscription(user)
    except Exception as e:
        return False, msg.CANCEL_ERROR.format(error=str(e))

    if 'error' in result:
        if result.get('code') == 'not_found':
            return False, msg.CANCEL_NO_SUB
        return False, msg.CANCEL_ERROR.format(error=result['error'])

    expires = result.get('active_until', '')
    if expires:
        # Parse ISO date to dd.mm.yyyy
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(expires)
            expires = dt.strftime('%d.%m.%Y')
        except Exception:
            pass

    return True, msg.CANCEL_SUCCESS.format(expires=expires)


def notify_user(chat_id, text):
    """Send a message to a Telegram user via the bot API."""
    token = settings.SIMPLECLAW_BOT_TOKEN
    if not token:
        logger.warning('SIMPLECLAW_BOT_TOKEN not set, cannot notify user')
        return False

    try:
        resp = requests.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'HTML',
            },
            timeout=10,
        )
        return resp.status_code == 200
    except Exception as e:
        logger.error(f'Failed to notify TG chat {chat_id}: {e}')
        return False
