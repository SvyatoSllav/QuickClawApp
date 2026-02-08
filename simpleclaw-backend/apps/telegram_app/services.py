"""Валидация Telegram Bot Token через Telegram API"""
import logging
import requests

logger = logging.getLogger(__name__)


def validate_telegram_token(token):
    """Проверить токен через getMe и вернуть данные бота"""
    if not token or ':' not in token:
        return None, 'Невалидный формат токена'

    try:
        resp = requests.get(
            f'https://api.telegram.org/bot{token}/getMe',
            timeout=10,
        )

        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok'):
                bot = data['result']
                return {
                    'id': bot['id'],
                    'username': bot.get('username', ''),
                    'first_name': bot.get('first_name', ''),
                }, None

        return None, 'Невалидный токен бота'
    except requests.Timeout:
        return None, 'Timeout при проверке токена'
    except Exception as e:
        logger.error(f'Ошибка валидации Telegram токена: {e}')
        return None, str(e)
