import { create } from 'zustand';
import { Session } from '../types/session';
import { useChatStore } from './chatStore';

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
    sendRequest('sessions.list', {}, (data) => {
      if (data.ok && data.result?.sessions) {
        const sessions: Session[] = data.result.sessions.map((s: any) => ({
          key: s.key,
          displayName: s.displayName,
          derivedTitle: s.derivedTitle,
          updatedAt: s.updatedAt ?? null,
          kind: s.kind ?? 'direct',
          totalTokens: s.totalTokens,
        }));
        set({ sessions, isLoading: false });
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
    const key = `chat-${Date.now()}`;
    const chat = useChatStore.getState();

    chat.setActiveSessionKey(key);
    chat.clearMessages();

    // Add optimistic entry to session list
    set((s) => ({
      sessions: [
        { key, displayName, updatedAt: Date.now(), kind: 'direct' },
        ...s.sessions,
      ],
    }));

    // Optionally set display name via sessions.patch
    if (displayName) {
      chat.sendRequest('sessions.patch', { key, displayName });
    }
  },

  deleteSession: (key) => {
    if (key === 'main') return;

    const chat = useChatStore.getState();
    chat.sendRequest('sessions.delete', { key }, (data) => {
      if (data.ok) {
        set((s) => ({ sessions: s.sessions.filter((sess) => sess.key !== key) }));

        // Switch to main if the deleted session was active
        if (chat.activeSessionKey === key) {
          chat.setActiveSessionKey('main');
          chat.clearMessages();
          chat.loadHistory('main');
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
