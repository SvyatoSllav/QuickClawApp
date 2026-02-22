"""ServerManager — управление OpenClaw на серверах через SSH (paramiko)"""
import json
import logging
import paramiko
import io
from django.conf import settings


# Dockerfile для сборки образа OpenClaw с Chrome headless
DOCKERFILE_CONTENT = """FROM ghcr.io/openclaw/openclaw:latest

USER root

RUN apt-get update -qq && \\
    apt-get install -y -qq --no-install-recommends \\
    wget gnupg2 ca-certificates python3-pip \\
    fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \\
    libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \\
    libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \\
    libxrandr2 xdg-utils libxss1 libgconf-2-4 \\
    libpango-1.0-0 libpangocairo-1.0-0 libcairo2 && \\
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \\
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \\
    apt-get update -qq && \\
    apt-get install -y -qq --no-install-recommends google-chrome-stable && \\
    pip install --break-system-packages python-pptx && \\
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Redirect Brave Search API to local SearXNG adapter
RUN sed -i 's|https://api.search.brave.com/res/v1/web/search|http://searxng-adapter:3000/res/v1/web/search|g' /app/dist/*.js

USER node
"""

# docker-compose: OpenClaw + SearXNG + Lightpanda + Valkey
DOCKER_COMPOSE_WITH_CHROME = """services:
  openclaw:
    build: .
    image: openclaw-chrome:latest
    container_name: openclaw
    restart: unless-stopped
    shm_size: 2g
    ports:
      - "18789:18789"
    env_file:
      - .env
    volumes:
      - ./openclaw-config.yaml:/app/config.yaml
      - ./data:/app/data
      - config:/home/node/.openclaw
    depends_on:
      - searxng
      - lightpanda

  searxng:
    image: docker.io/searxng/searxng:latest
    container_name: searxng
    restart: unless-stopped
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=http://searxng:8080

  lightpanda:
    image: lightpanda/browser:nightly
    container_name: lightpanda
    restart: unless-stopped
    environment:
      - LIGHTPANDA_DISABLE_TELEMETRY=true
    mem_limit: 512m

  searxng-adapter:
    image: openclaw-chrome:latest
    container_name: searxng-adapter
    restart: unless-stopped
    user: node
    volumes:
      - ./searxng-adapter.js:/tmp/adapter.js:ro
    entrypoint: ["node", "/tmp/adapter.js"]
    depends_on:
      - searxng
      - openclaw

  lightpanda-adapter:
    image: openclaw-chrome:latest
    container_name: lightpanda-adapter
    restart: unless-stopped
    user: "0"
    working_dir: /app
    volumes:
      - ./lightpanda-cdp-adapter.js:/tmp/adapter.js:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    entrypoint: ["node", "/tmp/adapter.js"]
    environment:
      - LP_HOST=lightpanda
      - LP_PORT=9222
      - LISTEN_PORT=9223
      - NODE_PATH=/app/node_modules
    depends_on:
      - lightpanda

  valkey:
    image: docker.io/valkey/valkey:8-alpine
    container_name: searxng-redis
    restart: unless-stopped
    command: valkey-server --save 30 1 --loglevel warning

volumes:
  config:
    name: openclaw_config
"""

# SearXNG settings.yml — minimal private instance with JSON API enabled
SEARXNG_SETTINGS_YML = """\
use_default_settings: true

general:
  instance_name: "OpenClaw Search"
  debug: false

search:
  safe_search: 0
  autocomplete: ""
  formats:
    - html
    - json

server:
  bind_address: "0.0.0.0"
  port: 8080
  secret_key: "{secret_key}"
  limiter: false
  image_proxy: false

redis:
  url: "redis://searxng-redis:6379/0"
"""

