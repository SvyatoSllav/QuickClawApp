"""Management command to warm-deploy OpenClaw on all unwarmed pool servers."""
import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Warm-deploy OpenClaw on pool servers that have openclaw_running=False'

    def add_arguments(self, parser):
        parser.add_argument(
            '--server-ip',
            type=str,
            help='Only warm a specific server by IP address',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List servers that would be warmed without making changes',
        )

    def handle(self, *args, **options):
        from apps.servers.models import Server
        from apps.servers.services import ServerManager

        filters = {
            'status': 'active',
            'openclaw_running': False,
            'profile__isnull': True,  # Only unassigned pool servers
        }
        if options['server_ip']:
            filters['ip_address'] = options['server_ip']

        servers = Server.objects.filter(**filters)
        total = servers.count()
        self.stdout.write(f'Found {total} unwarmed pool server(s)')

        if options['dry_run']:
            for s in servers:
                self.stdout.write(f'  {s.ip_address}')
            return

        success = 0
        failed = 0

        for server in servers:
            self.stdout.write(f'[{success + failed + 1}/{total}] Warming {server.ip_address}...')

            manager = ServerManager(server)
            try:
                result = manager.warm_deploy_standby()
                if result:
                    success += 1
                    self.stdout.write(self.style.SUCCESS(f'  OK — {server.ip_address}'))
                else:
                    failed += 1
                    self.stdout.write(self.style.ERROR(f'  FAILED — {server.ip_address}'))
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f'  FAILED — {server.ip_address}: {e}'))
                logger.error(f'warm_pool_servers failed on {server.ip_address}: {e}')
            finally:
                manager.disconnect()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Done: {success} warmed, {failed} failed out of {total}'))
