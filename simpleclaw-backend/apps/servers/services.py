"""ServerManager — управление OpenClaw на серверах через SSH (paramiko)"""
import json
import logging
import paramiko
import io
from django.conf import settings

logger = logging.getLogger(__name__)

# How many times to retry applying config if verification fails
CONFIG_MAX_RETRIES = 5
# Seconds to wait between retries (increases: 5, 10, 15, 20, 25)
CONFIG_RETRY_BASE_DELAY = 5


class ServerManager:
    """Подключение к серверу по SSH и управление OpenClaw"""

    def __init__(self, server):
        self.server = server
        self.client = None

    def connect(self):
        """Установить SSH-соединение"""
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.client.connect(
            hostname=self.server.ip_address,
            port=self.server.ssh_port,
            username=self.server.ssh_user,
            password=self.server.ssh_password,
            timeout=30,
        )
        logger.info(f'SSH подключение к {self.server.ip_address} установлено')

    def disconnect(self):
        if self.client:
            self.client.close()
            self.client = None

    def exec_command(self, cmd, timeout=60):
        """Выполнить команду на сервере"""
        if not self.client:
            self.connect()
        stdin, stdout, stderr = self.client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        exit_code = stdout.channel.recv_exit_status()
        return out, err, exit_code

    def upload_file(self, content, remote_path):
        """Загрузить содержимое как файл на сервер"""
        if not self.client:
            self.connect()
        sftp = self.client.open_sftp()
        f = sftp.file(remote_path, 'w')
        f.write(content)
        f.close()
        sftp.close()
        logger.info(f'Файл загружен: {remote_path}')

    def install_browser_in_container(self):
        """Install Chromium browser inside OpenClaw container for browser automation"""
        logger.info(f'Installing Chromium in container on {self.server.ip_address}...')

        # Split into separate commands with error checking
        out, err, code = self.exec_command(
            'docker exec -u root openclaw apt-get update',
            timeout=120
        )
        if code != 0:
            logger.warning(f'apt-get update failed (code {code}): {err[:300]}')
            # Try apk for Alpine-based containers
            out, err, code = self.exec_command(
                'docker exec -u root openclaw apk update && '
                'docker exec -u root openclaw apk add --no-cache chromium font-noto',
                timeout=180
            )
            if code != 0:
                logger.error(f'Browser install failed on {self.server.ip_address}: {err[:500]}')
                return False
        else:
            out, err, code = self.exec_command(
                'docker exec -u root openclaw apt-get install -y chromium fonts-liberation',
                timeout=300
            )
            if code != 0:
                logger.error(f'Chromium install failed on {self.server.ip_address}: {err[:500]}')
                return False

        logger.info(f'Chromium installed successfully on {self.server.ip_address}')

        browser_commands = [
            'docker exec openclaw node /app/openclaw.mjs browser create-profile --name headless --color "#00FF00" --driver openclaw 2>/dev/null || true',
            'docker exec openclaw node /app/openclaw.mjs config set browser.defaultProfile headless',
            'docker exec openclaw node /app/openclaw.mjs config set browser.noSandbox true',
            'docker exec openclaw node /app/openclaw.mjs config set browser.headless true',
        ]

        for cmd in browser_commands:
            self.exec_command(cmd)

        logger.info(f'Browser configured on {self.server.ip_address}')
        return True

    def configure_token_optimization(self, model_slug='claude-opus-4.5'):
        """Configure OpenClaw for optimal token usage to reduce costs.

        Implements optimizations from TOKEN_OPTIMISATION_PLAN.md (Option A):
        - Context limit (contextTokens 50k)
        - Heartbeat disable (biggest silent cost driver)
        - Sub-agent routing to cheap model (deepseek-reasoner)
        - Image model routing to cheap model (gemini-2.5-flash)
        - Compaction in safeguard mode
        - Context pruning with keepLastAssistants
        - Concurrency limits

        Note: maxHistoryMessages, params.cacheControlTtl, temperature, showUsage
        are not supported by current OpenClaw version.
        """
        logger.info(f'Configuring token optimization on {self.server.ip_address}...')

        if 'claude' in model_slug.lower():
            fallback_models = [
                'openrouter/anthropic/claude-sonnet-4',
                'openrouter/anthropic/claude-haiku-4.5',
            ]
        elif 'gpt' in model_slug.lower():
            fallback_models = [
                'openrouter/openai/gpt-4o-mini',
                'openrouter/openai/gpt-4o-mini',
            ]
        elif 'gemini' in model_slug.lower():
            fallback_models = [
                'openrouter/google/gemini-2.5-flash',
                'openrouter/google/gemini-2.5-flash',
            ]
        else:
            fallback_models = [
                'openrouter/anthropic/claude-sonnet-4',
                'openrouter/anthropic/claude-haiku-4.5',
            ]

        cli = 'docker exec openclaw node /app/openclaw.mjs'

        optimization_commands = [
            # --- Context limit (60-75% savings) ---
            f'{cli} config set agents.defaults.contextTokens 50000',

            # --- Heartbeat: disable entirely (up to 30%+ savings) ---
            # Each heartbeat is a full API call with entire session context.
            # At default intervals: ~48 API calls/day/agent doing nothing.
            f"""{cli} config set agents.defaults.heartbeat '{{"every": "0m"}}'""",

            # --- Sub-agent model: cheap model (90% savings on sub-agent calls) ---
            f"""{cli} config set agents.defaults.subagents '{{"model": "openrouter/deepseek/deepseek-reasoner", "maxConcurrent": 2, "archiveAfterMinutes": 60}}'""",

            # --- Image model: cheap model (98% savings on image processing) ---
            f"""{cli} config set agents.defaults.imageModel '{{"primary": "openrouter/google/gemini-2.5-flash", "fallbacks": ["openrouter/openai/gpt-4o-mini"]}}'""",

            # --- Compaction: safeguard mode (prevents context overflow) ---
            f"""{cli} config set agents.defaults.compaction '{{"mode": "safeguard"}}'""",

            # --- Context pruning with keepLastAssistants (20-40% savings) ---
            f"""{cli} config set agents.defaults.contextPruning '{{"mode": "cache-ttl", "ttl": "1h", "keepLastAssistants": 3}}'""",

            # --- Concurrency limit ---
            f'{cli} config set agents.defaults.maxConcurrent 2',
        ]

        for cmd in optimization_commands:
            out, err, code = self.exec_command(cmd)
            if code != 0:
                logger.warning(f'Token opt command failed (code {code}): {cmd[:80]}... err={err[:200]}')

        # Set fallback models
        self.exec_command(f'{cli} models fallbacks clear 2>/dev/null || true')
        for fallback in fallback_models:
            self.exec_command(f'{cli} models fallbacks add {fallback}')

        logger.info(f'Token optimization configured on {self.server.ip_address}')

    def _fix_permissions(self):
        """Fix /home/node/.openclaw ownership — Docker volume is created as root
        but OpenClaw runs as node."""
        self.exec_command(
            'docker exec -u root openclaw chown -R node:node /home/node/.openclaw'
        )

    def _apply_config(self, openrouter_key, openrouter_model):
        """
        Apply all critical config settings once.
        Does NOT verify — call _verify_config() after.
        """
        auth_profiles = {
            "profiles": {
                "openrouter": {
                    "provider": "openrouter",
                    "apiKey": openrouter_key
                }
            },
            "default": "openrouter"
        }
        auth_json = json.dumps(auth_profiles)

        # Write auth-profiles.json — use host temp file + docker cp to avoid escaping issues
        self.upload_file(auth_json, '/tmp/_openclaw_auth.json')
        self.exec_command(
            'docker exec -u root openclaw mkdir -p /home/node/.openclaw/agents/main/agent'
        )
        self.exec_command(
            'docker cp /tmp/_openclaw_auth.json openclaw:/home/node/.openclaw/agents/main/agent/auth-profiles.json'
        )
        self.exec_command('rm -f /tmp/_openclaw_auth.json')

        # Write telegram-allowFrom.json with wildcard to bypass pairing check
        # This is the store-level allowFrom that OpenClaw merges with config allowFrom
        allow_from_json = json.dumps({"version": 1, "allowFrom": ["*"]})
        self.upload_file(allow_from_json, '/tmp/_openclaw_allowfrom.json')
        self.exec_command(
            'docker exec -u root openclaw mkdir -p /home/node/.openclaw/credentials'
        )
        self.exec_command(
            'docker cp /tmp/_openclaw_allowfrom.json openclaw:/home/node/.openclaw/credentials/telegram-allowFrom.json'
        )
        self.exec_command('rm -f /tmp/_openclaw_allowfrom.json')

        self._fix_permissions()

        # Set provider + model
        self.exec_command(
            'docker exec openclaw node /app/openclaw.mjs config set provider openrouter'
        )
        self.exec_command(
            f'docker exec openclaw node /app/openclaw.mjs models set {openrouter_model}'
        )

        # Set allowFrom first, then dmPolicy (order matters for OpenClaw validation)
        self.exec_command(
            'docker exec openclaw node /app/openclaw.mjs config set channels.telegram.allowFrom \'["*"]\''
        )
        self.exec_command(
            'docker exec openclaw node /app/openclaw.mjs config set channels.telegram.dmPolicy open'
        )

    def _verify_config(self, openrouter_key, openrouter_model):
        """
        Verify that all critical OpenClaw settings are correctly applied.
        Returns (ok: bool, failures: list[str]).
        """
        failures = []

        # 1. dmPolicy must be "open"
        out, _, _ = self.exec_command(
            'docker exec openclaw node /app/openclaw.mjs config get channels.telegram.dmPolicy'
        )
        if 'open' not in out.strip():
            failures.append(f'dmPolicy={out.strip()!r} (expected "open")')

        # 2. Model must contain openrouter/ — check logs and config.yaml
        out, _, _ = self.exec_command(
            'docker logs openclaw --tail 30 2>&1 | grep "agent model:" | tail -1'
        )
        if 'openrouter/' not in out:
            out2, _, _ = self.exec_command(
                'docker exec openclaw grep "^model:" /app/config.yaml 2>/dev/null'
            )
            if 'openrouter/' not in out2:
                failures.append(f'model not set to openrouter (logs={out.strip()!r}, config={out2.strip()!r})')

        # 3. Auth profiles file must exist and contain the key
        out, _, code = self.exec_command(
            'docker exec openclaw cat /home/node/.openclaw/agents/main/agent/auth-profiles.json 2>/dev/null'
        )
        if code != 0 or openrouter_key not in out:
            failures.append('auth-profiles.json missing or wrong key')

        # 4. Container must be running (not restarting)
        out, _, _ = self.exec_command('docker inspect openclaw --format={{.State.Status}} 2>/dev/null')
        if 'running' not in out.strip():
            failures.append(f'container status={out.strip()!r} (expected "running")')

        # 5. No permission errors in recent logs
        out, _, _ = self.exec_command(
            'docker logs openclaw --tail 20 2>&1 | grep -c "EACCES"'
        )
        eacces_count = int(out.strip()) if out.strip().isdigit() else 0
        if eacces_count > 0:
            failures.append(f'{eacces_count} EACCES permission errors in logs')

        # 6. Telegram provider must be started
        out, _, _ = self.exec_command(
            'docker logs openclaw --tail 50 2>&1 | grep "\\[telegram\\]" | tail -1'
        )
        if 'starting provider' not in out:
            failures.append(f'telegram provider not started (last telegram log: {out.strip()!r})')

        # 7. telegram-allowFrom.json must have wildcard
        out, _, code = self.exec_command(
            'docker exec openclaw cat /home/node/.openclaw/credentials/telegram-allowFrom.json 2>/dev/null'
        )
        if code != 0 or '"*"' not in out:
            failures.append(f'telegram-allowFrom.json missing wildcard (content={out.strip()!r})')

        return (len(failures) == 0, failures)

    def _apply_config_with_retry(self, openrouter_key, openrouter_model):
        """
        Apply config, restart container so running process loads it,
        then verify. Retry on failure.
        Returns True if config is verified correct, False if all retries exhausted.
        """
        import time
        path = self.server.openclaw_path
        failures = []

        for attempt in range(1, CONFIG_MAX_RETRIES + 1):
            logger.info(
                f'Config apply attempt {attempt}/{CONFIG_MAX_RETRIES} '
                f'on {self.server.ip_address}'
            )

            # Fix permissions before every attempt
            self._fix_permissions()

            # Apply all settings (writes JSON files + CLI config set)
            self._apply_config(openrouter_key, openrouter_model)

            # Restart container so the running process picks up new config
            logger.info(f'Restarting container to apply config...')
            self.exec_command(f'cd {path} && docker compose restart')
            time.sleep(12)

            # Fix permissions again after restart
            self._fix_permissions()

            # Re-apply config after restart (OpenClaw may reset defaults on startup)
            self._apply_config(openrouter_key, openrouter_model)

            # Wait for Telegram provider to start
            time.sleep(8)

            # Verify
            ok, failures = self._verify_config(openrouter_key, openrouter_model)
            if ok:
                logger.info(
                    f'Config verified OK on attempt {attempt} '
                    f'for {self.server.ip_address}'
                )
                return True

            logger.warning(
                f'Config verification failed on attempt {attempt} '
                f'for {self.server.ip_address}: {failures}'
            )

            if attempt < CONFIG_MAX_RETRIES:
                delay = CONFIG_RETRY_BASE_DELAY * attempt
                logger.info(f'Waiting {delay}s before retry...')
                time.sleep(delay)

        # All retries exhausted
        logger.error(
            f'Config verification FAILED after {CONFIG_MAX_RETRIES} attempts '
            f'on {self.server.ip_address}. Last failures: {failures}'
        )
        return False

    def deploy_openclaw(self, openrouter_key, telegram_token, model_slug):
        """Настроить и запустить OpenClaw на сервере"""
        import secrets
        import time
        path = self.server.openclaw_path

        model_mapping = getattr(settings, 'MODEL_MAPPING', {})
        base_model = model_mapping.get(model_slug, 'anthropic/claude-opus-4.5')
        openrouter_model = f'openrouter/{base_model}'
        gateway_token = secrets.token_urlsafe(32)

        env_content = f"""OPENROUTER_API_KEY={openrouter_key}
TELEGRAM_BOT_TOKEN={telegram_token}
OPENCLAW_GATEWAY_TOKEN={gateway_token}
LOG_LEVEL=info
"""

        config_content = f"""provider: openrouter
model: {openrouter_model}
api_key: {openrouter_key}

gateway:
  mode: local
  auth:
    type: token
    token: {gateway_token}

channels:
  telegram:
    enabled: true
    botToken: {telegram_token}
    dmPolicy: open
    allowFrom: ["*"]
    groupPolicy: allowlist
    streamMode: partial

limits:
  max_tokens_per_message: 4096
  max_context_messages: 30
"""

        docker_compose_content = """services:
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
"""

        try:
            self.connect()

            # Upload all config files
            self.upload_file(env_content, f'{path}/.env')
            self.upload_file(config_content, f'{path}/openclaw-config.yaml')
            self.upload_file(docker_compose_content, f'{path}/docker-compose.yml')

            # Stop existing container and clear stale config
            self.exec_command(f'cd {path} && docker compose down 2>/dev/null || true')
            self.exec_command('docker volume rm openclaw_config 2>/dev/null || true')

            # Start container
            out, err, code = self.exec_command(f'cd {path} && docker compose up -d')

            if code != 0:
                self.server.openclaw_running = False
                self.server.status = 'error'
                self.server.last_error = f'docker compose up failed: {err[:500]}'
                self.server.save()
                logger.error(f'Ошибка запуска OpenClaw на {self.server.ip_address}: {err}')
                return False

            time.sleep(8)

            # Fix volume permissions
            self._fix_permissions()

            # Clear any stale internal config
            self.exec_command(
                "docker exec openclaw rm -rf /home/node/.openclaw/openclaw.json 2>/dev/null || true"
            )

            # Install browser in container
            self.install_browser_in_container()

            # Run doctor to fix initial setup issues
            self.exec_command('docker exec openclaw node /app/openclaw.mjs doctor --fix')
            self.exec_command('docker exec openclaw node /app/openclaw.mjs config set gateway.mode local')

            # Set model
            self.exec_command(
                f'docker exec openclaw node /app/openclaw.mjs models set {openrouter_model}'
            )

            # Configure token optimization
            self.configure_token_optimization(model_slug)

            # Apply config with restart + verify (includes restart cycle)
            config_ok = self._apply_config_with_retry(openrouter_key, openrouter_model)

            if not config_ok:
                from .tasks import send_telegram_message, ADMIN_TELEGRAM_ID
                send_telegram_message(
                    ADMIN_TELEGRAM_ID,
                    f'🚨 OpenClaw config verification FAILED after {CONFIG_MAX_RETRIES} retries\n'
                    f'Server: {self.server.ip_address}\n'
                    f'Manual intervention may be needed.'
                )
                self.server.openclaw_running = False
                self.server.status = 'error'
                self.server.last_error = 'Config verification failed after retries'
                self.server.save()
                return False

            # Start the browser
            self.exec_command(
                'docker exec openclaw node /app/openclaw.mjs browser start --browser-profile headless'
            )

            self.server.openclaw_running = True
            self.server.status = 'active'
            self.server.last_error = ''
            self.server.save()
            logger.info(f'OpenClaw deployed and verified on {self.server.ip_address}')
            return True

        except Exception as e:
            self.server.status = 'error'
            self.server.last_error = str(e)[:500]
            self.server.save()
            logger.error(f'Исключение при деплое OpenClaw на {self.server.ip_address}: {e}')
            return False


