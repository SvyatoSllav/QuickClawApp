import { create } from 'zustand';
import { Agent } from '../types/agent';
import { useChatStore } from './chatStore';
import { useSessionStore } from './sessionStore';
import { getItem, setItem } from '../services/secureStorage';
import { remoteLog } from '../services/remoteLog';

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
    if (__DEV__) console.log('[agents] fetchAgents starting...');
    set({ isLoading: true });
    const { sendRequest } = useChatStore.getState();

    // Fire all three requests in parallel
    const agentsP = new Promise<any>((resolve) => {
      sendRequest('agents.list', {}, resolve);
    });
    const configP = new Promise<any>((resolve) => {
      sendRequest('config.get', {}, resolve);
    });
    const savedIdP = getItem(ACTIVE_AGENT_KEY);

    agentsP.then((data) => {
      if (__DEV__) console.log('[agents] agents.list response:', data.ok ? (data.result?.agents?.length + ' agents, defaultId: ' + data.result?.defaultId) : 'FAILED', data.error || '');
      remoteLog('info', 'agents', 'agents.list result', { ok: data.ok, count: data.result?.agents?.length ?? 0, defaultId: data.result?.defaultId });
      if (!data.ok || !data.result?.agents) {
        if (__DEV__) console.error('[agents] fetchAgents failed:', data.error);
        set({ isLoading: false });
        return;
      }

      const agentsList: Agent[] = data.result.agents.map((a: any) => ({
        id: a.id,
        name: a.name,
        identity: a.identity,
      }));
      const serverDefaultId = data.result.defaultId ?? agentsList[0]?.id ?? null;

      // Show agents immediately, enrich with config later
      savedIdP.then((savedId) => {
        const validSaved = savedId && agentsList.some((a) => a.id === savedId) ? savedId : null;
        const activeId = validSaved ?? serverDefaultId;
        if (__DEV__) console.log('[agents] Active agent:', activeId, '(saved:', savedId, 'default:', serverDefaultId, ')');
        remoteLog('info', 'agents', 'active agent set', { activeId, savedId, serverDefaultId });

        set({ agents: agentsList, defaultAgentId: serverDefaultId, activeAgentId: activeId, isLoading: false });

        if (activeId) {
          const chat = useChatStore.getState();
          const sessionKey = `agent:${activeId}:main`;
          if (__DEV__) console.log('[agents] Setting session key:', sessionKey);
          chat.setActiveSessionKey(sessionKey);
          chat.loadHistory(sessionKey);
          useSessionStore.getState().fetchSessions();
        }
      });

      // Enrich agents with skills/descriptions from config (non-blocking)
      configP.then((cfgData) => {
        if (__DEV__) console.log('[agents] config.get response:', cfgData.ok ? 'ok' : 'FAILED', cfgData.error || '');
        if (cfgData.ok && cfgData.result?.config?.agents?.list) {
          const configAgents = cfgData.result.config.agents.list as any[];
          if (__DEV__) console.log('[agents] config agents count:', configAgents.length);
          const enriched = agentsList.map((agent) => {
            const cfgAgent = configAgents.find((c: any) => c.id === agent.id);
            if (cfgAgent) {
              if (__DEV__) console.log('[agents] Enriching agent', agent.id, '— skills:', JSON.stringify(cfgAgent.skills), 'description:', cfgAgent.description?.substring(0, 60));
              return { ...agent, skills: cfgAgent.skills, description: cfgAgent.description };
            }
            if (__DEV__) console.log('[agents] No config entry for agent', agent.id);
            return agent;
          });
          set({ agents: enriched });
        } else {
          if (__DEV__) console.log('[agents] config.get — no agents.list in result, raw keys:', cfgData.ok ? Object.keys(cfgData.result?.config || {}) : 'N/A');
        }
      });
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