# Lightpanda CDP adapter v24 — WebSocket proxy with:
# 1. HTTP /json/* endpoints for Playwright discovery + /health endpoint
# 2. Uses LP's STARTUP session as real page (forwards first session, hides extras)
# 3. Stubs unsupported methods (Target.attachToBrowserTarget, etc.)
# 4. Intercepts Target.createTarget (LP is single-page) — emits synthetic CDP events
# 5. 10s response timeout — returns fast CDP errors instead of hanging
# 6. Auto-restarts lightpanda container via Docker socket when stuck
LIGHTPANDA_CDP_ADAPTER_JS = """\
const http = require('http');
const WebSocket = require('ws');

const LP_HOST = process.env.LP_HOST || 'lightpanda';
const LP_PORT = parseInt(process.env.LP_PORT || '9222', 10);
const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || '9223', 10);
const SELF_HOST = 'lightpanda-adapter';
const LP_WS = 'ws://' + LP_HOST + ':' + LP_PORT + '/';
const BROWSER_SESSION = 'browser-stub-session';
const CMD_TIMEOUT_MS = 10000;

const STUB_METHODS = new Set([
  'Target.attachToBrowserTarget', 'Target.detachFromTarget',
  'Browser.getWindowForTarget', 'Browser.setWindowBounds', 'Browser.getWindowBounds',
]);

function log(msg) { console.log('[' + new Date().toISOString().substr(11,8) + '] ' + msg); }

var consecutiveTimeouts = 0;
var restartInProgress = false;
var lastRestartTime = 0;
var restartCount = 0;
var RESTART_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between restarts
var MAX_RESTARTS = 5; // circuit breaker: disable after N restarts

function restartLP() {
  if (restartInProgress) return;
  var now = Date.now();
  if (now - lastRestartTime < RESTART_COOLDOWN_MS) {
    log('Restart cooldown active, skipping (' + Math.round((RESTART_COOLDOWN_MS - (now - lastRestartTime)) / 1000) + 's remaining)');
    return;
  }
  if (restartCount >= MAX_RESTARTS) {
    log('Circuit breaker: max restarts (' + MAX_RESTARTS + ') reached, browser disabled');
    return;
  }
  restartInProgress = true;
  lastRestartTime = now;
  restartCount++;
  log('Auto-restarting lightpanda container (restart ' + restartCount + '/' + MAX_RESTARTS + ')...');
  var req = http.request({
    socketPath: '/var/run/docker.sock',
    path: '/containers/lightpanda/restart?t=2',
    method: 'POST'
  }, function(res) {
    log('LP restart: HTTP ' + res.statusCode);
    restartInProgress = false;
    consecutiveTimeouts = 0;
  });
  req.on('error', function(err) {
    log('LP restart failed: ' + err.message);
    restartInProgress = false;
  });
  req.setTimeout(15000, function() { req.destroy(); restartInProgress = false; });
  req.end();
}

var httpServer = http.createServer(function(req, res) {
  var url = new URL(req.url, 'http://localhost:' + LISTEN_PORT);
  var path = url.pathname.replace(/\\/+$/, '') || '/';
  res.setHeader('Content-Type', 'application/json');
  if (path === '/json/version') {
    res.end(JSON.stringify({
      Browser: 'Lightpanda/nightly', 'Protocol-Version': '1.3',
      webSocketDebuggerUrl: 'ws://' + SELF_HOST + ':' + LISTEN_PORT + '/'
    }));
  } else if (path === '/json/list' || path === '/json') {
    res.end(JSON.stringify([{
      id: 'default', type: 'page', title: 'Lightpanda', url: 'about:blank',
      webSocketDebuggerUrl: 'ws://' + SELF_HOST + ':' + LISTEN_PORT + '/'
    }]));
  } else if (path === '/json/new') {
    res.end(JSON.stringify({ id: 'default', type: 'page', url: 'about:blank' }));
  } else if (path === '/health') {
    var ok = !restartInProgress && consecutiveTimeouts < 3;
    res.writeHead(ok ? 200 : 503);
    res.end(JSON.stringify({ healthy: ok, timeouts: consecutiveTimeouts }));
  } else { res.writeHead(404); res.end('{}'); }
});

var wss = new WebSocket.Server({ server: httpServer });
wss.on('connection', function(clientWs) {
  log('CLIENT connected');
  var lpWs = new WebSocket(LP_WS);
  var lpReady = false, pendingQueue = [];
  var pageSessionId = null, pageTargetId = null;
  var hiddenSessions = {};
  var fakeToReal = {}, fakeTargetIds = {}, fakeCounter = 0;
  var proxiedRequests = {}, proxyIdCounter = 900000;
  var cmdTimers = {};
  var pendingCreateTargets = [];

  function cleanup() {
    Object.keys(cmdTimers).forEach(function(id) { clearTimeout(cmdTimers[id]); });
    cmdTimers = {};
  }

  function sendToLP(data) {
    if (lpReady) lpWs.send(data); else pendingQueue.push(data);
  }

  function startTimeout(lpId) {
    cmdTimers[lpId] = setTimeout(function() {
      var pr = proxiedRequests[lpId];
      if (!pr) return;
      delete proxiedRequests[lpId];
      delete cmdTimers[lpId];
      consecutiveTimeouts++;
      log('TIMEOUT lpId=' + lpId + ' clientId=' + pr.originalId + ' (consecutive: ' + consecutiveTimeouts + ')');
      var err = { id: pr.originalId, error: { code: -32000, message: 'Lightpanda response timeout' } };
      if (pr.originalSession) err.sessionId = pr.originalSession;
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify(err));
      if (consecutiveTimeouts >= 2) restartLP();
    }, CMD_TIMEOUT_MS);
  }

  lpWs.on('open', function() {
    log('LP connected');
    lpReady = true;
    pendingQueue.forEach(function(m) { lpWs.send(m); });
    pendingQueue = [];
  });

  lpWs.on('message', function(data) {
    var str = data.toString(), msg;
    consecutiveTimeouts = 0;
    try { msg = JSON.parse(str); } catch(e) {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(str);
      return;
    }
    // Track sessions but DON'T forward — we expose page via createTarget
    if (msg.method === 'Target.attachedToTarget' && msg.params && msg.params.sessionId) {
      if (!pageSessionId) {
        pageSessionId = msg.params.sessionId;
        if (msg.params.targetInfo) pageTargetId = msg.params.targetInfo.targetId;
        log('LP page session: ' + pageSessionId + ' target: ' + pageTargetId + ' (hidden)');
        // Process queued createTargets
        pendingCreateTargets.forEach(function(ct) { emitNewPage(ct); });
        pendingCreateTargets = [];
      } else {
        log('Hiding extra session: ' + msg.params.sessionId);
      }
      return;
    }
    // Hide events on LP's internal sessions — expose only fake sessions
    if (msg.sessionId === pageSessionId) { return; }
    // Clear timeout for any response (raw or proxied)
    if (msg.id) {
      var rawKey = 'r' + msg.id;
      if (cmdTimers[rawKey]) { clearTimeout(cmdTimers[rawKey]); delete cmdTimers[rawKey]; }
      if (cmdTimers[msg.id]) { clearTimeout(cmdTimers[msg.id]); delete cmdTimers[msg.id]; }
    }
    if (msg.id && proxiedRequests[msg.id]) {
      var pr = proxiedRequests[msg.id];
      delete proxiedRequests[msg.id];
      msg.id = pr.originalId;
      msg.sessionId = pr.originalSession;
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify(msg));
      return;
    }
    if (clientWs.readyState === WebSocket.OPEN) { clientWs.send(str); }
  });

  lpWs.on('close', function() {
    log('LP disconnected');
    Object.keys(proxiedRequests).forEach(function(lpId) {
      if (cmdTimers[lpId]) { clearTimeout(cmdTimers[lpId]); delete cmdTimers[lpId]; }
      var pr = proxiedRequests[lpId];
      var err = { id: pr.originalId, error: { code: -32000, message: 'Lightpanda disconnected' } };
      if (pr.originalSession) err.sessionId = pr.originalSession;
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify(err));
    });
    proxiedRequests = {};
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });
  lpWs.on('error', function(err) { log('LP error: ' + err.message); });

  clientWs.on('message', function(data) {
    var str = data.toString(), msg;
    try { msg = JSON.parse(str); } catch(e) { sendToLP(str); return; }

    if (msg.method && STUB_METHODS.has(msg.method)) {
      var r = { id: msg.id, result: {} };
      if (msg.method === 'Target.attachToBrowserTarget') r.result = { sessionId: BROWSER_SESSION };
      if (msg.sessionId) r.sessionId = msg.sessionId;
      clientWs.send(JSON.stringify(r));
      return;
    }

    // LP is single-page: return existing target instead of creating new one
    if (msg.method === 'Target.createTarget') {
      if (pageTargetId) {
        log('createTarget -> returning existing target ' + pageTargetId);
        var resp = { id: msg.id, result: { targetId: pageTargetId } };
        if (msg.sessionId) resp.sessionId = msg.sessionId;
        clientWs.send(JSON.stringify(resp));
      } else {
        log('createTarget queued (waiting for LP page session)');
        pendingCreateTargets.push(msg);
      }
      return;
    }

    if (msg.sessionId === BROWSER_SESSION && msg.method === 'Target.attachToTarget') {
      fakeCounter++;
      var fakeSid = 'fake-session-' + fakeCounter;
      var realSid = pageSessionId || '';
      fakeToReal[fakeSid] = realSid;
      var tid = (msg.params && msg.params.targetId) || pageTargetId || 'unknown';
      log('Fake session ' + fakeSid + ' -> real ' + realSid);
      clientWs.send(JSON.stringify({
        method: 'Target.attachedToTarget',
        params: {
          sessionId: fakeSid,
          targetInfo: { targetId: tid, type: 'page', title: '', url: 'about:blank', attached: true, canAccessOpener: false },
          waitingForDebugger: false
        },
        sessionId: BROWSER_SESSION
      }));
      clientWs.send(JSON.stringify({ id: msg.id, result: { sessionId: fakeSid }, sessionId: BROWSER_SESSION }));
      return;
    }

    if (msg.sessionId && fakeToReal[msg.sessionId] && msg.method === 'Target.getTargetInfo') {
      var infoTid = fakeTargetIds[msg.sessionId] || pageTargetId || 'unknown';
      clientWs.send(JSON.stringify({
        id: msg.id,
        result: { targetInfo: { targetId: infoTid, type: 'page', title: '', url: 'about:blank', attached: true, canAccessOpener: false, browserContextId: 'BID-1' } },
        sessionId: msg.sessionId
      }));
      return;
    }

    if (msg.sessionId === BROWSER_SESSION) {
      var lpId = ++proxyIdCounter;
      proxiedRequests[lpId] = { originalId: msg.id, originalSession: BROWSER_SESSION };
      startTimeout(lpId);
      var f = Object.assign({}, msg); delete f.sessionId; f.id = lpId;
      sendToLP(JSON.stringify(f));
      return;
    }

    if (msg.sessionId && fakeToReal[msg.sessionId]) {
      var lpId2 = ++proxyIdCounter;
      proxiedRequests[lpId2] = { originalId: msg.id, originalSession: msg.sessionId };
      startTimeout(lpId2);
      var f2 = Object.assign({}, msg); f2.sessionId = fakeToReal[msg.sessionId]; f2.id = lpId2;
      sendToLP(JSON.stringify(f2));
      return;
    }

    // Track raw-forwarded commands for timeout
    if (msg.id) {
      var rawKey = 'r' + msg.id;
      var rawSession = msg.sessionId || null;
      cmdTimers[rawKey] = setTimeout(function() {
        delete cmdTimers[rawKey];
        consecutiveTimeouts++;
        log('TIMEOUT raw id=' + msg.id + ' method=' + (msg.method || '?') + ' (consecutive: ' + consecutiveTimeouts + ')');
        var err = { id: msg.id, error: { code: -32000, message: 'Lightpanda response timeout' } };
        if (rawSession) err.sessionId = rawSession;
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify(err));
        if (consecutiveTimeouts >= 2) restartLP();
      }, CMD_TIMEOUT_MS);
    }
    sendToLP(str);
  });

  clientWs.on('close', function() {
    log('CLIENT disconnected');
    cleanup();
    if (lpWs.readyState === WebSocket.OPEN) lpWs.close();
  });
  clientWs.on('error', function() {});
});

httpServer.listen(LISTEN_PORT, '0.0.0.0', function() {
  log('Lightpanda CDP adapter v24 on :' + LISTEN_PORT + ' -> ' + LP_HOST + ':' + LP_PORT);
});
"""

