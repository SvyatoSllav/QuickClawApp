import { create } from 'zustand';
import { Session } from '../types/session';
import { useChatStore } from './chatStore';
import { useAgentStore } from './agentStore';

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
    set({ isLoading: true });
    const { sendRequest } = useChatStore.getState();
    const activeAgentId = useAgentStore.getState().activeAgentId;
    sendRequest('sessions.list', activeAgentId ? { agentId: activeAgentId } : {}, (data) => {
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
          }));
        set({ sessions, isLoading: false });

        const serverModel = data.result?.defaults?.model;
        if (serverModel) {
          useChatStore.getState().syncModelFromServer(serverModel);
        }
      } else {
        set({ isLoading: false });
      }
    });
  },

  switchSession: (key) => {
    const chat = useChatStore.getState();
    if (chat.activeSessionKey === key) return;

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
