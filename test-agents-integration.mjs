import WebSocket from 'ws';

const SERVERS = [
  { ip: '194.87.226.98', token: 'mBDiG-b2PczPIWCywnEp8L0IJ7q-zcPHsBAoAiZq3i0' },
  { ip: '85.239.52.210', token: 'ucmwT01_GVad8NtH5R4yqizi7IUp4SDHiM7x-olHtwQ' },
  { ip: '85.239.53.127', token: 'r8U1fIjbW6sjz_QSbiwifhzpAzCptLcAMUoz42h0UCk' },
  { ip: '49.13.135.40',  token: 'Ei9EXFNTOGM4suEDybbHsSin0KvfCECUucP5JSJXLKk' },
];

// ── Helpers ──────────────────────────────────────────────────

function connect(server, token) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), 10000);
    const ws = new WebSocket(`ws://${server}:18789`);
    ws.on('error', (e) => { clearTimeout(t); reject(e); });
    ws.on('close', (code) => { clearTimeout(t); reject(new Error(`Closed: ${code}`)); });
    ws.on('message', function onMsg(raw) {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        ws.send(JSON.stringify({
          type: 'req', id: 'connect-init', method: 'connect',
          params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: 'gateway-client', displayName: 'IntegrationTest', version: '1.0.0', platform: 'cli', mode: 'backend' },
            caps: [], auth: { token },
          },
        }));
        return;
      }
      if (msg.type === 'res' && msg.id === 'connect-init') {
        clearTimeout(t);
        if (msg.ok) { ws.off('message', onMsg); resolve(ws); }
        else reject(new Error('connect failed: ' + JSON.stringify(msg.error)));
      }
    });
  });
}

let counter = 0;
function rpc(ws, method, params = {}) {
  return new Promise((resolve) => {
    const id = `rpc-${++counter}-${Date.now()}`;
    const t = setTimeout(() => { ws.off('message', h); resolve({ ok: false, error: { message: 'timeout' } }); }, 15000);
    const h = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'res' && msg.id === id) {
        clearTimeout(t); ws.off('message', h);
        resolve({ ok: !!msg.ok, result: msg.payload, error: msg.error });
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ type: 'req', id, method, params }));
  });
}

function chat(ws, sessionKey, message, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const reqId = `chat-${++counter}-${Date.now()}`;
    let resp = '';
    const t = setTimeout(() => { ws.off('message', h); resolve({ ok: false, resp: '(timeout)', error: 'timeout' }); }, timeoutMs);
    const h = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'res' && msg.id === reqId && !msg.ok) {
        clearTimeout(t); ws.off('message', h);
        resolve({ ok: false, resp: '', error: msg.error?.message || JSON.stringify(msg.error) });
        return;
      }
      if (msg.type === 'event' && msg.event === 'chat') {
        const p = msg.payload;
        if (p.sessionKey && p.sessionKey !== sessionKey) return;
        if (p.state === 'delta' && p.message?.content) {
          resp = normalize(p.message.content);
        }
        if (p.state === 'final') {
          if (p.message?.content) resp = normalize(p.message.content);
          clearTimeout(t); ws.off('message', h);
          resolve({ ok: true, resp });
        }
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ type: 'req', id: reqId, method: 'chat.send', params: { sessionKey, message, idempotencyKey: reqId } }));
  });
}

function normalize(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter(p => p.type === 'text').map(p => p.text).join('');
  return '';
}

const AGENTS = [
  { id: 'researcher', name: 'Research Analyst', emoji: '🔍', keywords: ['research', 'analyst', 'intelligence', 'investigation'] },
  { id: 'coder',      name: 'Coding Assistant', emoji: '💻', keywords: ['code', 'developer', 'coding', 'programming', 'full-stack'] },
  { id: 'writer',     name: 'Content Creator',  emoji: '✍️', keywords: ['content', 'writer', 'copywriter', 'copy', 'creative'] },
  { id: 'analyst',    name: 'Data Analyst',      emoji: '📊', keywords: ['data', 'analyst', 'analysis', 'business intelligence'] },
  { id: 'assistant',  name: 'Personal Assistant', emoji: '📋', keywords: ['assistant', 'personal', 'task', 'organiz', 'schedule'] },
];

// ── Test suite for a single server ───────────────────────────

