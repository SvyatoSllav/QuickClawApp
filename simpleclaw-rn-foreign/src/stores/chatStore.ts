import { create } from 'zustand';
import { ModelId, ChatMessage, ChatAttachment } from '../types/chat';
import apiClient from '../api/client';

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

  setModel: (model: ModelId) => Promise<void>;
  setInputText: (text: string) => void;
  sendMessage: () => void;
  connect: (serverIp: string, gatewayToken: string) => void;
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
}

let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let requestCounter = 0;

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

  setModel: async (model) => {
    set({ selectedModel: model });
    try {
      await apiClient.patch('/profile/', { selected_model: model });
    } catch {
      // silent — local state is enough
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
    if (!ws || connectionState !== 'connected') return null;

    const id = `rpc-${++requestCounter}-${Date.now()}`;
    if (onResponse) {
      get()._responseHandlers.set(id, onResponse);
    }

    ws.send(JSON.stringify({ type: 'req', id, method, params }));
    return id;
  },

  loadHistory: (sessionKey) => {
    set({ isLoadingHistory: true });
    get().sendRequest('chat.history', { sessionKey }, (data) => {
      if (data.ok && data.result?.messages) {
        const messages: ChatMessage[] = data.result.messages
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
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
    if ((!text && attachments.length === 0) || connectionState !== 'connected' || !ws) return;

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

    ws.send(
      JSON.stringify({
        type: 'req',
        id: requestId,
        method: 'chat.send',
        params,
      }),
    );
  },

  connect: (serverIp, gatewayToken) => {
    const existing = get().ws;
    if (existing) {
      existing.close();
    }

    set({ connectionState: 'connecting' });

    const ws = new WebSocket(`ws://${serverIp}:18789`);

    ws.onopen = () => {
      // Wait for challenge event, then send connect request
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle challenge — send connect request
        if (data.type === 'event' && data.event === 'connect.challenge') {
          ws.send(
            JSON.stringify({
              type: 'req',
              id: 'connect-init',
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'gateway-client',
                  displayName: 'AwesomeClaw',
                  version: '1.0.0',
                  platform: 'mobile',
                  mode: 'backend',
                },
                caps: [],
                auth: { token: gatewayToken },
              },
            }),
          );
          return;
        }

        // Handle connect response
        if (data.type === 'res' && data.id === 'connect-init' && (data.ok || data.payload)) {
          set({ connectionState: 'connected' });
          // Fetch agents on connect — this sets session key and loads history
          const { useAgentStore } = require('./agentStore');
          useAgentStore.getState().fetchAgents();
          return;
        }

        // Route RPC responses to registered handlers
        if (data.type === 'res' && data.id) {
          const handler = get()._responseHandlers.get(data.id);
          if (handler) {
            get()._responseHandlers.delete(data.id);
            // OpenClaw uses 'payload' instead of 'result'
            handler({ ok: !!data.ok, result: data.payload, error: data.error });
            return;
          }
        }

        // Handle chat streaming events — filter by active session
        if (data.type === 'event' && data.event === 'chat') {
          const payload = data.payload;
          const activeKey = get().activeSessionKey;

          // Ignore events from other sessions
          if (payload.sessionKey && payload.sessionKey !== activeKey) return;

          if (payload.state === 'delta' && payload.message?.content) {
            get().updateLastAssistantMessage(payload.message.content);
          } else if (payload.state === 'final') {
            // Message complete — nothing extra needed
          }
        }

        // Handle chat.send response — create placeholder assistant message
        if (data.type === 'res' && data.ok && data.id?.startsWith('req-')) {
          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          };
          set((s) => ({ messages: [...s.messages, assistantMsg] }));
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      set({ connectionState: 'disconnected', ws: null });
      // Auto-reconnect after 3s
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        const state = get();
        if (state.connectionState === 'disconnected') {
          state.connect(serverIp, gatewayToken);
        }
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    set({ ws });
  },

  disconnect: () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    const ws = get().ws;
    if (ws) ws.close();
    set({ ws: null, connectionState: 'disconnected' });
  },

  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

  updateLastAssistantMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content: msgs[i].content + content };
          break;
        }
      }
      return { messages: msgs };
    }),

  clearMessages: () => set({ messages: [] }),
}));

/** Normalize Pi-format content (string or array of parts) to plain string */
function normalizeContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text' && part.text)
      .map((part: any) => part.text)
      .join('');
  }
  return '';
}