# SearXNG-to-Brave API adapter — translates Brave Search format to SearXNG
SEARXNG_ADAPTER_JS = """\
const http = require('http');
const SEARXNG = 'http://searxng:8080/search';

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:3000');
    const q = url.searchParams.get('q') || '';
    const count = parseInt(url.searchParams.get('count') || '5', 10);
    const lang = url.searchParams.get('search_lang') || '';
    const searxParams = new URLSearchParams({ q, format: 'json' });
    if (lang) searxParams.set('language', lang);

    const resp = await fetch(`${SEARXNG}?${searxParams}`);
    const data = await resp.json();

    const results = (data.results || []).slice(0, count).map(r => ({
      title: r.title || '',
      url: r.url || '',
      description: r.content || '',
      age: r.publishedDate || undefined,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ web: { results } }));
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ web: { results: [] } }));
  }
}).listen(3000, '0.0.0.0');
"""

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
            password=self.server.ssh_password or None,
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
        """Настройка Chrome headless внутри контейнера OpenClaw.
        Chrome уже установлен в образе через Dockerfile, здесь только
        очистка stale lock-файлов и настройка профиля."""
        logger.info(f'Configuring Chrome headless on {self.server.ip_address}...')

        # Очистка stale lock-файлов от предыдущих падений Chrome
        self.exec_command(
            'docker exec openclaw rm -f '
            '/home/node/.openclaw/browser/headless/user-data/SingletonLock '
            '/home/node/.openclaw/browser/headless/user-data/SingletonSocket '
            '/home/node/.openclaw/browser/headless/user-data/SingletonCookie '
            '2>/dev/null || true'
        )

        # Настройка профиля браузера
        browser_commands = [
            'docker exec openclaw node /app/openclaw.mjs browser create-profile --name headless --color "#00FF00" --driver openclaw 2>/dev/null || true',
            'docker exec openclaw node /app/openclaw.mjs config set browser.defaultProfile lightpanda',
            'docker exec openclaw node /app/openclaw.mjs config set browser.noSandbox true',
            'docker exec openclaw node /app/openclaw.mjs config set browser.headless true',
        ]

        for cmd in browser_commands:
            self.exec_command(cmd)

        logger.info(f'Chrome headless configured on {self.server.ip_address}')
        # NOTE: Lightpanda browser profile is configured by configure_searxng_provider().
        return True

    def _upload_docker_files(self, path):
        """Upload Dockerfile, docker-compose, SearXNG settings, and adapters to server"""
        self.upload_file(DOCKERFILE_CONTENT, f'{path}/Dockerfile')
        self.upload_file(DOCKER_COMPOSE_WITH_CHROME, f'{path}/docker-compose.yml')
        self._upload_searxng_settings()
        self.upload_file(SEARXNG_ADAPTER_JS, f'{path}/searxng-adapter.js')
        self.upload_file(LIGHTPANDA_CDP_ADAPTER_JS, f'{path}/lightpanda-cdp-adapter.js')

    def set_model(self, model_slug: str) -> tuple[bool, str]:
        """Change the active model on a running OpenClaw container.

        Args:
            model_slug: Frontend model ID like 'claude-sonnet-4' or 'minimax-m2.5'.

        Returns:
            (success, message) tuple.
        """
        from django.conf import settings as django_settings
        model_mapping = getattr(django_settings, 'MODEL_MAPPING', {})
        base_model = model_mapping.get(model_slug, model_slug)
        openrouter_model = self._ensure_openrouter_prefix(base_model)

        cli = 'docker exec openclaw node /app/openclaw.mjs'
        out, err, exit_code = self.exec_command(
            f'{cli} models set {openrouter_model}',
            timeout=30,
        )

        if exit_code != 0:
            logger.warning('set_model failed for %s: %s', openrouter_model, err or out)
            return False, (err or out).strip()

        # Re-apply aliases so /model command still works after models set
        self._apply_model_aliases()

        logger.info('Model changed to %s on %s', openrouter_model, self.server.ip_address)
        return True, openrouter_model

    @staticmethod
    def _ensure_openrouter_prefix(model: str) -> str:
        """Ensure model string has openrouter/ prefix for routing through OpenRouter."""
        if model and not model.startswith('openrouter/'):
            return f'openrouter/{model}'
        return model

    def _apply_model_aliases(self):
        """Set model aliases so user can switch models via /model command.

        Must be called AFTER `models set` because that command overwrites
        agents.defaults.models with only the primary model.
        """
        cli = 'docker exec openclaw node /app/openclaw.mjs'
        aliases = {
            "openrouter/anthropic/claude-opus-4.5": {"alias": "opus"},
            "openrouter/anthropic/claude-sonnet-4": {"alias": "sonnet"},
            "openrouter/anthropic/claude-sonnet-4-5-20250929": {"alias": "sonnet45"},
            "openrouter/anthropic/claude-haiku-4.5": {"alias": "haiku"},
            "openrouter/openai/gpt-4o": {"alias": "gpt4o"},
            "openrouter/google/gemini-2.5-flash": {"alias": "flash"},
            "openrouter/google/gemini-3-flash-preview": {"alias": "gemini3"},
            "openrouter/deepseek/deepseek-reasoner": {"alias": "deepseek"},
            "openrouter/minimax/minimax-m2.5": {"alias": "minimax"},
        }
        aliases_json = json.dumps(aliases)
        out, err, code = self.exec_command(
            f"{cli} config set agents.defaults.models '{aliases_json}'"
        )
        if code != 0:
            logger.warning(f'Model aliases failed: {err[:200]}')

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

            # --- Sub-agent model: gpt-5-nano (cheapest + fast) ---
            f"""{cli} config set agents.defaults.subagents '{{"model": "openrouter/openai/gpt-5-nano", "maxConcurrent": 2, "archiveAfterMinutes": 60}}'""",

            # --- Image model: cheap model ---
            f"""{cli} config set agents.defaults.imageModel '{{"primary": "openrouter/google/gemini-2.5-flash", "fallbacks": ["openrouter/openai/gpt-4o-mini"]}}'""",

            # --- Compaction with memoryFlush (saves context before compaction) ---
            f"""{cli} config set agents.defaults.compaction '{{"mode": "default", "memoryFlush": {{"enabled": true, "softThresholdTokens": 30000}}}}'""",

            # --- Context pruning with keepLastAssistants ---
            f"""{cli} config set agents.defaults.contextPruning '{{"mode": "cache-ttl", "ttl": "1h", "keepLastAssistants": 3}}'""",

            # --- Concurrency limit ---
            f'{cli} config set agents.defaults.maxConcurrent 2',

            # --- Enable web search ---
            f'{cli} config set web.enabled true',
            # NOTE: SearXNG provider is configured via configure_searxng_provider()
            # which sets provider=brave (adapter translates to SearXNG)

            # --- Bootstrap file size limit (reduces system prompt bloat) ---
            f'{cli} config set agents.defaults.bootstrapMaxChars 20000',

            # --- Context token limit (100K — triggers compaction earlier) ---
            f'{cli} config set agents.defaults.contextTokens 100000',

            # --- Local RAG — semantic memory search across sessions ---
            f"""{cli} config set agents.defaults.memorySearch '{{"enabled": true, "provider": "local", "store": {{"path": "/home/node/.openclaw/memory.db"}}}}'""",

            # --- Enable HTTP chat completions endpoint (for mobile app) ---
            f"""{cli} config set gateway.http.endpoints.chatCompletions '{{"enabled": true}}'""",
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
        self._apply_model_aliases()

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
BRAVE_API_KEY=local-searxng
LOG_LEVEL=info
"""

        # Generic config — no telegram channel, default model
        config_content = f"""provider: openrouter
