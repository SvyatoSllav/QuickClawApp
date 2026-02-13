"""Management command to install/verify/reconfigure SearXNG + Lightpanda on servers."""
import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Manage SearXNG search engine and Lightpanda browser on active OpenClaw servers'

    def add_arguments(self, parser):
        parser.add_argument(
            'action',
            choices=['install', 'verify', 'reconfigure'],
            help='Action: install, verify, or reconfigure SearXNG + Lightpanda',
        )
        parser.add_argument(
            '--server-ip',
            type=str,
            help='Target a specific server by IP address',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List servers that would be affected without making changes',
        )

    def handle(self, *args, **options):
        from apps.servers.models import Server
        from apps.servers.services import ServerManager

        action = options['action']

        filters = {
            'status': 'active',
            'openclaw_running': True,
        }
        if options['server_ip']:
            filters['ip_address'] = options['server_ip']

        servers = Server.objects.filter(**filters)
        total = servers.count()
        self.stdout.write(f'Found {total} active server(s)')

        if options['dry_run']:
            for s in servers:
                profile_info = f'{s.profile.user.email}' if s.profile else 'pool'
                self.stdout.write(f'  {s.ip_address} — {profile_info}')
            return

        success = 0
        failed = 0

        for server in servers:
            label = server.ip_address
            if server.profile:
                label += f' ({server.profile.user.email})'

            self.stdout.write(f'[{success + failed + 1}/{total}] {action} on {label}...')

            manager = ServerManager(server)
            try:
                manager.connect()

                if action == 'install':
                    result = manager.install_searxng()
                    if result:
                        success += 1
                        self.stdout.write(self.style.SUCCESS(f'  OK — installed'))
                    else:
                        failed += 1
                        self.stdout.write(self.style.ERROR(f'  FAILED — install returned False'))

                elif action == 'verify':
                    ok, failures = manager.verify_searxng()
                    if ok:
                        success += 1
                        self.stdout.write(self.style.SUCCESS(f'  OK — verified'))
                    else:
                        failed += 1
                        self.stdout.write(self.style.ERROR(
                            f'  FAILED — {", ".join(failures)}'
                        ))

                elif action == 'reconfigure':
                    manager._upload_searxng_settings()
                    path = server.openclaw_path
                    manager.exec_command(
                        f'cd {path} && docker compose restart searxng'
                    )
                    manager.configure_searxng_provider()
                    manager.configure_lightpanda_browser()
                    success += 1
                    self.stdout.write(self.style.SUCCESS(f'  OK — reconfigured'))

            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f'  FAILED — {e}'))
                logger.error(f'manage_searxng {action} failed on {server.ip_address}: {e}')
            finally:
                manager.disconnect()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Done: {success} succeeded, {failed} failed out of {total}'
        ))
