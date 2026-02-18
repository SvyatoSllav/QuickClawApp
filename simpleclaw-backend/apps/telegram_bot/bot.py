"""Core Telegram bot logic using python-telegram-bot v20+ async API."""

import logging

from django.conf import settings
from telegram import Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ConversationHandler,
    MessageHandler,
    filters,
)

from . import keyboards as kb
from . import messages as msg
from . import services

logger = logging.getLogger(__name__)

# Conversation states
WAITING_TOKEN = 0


# ---------------------------------------------------------------------------
# /start
# ---------------------------------------------------------------------------

async def start_handler(update: Update, context):
    """Handle /start command."""
    tg_user = update.effective_user
    tg_bot_user = await _sync(services.get_or_create_telegram_user, tg_user)

    # Check if user already has an active subscription
    if tg_bot_user.user:
        status = await _sync(services.check_deploy_status, tg_bot_user.user)

        if status['has_subscription'] and status['is_ready']:
            name = tg_user.first_name or tg_user.username or ''
            sub = tg_bot_user.user.subscription
            expires = sub.current_period_end.strftime('%d.%m.%Y') if sub.current_period_end else '—'
            await update.message.reply_text(
                msg.WELCOME_BACK.format(name=name, expires=expires),
                parse_mode='HTML',
                reply_markup=kb.start_keyboard_with_profile(),
            )
            return ConversationHandler.END

        if status['has_subscription'] and status['is_deploying']:
            name = tg_user.first_name or tg_user.username or ''
            await update.message.reply_text(
                msg.WELCOME_BACK_DEPLOYING.format(name=name),
                parse_mode='HTML',
                reply_markup=kb.deploying_keyboard(),
            )
            return ConversationHandler.END

    await update.message.reply_text(
        msg.WELCOME,
        parse_mode='HTML',
    )
    await update.message.reply_text(
        msg.WELCOME_DETAILS,
        parse_mode='HTML',
        reply_markup=kb.start_keyboard(),
    )
    return ConversationHandler.END


# ---------------------------------------------------------------------------
# Deploy flow
# ---------------------------------------------------------------------------

async def deploy_handler(update: Update, context):
    """Show model selection after user taps 'Задеплоить'."""
    query = update.callback_query
    await query.answer()

    await query.edit_message_text(
        msg.MODEL_QUESTION,
        parse_mode='HTML',
        reply_markup=kb.model_keyboard(),
    )
    return ConversationHandler.END


async def model_handler(update: Update, context):
    """Handle model selection callback."""
    query = update.callback_query
    await query.answer()

    model_id = query.data.split(':', 1)[1]
    tg_user = update.effective_user

    tg_bot_user = await _sync(services.get_or_create_telegram_user, tg_user)
    tg_bot_user.selected_model = model_id
    await _sync(_save_fields, tg_bot_user, ['selected_model'])

    # Also update profile model if exists
    if tg_bot_user.user:
        try:
            profile = tg_bot_user.user.profile
            profile.selected_model = model_id
            await _sync(_save_fields, profile, ['selected_model'])
        except Exception:
            pass

    model_name = msg.MODEL_DESCRIPTIONS.get(model_id, model_id)

    await query.edit_message_text(
        f'{msg.MODEL_SELECTED.format(model=model_name)}\n\n{msg.TOKEN_PROMPT}',
        parse_mode='HTML',
        reply_markup=kb.token_cancel_keyboard(),
    )
    return WAITING_TOKEN


async def token_handler(update: Update, context):
    """Handle bot token text input."""
    token = update.message.text.strip()
    tg_user = update.effective_user

    tg_bot_user = await _sync(services.get_or_create_telegram_user, tg_user)

    bot_data, error = await _sync(services.validate_and_save_token, tg_bot_user, token)

    if error:
        await update.message.reply_text(
            msg.TOKEN_INVALID_DETAIL.format(error=error),
            parse_mode='HTML',
            reply_markup=kb.token_cancel_keyboard(),
        )
        return WAITING_TOKEN

    username = bot_data.get('username', '')
    await update.message.reply_text(
        msg.TOKEN_VALID.format(username=username),
        parse_mode='HTML',
    )

    # Create payment
    payment_result = await _sync(services.create_payment_for_user, tg_bot_user)

    if not payment_result or 'confirmation_url' not in payment_result:
        await update.message.reply_text(
            msg.PAYMENT_CREATE_ERROR,
            parse_mode='HTML',
            reply_markup=kb.start_keyboard(),
        )
        return ConversationHandler.END

    await update.message.reply_text(
        msg.PAYMENT_PROMPT,
        parse_mode='HTML',
        reply_markup=kb.payment_keyboard(payment_result['confirmation_url']),
    )
    return ConversationHandler.END


