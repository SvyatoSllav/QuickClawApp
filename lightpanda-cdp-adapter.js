// LightPanda CDP Adapter v25 — Universal OpenClaw bridge
// Bridges OpenClaw's Chrome-like CDP expectations to LightPanda's subset.
//
// Key differences handled:
//   - LP doesn't auto-create a page on connect (Chrome does)
//   - LP doesn't support flatten:true in Target.attachToTarget
//   - LP is single-page: createTarget returns the existing target
//   - Several Browser.* / Target.* methods are stubbed

const http = require('http');
const WebSocket = require('ws');

// --- Configuration (all overridable via env) ---
const LP_HOST       = process.env.LP_HOST       || 'lightpanda';
const LP_PORT       = parseInt(process.env.LP_PORT || '9222', 10);
const LISTEN_PORT   = parseInt(process.env.LISTEN_PORT || '9223', 10);
const SELF_HOST     = process.env.SELF_HOST     || 'lightpanda-adapter';
const LP_CONTAINER  = process.env.LP_CONTAINER  || 'lightpanda';
const CMD_TIMEOUT   = parseInt(process.env.CMD_TIMEOUT_MS || '15000', 10);
const MAX_TIMEOUTS  = parseInt(process.env.MAX_TIMEOUTS || '2', 10);
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const VERSION       = 'v25';

const LP_WS_URL       = 'ws://' + LP_HOST + ':' + LP_PORT + '/';
const BROWSER_SESSION = 'browser-stub-session';

// Methods OpenClaw sends that LP doesn't implement — return empty success
const STUB_METHODS = new Set([
  'Target.attachToBrowserTarget',
  'Target.detachFromTarget',
  'Browser.getWindowForTarget',
  'Browser.setWindowBounds',
  'Browser.getWindowBounds',
]);

function log(msg) {
  console.log('[' + new Date().toISOString().substr(11, 8) + '] ' + msg);
}

// --- Auto-restart LP container via Docker socket ---
var consecutiveTimeouts = 0;
var restartInProgress = false;

