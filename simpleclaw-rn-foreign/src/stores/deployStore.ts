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
      clearInterval(id);
      set({ _intervalId: null });
    }
  },

  checkStatus: async () => {
    try {
      const serverStatus = await getServerStatus();
      const isReady = serverStatus.assigned && serverStatus.openclawRunning;
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
    } catch {
      // Auth might not be ready yet; keep polling.
    }
  },
}));
