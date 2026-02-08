"""Celery tasks for server management"""
import logging
import time
import requests
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)

# Admin Telegram ID for error reports
ADMIN_TELEGRAM_ID = 997273934


def send_telegram_message(chat_id, message, bot_token=None):
    """Send a Telegram message"""
    if not bot_token:
        bot_token = getattr(settings, 'ADMIN_TELEGRAM_BOT_TOKEN', None)
    
    if not bot_token:
        logger.warning(f'No bot token for Telegram: {message}')
        return False
    
    try:
        resp = requests.post(
            f'https://api.telegram.org/bot{bot_token}/sendMessage',
            json={
                'chat_id': chat_id,
                'text': message,
                'parse_mode': 'HTML',
            },
            timeout=10,
        )
        return resp.status_code == 200
    except Exception as e:
        logger.error(f'Telegram send error: {e}')
        return False


@shared_task
def notify_admin(message):
    """Send notification to admin via Telegram"""
    send_telegram_message(ADMIN_TELEGRAM_ID, f'🤖 SimpleClaw\n\n{message}')


@shared_task
def notify_error(error_type, details):
    """Send detailed error report to admin"""
    message = (
        f'🚨 <b>ERROR REPORT</b>\n\n'
        f'<b>Type:</b> {error_type}\n\n'
        f'<b>Details:</b>\n<pre>{details}</pre>\n\n'
        f'<b>Time:</b> {time.strftime("%Y-%m-%d %H:%M:%S UTC")}'
    )
    send_telegram_message(ADMIN_TELEGRAM_ID, message)


# ============== SERVER CLEANUP ==============

@shared_task
def cleanup_error_servers():
    """Delete error servers from TimeWeb and database.
    Run every 10 minutes via celery beat.
    Also cleans up stuck 'provisioning' servers older than 30 minutes.
    """
    from .models import Server
    from .timeweb import delete_server
    from django.utils import timezone
    from datetime import timedelta
    
    # Clean error servers
    error_servers = list(Server.objects.filter(status='error', profile__isnull=True))  # ONLY pool servers
    
    # Also clean stuck provisioning/creating servers older than 30 min
    stuck_threshold = timezone.now() - timedelta(minutes=30)
    stuck_servers = list(Server.objects.filter(
        status__in=['provisioning', 'creating'],
        updated_at__lt=stuck_threshold,
        profile__isnull=True,  # Only pool servers
    ))
    
    # Combine and deduplicate
    seen_ids = set()
    servers_to_clean = []
    for s in error_servers + stuck_servers:
        if s.id not in seen_ids:
            seen_ids.add(s.id)
            servers_to_clean.append(s)
    
    if not servers_to_clean:
        return
    
    logger.info(f'Cleaning up {len(servers_to_clean)} problem server(s)...')
    
    deleted_count = 0
    errors = []
    
    for server in servers_to_clean:
        tw_id = server.timeweb_server_id
        ip = server.ip_address or 'NO IP'
        error_msg = server.last_error or 'Unknown error'
        
        logger.info(f'Deleting error server ID:{server.id} TW:{tw_id} IP:{ip}')
        
        # Delete from TimeWeb
        if tw_id:
            try:
                result = delete_server(tw_id)
                if not result:
                    errors.append(f'TimeWeb delete failed for {tw_id}')
            except Exception as e:
                errors.append(f'TimeWeb exception for {tw_id}: {e}')
        
        # Delete from database
        server.delete()
        deleted_count += 1
        time.sleep(0.5)
    
    # Report
    if deleted_count > 0:
        report = f'🧹 Cleaned up {deleted_count} error server(s)'
        if errors:
            report += f'\n\n⚠️ Warnings:\n' + '\n'.join(errors)
        notify_admin.delay(report)


# ============== SERVER POOL MANAGEMENT ==============

MIN_AVAILABLE_SERVERS = 5
MAX_TOTAL_SERVERS = 10
MAX_RETRY_ATTEMPTS = 3