function restartLP() {
  if (restartInProgress) return;
  restartInProgress = true;
  log('Auto-restarting ' + LP_CONTAINER + ' container...');
  var req = http.request({
    socketPath: DOCKER_SOCKET,
    path: '/containers/' + LP_CONTAINER + '/restart?t=2',
    method: 'POST',
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

// --- HTTP server (discovery endpoints + health) ---
var httpServer = http.createServer(function(req, res) {
  var url = new URL(req.url, 'http://localhost:' + LISTEN_PORT);
  var path = url.pathname.replace(/\/+$/, '') || '/';
  res.setHeader('Content-Type', 'application/json');

  if (path === '/json/version') {
    res.end(JSON.stringify({
      Browser: 'Lightpanda/nightly',
      'Protocol-Version': '1.3',
      webSocketDebuggerUrl: 'ws://' + SELF_HOST + ':' + LISTEN_PORT + '/',
    }));
  } else if (path === '/json/list' || path === '/json') {
    res.end(JSON.stringify([{
      id: 'default', type: 'page', title: 'Lightpanda', url: 'about:blank',
      webSocketDebuggerUrl: 'ws://' + SELF_HOST + ':' + LISTEN_PORT + '/',
    }]));
  } else if (path === '/json/new') {
    res.end(JSON.stringify({ id: 'default', type: 'page', url: 'about:blank' }));
  } else if (path === '/health') {
    var ok = !restartInProgress && consecutiveTimeouts < MAX_TIMEOUTS;
    res.writeHead(ok ? 200 : 503);
    res.end(JSON.stringify({ healthy: ok, timeouts: consecutiveTimeouts, version: VERSION }));
  } else {
    res.writeHead(404);
    res.end('{}');
  }
});

// --- WebSocket proxy ---
var wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', function(clientWs) {
  log('CLIENT connected');

  // Per-connection state
  var lpWs = new WebSocket(LP_WS_URL);
  var lpReady = false;
  var lpSendQueue = [];

  // Init state machine: 'pending' -> 'creating' -> 'attaching' -> 'ready'
  var initState = 'pending';
  var clientQueue = [];

  var pageSessionId = null;
  var pageTargetId = null;

  var fakeToReal = {};
  var fakeCounter = 0;

  var proxiedRequests = {};
  var proxyIdCounter = 900000;
  var cmdTimers = {};

  // --- Helpers ---

  function cleanup() {
    for (var id in cmdTimers) { clearTimeout(cmdTimers[id]); }
    cmdTimers = {};
  }

  function sendToLP(data) {
    if (lpReady) lpWs.send(data);
    else lpSendQueue.push(data);
  }

  function sendToClient(data) {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
  }

  function startTimeout(lpId, method) {
    cmdTimers[lpId] = setTimeout(function() {
      var pr = proxiedRequests[lpId];
      if (!pr) return;
      delete proxiedRequests[lpId];
      delete cmdTimers[lpId];
      consecutiveTimeouts++;
      log('TIMEOUT lpId=' + lpId + ' method=' + (method || '?') +
          ' clientId=' + pr.originalId + ' (consecutive: ' + consecutiveTimeouts + ')');
      var err = { id: pr.originalId, error: { code: -32000, message: 'Lightpanda response timeout' } };
      if (pr.originalSession) err.sessionId = pr.originalSession;
      sendToClient(JSON.stringify(err));
      if (consecutiveTimeouts >= MAX_TIMEOUTS) restartLP();
    }, CMD_TIMEOUT);
  }

  function clearCmdTimer(id) {
    if (cmdTimers[id]) { clearTimeout(cmdTimers[id]); delete cmdTimers[id]; }
    var rawKey = 'r' + id;
    if (cmdTimers[rawKey]) { clearTimeout(cmdTimers[rawKey]); delete cmdTimers[rawKey]; }
  }

  function completeInit() {
    if (initState === 'ready') return; // guard against double-complete
    initState = 'ready';
    log('Init complete: sid=' + pageSessionId + ' tid=' + pageTargetId);
    // Send exactly one attachedToTarget to client
    sendToClient(JSON.stringify({
      method: 'Target.attachedToTarget',
      params: {
        sessionId: pageSessionId,
        targetInfo: {
          targetId: pageTargetId, type: 'page', title: '', url: 'about:blank',
          attached: true, canAccessOpener: false, browserContextId: 'BID-1',
        },
        waitingForDebugger: false,
      },
    }));
    // Flush queued client messages
    var queued = clientQueue;
    clientQueue = [];
    queued.forEach(function(m) { handleClientMessage(m); });
  }

  // --- LP WebSocket handlers ---

  lpWs.on('open', function() {
    log('LP connected');
    lpReady = true;
    lpSendQueue.forEach(function(m) { lpWs.send(m); });
    lpSendQueue = [];
    // Start init: create a target
    initState = 'creating';
    log('Init: creating target');
    sendToLP(JSON.stringify({ id: -1, method: 'Target.createTarget', params: { url: 'about:blank' } }));
  });

  lpWs.on('message', function(data) {
    var str = data.toString();
    var msg;
    consecutiveTimeouts = 0;

    try { msg = JSON.parse(str); } catch (e) {
      if (initState === 'ready') sendToClient(str);
      return;
    }

    // --- Init phase: absorb all LP messages, only process our init commands ---
    if (initState !== 'ready') {
      // createTarget response
      if (msg.id === -1 && msg.result && msg.result.targetId) {
        pageTargetId = msg.result.targetId;
        initState = 'attaching';
        log('Init: target ' + pageTargetId + ', attaching');
        sendToLP(JSON.stringify({ id: -2, method: 'Target.attachToTarget', params: { targetId: pageTargetId } }));
        return;
      }
      // attachToTarget response (this gives us the session ID)
      if (msg.id === -2 && msg.result && msg.result.sessionId) {
        pageSessionId = msg.result.sessionId;
        completeInit();
        return;
      }
      // LP may also send Target.attachedToTarget event — grab session from it
      if (msg.method === 'Target.attachedToTarget' && msg.params && msg.params.sessionId && !pageSessionId) {
        pageSessionId = msg.params.sessionId;
        if (msg.params.targetInfo) pageTargetId = msg.params.targetInfo.targetId;
        completeInit();
        return;
      }
      // Absorb all other init-phase messages (targetCreated, etc.)
      return;
    }

    // --- Normal phase: proxy LP responses to client ---

    // Suppress extra attachedToTarget events (LP may send them on reconnect)
    if (msg.method === 'Target.attachedToTarget' && msg.params && msg.params.sessionId) {
      if (msg.params.sessionId !== pageSessionId) {
        log('Suppressing extra session: ' + msg.params.sessionId);
        return;
      }
    }

    // Clear timeouts for responses
    if (msg.id) clearCmdTimer(msg.id);

    // Proxied request response — remap IDs back to client
    if (msg.id && proxiedRequests[msg.id]) {
      var pr = proxiedRequests[msg.id];
      delete proxiedRequests[msg.id];
      msg.id = pr.originalId;
      if (pr.originalSession !== undefined) msg.sessionId = pr.originalSession;
      sendToClient(JSON.stringify(msg));
      return;
    }

    // Forward everything else
    sendToClient(str);
  });

  lpWs.on('close', function() {
    log('LP disconnected');
    for (var lpId in proxiedRequests) {
      clearCmdTimer(lpId);
      var pr = proxiedRequests[lpId];
      var err = { id: pr.originalId, error: { code: -32000, message: 'Lightpanda disconnected' } };
      if (pr.originalSession) err.sessionId = pr.originalSession;
      sendToClient(JSON.stringify(err));
    }
    proxiedRequests = {};
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  lpWs.on('error', function(err) { log('LP error: ' + err.message); });

  // --- Client message handler ---

  function handleClientMessage(str) {
    var msg;
    try { msg = JSON.parse(str); } catch (e) { sendToLP(str); return; }

    // 1. Stub unsupported methods
    if (msg.method && STUB_METHODS.has(msg.method)) {
      var r = { id: msg.id, result: {} };
      if (msg.method === 'Target.attachToBrowserTarget') r.result = { sessionId: BROWSER_SESSION };
      if (msg.sessionId) r.sessionId = msg.sessionId;
      sendToClient(JSON.stringify(r));
      return;
    }

    // 2. Target.createTarget → return existing target (LP is single-page)
    if (msg.method === 'Target.createTarget') {
      if (pageTargetId) {
        log('createTarget -> existing ' + pageTargetId);
        var resp = { id: msg.id, result: { targetId: pageTargetId } };
        if (msg.sessionId) resp.sessionId = msg.sessionId;
        sendToClient(JSON.stringify(resp));
      } else {
        clientQueue.push(str);
      }
      return;
    }

    // 3. Target.attachToTarget via browser session → fake session mapping
    if (msg.sessionId === BROWSER_SESSION && msg.method === 'Target.attachToTarget') {
      fakeCounter++;
      var fakeSid = 'fake-session-' + fakeCounter;
      var realSid = pageSessionId || '';
      fakeToReal[fakeSid] = realSid;
      var tid = (msg.params && msg.params.targetId) || pageTargetId || 'unknown';
      log('Session map: ' + fakeSid + ' -> ' + realSid);
      sendToClient(JSON.stringify({
        method: 'Target.attachedToTarget',
        params: {
          sessionId: fakeSid,
          targetInfo: {
            targetId: tid, type: 'page', title: '', url: 'about:blank',
            attached: true, canAccessOpener: false,
          },
          waitingForDebugger: false,
        },
        sessionId: BROWSER_SESSION,
      }));
      sendToClient(JSON.stringify({
        id: msg.id, result: { sessionId: fakeSid }, sessionId: BROWSER_SESSION,
      }));
      return;
    }

    // 4. Target.getTargetInfo on fake sessions → synthetic info
    if (msg.sessionId && fakeToReal[msg.sessionId] && msg.method === 'Target.getTargetInfo') {
      sendToClient(JSON.stringify({
        id: msg.id,
        result: {
          targetInfo: {
            targetId: pageTargetId || 'unknown', type: 'page', title: '', url: 'about:blank',
            attached: true, canAccessOpener: false, browserContextId: 'BID-1',
          },
        },
        sessionId: msg.sessionId,
      }));
      return;
    }

    // 5. Strip flatten from Target.attachToTarget (LP doesn't support it)
    if (msg.method === 'Target.attachToTarget' && msg.params && msg.params.flatten) {
      log('Stripping flatten from attachToTarget');
      delete msg.params.flatten;
      str = JSON.stringify(msg);
    }

    // 6. Proxy browser-session commands (strip fake sessionId)
    if (msg.sessionId === BROWSER_SESSION) {
      var lpId = ++proxyIdCounter;
      proxiedRequests[lpId] = { originalId: msg.id, originalSession: BROWSER_SESSION };
      startTimeout(lpId, msg.method);
      var fwd = Object.assign({}, msg);
      delete fwd.sessionId;
      fwd.id = lpId;
      sendToLP(JSON.stringify(fwd));
      return;
    }

    // 7. Proxy fake-session commands (remap to real LP session)
    if (msg.sessionId && fakeToReal[msg.sessionId]) {
      var lpId2 = ++proxyIdCounter;
      proxiedRequests[lpId2] = { originalId: msg.id, originalSession: msg.sessionId };
      startTimeout(lpId2, msg.method);
      var fwd2 = Object.assign({}, msg);
      fwd2.sessionId = fakeToReal[msg.sessionId];
      fwd2.id = lpId2;
      sendToLP(JSON.stringify(fwd2));
      return;
    }

    // 8. Raw forward with timeout tracking
    if (msg.id) {
      var rawKey = 'r' + msg.id;
      var rawSession = msg.sessionId || null;
      var rawMethod = msg.method || '?';
      cmdTimers[rawKey] = setTimeout(function() {
        delete cmdTimers[rawKey];
        consecutiveTimeouts++;
        log('TIMEOUT raw id=' + msg.id + ' method=' + rawMethod +
            ' (consecutive: ' + consecutiveTimeouts + ')');
        var err = { id: msg.id, error: { code: -32000, message: 'Lightpanda response timeout' } };
        if (rawSession) err.sessionId = rawSession;
        sendToClient(JSON.stringify(err));
        if (consecutiveTimeouts >= MAX_TIMEOUTS) restartLP();
      }, CMD_TIMEOUT);
    }
    sendToLP(str);
  }

  // --- Client WebSocket handlers ---

  clientWs.on('message', function(data) {
    var str = data.toString();
    if (initState !== 'ready') {
      clientQueue.push(str);
      return;
    }
    handleClientMessage(str);
  });

  clientWs.on('close', function() {
    log('CLIENT disconnected');
    cleanup();
    if (lpWs.readyState === WebSocket.OPEN) lpWs.close();
  });

  clientWs.on('error', function() {});
});

// --- Start ---
httpServer.listen(LISTEN_PORT, '0.0.0.0', function() {
  log('Lightpanda CDP adapter ' + VERSION + ' on :' + LISTEN_PORT + ' -> ' + LP_HOST + ':' + LP_PORT);
  log('Config: container=' + LP_CONTAINER + ' timeout=' + CMD_TIMEOUT + 'ms maxTimeouts=' + MAX_TIMEOUTS);
});