model: openrouter/anthropic/claude-sonnet-4

gateway:
  mode: local
  bind: lan
  auth:
    type: token
    token: {gateway_token}
  controlUi:
    allowInsecureAuth: true
    allowedOrigins: ["http://localhost:8081", "http://localhost:19006", "http://localhost:3000"]

limits:
  max_tokens_per_message: 4096
  max_context_messages: 30
"""

        try:
            self.connect()

            self.upload_file(env_content, f'{path}/.env')
            self.upload_file(config_content, f'{path}/openclaw-config.yaml')
            self._upload_docker_files(path)

            # Stop existing container and clear stale config
            self.exec_command(f'cd {path} && docker compose down 2>/dev/null || true')
            self.exec_command('docker volume rm openclaw_config 2>/dev/null || true')

            out, err, code = self.exec_command(f'cd {path} && docker compose up -d --build', timeout=300)
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

            # Run doctor + set gateway mode + bind to LAN for mobile access
            self.exec_command('docker exec openclaw node /app/openclaw.mjs doctor --fix')
            self.exec_command('docker exec openclaw node /app/openclaw.mjs config set gateway.mode local')
            self.exec_command('docker exec openclaw node /app/openclaw.mjs config set gateway.bind lan')

            # Apply token optimization
            self.configure_token_optimization()

            # Install session watchdog (auto-recovers from Gemini thought signature errors)
            self.install_session_watchdog()

            # Prune unused built-in skills
            self.prune_builtin_skills()

            # Install multi-agent workspace files and config
            self.install_agents()

            # Start browser with headless profile (CLI still works at this point)
            self.exec_command(
                'docker exec openclaw node /app/openclaw.mjs browser start --browser-profile headless'
            )

            # Configure SearXNG (via Brave adapter) + Lightpanda browser
            self.configure_searxng_provider()

            self.server.openclaw_running = True
            self.server.gateway_token = gateway_token
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
BRAVE_API_KEY=local-searxng
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
  bind: lan
  auth:
    type: token
    token: {gateway_token}
  controlUi:
    allowInsecureAuth: true
    allowedOrigins: ["http://localhost:8081", "http://localhost:19006", "http://localhost:3000"]

channels:
  telegram:
    enabled: true
    botToken: {telegram_token}
    dmPolicy: open
    allowFrom: {allow_from}
    groupPolicy: allowlist
    streamMode: off

limits:
  max_tokens_per_message: 4096
  max_context_messages: 30
"""

        try:
            self.connect()

            # Upload user-specific config files
            self.upload_file(env_content, f'{path}/.env')
            self.upload_file(config_content, f'{path}/openclaw-config.yaml')

            # Ensure latest docker-compose with SearXNG + Lightpanda
            self._upload_docker_files(path)

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

            # Prune unused built-in skills
            self.prune_builtin_skills()

            # Install multi-agent workspace files and config (with OpenRouter auth)
            self.install_agents(openrouter_key=openrouter_key)

            # Apply user-specific config (auth-profiles, telegram) with retry
            # This runs AFTER install_agents so it has the final say on auth/model
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

            # Start browser with headless profile (CLI still works at this point)
            self.exec_command(
                'docker exec openclaw node /app/openclaw.mjs browser start --browser-profile headless'
            )

            # Configure SearXNG (via Brave adapter) + Lightpanda browser
            self.configure_searxng_provider()

            self.server.openclaw_running = True
            self.server.status = 'active'
            self.server.gateway_token = gateway_token
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

        # Write auth-profiles.json to ALL agent directories (main + sub-agents)
        self.upload_file(auth_json, '/tmp/_openclaw_auth.json')
        agent_dirs = ['main'] + self.AGENT_IDS
        for agent_id in agent_dirs:
            agent_path = f'/home/node/.openclaw/agents/{agent_id}/agent'
            self.exec_command(f'docker exec -u root openclaw mkdir -p {agent_path}')
            self.exec_command(
                f'docker cp /tmp/_openclaw_auth.json openclaw:{agent_path}/auth-profiles.json'
            )
        self.exec_command('rm -f /tmp/_openclaw_auth.json')

        self._fix_permissions()

        # Ensure model has openrouter/ prefix (provider is inferred from model prefix)
        openrouter_model = self._ensure_openrouter_prefix(openrouter_model)
        self.exec_command(
            f'docker exec openclaw node /app/openclaw.mjs models set {openrouter_model}'
        )

        # Re-apply model aliases (models set overwrites agents.defaults.models)
        self._apply_model_aliases()

        # Set dmPolicy to pairing — users must approve via pairing code
        self.exec_command(
            'docker exec openclaw node /app/openclaw.mjs config set channels.telegram.dmPolicy pairing'
        )

    def _verify_config(self, openrouter_key, openrouter_model, telegram_owner_id=None):
        """
        Verify that all critical OpenClaw settings are correctly applied.
        Returns (ok: bool, failures: list[str]).
        """
        failures = []

        # 1. dmPolicy must be "pairing"
        out, _, _ = self.exec_command(
            'docker exec openclaw node /app/openclaw.mjs config get channels.telegram.dmPolicy'
        )
        if 'pairing' not in out.strip():
            failures.append(f'dmPolicy={out.strip()!r} (expected "pairing")')

        # 2. Model must contain openrouter/ — check logs; force-fix if wrong
        out, _, _ = self.exec_command(
            'docker logs openclaw --tail 30 2>&1 | grep "agent model:" | tail -1'
        )
        if 'openrouter/' not in out:
            # Force re-set the model with openrouter/ prefix
            openrouter_model = self._ensure_openrouter_prefix(openrouter_model)
            self.exec_command(
                f'docker exec openclaw node /app/openclaw.mjs models set {openrouter_model}'
            )
            failures.append(f'model not set to openrouter (logs={out.strip()!r}), re-applied')

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
BRAVE_API_KEY=local-searxng
LOG_LEVEL=info
"""

        # Build allowFrom — restrict to owner's Telegram ID if known
        allow_from = f'["{telegram_owner_id}"]' if telegram_owner_id else '["*"]'

        config_content = f"""provider: openrouter
model: {openrouter_model}
api_key: {openrouter_key}

