import { create } from 'zustand';

export type AppScreen = 'landing' | 'success' | 'profile' | 'activeSubscription';

interface NavigationState {
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  screen: 'landing',
  setScreen: (screen) => set({ screen }),
}));
