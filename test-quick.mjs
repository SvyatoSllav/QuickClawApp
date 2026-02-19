import WebSocket from 'ws';

const ws = new WebSocket('ws://194.87.226.98:18789');

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());

  // Handle challenge
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    ws.send(JSON.stringify({
      type: 'req', id: 'connect-init', method: 'connect',
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: 'gateway-client', displayName: 'TestCLI', version: '1.0.0', platform: 'cli', mode: 'backend' },
        caps: [], auth: { token: 'mBDiG-b2PczPIWCywnEp8L0IJ7q-zcPHsBAoAiZq3i0' },
      },
    }));
    return;
  }

  // Connected — send chat
  if (msg.type === 'res' && msg.id === 'connect-init' && msg.ok) {
    console.log('Connected! Sending "hi" to researcher...\n');
    ws.send(JSON.stringify({
      type: 'req', id: 'req-1', method: 'chat.send',
      params: {
        sessionKey: `agent:researcher:test-${Date.now()}`,
        message: 'hi',
        idempotencyKey: 'req-1',
      },
    }));
    return;
  }

  // Chat streaming
  if (msg.type === 'event' && msg.event === 'chat') {
    const p = msg.payload;
    if (p.state === 'delta' && p.message?.content) {
      const text = typeof p.message.content === 'string'
        ? p.message.content
        : p.message.content.filter(c => c.type === 'text').map(c => c.text).join('');
      process.stdout.write('\r' + text);
    }
    if (p.state === 'final') {
      console.log('\n\n--- Done ---');
      ws.close();
    }
  }
});

ws.on('error', (e) => console.error('Error:', e.message));
setTimeout(() => { console.log('\n\nTimeout.'); ws.close(); }, 60000);