gateway:
  mode: local
  bind: lan
  auth:
    type: token
    token: {gateway_token}
  controlUi:
    allowInsecureAuth: true
    allowedOrigins: ["http://localhost:8081", "http://localhost:19006", "http://localhost:3000"]

channels:
  telegram:
    enabled: true
    botToken: {telegram_token}
    dmPolicy: open
    allowFrom: {allow_from}
    groupPolicy: allowlist
    streamMode: off

limits:
  max_tokens_per_message: 4096
  max_context_messages: 30
"""

        try:
            self.connect()

            # Upload all config files
            self.upload_file(env_content, f'{path}/.env')
            self.upload_file(config_content, f'{path}/openclaw-config.yaml')
            self._upload_docker_files(path)

            # Stop existing container and clear stale config
            self.exec_command(f'cd {path} && docker compose down 2>/dev/null || true')
            self.exec_command('docker volume rm openclaw_config 2>/dev/null || true')

            # Start container
            out, err, code = self.exec_command(f'cd {path} && docker compose up -d --build', timeout=300)

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
            self.exec_command('docker exec openclaw node /app/openclaw.mjs config set gateway.bind lan')

            # Set model
            self.exec_command(
                f'docker exec openclaw node /app/openclaw.mjs models set {openrouter_model}'
            )

            # Configure token optimization
            self.configure_token_optimization(model_slug)
            self.install_session_watchdog()

            # Prune unused built-in skills
            self.prune_builtin_skills()

            # Install multi-agent workspace files and config (with OpenRouter auth)
            self.install_agents(openrouter_key=openrouter_key)

            # Apply config with restart + verify (includes restart cycle)
            # Runs AFTER install_agents so it has the final say on auth/model
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

            # Start the browser with headless profile (CLI still works at this point)
            self.exec_command(
                'docker exec openclaw node /app/openclaw.mjs browser start --browser-profile headless'
            )

            # Configure SearXNG (via Brave adapter) + Lightpanda browser
            self.configure_searxng_provider()

            self.server.openclaw_running = True
            self.server.status = 'active'
            self.server.gateway_token = gateway_token
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


    # ─── SearXNG + Lightpanda ────────────────────────────────────────

    def _upload_searxng_settings(self):
        """Upload SearXNG settings.yml to the server."""
        import secrets as secrets_mod
        path = self.server.openclaw_path

        self.exec_command(f'mkdir -p {path}/searxng')

        secret_key = secrets_mod.token_hex(32)
        settings_content = SEARXNG_SETTINGS_YML.format(secret_key=secret_key)

        self.upload_file(settings_content, f'{path}/searxng/settings.yml')
        logger.info(f'SearXNG settings uploaded to {self.server.ip_address}')

    def configure_searxng_provider(self):
        """Configure SearXNG (via Brave adapter) + Lightpanda as default browser.

        Lightpanda is the default browser — fast and lightweight via the CDP
        adapter (v20). Chrome headless is available as 'headless' profile for
        complex JS-heavy sites that Lightpanda can't handle.

        Search provider is 'brave' (the adapter translates Brave API requests
        to SearXNG). BRAVE_API_KEY env var satisfies the API key check.
        """
        cli = 'docker exec openclaw node /app/openclaw.mjs'
        commands = [
            f'{cli} config set tools.web.search.provider brave',
            f'{cli} config set tools.web.search.enabled true',
            f'{cli} browser create-profile --name lightpanda --driver cdp --color "#0066CC" 2>/dev/null || true',
            f'{cli} config set browser.profiles.lightpanda.cdpUrl http://lightpanda-adapter:9223',
            f'{cli} config set browser.defaultProfile lightpanda',
        ]
        for cmd in commands:
            out, err, code = self.exec_command(cmd)
            if code != 0:
                logger.warning(f'SearXNG/Lightpanda config failed: {cmd[-60:]} err={err[:200]}')

        # Health check: verify SearXNG adapter responds
        import time
        time.sleep(3)
        out, _, code = self.exec_command(
            'docker exec openclaw curl -sf http://searxng-adapter:3000/res/v1/web/search?q=test\\&count=1 2>/dev/null'
        )
        if code != 0:
            logger.warning(f'SearXNG health check failed on {self.server.ip_address}')
        else:
            logger.info(f'SearXNG + browser configured on {self.server.ip_address}')

    def configure_lightpanda_browser(self):
        """Configure Lightpanda browser. Delegates to configure_searxng_provider()."""
        self.configure_searxng_provider()

    def _clean_invalid_searxng_config(self):
        """Remove old invalid config from openclaw.json (searxng provider, broken profiles).

        Reads/writes directly from the Docker volume on the host filesystem,
        so this works even when the openclaw container is crash-looping.
        """
        vol_path = '/var/lib/docker/volumes/openclaw_config/_data/openclaw.json'
        out, _, code = self.exec_command(f'cat {vol_path} 2>/dev/null')
        if code != 0 or not out.strip():
            return
        try:
            config = json.loads(out)
        except json.JSONDecodeError:
            return
        changed = False

        # Fix tools.web.search: remove invalid searxng provider/key
        search = config.get('tools', {}).get('web', {}).get('search', {})
        if 'searxng' in search:
            del search['searxng']
            changed = True
        if search.get('provider') == 'searxng':
            search['provider'] = 'brave'
            changed = True

        # Fix browser profiles: remove incomplete lightpanda profile (missing color)
        profiles = config.get('browser', {}).get('profiles', {})
        if 'lightpanda' in profiles and 'color' not in profiles['lightpanda']:
            del profiles['lightpanda']
            changed = True
        # Reset default profile to headless if it was lightpanda (and profile was removed)
        if config.get('browser', {}).get('defaultProfile') == 'lightpanda' and 'lightpanda' not in profiles:
            config['browser']['defaultProfile'] = 'headless'
            changed = True

        if changed:
            new_json = json.dumps(config, indent=2)
            self.upload_file(new_json, '/tmp/_oc_fix.json')
            self.exec_command(f'cp /tmp/_oc_fix.json {vol_path}')
            self.exec_command('rm -f /tmp/_oc_fix.json')
            # Restart container so it picks up the fixed config
            self.exec_command('docker restart openclaw 2>/dev/null')
            logger.info(f'Cleaned invalid config on {self.server.ip_address}')

    def verify_searxng(self):
        """Verify SearXNG + Lightpanda are running and accessible.
        Returns (ok: bool, failures: list[str]).
        """
        failures = []

        # 1. SearXNG container running
        out, _, code = self.exec_command(
            'docker inspect searxng --format={{.State.Status}} 2>/dev/null'
        )
        if 'running' not in out.strip():
            failures.append(f'searxng container status={out.strip()!r}')

        # 2. Valkey (Redis) container running
        out, _, code = self.exec_command(
            'docker inspect searxng-redis --format={{.State.Status}} 2>/dev/null'
        )
        if 'running' not in out.strip():
            failures.append(f'valkey container status={out.strip()!r}')

        # 3. Lightpanda container running
        out, _, code = self.exec_command(
            'docker inspect lightpanda --format={{.State.Status}} 2>/dev/null'
        )
        if 'running' not in out.strip():
            failures.append(f'lightpanda container status={out.strip()!r}')

        # 4. SearXNG adapter container running
        out, _, code = self.exec_command(
            'docker inspect searxng-adapter --format={{.State.Status}} 2>/dev/null'
        )
        if 'running' not in out.strip():
            failures.append(f'searxng-adapter container status={out.strip()!r}')

        # 5. Adapter responds with Brave-format JSON
        out, _, code = self.exec_command(
            'docker exec openclaw wget -qO- "http://searxng-adapter:3000/res/v1/web/search?q=test&count=3" 2>/dev/null | head -c 300',
            timeout=15,
        )
        if code != 0 or '"web"' not in out:
            failures.append(f'SearXNG adapter not responding (code={code})')

        # 6. OpenClaw config has brave provider (adapter translates to SearXNG)
        out, _, _ = self.exec_command(
            'docker exec openclaw node /app/openclaw.mjs config get tools.web.search.provider 2>/dev/null'
        )
        if 'brave' not in out.strip().lower():
            failures.append(f'search provider not set to brave')

        return (not failures, failures)

    def install_searxng(self):
        """Install SearXNG + Lightpanda on an existing server (retrofit).

        Rebuilds the Docker image (sed-patches Brave URL to local adapter),
        starts all containers including the adapter, and configures OpenClaw.
        """
        import time
        path = self.server.openclaw_path

        logger.info(f'Installing SearXNG + Lightpanda on {self.server.ip_address}...')

        # Upload Dockerfile (with sed patch), docker-compose, SearXNG settings, adapter
        self._upload_docker_files(path)

        # Add BRAVE_API_KEY to .env if missing
        self.exec_command(
            f'grep -q BRAVE_API_KEY {path}/.env || echo "BRAVE_API_KEY=local-searxng" >> {path}/.env'
        )

        # Rebuild image (applies sed patch) + start all containers
        out, err, code = self.exec_command(
            f'cd {path} && docker compose up -d --build',
            timeout=300,
        )
        if code != 0:
            logger.error(f'SearXNG install failed on {self.server.ip_address}: {err[:500]}')
            return False

        # Clean old invalid config (reads/writes volume directly, works even if container is restarting)
        self._clean_invalid_searxng_config()

        # Wait for openclaw container to be running and ready
        for _ in range(12):
            time.sleep(10)
            out, _, _ = self.exec_command(
                'docker inspect openclaw --format={{.State.Status}} 2>/dev/null'
            )
            if out.strip() == 'running':
                # Verify CLI works
                _, _, code = self.exec_command(
                    'docker exec openclaw node /app/openclaw.mjs config get browser.headless 2>/dev/null'
                )
                if code == 0:
                    break
        else:
            logger.warning(f'openclaw container not ready after 120s on {self.server.ip_address}')

        # Configure OpenClaw: provider=brave (adapter translates to SearXNG)
        self.configure_searxng_provider()

        logger.info(f'SearXNG + Lightpanda installed on {self.server.ip_address}')
        return True

    # ─── Multi-Agent Support ────────────────────────────────────────────

    AGENT_IDS = ['researcher', 'writer', 'coder', 'analyst', 'assistant']
    AGENT_FILES = ['SOUL.md', 'IDENTITY.md', 'TOOLS.md']

    def install_agents(self, openrouter_key=None):
        """Deploy multi-agent workspace files and config to the OpenClaw container.

        Copies SOUL.md, IDENTITY.md, TOOLS.md for each agent into
        /home/node/.openclaw/agents/{id}/ and applies the agents config
        via openclaw.json merge.

        All agent models are forced to use OpenRouter provider. The model
        from openclaw-agents.json is used as default, but the openrouter/
        prefix is always enforced.

        If openrouter_key is provided, writes auth-profiles with
        default=openrouter to main + all sub-agents, ensuring no drift.
        """
        import os

        logger.info(f'Installing agents on {self.server.ip_address}...')

        agents_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'openclaw-config', 'agents',
        )
        agents_config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'openclaw-config', 'openclaw-agents.json',
        )

        # Create agent workspace directories and upload files
        for agent_id in self.AGENT_IDS:
            container_dir = f'/home/node/.openclaw/agents/{agent_id}'
            self.exec_command(
                f'docker exec -u root openclaw mkdir -p {container_dir}'
            )

            for filename in self.AGENT_FILES:
                local_path = os.path.join(agents_dir, agent_id, filename)
                try:
                    with open(local_path, 'r') as f:
                        content = f.read()
                except FileNotFoundError:
                    logger.warning(f'Agent file not found: {local_path}')
                    continue

                tmp_path = f'/tmp/_agent_{agent_id}_{filename}'
                self.upload_file(content, tmp_path)
                self.exec_command(
                    f'docker cp {tmp_path} openclaw:{container_dir}/{filename}'
                )
                self.exec_command(f'rm -f {tmp_path}')

        # Apply agents config via openclaw.json merge
        try:
            with open(agents_config_path, 'r') as f:
                agents_json = f.read()
        except FileNotFoundError:
            logger.error(f'openclaw-agents.json not found at {agents_config_path}')
            return

        # Read current openclaw.json from the Docker volume
        vol_path = '/var/lib/docker/volumes/openclaw_config/_data/openclaw.json'
        out, _, code = self.exec_command(f'cat {vol_path} 2>/dev/null')

        import json as json_mod
        if code == 0 and out.strip():
            try:
                config = json_mod.loads(out)
            except json_mod.JSONDecodeError:
                config = {}
        else:
            config = {}

        # Merge agents config (deep-merge to preserve agents.defaults.models)
        agents_config = json_mod.loads(agents_json)

        # CRITICAL: Enforce openrouter/ prefix on ALL agent models.
        # The agents JSON may have models without the prefix — force it.
        for agent in agents_config.get('agents', {}).get('list', []):
            model = agent.get('model', '')
            if model and not model.startswith('openrouter/'):
                agent['model'] = f'openrouter/{model}'

        if 'agents' not in config:
            config['agents'] = {}
        existing_defaults = config.get('agents', {}).get('defaults', {})
        config['agents']['list'] = agents_config['agents']['list']
        # Merge defaults: keep existing (e.g. models from `models set`) + add new
        config['agents']['defaults'] = {
            **existing_defaults,
            **agents_config['agents'].get('defaults', {}),
        }

        # Write merged config back
        merged_json = json_mod.dumps(config, indent=2, ensure_ascii=False)
        self.upload_file(merged_json, '/tmp/_oc_agents.json')
        self.exec_command(f'cp /tmp/_oc_agents.json {vol_path}')
        self.exec_command('rm -f /tmp/_oc_agents.json')

        # Ensure main agent dir exists (warm_deploy_standby doesn't create it)
        main_agent_dir = '/home/node/.openclaw/agents/main/agent'
        self.exec_command(f'docker exec -u root openclaw mkdir -p {main_agent_dir}')

        # Write auth-profiles with default=openrouter to ALL agents
        if openrouter_key:
            auth_profiles = json_mod.dumps({
                "profiles": {
                    "openrouter": {
                        "provider": "openrouter",
                        "apiKey": openrouter_key
                    }
                },
                "default": "openrouter"
            })
            self.upload_file(auth_profiles, '/tmp/_openclaw_auth.json')
            for agent_id in ['main'] + self.AGENT_IDS:
                agent_auth_dir = f'/home/node/.openclaw/agents/{agent_id}/agent'
                self.exec_command(f'docker exec -u root openclaw mkdir -p {agent_auth_dir}')
                self.exec_command(
                    f'docker cp /tmp/_openclaw_auth.json openclaw:{agent_auth_dir}/auth-profiles.json'
                )
            self.exec_command('rm -f /tmp/_openclaw_auth.json')
            logger.info(f'Auth-profiles (default=openrouter) written to all agents on {self.server.ip_address}')
        else:
            # No key provided — copy from main agent to sub-agents if main exists
            for agent_id in self.AGENT_IDS:
                agent_auth_dir = f'/home/node/.openclaw/agents/{agent_id}/agent'
                self.exec_command(f'docker exec -u root openclaw mkdir -p {agent_auth_dir}')
                for fname in ['auth-profiles.json', 'models.json']:
                    self.exec_command(
                        f'docker exec -u root openclaw sh -c '
                        f'"[ -f {main_agent_dir}/{fname} ] && '
                        f'cp {main_agent_dir}/{fname} {agent_auth_dir}/{fname} || true"'
                    )

        # Fix permissions
        self.exec_command(
            'docker exec -u root openclaw chown -R node:node /home/node/.openclaw/agents'
        )

        # Verify agent directories exist
        missing_agents = []
        for agent_id in self.AGENT_IDS:
            out, _, code = self.exec_command(
                f'docker exec openclaw ls /home/node/.openclaw/agents/{agent_id}/SOUL.md 2>/dev/null'
            )
            if code != 0:
                missing_agents.append(agent_id)
        if missing_agents:
            logger.warning(f'Agent verification failed on {self.server.ip_address}: missing {missing_agents}')
        else:
            logger.info(f'All {len(self.AGENT_IDS)} agents verified on {self.server.ip_address}')

        logger.info(f'Agents installed on {self.server.ip_address}')

    # ─── ClawdMatrix Engine (On-Demand Skills) ─────────────────────────
    #
    # Skills are stored in /home/node/.openclaw/clawdmatrix/ (NOT /app/skills/)
    # so they don't appear in <available_skills> and don't cost tokens per message.
    # CLAUDE.md contains domain routing rules that tell the model to `read` the
    # relevant skill file only when the user's message matches a domain.

    CLAWDMATRIX_SKILLS = [
        'clawdmatrix-coding',
        'clawdmatrix-finance',
        'clawdmatrix-legal',
        'clawdmatrix-sysops',
        'clawdmatrix-creative',
        'clawdmatrix-occult',
        'clawdmatrix-gaming',
    ]

    # Skills to keep in /app/skills/ (the rest are moved to /app/skills-disabled/)
    OPENCLAW_ESSENTIAL_SKILLS = {
        'bird', 'canvas', 'clawhub', 'coding-agent', 'gemini',
        'healthcheck', 'model-usage', 'nano-pdf', 'openai-image-gen',
        'oracle', 'session-logs', 'spotify-player', 'summarize', 'weather',
        # Audio/media skills
        'sag', 'openai-whisper', 'openai-whisper-api', 'songsee', 'video-frames',
        # ClawdMatrix domain skills
        'clawdmatrix-coding', 'clawdmatrix-finance', 'clawdmatrix-legal',
        'clawdmatrix-sysops', 'clawdmatrix-creative', 'clawdmatrix-occult',
        'clawdmatrix-gaming',
        # Agent-specific skills (used in per-agent skills allowlists)
        'blogwatcher', 'gifgrep', 'github', 'gog', 'himalaya',
        'mcporter', 'nano-banana-pro', 'notion', 'obsidian', 'tmux', 'trello',
        'skill-creator',
    }

    # VPS-useless skills to permanently delete (not even kept in skills-disabled)
    OPENCLAW_REMOVE_SKILLS = {
        # macOS-only
        'apple-notes', 'apple-reminders', 'bear-notes', 'things-mac',
        'peekaboo', 'imsg',
        # Smart home / hardware
        'openhue', 'eightctl', 'blucli', 'sonoscli', 'camsnap',
        # Messaging (no accounts configured)
        'discord', 'slack', 'wacli', 'bluebubbles',
        # Food ordering
        'food-order', 'ordercli',
        # Other
        'nano-banana-pro',
    }

    # CLAUDE.md with quality gates + skill restore + link verification rule
    CLAWDMATRIX_CLAUDE_MD = """\
