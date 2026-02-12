"""Inline keyboard builders for the SimpleClaw Telegram bot."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def start_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton('🚀 Задеплоить', callback_data='deploy')],
    ])


def start_keyboard_with_profile():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton('👤 Профиль', callback_data='profile')],
        [InlineKeyboardButton('🔄 Задеплоить заново', callback_data='deploy')],
    ])


def deploying_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton('🔄 Проверить статус', callback_data='check_payment')],
    ])


def model_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(
            '⚡ Claude (Рекомендуем)',
            callback_data='model:claude-sonnet-4',
        )],
        [InlineKeyboardButton(
            '🧠 GPT',
            callback_data='model:gpt-4o',
        )],
        [InlineKeyboardButton(
            '💨 Gemini',
            callback_data='model:gemini-3-flash',
        )],
    ])


def token_cancel_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton('◀️ Отмена', callback_data='cancel_flow')],
    ])


def payment_keyboard(url):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton('💳 Оплатить', url=url)],
        [InlineKeyboardButton('✅ Проверить оплату', callback_data='check_payment')],
    ])


def check_payment_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton('✅ Проверить оплату', callback_data='check_payment')],
    ])


def profile_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton('❌ Отменить подписку', callback_data='cancel_sub')],
        [InlineKeyboardButton('◀️ Назад', callback_data='back_to_start')],
    ])


def profile_inactive_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton('🚀 Задеплоить', callback_data='deploy')],
    ])


def cancel_confirm_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton('❌ Да, отменить', callback_data='confirm_cancel')],
        [InlineKeyboardButton('◀️ Назад', callback_data='profile')],
    ])
