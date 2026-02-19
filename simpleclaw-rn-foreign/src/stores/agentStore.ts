import { create } from 'zustand';
import { Agent } from '../types/agent';
import { ModelId, AVAILABLE_MODELS } from '../types/chat';
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
        const mainAgent = agents.find((a) => a.id === 'main');
        const defaultId = defaultAgent?.id ?? mainAgent?.id ?? agents[0]?.id ?? null;

        set({ agents, defaultAgentId: defaultId, activeAgentId: defaultId, isLoading: false });

        if (defaultId) {
          const chat = useChatStore.getState();
          const sessionKey = `agent:${defaultId}:main`;
          chat.setActiveSessionKey(sessionKey);
          chat.loadHistory(sessionKey);
          useSessionStore.getState().fetchSessions();

          // Sync model from server
          chat.sendRequest('session.config.get', { sessionKey }, (cfgData) => {
            const model = cfgData.result?.model ?? cfgData.result?.config?.model;
            if (model && AVAILABLE_MODELS.some((m) => m.id === model)) {
              useChatStore.setState({ selectedModel: model as ModelId });
            }
          });
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