# ClawdMatrix Quality Gates
- Classify info completeness: Red (missing critical) / Yellow (partial) / Green (complete)
- Calculations must show full formula step-by-step
- Mirror the user's language (RU/EN)
- Refuse harmful instructions firmly

## Восстановление отключённых скиллов
Часть встроенных скиллов перемещена в `/app/skills-disabled/` для экономии токенов.
Если пользователь просит функцию из отключённого скилла (trello, notion, github, etc.):
1. Выполни: `mv /app/skills-disabled/<skill-name> /app/skills/<skill-name>`
2. Скилл сразу станет доступен в следующем ответе.
3. Полный список отключённых: `ls /app/skills-disabled/`
4. Чтобы отключить обратно: `mv /app/skills/<skill-name> /app/skills-disabled/<skill-name>`

### ОТПРАВКА ФАЙЛОВ В TELEGRAM
Для отправки файла используй `message` с `mediaUrl`. Поддерживаются: `file:///path`, абсолютные пути, `~/path`, `http(s)://url`.
```
message(action="send", to="<chat_id>", content="Описание", mediaUrl="/absolute/path/to/file.ext")
```
ВАЖНО:
- Параметр для файла — `mediaUrl` (НЕ `filePath`, НЕ `file`, НЕ `attachment`)
- `action` — ОДНО значение: `"send"` или `"sendAttachment"` (НЕ `"send,broadcast"`)
- `content` — текст сообщения (НЕ `message`)
- `to` — chat ID получателя

