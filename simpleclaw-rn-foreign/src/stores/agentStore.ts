import { create } from 'zustand';
import { Agent } from '../types/agent';
import { useChatStore } from './chatStore';
import { useSessionStore } from './sessionStore';

interface AgentState {
  agents: Agent[];
  activeAgentId: string | null;
  defaultAgentId: string | null;
  isLoading: boolean;

  fetchAgents: () => void;
  switchAgent: (id: string) => void;
  getActiveAgent: () => Agent | undefined;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  activeAgentId: null,
  defaultAgentId: null,
  isLoading: false,

  fetchAgents: () => {
    set({ isLoading: true });
    const { sendRequest } = useChatStore.getState();
    sendRequest('agents.list', {}, (data) => {
      if (data.ok && data.result?.agents) {
        const agents: Agent[] = data.result.agents.map((a: any) => ({
          id: a.id,
          name: a.name,
          identity: a.identity,
        }));

        const defaultAgent = data.result.agents.find((a: any) => a.default);
        const defaultId = defaultAgent?.id ?? agents[0]?.id ?? null;

        set({ agents, defaultAgentId: defaultId, activeAgentId: defaultId, isLoading: false });

        if (defaultId) {
          const chat = useChatStore.getState();
          chat.setActiveSessionKey(`agent:${defaultId}:main`);
          chat.loadHistory(`agent:${defaultId}:main`);
          useSessionStore.getState().fetchSessions();
        }
      } else {
        set({ isLoading: false });
      }
    });
  },

  switchAgent: (id) => {
    set({ activeAgentId: id });
    const chat = useChatStore.getState();
    chat.setActiveSessionKey(`agent:${id}:main`);
    chat.clearMessages();
    chat.loadHistory(`agent:${id}:main`);
    useSessionStore.getState().fetchSessions();
  },

  getActiveAgent: () => {
    const { agents, activeAgentId } = get();
    return agents.find((a) => a.id === activeAgentId);
  },
}));