def assign_server_to_user_sync(user_id):
    """
    Assign an available server from pool to user after payment.
    Synchronous version — replaces the Celery task.
    """
    from django.contrib.auth.models import User
    from .models import Server
    from .openrouter import create_openrouter_key
    from .tasks import send_telegram_message, ADMIN_TELEGRAM_ID

    try:
        user = User.objects.get(id=user_id)
        profile = user.profile
    except User.DoesNotExist:
        logger.error(f'assign_server_to_user_sync: User {user_id} not found')
        send_telegram_message(
            ADMIN_TELEGRAM_ID,
            f'🚨 Server Assignment Failed: User {user_id} not found'
        )
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
        send_telegram_message(
            ADMIN_TELEGRAM_ID,
            f'⚠️ No pool servers for {user.email}! Please add a server manually.'
        )
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

    send_telegram_message(
        ADMIN_TELEGRAM_ID,
        f'✅ Server assigned!\nIP: {available_server.ip_address}\nUser: {user.email}'
    )

    if profile.telegram_bot_token:
        manager = ServerManager(available_server)
        try:
            result = manager.deploy_openclaw(
                openrouter_key=profile.openrouter_api_key,
                telegram_token=profile.telegram_bot_token,
                model_slug=profile.selected_model,
            )
            if result:
                available_server.openclaw_running = True
                available_server.save()
                send_telegram_message(
                    ADMIN_TELEGRAM_ID,
                    f'✅ OpenClaw deployed & verified!\nIP: {available_server.ip_address}\nUser: {user.email}'
                )
        except Exception as e:
            send_telegram_message(
                ADMIN_TELEGRAM_ID,
                f'🚨 OpenClaw Deploy Failed\nUser: {user.email}\nError: {e}'
            )


def deactivate_subscription_sync(user_id):
    """Deactivate server when subscription ends."""
    from django.contrib.auth.models import User
    from .openrouter import revoke_openrouter_key
    from .tasks import send_telegram_message, ADMIN_TELEGRAM_ID

    try:
        user = User.objects.get(id=user_id)
        profile = user.profile
        server = profile.server
    except (User.DoesNotExist, Exception):
        return

    if server:
        manager = ServerManager(server)
        try:
            manager.connect()
            manager.exec_command(
                f'cd {server.openclaw_path} && docker compose down 2>/dev/null || true'
            )
        except Exception as e:
            logger.error(f'Error stopping OpenClaw on {server.ip_address}: {e}')
        finally:
            manager.disconnect()

        server.status = 'deactivated'
        server.openclaw_running = False
        server.save()

    if profile.openrouter_key_id:
        revoke_openrouter_key(profile.openrouter_key_id)
        profile.openrouter_api_key = ''
        profile.openrouter_key_id = ''
        profile.save()

    send_telegram_message(ADMIN_TELEGRAM_ID, f'Subscription deactivated: {user.email}')


def redeploy_openclaw_sync(user_id):
    """Redeploy OpenClaw after model/token change."""
    from django.contrib.auth.models import User

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