async def cancel_flow_handler(update: Update, context):
    """Handle cancel during flow (e.g. cancel token input)."""
    query = update.callback_query
    await query.answer()

    await query.edit_message_text(
        msg.WELCOME,
        parse_mode='HTML',
        reply_markup=kb.start_keyboard(),
    )
    return ConversationHandler.END


# ---------------------------------------------------------------------------
# Payment check
# ---------------------------------------------------------------------------

async def check_payment_handler(update: Update, context):
    """Check payment and deploy status."""
    query = update.callback_query
    await query.answer(msg.PAYMENT_CHECKING)

    tg_user = update.effective_user
    tg_bot_user = await _sync(services.get_or_create_telegram_user, tg_user)

    if not tg_bot_user.user:
        await query.edit_message_text(
            msg.ERROR_GENERIC,
            parse_mode='HTML',
            reply_markup=kb.start_keyboard(),
        )
        return

    status = await _sync(services.check_deploy_status, tg_bot_user.user)

    if not status['has_subscription']:
        await query.edit_message_text(
            msg.PAYMENT_NOT_RECEIVED,
            parse_mode='HTML',
            reply_markup=kb.check_payment_keyboard(),
        )
        return

    if status['is_ready']:
        bot_username = status['bot_username'] or tg_bot_user.pending_bot_token.split(':')[0] if tg_bot_user.pending_bot_token else ''
        # Try to get the username from profile
        if tg_bot_user.user:
            try:
                bot_username = tg_bot_user.user.profile.telegram_bot_username or bot_username
            except Exception:
                pass

        await query.edit_message_text(
            msg.DEPLOY_READY.format(username=bot_username),
            parse_mode='HTML',
            reply_markup=kb.start_keyboard_with_profile(),
        )
        return

    if status['is_deploying']:
        await query.edit_message_text(
            msg.DEPLOY_IN_PROGRESS,
            parse_mode='HTML',
            reply_markup=kb.deploying_keyboard(),
        )
        return


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

async def profile_handler(update: Update, context):
    """Show user profile."""
    query = update.callback_query
    await query.answer()

    tg_user = update.effective_user
    tg_bot_user = await _sync(services.get_or_create_telegram_user, tg_user)

    if not tg_bot_user.user:
        await query.edit_message_text(
            msg.PROFILE_INACTIVE.format(header=msg.PROFILE_HEADER),
            parse_mode='HTML',
            reply_markup=kb.profile_inactive_keyboard(),
        )
        return

    profile_text = await _sync(services.format_profile_message, tg_bot_user.user)

    # Determine keyboard based on subscription status
    try:
        sub = tg_bot_user.user.subscription
        if sub.is_active:
            keyboard = kb.profile_keyboard()
        else:
            keyboard = kb.profile_inactive_keyboard()
    except Exception:
        keyboard = kb.profile_inactive_keyboard()

    await query.edit_message_text(
        profile_text,
        parse_mode='HTML',
        reply_markup=keyboard,
    )


async def profile_command(update: Update, context):
    """Handle /profile command."""
    tg_user = update.effective_user
    tg_bot_user = await _sync(services.get_or_create_telegram_user, tg_user)

    if not tg_bot_user.user:
        await update.message.reply_text(
            msg.PROFILE_INACTIVE.format(header=msg.PROFILE_HEADER),
            parse_mode='HTML',
            reply_markup=kb.profile_inactive_keyboard(),
        )
        return

    profile_text = await _sync(services.format_profile_message, tg_bot_user.user)

    try:
        sub = tg_bot_user.user.subscription
        if sub.is_active:
            keyboard = kb.profile_keyboard()
        else:
            keyboard = kb.profile_inactive_keyboard()
    except Exception:
        keyboard = kb.profile_inactive_keyboard()

    await update.message.reply_text(
        profile_text,
        parse_mode='HTML',
        reply_markup=keyboard,
    )


# ---------------------------------------------------------------------------
# Cancel subscription
# ---------------------------------------------------------------------------

async def cancel_sub_handler(update: Update, context):
    """Show cancel confirmation."""
    query = update.callback_query
    await query.answer()

    await query.edit_message_text(
        msg.CANCEL_CONFIRM,
        parse_mode='HTML',
        reply_markup=kb.cancel_confirm_keyboard(),
    )


