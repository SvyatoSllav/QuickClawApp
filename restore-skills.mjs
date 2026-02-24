#!/usr/bin/env node
// Restore wiped agent skills on live server via OpenClaw gateway WebSocket
import { WebSocket } from 'ws';

const WS_URL = 'ws://85.239.53.127:18789';
const TOKEN = 'r8U1fIjbW6sjz_QSbiwifhzpAzCptLcAMUoz42h0UCk';

// Original skills from openclaw-agents.json
const CORRECT_SKILLS = {
  researcher: ["summarize", "blogwatcher", "weather", "session-logs", "mcporter", "human-browser"],
  writer: ["summarize", "nano-banana-pro", "openai-image-gen", "gifgrep", "obsidian", "session-logs", "human-browser"],
  coder: ["github", "coding-agent", "tmux", "session-logs", "mcporter", "human-browser"],
  analyst: ["summarize", "nano-pdf", "gog", "session-logs", "human-browser"],
  assistant: ["gog", "trello", "notion", "himalaya", "weather", "session-logs", "human-browser"],
};

let reqCounter = 0;
const handlers = new Map();

function sendReq(ws, method, params) {
  const id = `restore-${++reqCounter}`;
  return new Promise((resolve) => {
    handlers.set(id, resolve);
    ws.send(JSON.stringify({ type: 'req', id, method, params }));
    setTimeout(() => { handlers.delete(id); resolve({ ok: false, error: 'timeout' }); }, 15000);
  });
}

const ws = new WebSocket(WS_URL);

ws.on('open', () => console.log('WS opened'));

ws.on('message', async (raw) => {
  const data = JSON.parse(raw.toString());
  console.log('← ', data.type, data.event || data.id || '', data.ok !== undefined ? `ok=${data.ok}` : '');

  // Handle challenge
  if (data.type === 'event' && data.event === 'connect.challenge') {
    console.log('Sending auth...');
    ws.send(JSON.stringify({
      type: 'req', id: 'connect-init', method: 'connect',
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: 'openclaw-control-ui', displayName: 'EasyClaw', version: '1.0.0', platform: 'mobile', mode: 'ui' },
        caps: [], scopes: ['operator.read', 'operator.write', 'operator.admin'],
        auth: { token: TOKEN },
      },
    }));
    return;
  }

  // Handle connect response
  if (data.type === 'res' && data.id === 'connect-init') {
    if (!data.ok && !data.payload) {
      console.error('Auth FAILED:', data.error);
      process.exit(1);
    }
    console.log('Connected! Getting config...');

    // Step 1: Get current config
    const configRes = await sendReq(ws, 'config.get', {});
    if (!configRes.ok) {
      console.error('config.get failed:', configRes.error);
      process.exit(1);
    }

    const baseHash = configRes.result?.hash;
    const agents = configRes.result?.config?.agents?.list ?? [];
    console.log(`Got config (hash=${baseHash}), ${agents.length} agents:`);

    for (const a of agents) {
      console.log(`  ${a.id}: skills = [${(a.skills || []).join(', ')}]`);
    }

    // Step 2: Build patched list preserving ALL fields, only fixing skills
    const patchedList = agents.map((a) => {
      const correctSkills = CORRECT_SKILLS[a.id];
      if (!correctSkills) {
        console.log(`  ${a.id}: no correction needed (unknown agent), keeping as-is`);
        return a;
      }

      // Merge: keep any extra skills that were added (like "flow") + restore missing ones
      const currentSkills = a.skills || [];
      const merged = [...new Set([...correctSkills, ...currentSkills])];
      console.log(`  ${a.id}: ${JSON.stringify(currentSkills)} → ${JSON.stringify(merged)}`);
      return { ...a, skills: merged };
    });

    const patch = { agents: { list: patchedList } };
    console.log('\nSending config.patch...');

    const patchRes = await sendReq(ws, 'config.patch', { baseHash, raw: JSON.stringify(patch) });
    console.log('config.patch result:', patchRes.ok ? 'SUCCESS' : 'FAILED', patchRes.error || '');

    if (patchRes.ok) {
      console.log('\nSkills restored successfully!');
    }

    ws.close();
  }

  // Route RPC responses
  if (data.type === 'res' && data.id) {
    const handler = handlers.get(data.id);
    if (handler) {
      handlers.delete(data.id);
      handler({ ok: !!data.ok, result: data.payload, error: data.error });
    }
  }
});

ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1); });
ws.on('close', () => { console.log('WS closed'); process.exit(0); });
