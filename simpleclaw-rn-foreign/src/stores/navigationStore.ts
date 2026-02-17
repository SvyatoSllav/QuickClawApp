import { create } from 'zustand';

export type AppScreen = 'onboarding' | 'auth' | 'plan' | 'chat' | 'profile';

interface NavigationState {
  screen: AppScreen;
  previousScreen: AppScreen | null;
  setScreen: (screen: AppScreen) => void;
  goBack: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  screen: 'onboarding',
  previousScreen: null,

  setScreen: (screen) =>
    set({ previousScreen: get().screen, screen }),

  goBack: () => {
    const prev = get().previousScreen;
    if (prev) {
      set({ screen: prev, previousScreen: null });
    }
  },
}));