@shared_task
def ensure_server_pool():
    """Ensure there are always MIN_AVAILABLE_SERVERS unassigned ready servers.
    Run this every 5 minutes via celery beat.
    """
    from .models import Server

    # First cleanup any error servers
    cleanup_error_servers.delay()

    # Count available (unassigned, active) servers
    in_progress = Server.objects.filter(
        status__in=['creating', 'provisioning'],
        profile__isnull=True,
    ).count()
    available = Server.objects.filter(
        status='active',
        profile__isnull=True,
    ).count()

    total_pool = available + in_progress
    total_servers = Server.objects.exclude(status='error').count()
    
    logger.info(f'Server pool: {available} active, {in_progress} in progress, {total_servers} total')

    # Hard limit
    if total_servers >= MAX_TOTAL_SERVERS:
        logger.warning(f'Total servers ({total_servers}) >= MAX ({MAX_TOTAL_SERVERS})')
        return

    if total_pool < MIN_AVAILABLE_SERVERS:
        needed = MIN_AVAILABLE_SERVERS - total_pool
        logger.info(f'Creating {needed} new standby server(s)...')
        notify_admin.delay(f'📦 Pool: {available} available. Creating {needed} new server(s).')
        
        for i in range(needed):
            create_standby_server_with_retry.delay()


@shared_task(bind=True, max_retries=MAX_RETRY_ATTEMPTS)
def create_standby_server_with_retry(self):
    """Create a server for the pool with automatic retry on failure."""
    from .models import Server
    from .timeweb import create_server, wait_for_server_ready, delete_server
    
    # Hard limit check
    total = Server.objects.exclude(status='error').count()
    if total >= MAX_TOTAL_SERVERS:
        logger.warning(f'Cannot create: total ({total}) >= MAX ({MAX_TOTAL_SERVERS})')
        return

    server_name = f'openclaw-pool-{int(time.time())}'
    attempt = self.request.retries + 1
    
    server_record = Server.objects.create(
        profile=None,
        status='creating',
    )

    logger.info(f'Creating standby server: {server_name} (attempt {attempt}/{MAX_RETRY_ATTEMPTS})')

    try:
        tw_result = create_server(server_name, 'pool@simpleclaw.com')
        
        if not tw_result:
            raise Exception('TimeWeb API returned empty result')

        server_record.timeweb_server_id = tw_result.get('id', '')
        server_record.ssh_password = tw_result.get('root_pass', '')
        server_record.save()

        # Wait for server to be ready
        logger.info(f'Waiting for server {tw_result['id']}...')
        ready_info = wait_for_server_ready(tw_result['id'], max_wait=300)
        
        if not ready_info:
            raise Exception(f'Server creation timeout. TW ID: {tw_result.get('id')}')

        # Check for valid IPv4
        ip = ready_info.get('ip', '')
        if not ip or ':' in ip:  # IPv6 only
            raise Exception(f'No valid IPv4 address. Got: {ip}')

        server_record.ip_address = ip
        if ready_info.get('root_pass'):
            server_record.ssh_password = ready_info['root_pass']
        server_record.status = 'provisioning'
        server_record.save()

        logger.info(f'Server ready: {ip}, installing Docker...')
        setup_standby_server.delay(server_record.id)

    except Exception as e:
        error_msg = str(e)
        logger.error(f'Server creation failed (attempt {attempt}): {error_msg}')
        
        # Cleanup failed server from TimeWeb
        if server_record.timeweb_server_id:
            try:
                delete_server(server_record.timeweb_server_id)
                logger.info(f'Deleted failed server from TimeWeb: {server_record.timeweb_server_id}')
            except:
                pass
        
        # Delete record
        server_record.delete()
        
        # Notify and retry
        if attempt < MAX_RETRY_ATTEMPTS:
            notify_error.delay(
                'Server Creation Failed - Retrying',
                f'Attempt: {attempt}/{MAX_RETRY_ATTEMPTS}\n'
                f'Server: {server_name}\n'
                f'Error: {error_msg}\n'
                f'Action: Retrying in 60 seconds...'
            )
            raise self.retry(exc=e, countdown=60)
        else:
            notify_error.delay(
                'Server Creation Failed - MAX RETRIES EXCEEDED',
                f'Attempts: {MAX_RETRY_ATTEMPTS}/{MAX_RETRY_ATTEMPTS}\n'
                f'Server: {server_name}\n'
                f'Error: {error_msg}\n'
                f'Action: Manual intervention required!'
            )


