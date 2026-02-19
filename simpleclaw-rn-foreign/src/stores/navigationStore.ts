import { create } from 'zustand';

export type AppScreen = 'onboarding' | 'auth' | 'plan' | 'chat' | 'profile' | 'useCases' | 'marketplace' | 'systemPrompts' | 'agents';

interface NavigationState {
  screen: AppScreen;
  previousScreen: AppScreen | null;
  isSidebarOpen: boolean;
  isSessionDrawerOpen: boolean;
  setScreen: (screen: AppScreen) => void;
  goBack: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  openSessionDrawer: () => void;
  closeSessionDrawer: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  screen: 'onboarding',
  previousScreen: null,
  isSidebarOpen: false,
  isSessionDrawerOpen: false,

  setScreen: (screen) =>
    set({ previousScreen: get().screen, screen, isSidebarOpen: false }),

  goBack: () => {
    const prev = get().previousScreen;
    if (prev) {
      set({ screen: prev, previousScreen: null });
    }
  },

  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  openSessionDrawer: () => set({ isSessionDrawerOpen: true }),
  closeSessionDrawer: () => set({ isSessionDrawerOpen: false }),
}));