async function testServer(serverIp, token) {
  let pass = 0, fail = 0;
  const ok = (msg) => { pass++; console.log(`  ✅ ${msg}`); };
  const no = (msg) => { fail++; console.log(`  ❌ ${msg}`); };

  const ts = Date.now();
  const testSessions = [];

  // ── 1. Connection ──
  console.log('  1. Connection');
  let ws;
  try {
    ws = await connect(serverIp, token);
    ok('WebSocket connected');
  } catch (e) {
    no(`Connection failed: ${e.message}`);
    return { pass, fail };
  }

  // ── 2. agents.list ──
  console.log('  2. agents.list');
  const al = await rpc(ws, 'agents.list');
  if (!al.ok || !al.result?.agents) {
    no('agents.list failed');
    ws.close();
    return { pass, fail };
  }
  const agents = al.result.agents;
  ok(`Got ${agents.length} agents`);

  for (const expected of AGENTS) {
    const found = agents.find(a => a.id === expected.id);
    found ? ok(`${expected.emoji} ${expected.id} — "${found.name}"`) : no(`${expected.emoji} ${expected.id} NOT found`);
  }

  const mainAgent = agents.find(a => a.id === 'main');
  mainAgent ? ok('main agent found') : no('main agent NOT found');

  // ── 3. Chat with each agent + persona verification ──
  console.log('  3. Chat with each agent');
  const chatResults = {};

  for (const agent of AGENTS) {
    const sessionKey = `agent:${agent.id}:test-integ-${ts}`;
    testSessions.push(sessionKey);

    const start = Date.now();
    const result = await chat(ws, sessionKey, 'What is your name and role? Answer in 1 sentence.');
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    chatResults[agent.id] = result;

    if (!result.ok) {
      no(`${agent.id}: failed — ${result.error || result.resp} (${elapsed}s)`);
      continue;
    }
    if (!result.resp || result.resp.length < 10) {
      no(`${agent.id}: empty or too short (${elapsed}s)`);
      continue;
    }

    ok(`${agent.id}: ${elapsed}s — "${result.resp.slice(0, 80)}..."`);

    const lower = result.resp.toLowerCase();
    const matched = agent.keywords.some(kw => lower.includes(kw));
    matched
      ? ok(`${agent.id}: persona ✓ (${agent.keywords.filter(k => lower.includes(k)).join(', ')})`)
      : no(`${agent.id}: persona ✗ — expected [${agent.keywords.join(', ')}]`);
  }

  // ── 4. Session isolation ──
  console.log('  4. Session isolation');
  for (const agent of AGENTS) {
    const sessions = await rpc(ws, 'sessions.list', { agentId: agent.id });
    if (!sessions.ok) { no(`sessions.list ${agent.id} failed`); continue; }

    const keys = (sessions.result?.sessions || []).map(s => s.key);
    const testKey = `agent:${agent.id}:test-integ-${ts}`;

    if (chatResults[agent.id]?.ok) {
      keys.includes(testKey) ? ok(`${agent.id}: session in list`) : no(`${agent.id}: session missing`);
    }

    const leaked = AGENTS.filter(a => a.id !== agent.id && keys.some(k => k.startsWith(`agent:${a.id}:`)));
    leaked.length === 0 ? ok(`${agent.id}: no cross-contamination`) : no(`${agent.id}: leaked from ${leaked.map(a => a.id)}`);
  }

  // ── 5. Chat history ──
  console.log('  5. Chat history');
  for (const agent of AGENTS) {
    if (!chatResults[agent.id]?.ok) continue;
    const hist = await rpc(ws, 'chat.history', { sessionKey: `agent:${agent.id}:test-integ-${ts}` });
    if (!hist.ok) { no(`${agent.id}: history failed`); continue; }
    const msgs = hist.result?.messages || [];
    const u = msgs.filter(m => m.role === 'user').length;
    const a = msgs.filter(m => m.role === 'assistant').length;
    (u >= 1 && a >= 1) ? ok(`${agent.id}: ${u}u + ${a}a msgs`) : no(`${agent.id}: ${u}u + ${a}a (expected ≥1 each)`);
  }

  // ── 6. Agent switching ──
  console.log('  6. Agent switching');
  const swA = `agent:researcher:test-sw-${ts}`;
  const swB = `agent:coder:test-sw-${ts}`;
  testSessions.push(swA, swB);

  const rA = await chat(ws, swA, 'What tools do you have? List 3. 1 sentence.');
  const rB = await chat(ws, swB, 'What tools do you have? List 3. 1 sentence.');

  if (rA.ok && rB.ok) {
    ok(`Researcher: "${rA.resp.slice(0, 70)}..."`);
    ok(`Coder: "${rB.resp.slice(0, 70)}..."`);
    rA.resp !== rB.resp ? ok('Different responses ✓') : no('Identical responses');
  } else {
    if (!rA.ok) no(`Researcher: ${rA.error || rA.resp}`);
    if (!rB.ok) no(`Coder: ${rB.error || rB.resp}`);
  }

  // ── 7. Cleanup ──
  console.log('  7. Cleanup');
  let cleaned = 0;
  for (const key of testSessions) {
    const del = await rpc(ws, 'sessions.delete', { key });
    if (del.ok) cleaned++;
  }
  ok(`Deleted ${cleaned}/${testSessions.length} test sessions`);

  ws.close();
  return { pass, fail };
}

// ── Main: run on all servers ─────────────────────────────────

async function main() {
  let totalPass = 0, totalFail = 0;
  const results = [];

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     Agent Integration Tests — All Servers        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  for (const { ip, token } of SERVERS) {
    console.log(`\n┌──────────────────────────────────────────────────`);
    console.log(`│ Server: ${ip}`);
    console.log(`└──────────────────────────────────────────────────`);

    const { pass, fail } = await testServer(ip, token);
    totalPass += pass;
    totalFail += fail;
    results.push({ ip, pass, fail });

    console.log(`\n  → ${ip}: ${pass} passed, ${fail} failed`);
  }

  // ── Grand summary ──
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                    Summary                       ║');
  console.log('╠══════════════════════════════════════════════════╣');
  for (const r of results) {
    const status = r.fail === 0 ? '✅' : '❌';
    console.log(`║  ${status} ${r.ip.padEnd(16)} ${String(r.pass).padStart(3)} passed  ${String(r.fail).padStart(3)} failed ║`);
  }
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Total: ${String(totalPass).padStart(3)} passed, ${String(totalFail).padStart(3)} failed${' '.repeat(19)}║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
