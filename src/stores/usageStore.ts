import { create } from 'zustand';
import { getUsage } from '../api/profileApi';

interface UsageState {
  used: number;
  limit: number;
  remaining: number;
  loading: boolean;
  error: string | null;
  loadUsage: () => Promise<void>;
}

export const useUsageStore = create<UsageState>((set) => ({
  used: 0,
  limit: 15,
  remaining: 15,
  loading: false,
  error: null,

  loadUsage: async () => {
    set({ loading: true, error: null });
    try {
      const usage = await getUsage();
      set({
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        loading: false,
      });
    } catch (e) {
      set({
        loading: false,
        error: `Failed to load usage: ${e}`,
      });
    }
  },
}));
