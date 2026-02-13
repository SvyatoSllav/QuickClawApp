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

    def configure_token_optimization(self, model_slug='claude-sonnet-4'):
        """Configure OpenClaw for optimal token usage to reduce costs.

        Optimizations applied:
        - contextTokens: 100K (triggers compaction earlier than default 200K)
        - bootstrapMaxChars: 20K (limits system prompt bloat from AGENTS.md etc.)
        - Heartbeat disabled (biggest silent cost driver)
        - Sub-agent routing to gemini-3-flash-preview (cheap + fast)
        - Image model routing to gemini-2.5-flash
        - Compaction with memoryFlush (saves context before compaction)
        - Context pruning with cache-ttl 1h
        - Concurrency limits
        - Cheap fallback models (gemini-2.5-flash → haiku)
        - Local RAG memory search (semantic memory across sessions)
        """
        logger.info(f'Configuring token optimization on {self.server.ip_address}...')

        if 'claude' in model_slug.lower():
            fallback_models = [
                'openrouter/google/gemini-2.5-flash',
                'openrouter/anthropic/claude-haiku-4.5',
            ]
        elif 'gpt' in model_slug.lower():
            fallback_models = [
                'openrouter/google/gemini-2.5-flash',
                'openrouter/openai/gpt-4o-mini',
            ]
        elif 'gemini' in model_slug.lower():
            fallback_models = [
                'openrouter/google/gemini-2.5-flash',
                'openrouter/anthropic/claude-haiku-4.5',
            ]
        else:
            fallback_models = [
                'openrouter/google/gemini-2.5-flash',
                'openrouter/anthropic/claude-haiku-4.5',
            ]

        cli = 'docker exec openclaw node /app/openclaw.mjs'

        optimization_commands = [
            # --- Heartbeat: disable entirely (up to 30%+ savings) ---
            f"""{cli} config set agents.defaults.heartbeat '{{"every": "0m"}}'""",

            # --- Sub-agent model: gemini-3-flash (cheap + fast) ---
            f"""{cli} config set agents.defaults.subagents '{{"model": "openrouter/google/gemini-3-flash-preview", "maxConcurrent": 2, "archiveAfterMinutes": 60}}'""",

            # --- Image model: cheap model ---
            f"""{cli} config set agents.defaults.imageModel '{{"primary": "openrouter/google/gemini-2.5-flash", "fallbacks": ["openrouter/openai/gpt-4o-mini"]}}'""",

            # --- Compaction with memoryFlush (saves context before compaction) ---
            f"""{cli} config set agents.defaults.compaction '{{"mode": "default", "memoryFlush": {{"enabled": true, "softThresholdTokens": 30000}}}}'""",

            # --- Context pruning with keepLastAssistants ---
            f"""{cli} config set agents.defaults.contextPruning '{{"mode": "cache-ttl", "ttl": "1h", "keepLastAssistants": 3}}'""",

            # --- Concurrency limit ---
            f'{cli} config set agents.defaults.maxConcurrent 2',

            # --- Enable web search (uses headless browser) ---
            f'{cli} config set web.enabled true',

            # --- Bootstrap file size limit (reduces system prompt bloat) ---
            f'{cli} config set agents.defaults.bootstrapMaxChars 20000',

            # --- Context token limit (100K — triggers compaction earlier) ---
            f'{cli} config set agents.defaults.contextTokens 100000',

            # --- Local RAG — semantic memory search across sessions ---
            f"""{cli} config set agents.defaults.memorySearch '{{"enabled": true, "provider": "local", "store": {{"path": "/home/node/.openclaw/memory.db"}}}}'""",
        ]

        for cmd in optimization_commands:
            out, err, code = self.exec_command(cmd)
            if code != 0:
                logger.warning(f'Token opt command failed (code {code}): {cmd[:80]}... err={err[:200]}')

        # Set fallback models
        self.exec_command(f'{cli} models fallbacks clear 2>/dev/null || true')
        for fallback in fallback_models:
            self.exec_command(f'{cli} models fallbacks add {fallback}')

        # Set model aliases for easy /model switching
        aliases = {
            "openrouter/anthropic/claude-opus-4.5": {"alias": "opus"},
            "openrouter/anthropic/claude-sonnet-4": {"alias": "sonnet"},
            "openrouter/anthropic/claude-haiku-4.5": {"alias": "haiku"},
            "openrouter/google/gemini-2.5-flash": {"alias": "flash"},
            "openrouter/deepseek/deepseek-reasoner": {"alias": "deepseek"},
            "openrouter/google/gemini-3-flash-preview": {"alias": "gemini3"},
        }
        aliases_json = json.dumps(aliases)
        out, err, code = self.exec_command(
            f"{cli} config set agents.defaults.models '{aliases_json}'"
        )
        if code != 0:
            logger.warning(f'Model aliases failed: {err[:200]}')

        logger.info(f'Token optimization configured on {self.server.ip_address}')

    def install_session_watchdog(self):
        """Install a cron-based watchdog that auto-compacts OpenClaw sessions
        when Gemini's 'Thought signature is not valid' error is detected.

        The script runs every 2 minutes, checks recent docker logs for the error,
        and if found — triggers /compact via the agent CLI to flush corrupted
        thought tokens while preserving conversation memory.
        """
        logger.info(f'Installing session watchdog on {self.server.ip_address}...')

        script = r'''#!/bin/bash
# OpenClaw session watchdog — auto-compact on Gemini "Thought signature" errors
LOGFILE="/var/log/openclaw-watchdog.log"
CONTAINER="openclaw"
CLI="node /app/openclaw.mjs"

# Check last 2 min of logs for the error
if docker logs "$CONTAINER" --since 2m 2>&1 | grep -qi "Thought signature is not valid"; then
    echo "$(date -Iseconds) [watchdog] Detected 'Thought signature' error — triggering compaction" >> "$LOGFILE"

    # Get active session IDs
    SESSIONS=$(docker exec "$CONTAINER" $CLI sessions --json 2>/dev/null | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

    for SID in $SESSIONS; do
        docker exec "$CONTAINER" $CLI agent --session-id "$SID" --message "/compact" --channel telegram --timeout 120 2>&1 >> "$LOGFILE"
        echo "$(date -Iseconds) [watchdog] Compacted session $SID" >> "$LOGFILE"
    done
else
    : # no error — do nothing
fi
'''

        self.upload_file(script, '/usr/local/bin/openclaw-watchdog.sh')
        self.exec_command('chmod +x /usr/local/bin/openclaw-watchdog.sh')

        # Install cron job (every 2 min), idempotent — remove old entry first
        self.exec_command(
            '(crontab -l 2>/dev/null | grep -v openclaw-watchdog; '
            'echo "*/2 * * * * /usr/local/bin/openclaw-watchdog.sh") | crontab -'
        )

        logger.info(f'Session watchdog installed on {self.server.ip_address}')

    def warm_deploy_standby(self):
        """Pre-deploy OpenClaw on a pool server without user-specific config.

        Starts the container, installs Chromium, applies token optimization,
        and creates the browser profile. When a user is assigned, only their
        OpenRouter key, Telegram token, and model need to be injected via
        quick_deploy_user() — cutting deployment from ~5-10min to ~30-60s.
        """
        import secrets
        import time
        path = self.server.openclaw_path

        gateway_token = secrets.token_urlsafe(32)

        # Generic .env — no user keys, just enough to start the container
        env_content = f"""OPENROUTER_API_KEY=placeholder
TELEGRAM_BOT_TOKEN=placeholder
OPENCLAW_GATEWAY_TOKEN={gateway_token}
LOG_LEVEL=info
"""

        # Generic config — no telegram channel, default model
        config_content = f"""provider: openrouter
model: openrouter/anthropic/claude-sonnet-4

gateway:
  mode: local
  auth:
    type: token
    token: {gateway_token}

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

            self.upload_file(env_content, f'{path}/.env')
            self.upload_file(config_content, f'{path}/openclaw-config.yaml')
            self.upload_file(docker_compose_content, f'{path}/docker-compose.yml')

            # Stop existing container and clear stale config
            self.exec_command(f'cd {path} && docker compose down 2>/dev/null || true')
            self.exec_command('docker volume rm openclaw_config 2>/dev/null || true')

            out, err, code = self.exec_command(f'cd {path} && docker compose up -d')
            if code != 0:
                logger.error(f'warm_deploy_standby: docker compose up failed on {self.server.ip_address}: {err}')
                return False

            time.sleep(8)
            self._fix_permissions()

            # Clear stale internal config
            self.exec_command(
                "docker exec openclaw rm -rf /home/node/.openclaw/openclaw.json 2>/dev/null || true"
            )

            # Install browser (the slow part — ~3-5 min)
            self.install_browser_in_container()

            # Run doctor + set gateway mode
            self.exec_command('docker exec openclaw node /app/openclaw.mjs doctor --fix')
            self.exec_command('docker exec openclaw node /app/openclaw.mjs config set gateway.mode local')

            # Apply token optimization
            self.configure_token_optimization()

            # Install session watchdog (auto-recovers from Gemini thought signature errors)
            self.install_session_watchdog()

            # Pre-install ClawdMatrix so it's ready for quick_deploy_user
            try:
                self.install_clawdmatrix()
            except Exception as e:
                logger.warning(f'ClawdMatrix install failed during warm deploy (non-fatal): {e}')

            # Start browser profile
            self.exec_command(
                'docker exec openclaw node /app/openclaw.mjs browser start --browser-profile headless'
            )

            self.server.openclaw_running = True
            self.server.last_error = ''
            self.server.save()
            logger.info(f'Warm deploy complete on {self.server.ip_address}')
            return True

        except Exception as e:
            logger.error(f'warm_deploy_standby failed on {self.server.ip_address}: {e}')
            self.server.last_error = str(e)[:500]
            self.server.save()
            return False

    def quick_deploy_user(self, openrouter_key, telegram_token, model_slug, telegram_owner_id=None):
        """Fast user deployment on an already-warmed server (~30-60s).

        Skips Chromium install, doctor, token optimization (already done by
        warm_deploy_standby). Only injects user-specific config and restarts.
        """
        import secrets
        import time
        path = self.server.openclaw_path

        model_mapping = getattr(settings, 'MODEL_MAPPING', {})
        base_model = model_mapping.get(model_slug, 'anthropic/claude-sonnet-4')
        openrouter_model = f'openrouter/{base_model}'
        gateway_token = secrets.token_urlsafe(32)

        # User-specific .env
        env_content = f"""OPENROUTER_API_KEY={openrouter_key}
