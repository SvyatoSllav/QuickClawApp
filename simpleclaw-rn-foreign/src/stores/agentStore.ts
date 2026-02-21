import { create } from 'zustand';
import { Agent } from '../types/agent';
import { useChatStore } from './chatStore';
import { useSessionStore } from './sessionStore';
import { getItem, setItem } from '../services/secureStorage';

const ACTIVE_AGENT_KEY = 'active_agent_id';

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
    console.log('[agents] fetchAgents starting...');
    set({ isLoading: true });
    const { sendRequest } = useChatStore.getState();

    sendRequest('agents.list', {}, (data) => {
      console.log('[agents] agents.list response:', data.ok ? (data.result?.agents?.length + ' agents, defaultId: ' + data.result?.defaultId) : 'FAILED', data.error || '');
      if (data.ok && data.result?.agents) {
        const agentsList: Agent[] = data.result.agents.map((a: any) => ({
          id: a.id,
          name: a.name,
          identity: a.identity,
        }));

        const serverDefaultId = data.result.defaultId ?? agentsList[0]?.id ?? null;

        sendRequest('config.get', {}, (cfgData) => {
          console.log('[agents] config.get response:', cfgData.ok ? 'ok' : 'FAILED', cfgData.error || '');
          if (cfgData.ok && cfgData.result?.config?.agents?.list) {
            const configAgents = cfgData.result.config.agents.list as any[];
            for (const agent of agentsList) {
              const cfgAgent = configAgents.find((c: any) => c.id === agent.id);
              if (cfgAgent) {
                agent.skills = cfgAgent.skills;
                agent.description = cfgAgent.description;
              }
            }
          }

          getItem(ACTIVE_AGENT_KEY).then((savedId) => {
            const validSaved = savedId && agentsList.some((a) => a.id === savedId) ? savedId : null;
            const activeId = validSaved ?? serverDefaultId;
            console.log('[agents] Active agent:', activeId, '(saved:', savedId, 'default:', serverDefaultId, ')');

            set({ agents: agentsList, defaultAgentId: serverDefaultId, activeAgentId: activeId, isLoading: false });

            if (activeId) {
              const chat = useChatStore.getState();
              const sessionKey = `agent:${activeId}:main`;
              console.log('[agents] Setting session key:', sessionKey, '+ loading history + fetching sessions');
              chat.setActiveSessionKey(sessionKey);
              chat.loadHistory(sessionKey);
              useSessionStore.getState().fetchSessions();
            }
          });
        });
      } else {
        console.error('[agents] fetchAgents failed:', data.error);
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

    // Persist locally (config.set kills the WebSocket connection)
    setItem(ACTIVE_AGENT_KEY, id);
  },

  getActiveAgent: () => {
    const { agents, activeAgentId } = get();
    return agents.find((a) => a.id === activeAgentId);
  },
}));
