import { create } from 'zustand';
import { ModelId, ChatMessage, ChatAttachment, AVAILABLE_MODELS, MODEL_TO_OPENROUTER } from '../types/chat';
import apiClient from '../api/client';
import { setServerModel } from '../api/profileApi';
import { getItem, setItem } from '../services/secureStorage';

const SELECTED_MODEL_KEY = 'selected_model';

type ResponseHandler = (data: { ok: boolean; result?: any; error?: any }) => void;

interface ChatState {
  messages: ChatMessage[];
  selectedModel: ModelId;
  inputText: string;
  connectionState: 'disconnected' | 'connecting' | 'connected';
  ws: WebSocket | null;
  attachments: ChatAttachment[];
  activeSessionKey: string;
  isLoadingHistory: boolean;
  _responseHandlers: Map<string, ResponseHandler>;
  _connGeneration: number;

  setModel: (model: ModelId) => Promise<void>;
  setInputText: (text: string) => void;
  sendMessage: () => void;
  connect: (serverIp: string, gatewayToken: string, wsUrl?: string) => void;
  disconnect: () => void;
  addMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearMessages: () => void;
  addAttachment: (attachment: ChatAttachment) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;
  setActiveSessionKey: (key: string) => void;
  sendRequest: (method: string, params: Record<string, any>, onResponse?: ResponseHandler) => string | null;
  loadHistory: (sessionKey: string) => void;
  syncModelFromServer: (serverModel: string) => void;
}

let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let healthWatchdog: ReturnType<typeof setTimeout> | null = null;
let requestCounter = 0;

/** Strip provider prefix: "anthropic/claude-sonnet-4" → "claude-sonnet-4", "openrouter/minimax/minimax-m2.5" → "minimax-m2.5" */
function stripProviderPrefix(raw: string): string {
  const parts = raw.split('/');
  // openrouter/<provider>/<model> → take last part
  if (parts.length >= 3 && parts[0] === 'openrouter') return parts.slice(2).join('/');
  // <provider>/<model> → take model part (handles anthropic/, openai/, google/, etc.)
  if (parts.length === 2) return parts[1];
  return raw;
}

/** Resolve a server model string to a known ModelId */
function resolveServerModel(serverModel: string): ModelId | null {
  const stripped = stripProviderPrefix(serverModel);
  const normalized = stripped.toLowerCase().replace(/[-._]/g, '');

  // Exact match against stripped value
  const exact = AVAILABLE_MODELS.find((m) => m.id === stripped);
  if (exact) return exact.id;

  // Normalized substring match
  const sub = AVAILABLE_MODELS.find(
    (m) => normalized.includes(m.id.toLowerCase().replace(/[-._]/g, ''))
      || m.id.toLowerCase().replace(/[-._]/g, '').includes(normalized),
  );
  if (sub) return sub.id;

  // Provider keyword match
  for (const keyword of ['claude', 'gpt', 'gemini', 'minimax'] as const) {
    if (normalized.includes(keyword)) {
      const match = AVAILABLE_MODELS.find((m) => m.icon === keyword);
      if (match) return match.id;
    }
  }

  return null;
}

