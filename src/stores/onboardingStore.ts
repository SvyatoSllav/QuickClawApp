import { create } from 'zustand';
import { getHasOnboarded, setHasOnboarded } from '../services/secureStorage';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  completeOnboarding: () => Promise<void>;
  checkOnboarding: () => Promise<boolean>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasCompletedOnboarding: false,
  currentPage: 0,

  setCurrentPage: (page) => set({ currentPage: page }),

  completeOnboarding: async () => {
    await setHasOnboarded();
    set({ hasCompletedOnboarding: true });
  },

  checkOnboarding: async () => {
    const hasOnboarded = await getHasOnboarded();
    set({ hasCompletedOnboarding: hasOnboarded });
    return hasOnboarded;
  },
}));