@shared_task(bind=True, max_retries=MAX_RETRY_ATTEMPTS)
def setup_standby_server(self, server_id):
    """Install Docker and prepare server for OpenClaw deployment."""
    from .models import Server
    from .services import ServerManager
    from .timeweb import delete_server

    try:
        server = Server.objects.get(id=server_id)
    except Server.DoesNotExist:
        logger.error(f'Server {server_id} not found')
        return

    attempt = self.request.retries + 1
    manager = ServerManager(server)

    try:
        # Wait for SSH (90s to ensure server is ready)
        time.sleep(90)
        manager.connect()

        # Install Docker
        logger.info(f'Installing Docker on {server.ip_address} (attempt {attempt})...')
        commands = [
            'apt-get update -y',
            'apt-get install -y apt-transport-https ca-certificates curl software-properties-common',
            'curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh',
            'systemctl enable docker && systemctl start docker',
            'curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-Linux-x86_64 -o /usr/local/bin/docker-compose',
            'chmod +x /usr/local/bin/docker-compose',
        ]
        
        for cmd in commands:
            out, err, code = manager.exec_command(cmd)
            if code != 0 and 'docker' in cmd.lower():
                raise Exception(f'Critical command failed: {cmd}\nError: {err}')

        # Verify Docker works
        out, err, code = manager.exec_command('docker --version')
        if code != 0:
            raise Exception(f'Docker not working: {err}')

        # Create OpenClaw directory
        manager.exec_command(f'mkdir -p {server.openclaw_path}')

        docker_compose = '''version: '3.8'
services:
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    container_name: openclaw
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./openclaw-config.yaml:/app/config.yaml
      - ./data:/app/data
'''
        manager.upload_file(docker_compose, f'{server.openclaw_path}/docker-compose.yml')

        # Mark as active
        server.status = 'active'
        server.last_error = ''
        server.save()

        logger.info(f'Standby server {server.ip_address} is ready!')
        notify_admin.delay(f'✅ Pool server ready: {server.ip_address}')

    except Exception as e:
        error_msg = str(e)
        logger.error(f'Setup failed for {server.ip_address} (attempt {attempt}): {error_msg}')
        
        # Always save error status so cleanup_error_servers can handle it
        server.status = 'error'
        server.last_error = error_msg[:500]
        server.save()
        
        if attempt < MAX_RETRY_ATTEMPTS:
            notify_error.delay(
                'Server Setup Failed - Retrying',
                f'Attempt: {attempt}/{MAX_RETRY_ATTEMPTS}\n'
                f'Server: {server.ip_address}\n'
                f'Error: {error_msg}\n'
                f'Action: Retrying in 60 seconds...'
            )
            manager.disconnect()
            raise self.retry(exc=e, countdown=60)
        else:
            # Max retries - cleanup
            notify_error.delay(
                'Server Setup Failed - DELETING',
                f'Attempts: {MAX_RETRY_ATTEMPTS}/{MAX_RETRY_ATTEMPTS}\n'
                f'Server: {server.ip_address}\n'
                f'TW ID: {server.timeweb_server_id}\n'
                f'Error: {error_msg}\n'
                f'Action: Deleting server and will retry pool creation.'
            )
            
            # Delete from TimeWeb
            if server.timeweb_server_id:
                try:
                    delete_server(server.timeweb_server_id)
                except:
                    pass
            
            # Delete record
            server.delete()
            
            # Trigger new server creation
            create_standby_server_with_retry.delay()
    finally:
        manager.disconnect()


# Legacy function - redirect to new one
@shared_task
def create_standby_server():
    create_standby_server_with_retry.delay()


