"""Management command to install/enable/disable/verify ClawdMatrix on servers."""
import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Manage ClawdMatrix Engine on active OpenClaw servers'

    def add_arguments(self, parser):
        parser.add_argument(
            'action',
            choices=['install', 'enable', 'disable', 'verify', 'update'],
            help='Action: install, enable, disable, verify, or update skills',
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
        parser.add_argument(
            '--all-users',
            action='store_true',
            help='For enable: enable on ALL servers regardless of profile setting',
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
                matrix = 'installed' if s.clawdmatrix_installed else 'not installed'
                enabled = ''
                if s.profile:
                    enabled = f', enabled={s.profile.clawdmatrix_enabled}'
                self.stdout.write(f'  {s.ip_address} — {profile_info} — {matrix}{enabled}')
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
                if action == 'install':
                    manager.connect()
                    manager.install_clawdmatrix()
                    success += 1
                    self.stdout.write(self.style.SUCCESS(f'  OK — installed'))

                elif action == 'enable':
                    manager.connect()
                    # Skip if profile doesn't have it enabled (unless --all-users)
                    if not options['all_users'] and server.profile and not server.profile.clawdmatrix_enabled:
                        self.stdout.write(f'  SKIP — clawdmatrix_enabled=False')
                        continue

                    if not server.clawdmatrix_installed:
                        manager.install_clawdmatrix()

                    custom_skills = None
                    if server.profile and server.profile.clawdmatrix_custom_skills:
                        custom_skills = server.profile.clawdmatrix_custom_skills

                    result = manager.enable_clawdmatrix(custom_skills=custom_skills)
                    if result:
                        success += 1
                        self.stdout.write(self.style.SUCCESS(f'  OK — enabled'))
                    else:
                        failed += 1
                        self.stdout.write(self.style.ERROR(f'  FAILED — enable returned False'))

                elif action == 'disable':
                    manager.connect()
                    manager.disable_clawdmatrix()
                    success += 1
                    self.stdout.write(self.style.SUCCESS(f'  OK — disabled'))

                elif action == 'verify':
                    manager.connect()
                    ok, failures = manager.verify_clawdmatrix()
                    if ok:
                        success += 1
                        self.stdout.write(self.style.SUCCESS(f'  OK — verified'))
                    else:
                        failed += 1
                        self.stdout.write(self.style.ERROR(
                            f'  FAILED — {", ".join(failures)}'
                        ))

                elif action == 'update':
                    manager.connect()
                    manager.update_clawdmatrix_skills()
                    success += 1
                    self.stdout.write(self.style.SUCCESS(f'  OK — updated'))

            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f'  FAILED — {e}'))
                logger.error(f'manage_clawdmatrix {action} failed on {server.ip_address}: {e}')
            finally:
                manager.disconnect()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Done: {success} succeeded, {failed} failed out of {total}'
        ))
