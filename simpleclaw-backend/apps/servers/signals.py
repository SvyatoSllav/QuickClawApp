"""Django signals for server management - replaces Celery tasks"""
import logging
import threading
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def install_openclaw_async(server_id):
    """Install OpenClaw on server in background thread"""
    import time
    from .models import Server
    from .services import ServerManager

    try:
        server = Server.objects.get(id=server_id)
    except Server.DoesNotExist:
        logger.error(f'Server {server_id} not found')
        return

    if not server.ip_address or not server.ssh_password:
        server.status = 'error'
        server.last_error = 'Missing IP address or SSH password'
        server.save()
        logger.error(f'Server {server_id}: Missing IP or password')
        return

    logger.info(f'Starting OpenClaw installation on {server.ip_address}...')

    # Update status to provisioning
    server.status = 'provisioning'
    server.save()

    manager = ServerManager(server)

    try:
        # Wait for SSH to be ready
        time.sleep(10)
        manager.connect()

        # Check if Docker is installed
        out, err, code = manager.exec_command('docker --version')
        if code != 0:
            logger.info(f'Installing Docker on {server.ip_address}...')
            commands = [
                'apt-get update -y',
                'apt-get install -y apt-transport-https ca-certificates curl software-properties-common',
                'curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh',
                'systemctl enable docker && systemctl start docker',
                'curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-Linux-x86_64 -o /usr/local/bin/docker-compose',
                'chmod +x /usr/local/bin/docker-compose',
            ]

            for cmd in commands:
                out, err, code = manager.exec_command(cmd, timeout=180)
                if code != 0 and 'docker' in cmd.lower():
                    raise Exception(f'Command failed: {cmd}\nError: {err}')

        # Create OpenClaw directory
        manager.exec_command(f'mkdir -p {server.openclaw_path}')

        # Create docker-compose.yml
        docker_compose = '''services:
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    container_name: openclaw
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./openclaw-config.yaml:/app/config.yaml
      - ./data:/app/data
      - config:/home/node/.openclaw
volumes:
  config:
    name: openclaw_config
'''
        manager.upload_file(docker_compose, f'{server.openclaw_path}/docker-compose.yml')

        # Deploy OpenClaw if profile has telegram token
        profile = server.profile
        if profile and profile.telegram_bot_token:
            logger.info(f'Deploying OpenClaw for user {profile.user.email}...')
            manager.deploy_openclaw(
                openrouter_key=profile.openrouter_api_key or '',
                telegram_token=profile.telegram_bot_token,
                model_slug=profile.selected_model or 'openrouter/anthropic/claude-sonnet-4',
            )
            server.openclaw_running = True
        else:
            # Just pull the image for standby (large image, needs long timeout)
            logger.info(f'Pulling OpenClaw image on {server.ip_address}...')
            manager.exec_command(
                f'cd {server.openclaw_path} && docker compose pull',
                timeout=600,
            )

        # Mark as active
        server.status = 'active'
        server.last_error = ''
        server.save()

        logger.info(f'OpenClaw installed successfully on {server.ip_address}')

    except Exception as e:
        error_msg = str(e)[:500]
        logger.error(f'OpenClaw installation failed on {server.ip_address}: {error_msg}')
        server.status = 'error'
        server.last_error = error_msg
        server.save()
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

    # Only trigger if server has IP and password (admin added it)
    if not instance.ip_address or not instance.ssh_password:
        logger.info(f'Server {instance.id} created without IP/password, skipping installation')
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
