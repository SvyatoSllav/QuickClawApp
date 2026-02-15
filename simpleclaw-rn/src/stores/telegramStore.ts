import { create } from 'zustand';
import {
  setPendingTelegramToken,
  getPendingTelegramToken,
  clearPendingTelegramToken,
} from '../services/secureStorage';
import { validateTelegramToken } from '../api/telegramApi';

interface TelegramState {
  pendingToken: string;
  isModalVisible: boolean;
  isValidating: boolean;
  validationError: string | null;
  showModal: () => void;
  hideModal: () => void;
  setToken: (token: string) => void;
  savePendingToken: () => Promise<void>;
  validatePendingTokenFromStorage: () => Promise<void>;
  reset: () => void;
}

export const useTelegramStore = create<TelegramState>((set, get) => ({
  pendingToken: '',
  isModalVisible: false,
  isValidating: false,
  validationError: null,

  showModal: () => set({ isModalVisible: true }),
  hideModal: () => set({ isModalVisible: false }),

  setToken: (token) => set({ pendingToken: token, validationError: null }),

  savePendingToken: async () => {
    const { pendingToken } = get();
    if (!pendingToken) return;
    await setPendingTelegramToken(pendingToken);
  },

  validatePendingTokenFromStorage: async () => {
    const token = await getPendingTelegramToken();
    if (!token) return;

    set({ isValidating: true, validationError: null });

    try {
      await validateTelegramToken(token);
      await clearPendingTelegramToken();
      set({ isValidating: false, pendingToken: '' });
    } catch (e) {
      set({
        isValidating: false,
        validationError: `Failed to validate telegram token: ${e}`,
      });
    }
  },

  reset: () =>
    set({
      pendingToken: '',
      isModalVisible: false,
      isValidating: false,
      validationError: null,
    }),
}));
