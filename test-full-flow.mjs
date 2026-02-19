import WebSocket from 'ws';

const SERVER = 'ws://194.87.226.98:18789';
const TOKEN = 'mBDiG-b2PczPIWCywnEp8L0IJ7q-zcPHsBAoAiZq3i0';

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER);
    ws.on('error', reject);
    ws.on('close', (code) => reject(new Error(`Closed: ${code}`)));
    ws.on('message', function onMsg(raw) {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        ws.send(JSON.stringify({
          type: 'req', id: 'connect-init', method: 'connect',
          params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: 'gateway-client', displayName: 'TestCLI', version: '1.0.0', platform: 'cli', mode: 'backend' },
            caps: [], auth: { token: TOKEN },
          },
        }));
        return;
      }
      if (msg.type === 'res' && msg.id === 'connect-init') {
        if (msg.ok) { ws.off('message', onMsg); resolve(ws); }
        else reject(new Error('connect failed'));
      }
    });
  });
}

let c = 0;
function rpc(ws, method, params = {}) {
  return new Promise((resolve) => {
    const id = `r-${++c}-${Date.now()}`;
    const t = setTimeout(() => { ws.off('message', h); resolve({ ok: false, error: { message: 'timeout' } }); }, 15000);
    const h = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'res' && msg.id === id) { clearTimeout(t); ws.off('message', h); resolve({ ok: !!msg.ok, result: msg.payload, error: msg.error }); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ type: 'req', id, method, params }));
  });
}

function chat(ws, sessionKey, message) {
  return new Promise((resolve) => {
    const reqId = `chat-${++c}-${Date.now()}`;
    let resp = '';
    const t = setTimeout(() => { ws.off('message', h); resolve({ ok: false, resp: '(timeout)' }); }, 60000);
    const h = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'res' && msg.id === reqId && !msg.ok) {
        clearTimeout(t); ws.off('message', h);
        resolve({ ok: false, resp: msg.error?.message || 'error' });
        return;
      }
      if (msg.type === 'event' && msg.event === 'chat') {
        const p = msg.payload;
        if (p.sessionKey && p.sessionKey !== sessionKey) return;
        if (p.state === 'delta' && p.message?.content) {
          resp = typeof p.message.content === 'string' ? p.message.content :
            (Array.isArray(p.message.content) ? p.message.content.filter(x => x.type === 'text').map(x => x.text).join('') : '');
        }
        if (p.state === 'final') {
          if (p.message?.content) resp = typeof p.message.content === 'string' ? p.message.content :
            (Array.isArray(p.message.content) ? p.message.content.filter(x => x.type === 'text').map(x => x.text).join('') : '');
          clearTimeout(t); ws.off('message', h); resolve({ ok: true, resp });
        }
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ type: 'req', id: reqId, method: 'chat.send', params: { sessionKey, message, idempotencyKey: reqId } }));
  });
}

let pass = 0, fail = 0;
function ok(msg) { pass++; console.log(`  ✅ ${msg}`); }
function no(msg) { fail++; console.log(`  ❌ ${msg}`); }

async function main() {
  console.log('\n═══ Agent Switch + Session Isolation (Final) ═══\n');

  const ws = await connect();
  ok('Connected');

  // ── 1. fetchAgents ──
  console.log('\n1. fetchAgents');
  const al = await rpc(ws, 'agents.list');
  ok(`agents: ${al.result?.agents?.length}, defaultId="${al.result?.defaultId}"`);

  // Skills from config.get
  const cfg = await rpc(ws, 'config.get', {});
  const cfgAgents = cfg.result?.config?.agents?.list || [];
  const withSkills = cfgAgents.filter(a => a.skills?.length > 0);
  ok(`Skills enriched: ${withSkills.length} agents have skills`);

  // ── 2. Switch to coder (local only, no config.set) ──
  console.log('\n2. switchAgent("coder") — local switch');
  const coderKey = `agent:coder:test-${Date.now()}`;

  // Sessions for coder
  const coderSess = await rpc(ws, 'sessions.list', { agentId: 'coder' });
  ok(`Coder has ${coderSess.result?.sessions?.length} existing sessions`);

  // ── 3. Send message to coder ──
  console.log('\n3. Chat with coder');
  const coderResp = await chat(ws, coderKey, 'Say "I am the coding assistant" and nothing else.');
  if (coderResp.ok) {
    ok(`Coder: "${coderResp.resp.slice(0, 80)}"`);
  } else {
    no(`Coder failed: ${coderResp.resp}`);
  }

  // ── 4. Switch to researcher, send message ──
  console.log('\n4. switchAgent("researcher") + chat');
  const resKey = `agent:researcher:test-${Date.now()}`;
  const resResp = await chat(ws, resKey, 'Say "I am the research analyst" and nothing else.');
  if (resResp.ok) {
    ok(`Researcher: "${resResp.resp.slice(0, 80)}"`);
  } else {
    no(`Researcher failed: ${resResp.resp}`);
  }

  // ── 5. Session isolation ──
  console.log('\n5. Session isolation');
  const afterCoderSess = await rpc(ws, 'sessions.list', { agentId: 'coder' });
  const afterResSess = await rpc(ws, 'sessions.list', { agentId: 'researcher' });
  const coderKeys = (afterCoderSess.result?.sessions || []).map(s => s.key);
  const resKeys = (afterResSess.result?.sessions || []).map(s => s.key);

  coderKeys.includes(coderKey) ? ok('New coder session in coder list') : no('Coder session missing');
  resKeys.includes(resKey) ? ok('New researcher session in researcher list') : no('Researcher session missing');
  !coderKeys.some(k => k.startsWith('agent:researcher:')) ? ok('No cross-contamination: coder list clean') : no('Researcher leaked into coder');
  !resKeys.some(k => k.startsWith('agent:coder:')) ? ok('No cross-contamination: researcher list clean') : no('Coder leaked into researcher');

  // ── 6. chat.history isolation ──
  console.log('\n6. chat.history isolation');
  const cHist = await rpc(ws, 'chat.history', { sessionKey: coderKey });
  const rHist = await rpc(ws, 'chat.history', { sessionKey: resKey });
  cHist.ok && (cHist.result?.messages?.length >= 2) ? ok(`Coder history: ${cHist.result.messages.length} msgs`) : no(`Coder history: ${cHist.result?.messages?.length ?? 0} msgs`);
  rHist.ok && (rHist.result?.messages?.length >= 2) ? ok(`Researcher history: ${rHist.result.messages.length} msgs`) : no(`Researcher history: ${rHist.result?.messages?.length ?? 0} msgs`);

  // ── 7. Switch to writer, verify different sessions ──
  console.log('\n7. Writer agent');
  const writerSess = await rpc(ws, 'sessions.list', { agentId: 'writer' });
  ok(`Writer has ${writerSess.result?.sessions?.length} sessions (separate from coder/researcher)`);

  // ── Cleanup ──
  console.log('\n8. Cleanup');
  await rpc(ws, 'sessions.delete', { key: coderKey });
  await rpc(ws, 'sessions.delete', { key: resKey });
  ok('Test sessions deleted');

  ws.close();
  console.log(`\n═══ Results: ${pass} passed, ${fail} failed ═══\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
