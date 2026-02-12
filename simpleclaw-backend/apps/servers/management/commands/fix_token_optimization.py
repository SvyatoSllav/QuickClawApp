"""Management command to apply token optimization config to all active OpenClaw servers."""
import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Apply token optimization settings to all active servers with OpenClaw running'

    def add_arguments(self, parser):
        parser.add_argument(
            '--server-ip',
            type=str,
            help='Only fix a specific server by IP address',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List servers that would be fixed without applying changes',
        )

    def handle(self, *args, **options):
        from apps.servers.models import Server
        from apps.servers.services import ServerManager

        filters = {'status': 'active', 'openclaw_running': True}
        if options['server_ip']:
            filters['ip_address'] = options['server_ip']

        servers = Server.objects.filter(**filters)
        total = servers.count()
        self.stdout.write(f'Found {total} active server(s) with OpenClaw running')

        if options['dry_run']:
            for s in servers:
                user_email = s.profile.user.email if s.profile else 'unassigned'
                self.stdout.write(f'  {s.ip_address} — {user_email} — model: {s.profile.selected_model if s.profile else "N/A"}')
            return

        success = 0
        failed = 0

        for server in servers:
            user_email = server.profile.user.email if server.profile else 'unassigned'
            model_slug = server.profile.selected_model if server.profile else 'claude-opus-4.5'
            self.stdout.write(f'[{success + failed + 1}/{total}] Fixing {server.ip_address} ({user_email})...')

            manager = ServerManager(server)
            try:
                manager.connect()
                manager.configure_token_optimization(model_slug)
                # Restart container so config takes effect
                path = server.openclaw_path
                manager.exec_command(f'cd {path} && docker compose restart')
                success += 1
                self.stdout.write(self.style.SUCCESS(f'  OK — {server.ip_address}'))
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f'  FAILED — {server.ip_address}: {e}'))
                logger.error(f'fix_token_optimization failed on {server.ip_address}: {e}')
            finally:
                manager.disconnect()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Done: {success} fixed, {failed} failed out of {total}'))
