"""Django signals for server management - replaces Celery tasks"""
import logging
import threading
import time
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

# SSH connection retry settings
SSH_MAX_RETRIES = 5
SSH_RETRY_DELAY = 15  # seconds between retries


def install_openclaw_async(server_id):
    """Install OpenClaw on server in background thread"""
    from .models import Server
    from .services import ServerManager
    from .tasks import send_telegram_message, ADMIN_TELEGRAM_ID

    try:
        server = Server.objects.get(id=server_id)
    except Server.DoesNotExist:
        logger.error(f'Server {server_id} not found')
        return

    if not server.ip_address:
        server.status = 'error'
        server.last_error = 'Missing IP address'
        server.save()
        logger.error(f'Server {server_id}: Missing IP address')
        send_telegram_message(
            ADMIN_TELEGRAM_ID,
            f'🚨 Server {server_id}: Missing IP address'
        )
        return

    logger.info(f'Starting OpenClaw installation on {server.ip_address}...')

    # Update status to provisioning
    server.status = 'provisioning'
    server.save()

    manager = ServerManager(server)

    try:
        # Retry SSH connection — server may still be booting
        connected = False
        for attempt in range(1, SSH_MAX_RETRIES + 1):
            try:
                logger.info(
                    f'SSH connect attempt {attempt}/{SSH_MAX_RETRIES} '
                    f'to {server.ip_address}...'
                )
                time.sleep(SSH_RETRY_DELAY)
                manager.connect()
                connected = True
                break
            except Exception as e:
                logger.warning(
                    f'SSH attempt {attempt}/{SSH_MAX_RETRIES} failed '
                    f'for {server.ip_address}: {e}'
                )
                if attempt < SSH_MAX_RETRIES:
                    manager.disconnect()

        if not connected:
            raise Exception(
                f'SSH connection failed after {SSH_MAX_RETRIES} attempts'
            )

        # Check if Docker is installed
        out, err, code = manager.exec_command('docker --version')
        if code != 0:
            logger.info(f'Installing Docker on {server.ip_address}...')
            commands = [
                'apt-get update -y',
                'apt-get install -y apt-transport-https ca-certificates curl software-properties-common',
                'curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh',
                'systemctl enable docker && systemctl start docker',
            ]

            for cmd in commands:
                out, err, code = manager.exec_command(cmd, timeout=180)
                if code != 0 and 'docker' in cmd.lower():
                    raise Exception(f'Command failed: {cmd}\nError: {err}')

        # Create OpenClaw directory
        manager.exec_command(f'mkdir -p {server.openclaw_path}')

        # Upload Dockerfile, docker-compose (with SearXNG + Lightpanda), and SearXNG settings
        from .services import DOCKERFILE_CONTENT, DOCKER_COMPOSE_WITH_CHROME
        manager.upload_file(DOCKERFILE_CONTENT, f'{server.openclaw_path}/Dockerfile')
        manager.upload_file(DOCKER_COMPOSE_WITH_CHROME, f'{server.openclaw_path}/docker-compose.yml')
        manager.exec_command(f'mkdir -p {server.openclaw_path}/searxng')
        import secrets as secrets_mod
        from .services import SEARXNG_SETTINGS_YML
        settings_content = SEARXNG_SETTINGS_YML.format(secret_key=secrets_mod.token_hex(32))
        manager.upload_file(settings_content, f'{server.openclaw_path}/searxng/settings.yml')

        # Deploy OpenClaw if profile has telegram token
        profile = server.profile
        if profile and profile.telegram_bot_token:
            telegram_owner_id = None
            try:
                telegram_owner_id = profile.user.telegram_bot_user.telegram_id
            except Exception:
                pass
            logger.info(f'Deploying OpenClaw for user {profile.user.email}...')
            manager.deploy_openclaw(
                openrouter_key=profile.openrouter_api_key or '',
                telegram_token=profile.telegram_bot_token,
                model_slug=profile.selected_model or 'openrouter/anthropic/claude-sonnet-4',
                telegram_owner_id=telegram_owner_id,
            )
            server.openclaw_running = True
        else:
            # Warm deploy: start container, install Chromium, apply token optimization.
            # When a user is assigned, quick_deploy_user() only takes ~30-60s.
            logger.info(f'Warm deploying OpenClaw on {server.ip_address}...')
            manager.warm_deploy_standby()

        # Mark as active
        server.status = 'active'
        server.last_error = ''
        server.save()

        logger.info(f'OpenClaw installed successfully on {server.ip_address}')
        send_telegram_message(
            ADMIN_TELEGRAM_ID,
            f'✅ Server ready: {server.ip_address}\nDocker + OpenClaw image installed, standby.'
        )

    except Exception as e:
        error_msg = str(e)[:500]
        logger.error(f'OpenClaw installation failed on {server.ip_address}: {error_msg}')
        server.status = 'error'
        server.last_error = error_msg
        server.save()
        send_telegram_message(
            ADMIN_TELEGRAM_ID,
            f'🚨 Server install FAILED: {server.ip_address}\nError: {error_msg}'
        )
    finally:
        manager.disconnect()


@receiver(post_save, sender='servers.Server')
def server_post_save(sender, instance, created, **kwargs):
    """
    Signal handler for Server model.
    When a new server is created with IP and password, install OpenClaw.
    """
    # Only trigger on new server creation
    if not created:
        return

    # Only trigger if server has IP (admin added it)
    if not instance.ip_address:
        logger.info(f'Server {instance.id} created without IP, skipping installation')
        return

    # Skip if already active or error
    if instance.status in ('active', 'error'):
        return

    logger.info(f'New server detected: {instance.ip_address} - starting OpenClaw installation')

    # Run installation in background thread
    thread = threading.Thread(
        target=install_openclaw_async,
        args=(instance.id,),
        daemon=True
    )
    thread.start()
