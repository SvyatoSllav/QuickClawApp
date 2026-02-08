"""Управление API-ключами OpenRouter через Provisioning API"""
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'


def create_openrouter_key(user_email, limit_usd=15.0):
    """Создать API-ключ OpenRouter с лимитом и ежемесячным сбросом"""
    admin_key = settings.OPENROUTER_ADMIN_KEY
    if not admin_key:
        logger.warning('OPENROUTER_ADMIN_KEY не установлен')
        return None, None

    try:
        resp = requests.post(
            f'{OPENROUTER_API_BASE}/keys',
            headers={
                'Authorization': f'Bearer {admin_key}',
                'Content-Type': 'application/json',
            },
            json={
                'name': f'SimpleClaw — {user_email}',
                'limit': limit_usd,
                'limit_reset': 'monthly',  # Auto-reset usage on 1st of each month
            },
            timeout=15,
        )

        if resp.status_code in (200, 201):
            data = resp.json()
            key = data.get('key', data.get('data', {}).get('key', ''))
            key_hash = data.get('data', {}).get('hash', '')
            logger.info(f'Создан OpenRouter ключ для {user_email}: hash={key_hash[:16]}...')
            return key, key_hash
        else:
            logger.error(f'Ошибка создания ключа OpenRouter: {resp.status_code} {resp.text}')
            return None, None
    except Exception as e:
        logger.error(f'Исключение при создании ключа OpenRouter: {e}')
        return None, None


def get_key_info(key_hash):
    """Get key info by hash via admin API"""
    admin_key = settings.OPENROUTER_ADMIN_KEY
    if not admin_key or not key_hash:
        return None

    try:
        resp = requests.get(
            f'{OPENROUTER_API_BASE}/keys/{key_hash}',
            headers={'Authorization': f'Bearer {admin_key}'},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json().get('data', {})
        return None
    except Exception:
        return None


def enable_monthly_reset(key_hash):
    """Enable monthly usage reset for existing key"""
    admin_key = settings.OPENROUTER_ADMIN_KEY
    if not admin_key or not key_hash:
        return False

    try:
        resp = requests.patch(
            f'{OPENROUTER_API_BASE}/keys/{key_hash}',
            headers={
                'Authorization': f'Bearer {admin_key}',
                'Content-Type': 'application/json',
            },
            json={
                'limit_reset': 'monthly',
            },
            timeout=15,
        )
        if resp.status_code in (200, 204):
            logger.info(f'Enabled monthly reset for key {key_hash[:16]}...')
            return True
        else:
            logger.error(f'Failed to enable monthly reset: {resp.status_code} {resp.text}')
            return False
    except Exception as e:
        logger.error(f'Exception enabling monthly reset: {e}')
        return False


def revoke_openrouter_key(key_id):
    """Отозвать (удалить) API-ключ OpenRouter"""
    admin_key = settings.OPENROUTER_ADMIN_KEY
    if not admin_key or not key_id:
        return False

    try:
        resp = requests.delete(
            f'{OPENROUTER_API_BASE}/keys/{key_id}',
            headers={'Authorization': f'Bearer {admin_key}'},
            timeout=15,
        )
        if resp.status_code in (200, 204):
            logger.info(f'Ключ OpenRouter {key_id[:16]}... отозван')
            return True
        else:
            logger.error(f'Ошибка отзыва ключа OpenRouter: {resp.status_code}')
            return False
    except Exception as e:
        logger.error(f'Исключение при отзыве ключа: {e}')
        return False


def check_key_usage(api_key):
    """Проверить использование ключа через OpenRouter API"""
    if not api_key:
        return None

    try:
        resp = requests.get(
            f'{OPENROUTER_API_BASE}/key',
            headers={'Authorization': f'Bearer {api_key}'},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json().get('data', {})
        return None
    except Exception:
        return None


def reset_key_limit(key_hash, limit_usd=15.0):
    """Reset key limit (for manual reset if needed)"""
    admin_key = settings.OPENROUTER_ADMIN_KEY
    if not admin_key or not key_hash:
        return False

    try:
        resp = requests.patch(
            f'{OPENROUTER_API_BASE}/keys/{key_hash}',
            headers={
                'Authorization': f'Bearer {admin_key}',
                'Content-Type': 'application/json',
            },
            json={
                'limit': limit_usd,
                'limit_reset': 'monthly',
            },
            timeout=15,
        )
        if resp.status_code in (200, 204):
            logger.info(f'Reset key {key_hash[:16]}... limit to ${limit_usd}')
            return True
        else:
            logger.error(f'Failed to reset key: {resp.status_code} {resp.text}')
            return False
    except Exception as e:
        logger.error(f'Exception resetting key: {e}')
        return False


def disable_openrouter_key(key_id):
    """Disable an OpenRouter key"""
    admin_key = settings.OPENROUTER_ADMIN_KEY
    if not admin_key or not key_id:
        return False

    try:
        resp = requests.patch(
            f'{OPENROUTER_API_BASE}/keys/{key_id}',
            headers={
                'Authorization': f'Bearer {admin_key}',
                'Content-Type': 'application/json',
            },
            json={'disabled': True},
            timeout=15,
        )
        if resp.status_code in (200, 204):
            logger.info(f'Disabled OpenRouter key {key_id[:16]}...')
            return True
        else:
            logger.error(f'Failed to disable key: {resp.status_code} {resp.text}')
            return False
    except Exception as e:
        logger.error(f'Exception disabling key: {e}')
        return False


def enable_openrouter_key(key_id):
    """Re-enable a disabled OpenRouter key"""
    admin_key = settings.OPENROUTER_ADMIN_KEY
    if not admin_key or not key_id:
        return False

    try:
        resp = requests.patch(
            f'{OPENROUTER_API_BASE}/keys/{key_id}',
            headers={
                'Authorization': f'Bearer {admin_key}',
                'Content-Type': 'application/json',
            },
            json={'disabled': False},
            timeout=15,
        )
        if resp.status_code in (200, 204):
            logger.info(f'Enabled OpenRouter key {key_id[:16]}...')
            return True
        else:
            logger.error(f'Failed to enable key: {resp.status_code} {resp.text}')
            return False
    except Exception as e:
        logger.error(f'Exception enabling key: {e}')
        return False
