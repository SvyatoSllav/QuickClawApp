"""Management command to deploy OpenClaw on a server for a user.
Runs as a separate process so it survives gunicorn worker recycling."""
import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Deploy OpenClaw on a server assigned to a user'

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=int)

    def handle(self, *args, **options):
        from apps.servers.services import assign_server_to_user_sync
        user_id = options['user_id']
        self.stdout.write(f'Starting deploy for user {user_id}...')
        assign_server_to_user_sync(user_id)
        self.stdout.write(self.style.SUCCESS(f'Deploy complete for user {user_id}'))
