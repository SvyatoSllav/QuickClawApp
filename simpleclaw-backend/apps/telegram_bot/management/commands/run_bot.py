"""Management command to run the SimpleClaw Telegram sales bot."""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Run the SimpleClaw Telegram sales bot'

    def handle(self, *args, **options):
        from apps.telegram_bot.bot import create_application

        self.stdout.write(self.style.SUCCESS('Starting SimpleClaw Telegram bot...'))

        app = create_application()
        app.run_polling(drop_pending_updates=True)
