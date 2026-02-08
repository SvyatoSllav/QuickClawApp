import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def process_subscription_renewals():
    """Celery-beat: автопродление подписок (запускается ежедневно)"""
    from .models import Subscription
    from .services import create_recurring_payment

    now = timezone.now()

    # Найти подписки с истекшим периодом и включённым автопродлением
    expired_subs = Subscription.objects.filter(
        is_active=True,
        auto_renew=True,
        current_period_end__lte=now,
        yookassa_payment_method_id__gt='',  # Есть сохранённый метод оплаты
    )

    for sub in expired_subs:
        try:
            logger.info(f'Автопродление для {sub.user.email}')
            create_recurring_payment(sub)
        except Exception as e:
            logger.error(f'Ошибка автопродления для {sub.user.email}: {e}')
            # Уведомить админа
            from apps.servers.tasks import notify_admin
            notify_admin.delay(f'Ошибка автопродления: {sub.user.email} — {e}')

    # Деактивировать подписки без автопродления
    cancelled_subs = Subscription.objects.filter(
        is_active=True,
        auto_renew=False,
        current_period_end__lte=now,
    )

    for sub in cancelled_subs:
        sub.is_active = False
        sub.status = 'expired'
        sub.save()

        profile = sub.user.profile
        profile.subscription_status = 'expired'
        profile.save()

        logger.info(f'Подписка истекла: {sub.user.email}')

        # Деактивировать сервер
        from apps.servers.tasks import deactivate_subscription
        deactivate_subscription.delay(sub.user.id)