TELEGRAM_BOT_TOKEN={telegram_token}
OPENCLAW_GATEWAY_TOKEN={gateway_token}
LOG_LEVEL=info
"""

        # Build allowFrom — restrict to owner's Telegram ID if known
        allow_from = f'["{telegram_owner_id}"]' if telegram_owner_id else '["*"]'

        # User-specific config with telegram channel
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
    allowFrom: {allow_from}
    groupPolicy: allowlist
    streamMode: partial

limits:
  max_tokens_per_message: 4096
  max_context_messages: 30
"""

        try:
            self.connect()

            # Upload user-specific config files
            self.upload_file(env_content, f'{path}/.env')
            self.upload_file(config_content, f'{path}/openclaw-config.yaml')

            # Recreate to pick up new .env (restart doesn't reload env vars)
            self.exec_command(f'cd {path} && docker compose up -d --force-recreate')
            time.sleep(8)

            # Reinstall Chromium (lost when container is recreated from image)
            self.install_browser_in_container()

            self._fix_permissions()

            # Set model + fallbacks
            self.exec_command(
                f'docker exec openclaw node /app/openclaw.mjs models set {openrouter_model}'
            )
            self.configure_token_optimization(model_slug)
            self.install_session_watchdog()

            # Apply user-specific config (auth-profiles, telegram) with retry
            config_ok = self._apply_config_with_retry(openrouter_key, openrouter_model, telegram_owner_id)

            if not config_ok:
                from .tasks import send_telegram_message, ADMIN_TELEGRAM_ID
                send_telegram_message(
                    ADMIN_TELEGRAM_ID,
                    f'🚨 quick_deploy_user config verification FAILED\n'
                    f'Server: {self.server.ip_address}\n'
                    f'Manual intervention may be needed.'
                )
                self.server.status = 'error'
                self.server.last_error = 'Quick deploy config verification failed'
                self.server.save()
                return False

            # ClawdMatrix: enable/disable based on user profile
            try:
                profile = self.server.profile
                if profile and profile.clawdmatrix_enabled:
                    self.install_clawdmatrix()
                    self.enable_clawdmatrix(
                        custom_skills=profile.clawdmatrix_custom_skills or None,
                    )
                else:
                    self.disable_clawdmatrix()
            except Exception as e:
                logger.warning(f'ClawdMatrix setup failed during quick deploy (non-fatal): {e}')

            # Start browser
            self.exec_command(
                'docker exec openclaw node /app/openclaw.mjs browser start --browser-profile headless'
            )

            self.server.openclaw_running = True
            self.server.status = 'active'
            self.server.last_error = ''
            self.server.save()
            logger.info(f'Quick deploy complete on {self.server.ip_address}')
            return True

        except Exception as e:
            self.server.status = 'error'
            self.server.last_error = str(e)[:500]
            self.server.save()
            logger.error(f'quick_deploy_user failed on {self.server.ip_address}: {e}')
            return False

    def _fix_permissions(self):
        """Fix /home/node/.openclaw ownership — Docker volume is created as root
        but OpenClaw runs as node."""
        self.exec_command(
            'docker exec -u root openclaw chown -R node:node /home/node/.openclaw'
        )

    def _apply_config(self, openrouter_key, openrouter_model, telegram_owner_id=None):
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

        # Write telegram-allowFrom.json to bypass pairing check
        # This is the store-level allowFrom that OpenClaw merges with config allowFrom
        allow_from_list = [str(telegram_owner_id)] if telegram_owner_id else ["*"]
        allow_from_json = json.dumps({"version": 1, "allowFrom": allow_from_list})
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
        allow_from_val = json.dumps([str(telegram_owner_id)] if telegram_owner_id else ["*"])
        self.exec_command(
            f"docker exec openclaw node /app/openclaw.mjs config set channels.telegram.allowFrom '{allow_from_val}'"
        )
        self.exec_command(
            'docker exec openclaw node /app/openclaw.mjs config set channels.telegram.dmPolicy open'
        )

    def _verify_config(self, openrouter_key, openrouter_model, telegram_owner_id=None):
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

        # 7. telegram-allowFrom.json must have correct allowFrom
        out, _, code = self.exec_command(
            'docker exec openclaw cat /home/node/.openclaw/credentials/telegram-allowFrom.json 2>/dev/null'
        )
        expected_id = f'"{telegram_owner_id}"' if telegram_owner_id else '"*"'
        if code != 0 or expected_id not in out:
            failures.append(f'telegram-allowFrom.json missing {expected_id} (content={out.strip()!r})')

        return (len(failures) == 0, failures)

    def _apply_config_with_retry(self, openrouter_key, openrouter_model, telegram_owner_id=None):
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
            self._apply_config(openrouter_key, openrouter_model, telegram_owner_id)

            # Restart container so the running process picks up new config
            logger.info(f'Restarting container to apply config...')
            self.exec_command(f'cd {path} && docker compose restart')
            time.sleep(12)

            # Fix permissions again after restart
            self._fix_permissions()

            # Re-apply config after restart (OpenClaw may reset defaults on startup)
            self._apply_config(openrouter_key, openrouter_model, telegram_owner_id)

            # Wait for Telegram provider to start
            time.sleep(8)

            # Verify
            ok, failures = self._verify_config(openrouter_key, openrouter_model, telegram_owner_id)
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

    def deploy_openclaw(self, openrouter_key, telegram_token, model_slug, telegram_owner_id=None):
        """Настроить и запустить OpenClaw на сервере"""
        import secrets
        import time
        path = self.server.openclaw_path

        model_mapping = getattr(settings, 'MODEL_MAPPING', {})
        base_model = model_mapping.get(model_slug, 'anthropic/claude-sonnet-4')
        openrouter_model = f'openrouter/{base_model}'
        gateway_token = secrets.token_urlsafe(32)

        env_content = f"""OPENROUTER_API_KEY={openrouter_key}
TELEGRAM_BOT_TOKEN={telegram_token}
OPENCLAW_GATEWAY_TOKEN={gateway_token}
LOG_LEVEL=info
"""

        # Build allowFrom — restrict to owner's Telegram ID if known
        allow_from = f'["{telegram_owner_id}"]' if telegram_owner_id else '["*"]'

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
    allowFrom: {allow_from}
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
            self.install_session_watchdog()

            # Install and optionally enable ClawdMatrix
            try:
                self.install_clawdmatrix()
                profile = self.server.profile
                if profile and profile.clawdmatrix_enabled:
                    self.enable_clawdmatrix(
                        custom_skills=profile.clawdmatrix_custom_skills or None,
                    )
            except Exception as e:
                logger.warning(f'ClawdMatrix setup failed during deploy (non-fatal): {e}')

            # Apply config with restart + verify (includes restart cycle)
            config_ok = self._apply_config_with_retry(openrouter_key, openrouter_model, telegram_owner_id)

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


    # ─── ClawdMatrix Engine ──────────────────────────────────────────

    CLAWDMATRIX_FILES = [
        'clawd-matrix.js',
        'triangulator.js',
        'skills-loader.js',
        'injector.js',
        'system-directives.js',
        'index.js',
        'types.js',
        'wrapper.js',
        'data/domain-map.json',
        'data/skills.json',
    ]

    def install_clawdmatrix(self):
        """Install ClawdMatrix Engine files into the OpenClaw container."""
        import os

        logger.info(f'Installing ClawdMatrix on {self.server.ip_address}...')

        bundle_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'clawdmatrix', 'bundle',
        )

        # Create target directory inside container
        self.exec_command(
            'docker exec -u root openclaw mkdir -p /app/clawdmatrix/data'
        )

        for filename in self.CLAWDMATRIX_FILES:
            local_path = os.path.join(bundle_dir, filename)
            try:
                with open(local_path, 'r') as f:
                    content = f.read()
            except FileNotFoundError:
                logger.warning(f'ClawdMatrix file not found: {local_path}')
                continue

            safe_name = filename.replace('/', '_')
            tmp_path = f'/tmp/_clawdmatrix_{safe_name}'
            self.upload_file(content, tmp_path)

            container_path = f'/app/clawdmatrix/{filename}'
            if '/' in filename:
                subdir = '/app/clawdmatrix/' + '/'.join(filename.split('/')[:-1])
                self.exec_command(f'docker exec -u root openclaw mkdir -p {subdir}')

            self.exec_command(f'docker cp {tmp_path} openclaw:{container_path}')
            self.exec_command(f'rm -f {tmp_path}')

        # Fix permissions
        self.exec_command(
            'docker exec -u root openclaw chown -R node:node /app/clawdmatrix'
        )

        self.server.clawdmatrix_installed = True
        self.server.save(update_fields=['clawdmatrix_installed'])
        logger.info(f'ClawdMatrix installed on {self.server.ip_address}')

    def enable_clawdmatrix(self, custom_domain_map=None, custom_skills=None):
        """Enable ClawdMatrix Engine on the running OpenClaw instance.

        Generates a CLAUDE.md block with ClawdMatrix instructions and injects
        it into the OpenClaw agent's configuration via the config CLI.
        """
        logger.info(f'Enabling ClawdMatrix on {self.server.ip_address}...')

        if not self.server.clawdmatrix_installed:
            self.install_clawdmatrix()

        # Upload custom domain-map or skills if provided
        if custom_domain_map:
            content = json.dumps(custom_domain_map, ensure_ascii=False, indent=2)
            self.upload_file(content, '/tmp/_custom_domain_map.json')
            self.exec_command(
                'docker cp /tmp/_custom_domain_map.json '
                'openclaw:/app/clawdmatrix/data/domain-map.json'
            )
            self.exec_command('rm -f /tmp/_custom_domain_map.json')

        if custom_skills:
            content = json.dumps(custom_skills, ensure_ascii=False, indent=2)
            self.upload_file(content, '/tmp/_custom_skills.json')
            self.exec_command(
                'docker cp /tmp/_custom_skills.json '
                'openclaw:/app/clawdmatrix/data/skills.json'
            )
            self.exec_command('rm -f /tmp/_custom_skills.json')

        # Fix permissions after any custom file uploads
        self.exec_command(
            'docker exec -u root openclaw chown -R node:node /app/clawdmatrix'
        )

        # Generate CLAUDE.md content using the wrapper CLI
        out, err, code = self.exec_command(
            'docker exec openclaw node /app/clawdmatrix/wrapper.js --claude-md',
            timeout=30,
        )

        if code != 0 or not out.strip():
            logger.error(
                f'ClawdMatrix CLAUDE.md generation failed on {self.server.ip_address}: '
                f'code={code}, err={err[:300]}'
            )
            return False

        claude_md_block = out.strip()

        # Write the CLAUDE.md content to the OpenClaw workspace
        self.upload_file(claude_md_block, '/tmp/_clawdmatrix_claude.md')
        self.exec_command(
            'docker cp /tmp/_clawdmatrix_claude.md '
            'openclaw:/home/node/.openclaw/CLAUDE.md'
        )
        self.exec_command('rm -f /tmp/_clawdmatrix_claude.md')
        self.exec_command(
            'docker exec -u root openclaw chown node:node /home/node/.openclaw/CLAUDE.md'
        )

        logger.info(f'ClawdMatrix enabled on {self.server.ip_address}')
        return True

    def disable_clawdmatrix(self):
        """Disable ClawdMatrix Engine without removing files."""
        logger.info(f'Disabling ClawdMatrix on {self.server.ip_address}...')

        # Remove the CLAUDE.md file that contains ClawdMatrix instructions
        self.exec_command(
            'docker exec openclaw rm -f /home/node/.openclaw/CLAUDE.md'
        )

        logger.info(f'ClawdMatrix disabled on {self.server.ip_address}')

    def verify_clawdmatrix(self):
        """Verify ClawdMatrix is installed and functioning.

        Returns (success: bool, failures: list[str]).
        """
        failures = []

        # Check core files exist
        out, _, code = self.exec_command(
            'docker exec openclaw ls /app/clawdmatrix/index.js 2>/dev/null'
        )
        if code != 0:
            failures.append('index.js not found')

        out, _, code = self.exec_command(
            'docker exec openclaw ls /app/clawdmatrix/data/skills.json 2>/dev/null'
        )
        if code != 0:
            failures.append('skills.json not found')

        out, _, code = self.exec_command(
            'docker exec openclaw ls /app/clawdmatrix/data/domain-map.json 2>/dev/null'
        )
        if code != 0:
            failures.append('domain-map.json not found')

        # Check skills.json is valid JSON
        out, _, code = self.exec_command(
            "docker exec openclaw node -e "
            "\"JSON.parse(require('fs').readFileSync('/app/clawdmatrix/data/skills.json', 'utf-8'))\""
        )
        if code != 0:
            failures.append(f'skills.json parse error: {out[:200]}')

        # Check wrapper can generate CLAUDE.md
        out, _, code = self.exec_command(
            'docker exec openclaw node /app/clawdmatrix/wrapper.js --claude-md 2>/dev/null | head -3'
        )
        if code != 0 or 'ClawdMatrix' not in out:
            failures.append(f'wrapper.js --claude-md failed: {out[:200]}')

        return (len(failures) == 0, failures)

    def update_clawdmatrix_skills(self, domain_map=None, skills=None):
        """Update ClawdMatrix skill data without full reinstall."""
        if domain_map:
            content = json.dumps(domain_map, ensure_ascii=False, indent=2)
            self.upload_file(content, '/tmp/_domain_map.json')
            self.exec_command(
                'docker cp /tmp/_domain_map.json openclaw:/app/clawdmatrix/data/domain-map.json'
            )
            self.exec_command('rm -f /tmp/_domain_map.json')

        if skills:
            content = json.dumps(skills, ensure_ascii=False, indent=2)
            self.upload_file(content, '/tmp/_skills.json')
            self.exec_command(
                'docker cp /tmp/_skills.json openclaw:/app/clawdmatrix/data/skills.json'
            )
            self.exec_command('rm -f /tmp/_skills.json')

        self.exec_command(
            'docker exec -u root openclaw chown -R node:node /app/clawdmatrix'
        )

        # Re-generate CLAUDE.md with updated data
        out, _, code = self.exec_command(
            'docker exec openclaw node /app/clawdmatrix/wrapper.js --claude-md',
            timeout=30,
        )
        if code == 0 and out.strip():
            self.upload_file(out.strip(), '/tmp/_clawdmatrix_claude.md')
            self.exec_command(
                'docker cp /tmp/_clawdmatrix_claude.md '
                'openclaw:/home/node/.openclaw/CLAUDE.md'
            )
            self.exec_command('rm -f /tmp/_clawdmatrix_claude.md')
            self.exec_command(
                'docker exec -u root openclaw chown node:node /home/node/.openclaw/CLAUDE.md'
            )

        logger.info(f'ClawdMatrix skills updated on {self.server.ip_address}')


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
        # Get the owner's Telegram ID to restrict bot access
        telegram_owner_id = None
        try:
            telegram_owner_id = user.telegram_bot_user.telegram_id
        except Exception:
            pass

        manager = ServerManager(available_server)
        try:
            # Use quick deploy on warmed servers (~30s), full deploy as fallback (~5-10min)
            if available_server.openclaw_running:
                result = manager.quick_deploy_user(
                    openrouter_key=profile.openrouter_api_key,
                    telegram_token=profile.telegram_bot_token,
                    model_slug=profile.selected_model,
                    telegram_owner_id=telegram_owner_id,
                )
            else:
                result = manager.deploy_openclaw(
                    openrouter_key=profile.openrouter_api_key,
                    telegram_token=profile.telegram_bot_token,
                    model_slug=profile.selected_model,
                    telegram_owner_id=telegram_owner_id,
                )
            if result:
                available_server.openclaw_running = True
                available_server.save()
                deploy_type = 'quick' if available_server.openclaw_running else 'full'
                send_telegram_message(
                    ADMIN_TELEGRAM_ID,
                    f'✅ OpenClaw deployed ({deploy_type})!\nIP: {available_server.ip_address}\nUser: {user.email}'
                )
                # Notify Telegram bot user that their bot is ready
                try:
                    tg_bot_user = user.telegram_bot_user
                    bot_username = profile.telegram_bot_username or ''
                    from apps.telegram_bot.services import notify_user
                    notify_user(
                        tg_bot_user.chat_id,
                        f'🎉 Ваш бот готов!\n\n'
                        f'Напишите <b>@{bot_username}</b>',
                    )
                except Exception:
                    pass  # User may not be a Telegram bot user
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

    telegram_owner_id = None
    try:
        telegram_owner_id = user.telegram_bot_user.telegram_id
    except Exception:
        pass

    manager = ServerManager(server)
    manager.deploy_openclaw(
        openrouter_key=profile.openrouter_api_key,
        telegram_token=profile.telegram_bot_token,
        model_slug=profile.selected_model,
        telegram_owner_id=telegram_owner_id,
    )