@shared_task
def provision_user_service(user_id):
    """Create server via TimeWeb and deploy OpenClaw"""
    from django.contrib.auth.models import User
    from .models import Server
    from .services import ServerManager
    from .openrouter import create_openrouter_key
    from .timeweb import create_server, wait_for_server_ready

    try:
        user = User.objects.get(id=user_id)
        profile = user.profile
    except User.DoesNotExist:
        logger.error(f'User {user_id} not found')
        return

    existing = Server.objects.filter(profile=profile).exclude(status='deactivated').first()
    if existing:
        logger.info(f'User {user.email} already has server {existing.ip_address}')
        return

    server_name = f'openclaw-{user.id}-{int(time.time())}'
    
    server_record = Server.objects.create(
        profile=profile,
        status='creating',
    )

    notify_admin.delay(f'Creating server for {user.email}...')

    tw_result = create_server(server_name, user.email)
    if not tw_result:
        server_record.status = 'error'
        server_record.last_error = 'Failed to create TimeWeb server'
        server_record.save()
        notify_error.delay('User Server Creation Failed', f'User: {user.email}\nError: TimeWeb API failed')
        return

    server_record.timeweb_server_id = tw_result.get('id', '')
    server_record.save()

    ready_info = wait_for_server_ready(tw_result['id'], max_wait=300)
    
    if not ready_info:
        server_record.status = 'error'
        server_record.last_error = 'Server creation timeout'
        server_record.save()
        notify_error.delay('User Server Creation Timeout', f'User: {user.email}\nTW ID: {tw_result.get('id')}')
        return

    server_record.ip_address = ready_info['ip']
    server_record.ssh_password = ready_info.get('root_pass', '')
    server_record.status = 'provisioning'
    server_record.save()

    or_key, or_key_id = create_openrouter_key(
        user.email,
        limit_usd=float(settings.OPENROUTER_TOKEN_LIMIT),
    )

    if or_key:
        profile.openrouter_api_key = or_key
        profile.openrouter_key_id = or_key_id
        profile.tokens_used_usd = 0
        profile.save()

    time.sleep(30)
    setup_openclaw_server.delay(server_record.id)


@shared_task
def setup_openclaw_server(server_id):
    """Install OpenClaw on a newly created server"""
    from .models import Server
    from .services import ServerManager

    try:
        server = Server.objects.get(id=server_id)
    except Server.DoesNotExist:
        return

    profile = server.profile
    if not profile:
        return

    manager = ServerManager(server)

    try:
        manager.connect()

        commands = [
            'apt-get update -y',
            'apt-get install -y apt-transport-https ca-certificates curl software-properties-common',
            'curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh',
            'systemctl enable docker && systemctl start docker',
            'curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-Linux-x86_64 -o /usr/local/bin/docker-compose',
            'chmod +x /usr/local/bin/docker-compose',
        ]
        
        for cmd in commands:
            out, err, code = manager.exec_command(cmd)
            if code != 0:
                logger.warning(f'Command failed: {cmd}, error: {err}')

        manager.exec_command(f'mkdir -p {server.openclaw_path}')

        docker_compose = '''version: '3.8'
services:
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    container_name: openclaw
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./openclaw-config.yaml:/app/config.yaml
      - ./data:/app/data
'''
        manager.upload_file(docker_compose, f'{server.openclaw_path}/docker-compose.yml')

        server.status = 'active'
        server.last_error = ''
        server.save()

        if profile.telegram_bot_token:
            manager.deploy_openclaw(
                openrouter_key=profile.openrouter_api_key,
                telegram_token=profile.telegram_bot_token,
                model_slug=profile.selected_model,
            )

        notify_admin.delay(
            f'✅ Server ready!\n'
            f'IP: {server.ip_address}\n'
            f'User: {profile.user.email}'
        )

    except Exception as e:
        server.status = 'error'
        server.last_error = str(e)[:500]
        server.save()
        notify_error.delay('Server Setup Failed', f'IP: {server.ip_address}\nUser: {profile.user.email}\nError: {e}')
    finally:
        manager.disconnect()


@shared_task
def redeploy_openclaw(user_id):
    """Redeploy OpenClaw after model/token change"""
    from django.contrib.auth.models import User
    from .services import ServerManager

    try:
        user = User.objects.get(id=user_id)
        profile = user.profile
        server = profile.server
    except (User.DoesNotExist, Exception):
        logger.error(f'Could not find server for user {user_id}')
        return

    if not server or server.status not in ('active', 'error'):
        return

    manager = ServerManager(server)
    manager.deploy_openclaw(
        openrouter_key=profile.openrouter_api_key,
        telegram_token=profile.telegram_bot_token,
        model_slug=profile.selected_model,
    )