/** Reset health watchdog — call on every server event. Forces reconnect if no events for 15s. */
function resetHealthWatchdog(get: () => ChatState) {
  if (healthWatchdog) clearTimeout(healthWatchdog);
  healthWatchdog = setTimeout(() => {
    const { connectionState, ws } = get();
    if (connectionState === 'connected' && ws) {
      console.log('[ws] Health watchdog: no events for 15s, forcing reconnect');
      ws.close();
    }
  }, 15000);
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  selectedModel: 'claude-sonnet-4',
  inputText: '',
  connectionState: 'disconnected',
  ws: null,
  attachments: [],
  activeSessionKey: 'main',
  isLoadingHistory: false,
  _responseHandlers: new Map(),
  _connGeneration: 0,

  setModel: async (model) => {
    console.log('[chat] setModel called:', model);
    set({ selectedModel: model });
    setItem(SELECTED_MODEL_KEY, model);

    const openrouterModel = MODEL_TO_OPENROUTER[model] || model;
    const { sendRequest, activeSessionKey } = get();

    // Per-session override via WebSocket (immediate, no restart)
    sendRequest('sessions.patch', { key: activeSessionKey, model: openrouterModel }, (data) => {
      console.log('[chat] sessions.patch model response:', data.ok ? 'ok' : 'FAILED', JSON.stringify(data.error || ''));
    });

    // Persist to backend profile (for next login). Skip setServerModel — it SSHes
    // into the server and triggers a gateway restart which kills the WebSocket.
    try {
      await apiClient.patch('/profile/', { selected_model: model });
    } catch (e: any) {
      console.error('[chat] setModel profile save ERROR:', e?.response?.status, e?.message);
    }
  },

  setInputText: (text) => set({ inputText: text }),

  addAttachment: (attachment) =>
    set((s) => ({ attachments: [...s.attachments, attachment] })),

  removeAttachment: (index) =>
    set((s) => ({ attachments: s.attachments.filter((_, i) => i !== index) })),

  clearAttachments: () => set({ attachments: [] }),

  setActiveSessionKey: (key) => set({ activeSessionKey: key }),

  sendRequest: (method, params, onResponse) => {
    const { ws, connectionState } = get();
    if (!ws || connectionState !== 'connected') {
      console.log('[ws] sendRequest SKIPPED (not connected):', method, 'state:', connectionState, 'ws:', !!ws);
      return null;
    }

    const id = `rpc-${++requestCounter}-${Date.now()}`;
    if (onResponse) {
      get()._responseHandlers.set(id, onResponse);
    }

    console.log('[ws] sendRequest:', method, 'id:', id, 'params:', JSON.stringify(params).substring(0, 200));
    try {
      ws.send(JSON.stringify({ type: 'req', id, method, params }));
    } catch (e) {
      console.error('[ws] sendRequest send failed:', e);
      get()._responseHandlers.delete(id);
      return null;
    }
    return id;
  },

  loadHistory: (sessionKey) => {
    console.log('[ws] loadHistory:', sessionKey);
    set({ isLoadingHistory: true });
    get().sendRequest('chat.history', { sessionKey }, (data) => {
      console.log('[ws] loadHistory response:', data.ok ? `${data.result?.messages?.length ?? 0} messages` : 'FAILED', data.error || '');
      if (data.ok && data.result?.messages) {
        const messages: ChatMessage[] = data.result.messages
          .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && normalizeContent(m.content))
          .map((m: any, i: number) => ({
            id: `hist-${i}-${Date.now()}`,
            role: m.role as 'user' | 'assistant',
            content: normalizeContent(m.content),
            timestamp: m.timestamp ?? Date.now(),
          }));
        set({ messages, isLoadingHistory: false });
      } else {
        set({ isLoadingHistory: false });
      }
    });
  },

  sendMessage: () => {
    const { inputText, ws, connectionState, activeSessionKey, attachments } = get();
    const text = inputText.trim();
    console.log('[ws] sendMessage called: text="' + text.substring(0, 50) + '" state=' + connectionState + ' session=' + activeSessionKey + ' attachments=' + attachments.length);

    // Self-healing: if state says connected but ws is gone, fix it
    if (connectionState === 'connected' && !ws) {
      console.warn('[ws] State corrupted: connected but no ws — resetting to disconnected');
      set({ connectionState: 'disconnected', ws: null });
      return;
    }

    if ((!text && attachments.length === 0) || connectionState !== 'connected' || !ws) {
      console.log('[ws] sendMessage SKIPPED: noText=' + (!text && attachments.length === 0) + ' notConnected=' + (connectionState !== 'connected') + ' noWs=' + !ws);
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      inputText: '',
      attachments: [],
    }));

    const requestId = `req-${Date.now()}`;
    const params: Record<string, any> = {
      sessionKey: activeSessionKey,
      message: text,
      idempotencyKey: requestId,
    };

    if (attachments.length > 0) {
      params.attachments = attachments.map((a) => ({
        type: 'image',
        mimeType: a.mimeType,
        fileName: a.fileName,
        content: a.base64,
      }));
    }

    console.log('[ws] sendMessage → chat.send id=' + requestId + ' session=' + activeSessionKey);
    try {
      ws.send(
        JSON.stringify({
          type: 'req',
          id: requestId,
          method: 'chat.send',
          params,
        }),
      );
    } catch (e) {
      console.error('[ws] sendMessage send failed:', e);
    }
  },

  connect: (serverIp, gatewayToken, wsUrl?) => {
    const { connectionState: curState, ws: existingWs } = get();

    // Duplicate connection guard
    if ((curState === 'connecting' || curState === 'connected') && existingWs) {
      console.log('[ws] Already', curState, '— skipping duplicate connect to', serverIp);
      return;
    }

    // Bump generation — all callbacks from previous connections become stale
    const gen = get()._connGeneration + 1;
    set({ _connGeneration: gen });

    const wsEndpoint = wsUrl || `ws://${serverIp}:18789`;
    console.log('[ws] Connecting to ' + wsEndpoint + ' gen=' + gen);

    if (existingWs) {
      console.log('[ws] Closing existing WebSocket before reconnect');
      existingWs.close();
    }

    // Clear stale response handlers from previous connection
    get()._responseHandlers.clear();

    set({ connectionState: 'connecting', ws: null });

    const ws = new WebSocket(wsEndpoint);

    ws.onopen = () => {
      // Stale check
      if (get()._connGeneration !== gen) { ws.close(); return; }
      console.log('[ws] WebSocket opened, waiting for challenge...');
    };

    ws.onmessage = (event) => {
      // Stale check
      if (get()._connGeneration !== gen) return;

      // Reset health watchdog on every message
      resetHealthWatchdog(get);

      try {
        const data = JSON.parse(event.data);
        console.log('[ws] ← recv:', data.type, data.event || data.id || '', data.ok !== undefined ? 'ok=' + data.ok : '');

        // Handle challenge — send connect request
        if (data.type === 'event' && data.event === 'connect.challenge') {
          console.log('[ws] Challenge received, sending auth as control-ui mode=ui');
          ws.send(
            JSON.stringify({
              type: 'req',
              id: 'connect-init',
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'openclaw-control-ui',
                  displayName: 'EasyClaw',
                  version: '1.0.0',
                  platform: 'mobile',
                  mode: 'ui',
                },
                caps: [],
                scopes: ['operator.read', 'operator.write', 'operator.admin'],
                auth: { token: gatewayToken },
              },
            }),
          );
          return;
        }

        // Handle connect response
        if (data.type === 'res' && data.id === 'connect-init') {
          if (data.ok || data.payload) {
            const hadMessages = get().messages.length > 0;
            console.log('[ws] Connect SUCCESS gen=' + gen + ' (reconnect:', hadMessages, ')');
            // Atomically set both ws and connectionState together
            set({ connectionState: 'connected', ws });

            if (hadMessages) {
              // Reconnect: keep existing messages, just re-fetch sessions quietly
              const { useSessionStore } = require('./sessionStore');
              useSessionStore.getState().fetchSessions();
            } else {
              // Fresh connect: full agent/session init
              const { useAgentStore } = require('./agentStore');
              useAgentStore.getState().fetchAgents();
            }
          } else {
            console.error('[ws] Connect FAILED:', JSON.stringify(data.error || data));
          }
          return;
        }

        // Route RPC responses to registered handlers
        if (data.type === 'res' && data.id) {
          const handler = get()._responseHandlers.get(data.id);
          if (handler) {
            get()._responseHandlers.delete(data.id);
            console.log('[ws] RPC response for', data.id, 'ok:', !!data.ok, data.error ? 'error:' + JSON.stringify(data.error) : '');
            handler({ ok: !!data.ok, result: data.payload, error: data.error });
            return;
          }
        }

        // Handle chat streaming events — filter by active session
        if (data.type === 'event' && data.event === 'chat') {
          const payload = data.payload;
          const activeKey = get().activeSessionKey;

          if (payload.sessionKey && payload.sessionKey !== activeKey) return;

          if (payload.state === 'delta' && payload.message?.content) {
            const content = normalizeContent(payload.message.content);
            console.log('[ws] chat delta len=' + content.length + ' preview="' + content.substring(0, 50) + '"');
            get().updateLastAssistantMessage(content);
          } else if (payload.state === 'final') {
            const finalContent = payload.message?.content ? normalizeContent(payload.message.content) : null;
            console.log('[ws] Chat message final for session:', payload.sessionKey, 'finalLen=' + (finalContent?.length ?? 'none'));
            // If final has content and it's longer than what we have, use it
            if (finalContent && finalContent.length > 0) {
              get().updateLastAssistantMessage(finalContent);
            }
          }
        }

        // Handle chat.send response
        if (data.type === 'res' && data.id?.startsWith('req-') && !data.ok) {
          console.error('[ws] chat.send FAILED:', JSON.stringify(data.error || data));
        }
        if (data.type === 'res' && data.ok && data.id?.startsWith('req-')) {
          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          };
          set((s) => ({ messages: [...s.messages, assistantMsg] }));
        }
      } catch (e) {
        console.error('[ws] Message parse error:', e, 'raw:', String(event.data).substring(0, 200));
      }
    };

    ws.onclose = (event) => {
      // Stale check: only handle if this is still the active connection
      if (get()._connGeneration !== gen) {
        console.log('[ws] Stale onclose (gen=' + gen + ' current=' + get()._connGeneration + '), ignoring');
        return;
      }
      console.log('[ws] WebSocket CLOSED gen=' + gen + ' code=' + event.code + ' reason="' + (event.reason || '') + '"');
      set({ connectionState: 'disconnected', ws: null });

      // Stop health watchdog
      if (healthWatchdog) { clearTimeout(healthWatchdog); healthWatchdog = null; }

      // Auto-reconnect after 1s
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        const state = get();
        if (state.connectionState === 'disconnected') {
          console.log('[ws] Auto-reconnecting...');
          state.connect(serverIp, gatewayToken, wsUrl);
        }
      }, 1000);
    };

    ws.onerror = (event) => {
      if (get()._connGeneration !== gen) return;
      console.error('[ws] WebSocket ERROR gen=' + gen);
      ws.close();
    };

    // Store ws immediately so it's available during handshake
    set({ ws });
  },

  disconnect: () => {
    console.log('[ws] disconnect() called');
    // Bump generation to invalidate all callbacks
    set((s) => ({ _connGeneration: s._connGeneration + 1 }));
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (healthWatchdog) {
      clearTimeout(healthWatchdog);
      healthWatchdog = null;
    }
    const ws = get().ws;
    if (ws) {
      console.log('[ws] Closing WebSocket from disconnect()');
      ws.close();
    }
    set({ ws: null, connectionState: 'disconnected' });
    get()._responseHandlers.clear();
  },

  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

  updateLastAssistantMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content };
          break;
        }
      }
      return { messages: msgs };
    }),

  syncModelFromServer: (serverModel) => {
    // Only sync from server if no locally saved model
    getItem(SELECTED_MODEL_KEY).then((saved) => {
      if (saved) {
        const savedModel = AVAILABLE_MODELS.find((m) => m.id === saved);
        if (savedModel) {
          set({ selectedModel: savedModel.id });
          return;
        }
      }
      const resolved = resolveServerModel(serverModel);
      if (resolved) set({ selectedModel: resolved });
    });
  },

  clearMessages: () => set({ messages: [] }),
}));

/** Normalize Pi-format content (string or array of parts) to plain string */
function normalizeContent(content: unknown): string {
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((part: any) => part.type === 'text' && part.text)
      .map((part: any) => part.text)
      .join('');
  }
  return stripMessageMetadata(text);
}

/** Strip OpenClaw metadata prefix from user messages:
 *  "Conversation info (untrusted metadata):\n```json\n{...}\n```\n\n[timestamp] actual text"
 */
function stripMessageMetadata(text: string): string {
  if (!text) return text;
  // Remove "Conversation info ..." block + timestamp prefix
  const cleaned = text.replace(/^Conversation info \(untrusted metadata\):\n```json\n[\s\S]*?```\n\n/, '');
  // Remove leading timestamp like "[Mon 2026-02-23 09:14 UTC] "
  return cleaned.replace(/^\[[\w\s:,-]+\]\s*/, '');
}
