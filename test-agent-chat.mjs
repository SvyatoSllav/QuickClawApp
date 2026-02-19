import WebSocket from 'ws';

const SERVER = 'ws://194.87.226.98:18789';
const TOKEN = 'mBDiG-b2PczPIWCywnEp8L0IJ7q-zcPHsBAoAiZq3i0';
const CHAT_TIMEOUT = 180000; // 3 minutes

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER);
    ws.on('error', reject);
    ws.on('close', (code, reason) => reject(new Error(`Closed: ${code} ${reason}`)));

    ws.on('message', function onMsg(raw) {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        ws.send(JSON.stringify({
          type: 'req',
          id: 'connect-init',
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'gateway-client',
              displayName: 'TestCLI',
              version: '1.0.0',
              platform: 'cli',
              mode: 'backend',
            },
            caps: [],
            auth: { token: TOKEN },
          },
        }));
        return;
      }

      if (msg.type === 'res' && msg.id === 'connect-init') {
        if (msg.ok) {
          ws.off('message', onMsg);
          resolve(ws);
        } else {
          reject(new Error('connect failed: ' + JSON.stringify(msg)));
        }
      }
    });
  });
}

let rpcCounter = 0;

function sendRPC(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = `rpc-${++rpcCounter}-${Date.now()}`;
    const timeout = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`RPC timeout: ${method}`));
    }, 30000);

    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'res' && msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve({ ok: !!msg.ok, result: msg.payload, error: msg.error });
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ type: 'req', id, method, params }));
  });
}

function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(p => p.type === 'text' && p.text)
      .map(p => p.text)
      .join('');
  }
  return '';
}

function chatWithAgent(ws, agentId, question) {
  return new Promise((resolve) => {
    const sessionKey = `agent:${agentId}:test-${Date.now()}`;
    const reqId = `req-${Date.now()}`;
    let fullResponse = '';
    let gotDelta = false;
    let gotRes = false;
    let gotFinal = false;

    const timeout = setTimeout(() => {
      ws.off('message', handler);
      resolve({ text: fullResponse || '(timeout after 3min)', timedOut: true, sessionKey });
    }, CHAT_TIMEOUT);

    const finish = () => {
      clearTimeout(timeout);
      ws.off('message', handler);
      resolve({ text: fullResponse || '(empty)', timedOut: false, sessionKey });
    };

    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());

      // Handle initial response (OK ack for chat.send)
      if (msg.type === 'res' && msg.id === reqId) {
        gotRes = true;
        if (!msg.ok) {
          clearTimeout(timeout);
          ws.off('message', handler);
          resolve({ text: `(error: ${JSON.stringify(msg.error)})`, timedOut: false, sessionKey });
          return;
        }
        // Don't finish yet — wait for streaming events
        return;
      }

      // Handle streaming chat events
      if (msg.type === 'event' && msg.event === 'chat') {
        const payload = msg.payload;
        if (payload.sessionKey && payload.sessionKey !== sessionKey) return;

        if (payload.state === 'delta' && payload.message?.content) {
          gotDelta = true;
          fullResponse = normalizeContent(payload.message.content);
        } else if (payload.state === 'final') {
          gotFinal = true;
          if (payload.message?.content) {
            fullResponse = normalizeContent(payload.message.content);
          }
          finish();
        }
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify({
      type: 'req',
      id: reqId,
      method: 'chat.send',
      params: {
        sessionKey,
        message: question,
        idempotencyKey: reqId,
      },
    }));

    console.log(`  Sent to ${agentId} (session: ${sessionKey})`);
  });
}

async function main() {
  console.log('Connecting to', SERVER);
  const ws = await connect();
  console.log('Connected!\n');

  // List agents
  const agentsResp = await sendRPC(ws, 'agents.list');
  const agents = agentsResp.result?.agents || [];
  console.log(`Found ${agents.length} agent(s):`);
  for (const a of agents) {
    console.log(`  ${a.identity?.emoji || ' '} ${a.id} — ${a.name || '(no name)'}`);
  }
  console.log();

  // Test agents
  const testAgents = ['researcher', 'coder', 'writer', 'analyst', 'assistant'];
  const question = 'What is your name, role, and what tools/skills do you have? Answer in 2-3 sentences max.';

  for (const agentId of testAgents) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      console.log(`⚠ Agent "${agentId}" not found, skipping\n`);
      continue;
    }

    console.log(`=== ${agent.identity?.emoji || ''} ${agentId} (${agent.name}) ===`);
    const start = Date.now();
    const result = await chatWithAgent(ws, agentId, question);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`  Time: ${elapsed}s ${result.timedOut ? '(TIMEOUT)' : '(OK)'}`);
    console.log(`  Response: ${result.text.slice(0, 600)}`);
    console.log();
  }

  ws.close();
  console.log('Done.');
}

main().catch(console.error);
