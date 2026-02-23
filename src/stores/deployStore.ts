import { create } from 'zustand';
import { getServerStatus } from '../api/serverApi';
import { AppConfig } from '../config/appConfig';

interface DeployState {
  assigned: boolean;
  openclawRunning: boolean;
  status: string;
  ipAddress: string | null;
  gatewayToken: string | null;
  isReady: boolean;
  _intervalId: ReturnType<typeof setInterval> | null;
  startPolling: () => void;
  stopPolling: () => void;
  checkStatus: () => Promise<void>;
}

export const useDeployStore = create<DeployState>((set, get) => ({
  assigned: false,
  openclawRunning: false,
  status: '',
  ipAddress: null,
  gatewayToken: null,
  isReady: false,
  _intervalId: null,

  startPolling: () => {
    console.log('[deploy] startPolling()');
    get().stopPolling();
    get().checkStatus();
    const id = setInterval(() => {
      get().checkStatus();
    }, AppConfig.deployPollIntervalMs);
    set({ _intervalId: id });
  },

  stopPolling: () => {
    const id = get()._intervalId;
    if (id) {
      console.log('[deploy] stopPolling()');
      clearInterval(id);
      set({ _intervalId: null });
    }
  },

  checkStatus: async () => {
    console.log('[deploy] checkStatus() calling /server/status/...');
    try {
      const serverStatus = await getServerStatus();
      const isReady = serverStatus.assigned && serverStatus.openclawRunning;
      console.log('[deploy] checkStatus() response:', JSON.stringify({
        assigned: serverStatus.assigned,
        openclawRunning: serverStatus.openclawRunning,
        status: serverStatus.status,
        ipAddress: serverStatus.ipAddress,
        gatewayToken: serverStatus.gatewayToken ? serverStatus.gatewayToken.substring(0, 8) + '...' : null,
        isReady,
      }));
      set({
        assigned: serverStatus.assigned,
        openclawRunning: serverStatus.openclawRunning,
        status: serverStatus.status ?? '',
        ipAddress: serverStatus.ipAddress ?? null,
        gatewayToken: serverStatus.gatewayToken ?? null,
        isReady,
      });

      if (isReady || serverStatus.status === 'error') {
        get().stopPolling();
      }
    } catch (e) {
      console.error('[deploy] checkStatus() ERROR:', e);
    }
  },
}));
