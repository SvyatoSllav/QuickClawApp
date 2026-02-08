"""Management command to process subscription renewals (replaces celery-beat task)."""
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Process subscription renewals and deactivate expired subscriptions'

    def handle(self, *args, **options):
        from apps.payments.models import Subscription
        from apps.payments.services import create_recurring_payment
        from apps.servers.services import deactivate_subscription_sync
        from apps.servers.tasks import send_telegram_message, ADMIN_TELEGRAM_ID

        now = timezone.now()

        # 1. Auto-renew expired subscriptions with saved payment method
        expired_subs = Subscription.objects.filter(
            is_active=True,
            auto_renew=True,
            current_period_end__lte=now,
            yookassa_payment_method_id__gt='',
        )

        renewed = 0
        errors = 0
        for sub in expired_subs:
            try:
                logger.info(f'Автопродление для {sub.user.email}')
                create_recurring_payment(sub)
                renewed += 1
            except Exception as e:
                errors += 1
                logger.error(f'Ошибка автопродления для {sub.user.email}: {e}')
                send_telegram_message(
                    ADMIN_TELEGRAM_ID,
                    f'🚨 Ошибка автопродления: {sub.user.email} — {e}'
                )

        # 2. Deactivate expired subscriptions without auto-renew
        cancelled_subs = Subscription.objects.filter(
            is_active=True,
            auto_renew=False,
            current_period_end__lte=now,
        )

        deactivated = 0
        for sub in cancelled_subs:
            sub.is_active = False
            sub.status = 'expired'
            sub.save()

            profile = sub.user.profile
            profile.subscription_status = 'expired'
            profile.save()

            logger.info(f'Подписка истекла: {sub.user.email}')
            deactivate_subscription_sync(sub.user.id)
            deactivated += 1

        summary = (
            f'process_renewals: renewed={renewed}, '
            f'errors={errors}, deactivated={deactivated}'
        )
        self.stdout.write(self.style.SUCCESS(summary))
        logger.info(summary)
