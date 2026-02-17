import { create } from 'zustand';
import { validateTelegramToken, removeTelegramBot, approvePairingCode } from '../api/telegramApi';
import { useAuthStore } from './authStore';

type TelegramStep = 'idle' | 'setup' | 'validating' | 'validated' | 'pairing' | 'approved' | 'error';

interface TelegramState {
  step: TelegramStep;
  botUsername: string | null;
  error: string | null;
  loading: boolean;

  openSetup: () => void;
  validateToken: (token: string) => Promise<boolean>;
  submitPairingCode: (code: string) => Promise<boolean>;
  removeBot: () => Promise<void>;
  reset: () => void;
}

export const useTelegramStore = create<TelegramState>((set) => ({
  step: 'idle',
  botUsername: null,
  error: null,
  loading: false,

  openSetup: () => set({ step: 'setup', error: null }),

  validateToken: async (token: string) => {
    set({ loading: true, error: null, step: 'validating' });
    try {
      const result = await validateTelegramToken(token);
      if (result.valid) {
        set({
          step: 'validated',
          botUsername: result.bot_username ?? null,
          loading: false,
        });
        await useAuthStore.getState().loadProfile();
        return true;
      }
      set({ step: 'error', error: 'Invalid token', loading: false });
      return false;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ step: 'error', error: msg, loading: false });
      return false;
    }
  },

  submitPairingCode: async (code: string) => {
    set({ loading: true, error: null, step: 'pairing' });
    try {
      const result = await approvePairingCode(code);
      if (result.approved) {
        set({ step: 'approved', loading: false });
        return true;
      }
      set({ step: 'error', error: result.error ?? 'Pairing failed', loading: false });
      return false;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ step: 'error', error: msg, loading: false });
      return false;
    }
  },

  removeBot: async () => {
    set({ loading: true });
    try {
      await removeTelegramBot();
      set({ step: 'idle', botUsername: null, loading: false });
      await useAuthStore.getState().loadProfile();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg, loading: false });
    }
  },

  reset: () => set({ step: 'idle', botUsername: null, error: null, loading: false }),
}));
