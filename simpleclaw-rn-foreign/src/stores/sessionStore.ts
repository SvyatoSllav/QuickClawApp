import { create } from 'zustand';
import { Session } from '../types/session';
import { useChatStore } from './chatStore';
import { useAgentStore } from './agentStore';
import { remoteLog } from '../services/remoteLog';

interface SessionState {
  sessions: Session[];
  isLoading: boolean;

  fetchSessions: () => void;
  switchSession: (key: string) => void;
  createSession: (displayName?: string) => void;
  deleteSession: (key: string) => void;
  renameSession: (key: string, displayName: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  isLoading: false,

  fetchSessions: () => {
    if (__DEV__) console.log('[sessions] fetchSessions starting...');
    set({ isLoading: true });
    const { sendRequest } = useChatStore.getState();
    const activeAgentId = useAgentStore.getState().activeAgentId;
    remoteLog('info', 'sessions', 'fetchSessions', { agentId: activeAgentId });
    sendRequest('sessions.list', activeAgentId ? { agentId: activeAgentId } : {}, (data) => {
      if (__DEV__) console.log('[sessions] sessions.list response:', data.ok ? (data.result?.sessions?.length + ' sessions') : 'FAILED', data.error || '');
      remoteLog('info', 'sessions', 'sessions.list result', { ok: data.ok, count: data.result?.sessions?.length ?? 0, error: data.error ? JSON.stringify(data.error).substring(0, 200) : undefined });
      if (data.ok && data.result?.sessions) {
        const activeAgentId = useAgentStore.getState().activeAgentId;
        const prefix = activeAgentId ? `agent:${activeAgentId}:` : '';

        const sessions: Session[] = data.result.sessions
          .filter((s: any) => !prefix || s.key.startsWith(prefix))
          .map((s: any) => ({
            key: s.key,
            displayName: s.displayName,
            derivedTitle: s.derivedTitle,
            updatedAt: s.updatedAt ?? null,
            kind: s.kind ?? 'direct',
            totalTokens: s.totalTokens,
            model: s.model ?? undefined,
          }));
        if (__DEV__) console.log('[sessions] Filtered sessions:', sessions.length, 'for prefix:', prefix);
        set({ sessions, isLoading: false });

        // Sync model from the ACTIVE SESSION (not just server defaults)
        const { activeSessionKey } = useChatStore.getState();
        const activeSession = data.result.sessions.find(
          (s: any) => s.key === activeSessionKey,
        );
        const serverModel = activeSession?.model || data.result?.defaults?.model;
        if (serverModel) {
          if (__DEV__) console.log('[sessions] Server model:', serverModel, '(from', activeSession?.model ? 'session' : 'defaults', ')');
          useChatStore.getState().syncModelFromServer(serverModel);
        }
      } else {
        if (__DEV__) console.warn('[sessions] fetchSessions unavailable (scope):', data.error?.message || data.error);
        set({ isLoading: false });
      }
    });
  },

  switchSession: (key) => {
    const chat = useChatStore.getState();
    if (chat.activeSessionKey === key) return;

    const session = get().sessions.find(s => s.key === key);
    if (session?.model) {
      chat.syncModelFromServer(session.model);
    }

    chat.setActiveSessionKey(key);
    chat.clearMessages();
    chat.loadHistory(key);
  },

  createSession: (displayName) => {
    const activeAgentId = useAgentStore.getState().activeAgentId;
    const key = activeAgentId
      ? `agent:${activeAgentId}:chat-${Date.now()}`
      : `chat-${Date.now()}`;
    const chat = useChatStore.getState();

    // Set key and clear messages immediately for snappy UI
    chat.setActiveSessionKey(key);
    chat.clearMessages();

    // Add optimistic entry to session list
    set((s) => ({
      sessions: [
        { key, displayName, updatedAt: Date.now(), kind: 'direct' },
        ...s.sessions,
      ],
    }));

    // Sessions auto-create on first chat.send — no server call needed here
  },

  deleteSession: (key) => {
    if (key.endsWith(':main')) return;

    const chat = useChatStore.getState();
    chat.sendRequest('sessions.delete', { key }, (data) => {
      if (data.ok) {
        set((s) => ({ sessions: s.sessions.filter((sess) => sess.key !== key) }));

        // Switch to agent's main session if the deleted session was active
        if (chat.activeSessionKey === key) {
          const activeAgentId = useAgentStore.getState().activeAgentId;
          const mainKey = activeAgentId ? `agent:${activeAgentId}:main` : 'main';
          chat.setActiveSessionKey(mainKey);
          chat.clearMessages();
          chat.loadHistory(mainKey);
        }
      }
    });
  },

  renameSession: (key, displayName) => {
    const { sendRequest } = useChatStore.getState();
    sendRequest('sessions.patch', { key, displayName }, (data) => {
      if (data.ok) {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.key === key ? { ...sess, displayName } : sess,
          ),
        }));
      }
    });
  },
}));