@shared_task
def deactivate_subscription(user_id):
    """Deactivate server when subscription ends"""
    from django.contrib.auth.models import User
    from .services import ServerManager
    from .openrouter import revoke_openrouter_key
    from .timeweb import delete_server

    try:
        user = User.objects.get(id=user_id)
        profile = user.profile
        server = profile.server
    except (User.DoesNotExist, Exception):
        return

    if server:
        manager = ServerManager(server)
        manager.stop_openclaw()

        if server.timeweb_server_id:
            delete_server(server.timeweb_server_id)

        server.status = 'deactivated'
        server.save()

    if profile.openrouter_key_id:
        revoke_openrouter_key(profile.openrouter_key_id)
        profile.openrouter_api_key = ''
        profile.openrouter_key_id = ''
        profile.save()

    notify_admin.delay(f'Subscription deactivated: {user.email}')


@shared_task
def monitor_servers():
    """Health check for active servers (every 10 min)"""
    from .models import Server
    from .services import ServerManager

    active_servers = Server.objects.filter(status='active')
    for server in active_servers:
        manager = ServerManager(server)
        healthy = manager.check_health()
        if not healthy:
            notify_error.delay(
                'Server Health Check Failed',
                f'IP: {server.ip_address}\n'
                f'User: {server.profile.user.email if server.profile else pool}\n'
                f'Status: Not responding'
            )


@shared_task
def assign_server_to_user(user_id):
    """Assign an available server from pool to user after payment."""
    from django.contrib.auth.models import User
    from .models import Server
    from .services import ServerManager
    from .openrouter import create_openrouter_key

    try:
        user = User.objects.get(id=user_id)
        profile = user.profile
    except User.DoesNotExist:
        notify_error.delay('Server Assignment Failed', f'User {user_id} not found')
        return

    existing = Server.objects.filter(profile=profile).exclude(status='deactivated').first()
    if existing:
        logger.info(f'User {user.email} already has server {existing.ip_address}')
        return

    available_server = Server.objects.filter(
        status='active',
        profile__isnull=True,
    ).first()

    if not available_server:
        logger.warning(f'No servers in pool for {user.email}')
        notify_admin.delay(f'⚠️ No pool servers for {user.email}! Creating new...')
        provision_user_service.delay(user_id)
        return

    available_server.profile = profile
    available_server.save()

    logger.info(f'Assigned server {available_server.ip_address} to {user.email}')

    or_key, or_key_id = create_openrouter_key(
        user.email,
        limit_usd=float(settings.OPENROUTER_TOKEN_LIMIT),
    )

    if or_key:
        profile.openrouter_api_key = or_key
        profile.openrouter_key_id = or_key_id
        profile.tokens_used_usd = 0
        profile.save()

    notify_admin.delay(
        f'✅ Server assigned!\n'
        f'IP: {available_server.ip_address}\n'
        f'User: {user.email}'
    )

    if profile.telegram_bot_token:
        manager = ServerManager(available_server)
        try:
            manager.deploy_openclaw(
                openrouter_key=profile.openrouter_api_key,
                telegram_token=profile.telegram_bot_token,
                model_slug=profile.selected_model,
            )
            available_server.openclaw_running = True
            available_server.save()
        except Exception as e:
            notify_error.delay('OpenClaw Deploy Failed', f'User: {user.email}\nError: {e}')

    ensure_server_pool.delay()


@shared_task
def reset_openrouter_keys_monthly():
    """Reset OpenRouter key limits monthly."""
    from django.contrib.auth.models import User
    from .openrouter import reset_key_limit
    
    logger.info('=== MONTHLY KEY RESET STARTED ===')
    
    users_with_keys = User.objects.filter(
        profile__openrouter_key_id__isnull=False
    ).exclude(profile__openrouter_key_id='')
    
    success_count = 0
    error_count = 0
    
    for user in users_with_keys:
        profile = user.profile
        try:
            result = reset_key_limit(profile.openrouter_key_id, api_key=profile.openrouter_api_key)
            if result:
                profile.tokens_used_usd = 0
                profile.save()
                success_count += 1
            else:
                error_count += 1
        except Exception as e:
            error_count += 1
            logger.error(f'Reset error for {user.email}: {e}')
    
    notify_admin.delay(f'Monthly key reset:\n✅ Success: {success_count}\n❌ Errors: {error_count}')
