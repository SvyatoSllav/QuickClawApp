import { create } from 'zustand';
import { Platform } from 'react-native';
import { UserData } from '../types/auth';
import { ProfileData } from '../types/profile';
import { SubscriptionData } from '../types/subscription';
import {
  signInWithGoogle,
  signInWithGoogleUserInfo,
  signInWithApple as signInWithAppleApi,
  logoutFromBackend,
} from '../api/authApi';
import { getProfile } from '../api/profileApi';
import { googleSignIn, googleSignOut } from '../services/googleAuth';
import { appleSignIn } from '../services/appleAuth';
import { getAuthToken, setAuthToken, clearAuthToken } from '../services/secureStorage';
import { useOnboardingStore } from './onboardingStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useNavigationStore } from './navigationStore';
import { useChatStore } from './chatStore';
import { useDeployStore } from './deployStore';

interface AuthState {
  isAuthenticated: boolean;
  authToken: string | null;
  user: UserData | null;
  profile: ProfileData | null;
  subscription: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  initComplete: boolean;
  init: () => Promise<void>;
  signInApple: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  afterAuthFlow: () => Promise<void>;
  loadProfile: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  authToken: null,
  user: null,
  profile: null,
  subscription: null,
  loading: false,
  error: null,
  initComplete: false,

  init: async () => {
    const token = await getAuthToken();
    if (!token) {
      set({ initComplete: true });
      return;
    }

    set({ authToken: token, isAuthenticated: true, loading: true });

    try {
      await get().loadProfile();

      // Initialize RevenueCat if we have a user
      const user = get().user;
      if (user) {
        const subStore = useSubscriptionStore.getState();
        await subStore.initRevenueCat(String(user.id));
        await subStore.checkEntitlement();
      }
    } catch {
      await get().logout();
    }

    set({ loading: false, initComplete: true });
  },

  signInApple: async () => {
    set({ loading: true, error: null });
    try {
      const result = await appleSignIn();
      const authResponse = await signInWithAppleApi(
        result.identityToken,
        result.fullName,
      );

      await setAuthToken(authResponse.token);
      set({
        authToken: authResponse.token,
        user: authResponse.user,
        isAuthenticated: true,
      });

      await get().afterAuthFlow();
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  signInGoogle: async () => {
    set({ loading: true, error: null });

    try {
      const result = await googleSignIn();
      const authResponse =
        result.type === 'token'
          ? await signInWithGoogle(result.idToken)
          : await signInWithGoogleUserInfo(result.userInfo);

      await setAuthToken(authResponse.token);
      set({
        authToken: authResponse.token,
        user: authResponse.user,
        isAuthenticated: true,
      });

      await get().afterAuthFlow();
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  afterAuthFlow: async () => {
    await get().loadProfile();

    // Mark onboarding complete
    await useOnboardingStore.getState().completeOnboarding();

    // Init RevenueCat
    const user = get().user;
    if (user) {
      const subStore = useSubscriptionStore.getState();
      await subStore.initRevenueCat(String(user.id));
      await subStore.checkEntitlement();
    }

    const isSubscribed = useSubscriptionStore.getState().isSubscribed;

    set({ loading: false });
    useNavigationStore.getState().setScreen(isSubscribed ? 'chat' : 'plan');
  },

  loadProfile: async () => {
    const userData = await getProfile();
    const profile = userData.profile;

    let subscription: SubscriptionData | null = null;
    if (profile) {
      const status = profile.subscriptionStatus;
      if (status === 'active' || status === 'cancelling') {
        subscription = {
          isActive: true,
          autoRenew: profile.autoRenew,
          status,
          currentPeriodStart: profile.subscriptionStartedAt,
          currentPeriodEnd: profile.subscriptionExpiresAt,
          cancelledAt: profile.cancelledAt,
          hasPaymentMethod: true,
          serverIp: null,
        };
      }
    }

    set({
      isAuthenticated: true,
      user: userData,
      profile,
      subscription,
    });
  },

  logout: async () => {
    await logoutFromBackend();
    await googleSignOut();
    await clearAuthToken();
    await useSubscriptionStore.getState().logoutRevenueCat();

    set({
      isAuthenticated: false,
      authToken: null,
      user: null,
      profile: null,
      subscription: null,
      loading: false,
      error: null,
      initComplete: true,
    });

    useNavigationStore.getState().setScreen('auth');
  },

  clearError: () => set({ error: null }),
}));