async def confirm_cancel_handler(update: Update, context):
    """Execute subscription cancellation."""
    query = update.callback_query
    await query.answer()

    tg_user = update.effective_user
    tg_bot_user = await _sync(services.get_or_create_telegram_user, tg_user)

    if not tg_bot_user.user:
        await query.edit_message_text(
            msg.CANCEL_NO_SUB,
            parse_mode='HTML',
            reply_markup=kb.start_keyboard(),
        )
        return

    success, result_msg = await _sync(services.cancel_user_subscription, tg_bot_user.user)

    await query.edit_message_text(
        result_msg,
        parse_mode='HTML',
        reply_markup=kb.start_keyboard(),
    )


# ---------------------------------------------------------------------------
# Back to start
# ---------------------------------------------------------------------------

async def back_to_start_handler(update: Update, context):
    """Go back to start screen."""
    query = update.callback_query
    await query.answer()

    tg_user = update.effective_user
    tg_bot_user = await _sync(services.get_or_create_telegram_user, tg_user)

    if tg_bot_user.user:
        status = await _sync(services.check_deploy_status, tg_bot_user.user)
        if status['has_subscription']:
            await query.edit_message_text(
                msg.WELCOME,
                parse_mode='HTML',
                reply_markup=kb.start_keyboard_with_profile(),
            )
            return

    await query.edit_message_text(
        msg.WELCOME,
        parse_mode='HTML',
        reply_markup=kb.start_keyboard(),
    )


# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

async def help_handler(update: Update, context):
    """Handle /help command."""
    await update.message.reply_text(
        msg.HELP,
        parse_mode='HTML',
    )



# ---------------------------------------------------------------------------
# Pairing code approval
# ---------------------------------------------------------------------------

async def pairing_handler(update: Update, context):
    """Handle /pairing <code> command."""
    tg_user = update.effective_user
    tg_bot_user = await _sync(services.get_or_create_telegram_user, tg_user)

    if not tg_bot_user.user:
        await update.message.reply_text(msg.PAIRING_NO_SERVER, parse_mode='HTML')
        return

    args = context.args
    if not args:
        await update.message.reply_text(msg.PAIRING_USAGE, parse_mode='HTML')
        return

    code = args[0].strip()
    success, result = await _sync(services.approve_pairing_code, tg_bot_user.user, code)

    if success:
        await update.message.reply_text(msg.PAIRING_SUCCESS, parse_mode='HTML')
    else:
        await update.message.reply_text(
            msg.PAIRING_ERROR.format(error=result), parse_mode='HTML'
        )


# ---------------------------------------------------------------------------
# Application builder
# ---------------------------------------------------------------------------

def create_application():
    """Build and configure the Telegram bot Application."""
    token = settings.SIMPLECLAW_BOT_TOKEN
    if not token:
        raise RuntimeError('SIMPLECLAW_BOT_TOKEN is not set')

    application = Application.builder().token(token).build()

    # Conversation handler for the deploy flow (token input needs a text state)
    conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler('start', start_handler),
            CallbackQueryHandler(deploy_handler, pattern=r'^deploy$'),
            CallbackQueryHandler(model_handler, pattern=r'^model:'),
        ],
        states={
            WAITING_TOKEN: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, token_handler),
                CallbackQueryHandler(cancel_flow_handler, pattern=r'^cancel_flow$'),
            ],
        },
        fallbacks=[
            CommandHandler('start', start_handler),
            CallbackQueryHandler(cancel_flow_handler, pattern=r'^cancel_flow$'),
        ],
        allow_reentry=True,
        per_message=False,
    )

    application.add_handler(conv_handler)

    # Standalone callback handlers (outside conversation)
    application.add_handler(CallbackQueryHandler(check_payment_handler, pattern=r'^check_payment$'))
    application.add_handler(CallbackQueryHandler(profile_handler, pattern=r'^profile$'))
    application.add_handler(CallbackQueryHandler(cancel_sub_handler, pattern=r'^cancel_sub$'))
    application.add_handler(CallbackQueryHandler(confirm_cancel_handler, pattern=r'^confirm_cancel$'))
    application.add_handler(CallbackQueryHandler(back_to_start_handler, pattern=r'^back_to_start$'))

    # Command handlers
    application.add_handler(CommandHandler('profile', profile_command))
    application.add_handler(CommandHandler('help', help_handler))
    application.add_handler(CommandHandler('pairing', pairing_handler))

    return application


# ---------------------------------------------------------------------------
# Helpers — run sync Django ORM calls in the async context
# ---------------------------------------------------------------------------

async def _sync(func, *args, **kwargs):
    """Run a synchronous function in a thread executor."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: func(*args, **kwargs))


def _save_fields(obj, fields):
    """Helper to save specific fields on a model instance."""
    obj.save(update_fields=fields)