### СТРАТЕГИЯ БРАУЗЕРА
- Для поиска информации СНАЧАЛА используй `web_search` (SearXNG через Brave API) — он вернёт ссылки.
- Для сбора данных со страниц используй `browser` — профиль **lightpanda** (по умолчанию, быстрый и лёгкий).
- Если lightpanda зависает или выдаёт ошибку на сложном сайте с тяжёлым JS — переключись на профиль **headless** (Chrome): `browser open --profile headless "<url>"`.
- НЕ пытайся открыть тяжёлые SPA-сайты (Travelata, Level.Travel и т.п.) через lightpanda — сразу используй headless.

### ПРАВИЛО ПРОВЕРКИ ССЫЛОК
1. НИКОГДА не выдумывай ссылки на YouTube, товары или конкретные страницы сайтов на основе "знаний из головы" или общих результатов поиска.
2. Для предоставления любой конкретной ссылки (кроме главных страниц доменов) ТЫ ОБЯЗАН:
   - Открыть страницу через инструмент `browser`.
   - Скопировать актуальный URL или ID из адресной строки или элементов страницы.
   - Убедиться, что страница реально загрузилась и содержит ожидаемый контент.
3. Если ты не проверил ссылку через браузер — прямо сообщи об этом пользователю. Прямые, непроверенные ссылки запрещены.
""".strip()

    def install_clawdmatrix(self):
        """Install ClawdMatrix skill files into the OpenClaw container.

        Deploys SKILL.md files to /app/skills/ as regular OpenClaw skills.
        Also cleans up old /app/clawdmatrix/ bundle and private directory.
        """
        import os

        logger.info(f'Installing ClawdMatrix skills on {self.server.ip_address}...')

        skills_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'clawdmatrix', 'skills',
        )

        # Clean up old locations
        self.exec_command('docker exec -u root openclaw rm -rf /app/clawdmatrix')
        self.exec_command('docker exec -u root openclaw rm -rf /home/node/.openclaw/clawdmatrix')

        # Deploy skill files to /app/skills/ (standard OpenClaw location)
        for skill_name in self.CLAWDMATRIX_SKILLS:
            local_path = os.path.join(skills_dir, skill_name, 'SKILL.md')
            try:
                with open(local_path, 'r') as f:
                    content = f.read()
            except FileNotFoundError:
                logger.warning(f'ClawdMatrix SKILL.md not found: {local_path}')
                continue

            self.exec_command(
                f'docker exec -u root openclaw mkdir -p /app/skills/{skill_name}'
            )
            tmp_path = f'/tmp/_clawdmatrix_{skill_name}.md'
            self.upload_file(content, tmp_path)
            self.exec_command(
                f'docker cp {tmp_path} openclaw:/app/skills/{skill_name}/SKILL.md'
            )
            self.exec_command(f'rm -f {tmp_path}')

        # Fix permissions
        self.exec_command('docker exec -u root openclaw chown -R node:node /app/skills')

        # Prune unused built-in skills to save tokens
        self.prune_builtin_skills()

        self.server.clawdmatrix_installed = True
        self.server.save(update_fields=['clawdmatrix_installed'])
        logger.info(f'ClawdMatrix on-demand skills installed on {self.server.ip_address}')

    def prune_builtin_skills(self):
        """Move non-essential built-in skills to /app/skills-disabled/.

        Keeps only OPENCLAW_ESSENTIAL_SKILLS in /app/skills/ to reduce
        token overhead. VPS-useless skills are permanently deleted.
        """
        logger.info(f'Pruning built-in skills on {self.server.ip_address}...')
        self.exec_command('docker exec -u root openclaw mkdir -p /app/skills-disabled')

        result = self.exec_command('docker exec openclaw ls /app/skills/')
        if isinstance(result, tuple):
            all_skills = [s.strip() for s in result[0].strip().split('\n') if s.strip()]
        else:
            all_skills = [s.strip() for s in result.strip().split('\n') if s.strip()]

        removed = 0
        for skill in all_skills:
            if skill not in self.OPENCLAW_ESSENTIAL_SKILLS:
                if skill in self.OPENCLAW_REMOVE_SKILLS:
                    # Permanently delete VPS-useless skills
                    self.exec_command(
                        f'docker exec -u root openclaw rm -rf /app/skills/{skill}'
                    )
                else:
                    # Move potentially useful skills to disabled
                    self.exec_command(
                        f'docker exec -u root openclaw mv /app/skills/{skill} /app/skills-disabled/{skill}'
                    )
                removed += 1

        # Also clean VPS-useless from skills-disabled if present
        for skill in self.OPENCLAW_REMOVE_SKILLS:
            self.exec_command(
                f'docker exec -u root openclaw rm -rf /app/skills-disabled/{skill}'
            )

        # Give node user ownership so the model can mv skills back on demand
        self.exec_command('docker exec -u root openclaw chown -R node:node /app/skills')
        self.exec_command('docker exec -u root openclaw chown -R node:node /app/skills-disabled')

        logger.info(
            f'Pruned {removed} skills on {self.server.ip_address}, '
            f'{len(all_skills) - removed} remaining'
        )

    def enable_clawdmatrix(self, custom_domain_map=None, custom_skills=None):
        """Enable ClawdMatrix Engine with on-demand skill loading.

        Deploys skill files to a private directory and writes CLAUDE.md with
        domain routing rules. The model reads skill files only when a domain
        matches — zero token cost when not needed.
        """
        logger.info(f'Enabling ClawdMatrix on {self.server.ip_address}...')

        if not self.server.clawdmatrix_installed:
            self.install_clawdmatrix()

        # Write CLAUDE.md with quality gates + domain routing + link verification
        self.upload_file(self.CLAWDMATRIX_CLAUDE_MD, '/tmp/_clawdmatrix_claude.md')
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
        """Disable ClawdMatrix Engine and clean up all files."""
        logger.info(f'Disabling ClawdMatrix on {self.server.ip_address}...')

        self.exec_command(
            'docker exec openclaw rm -f /home/node/.openclaw/CLAUDE.md'
        )
        self.exec_command(
            f'docker exec -u root openclaw rm -rf {self.CLAWDMATRIX_SKILLS_PATH}'
        )
        # Clean up old locations too
        self.exec_command(
            'docker exec -u root openclaw rm -rf /app/clawdmatrix'
        )
        for skill_name in self.CLAWDMATRIX_SKILLS:
            self.exec_command(
                f'docker exec -u root openclaw rm -rf /app/skills/{skill_name}'
            )

        logger.info(f'ClawdMatrix disabled on {self.server.ip_address}')

    def verify_clawdmatrix(self):
        """Verify ClawdMatrix on-demand skills are installed and functioning.

        Returns (success: bool, failures: list[str]).
        """
        failures = []

        # Check each SKILL.md exists in private directory
        for skill_name in self.CLAWDMATRIX_SKILLS:
            out, _, code = self.exec_command(
                f'docker exec openclaw ls {self.CLAWDMATRIX_SKILLS_PATH}/{skill_name}/SKILL.md 2>/dev/null'
            )
            if code != 0:
                failures.append(f'{skill_name}/SKILL.md not found')

        # Check CLAUDE.md exists with domain routing
        out, _, code = self.exec_command(
            'docker exec openclaw cat /home/node/.openclaw/CLAUDE.md 2>/dev/null'
        )
        if code != 0 or 'Quality Gates' not in out:
            failures.append('CLAUDE.md missing or no quality gates')
        if 'ПРАВИЛО ПРОВЕРКИ ССЫЛОК' not in out:
            failures.append('CLAUDE.md missing link verification rule')

        # Verify old /app/skills/clawdmatrix-* are gone (shouldn't be in available_skills)
        out, _, code = self.exec_command(
            'docker exec openclaw ls /app/skills/ 2>/dev/null | grep clawdmatrix'
        )
        if out.strip():
            failures.append(f'Old clawdmatrix entries still in /app/skills/: {out.strip()}')

        return (not failures, failures)

    def update_clawdmatrix_skills(self, domain_map=None, skills=None):
        """Update ClawdMatrix skills by re-deploying SKILL.md files."""
        self.install_clawdmatrix()
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

    from django.db import transaction

    with transaction.atomic():
        available_server = Server.objects.select_for_update().filter(
            status='active',
            profile__isnull=True,
        ).first()

        if not available_server:
            logger.warning(f'No servers in pool for {user.email}')
            send_telegram_message(
                ADMIN_TELEGRAM_ID,
                f'⚠️ No pool servers for {user.email}! Provisioning new server...'
            )
            from .tasks import provision_user_service
            provision_user_service.delay(user_id)
            return

        available_server.profile = profile
        available_server.save()

    available_server.deployment_stage = 'configuring_keys'
    available_server.save(update_fields=['deployment_stage'])
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
        telegram_owner_id = None
        try:
            telegram_owner_id = user.telegram_bot_user.telegram_id
        except Exception:
            pass

        was_warmed = available_server.openclaw_running
        manager = ServerManager(available_server)
        try:
            available_server.deployment_stage = 'deploying_openclaw'
            available_server.save(update_fields=['deployment_stage'])

            deploy_kwargs = dict(
                openrouter_key=profile.openrouter_api_key,
                telegram_token=profile.telegram_bot_token,
                model_slug=profile.selected_model,
                telegram_owner_id=telegram_owner_id,
            )
            # Use quick deploy on warmed servers (~30s), full deploy as fallback (~5-10min)
            if was_warmed:
                result = manager.quick_deploy_user(**deploy_kwargs)
            else:
                result = manager.deploy_openclaw(**deploy_kwargs)

            if result:
                available_server.openclaw_running = True
                available_server.deployment_stage = 'ready'
                available_server.save(update_fields=['openclaw_running', 'deployment_stage'])
                deploy_type = 'quick' if was_warmed else 'full'
                send_telegram_message(
                    ADMIN_TELEGRAM_ID,
                    f'✅ OpenClaw deployed ({deploy_type})!\nIP: {available_server.ip_address}\nUser: {user.email}'
                )
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
                    pass
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
