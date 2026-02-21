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
    console.log('[auth] init() starting');
    const token = await getAuthToken();
    if (!token) {
      console.log('[auth] No saved token, skipping init');
      set({ initComplete: true });
      return;
    }

    console.log('[auth] Token found, loading profile...');
    set({ authToken: token, isAuthenticated: true, loading: true });

    try {
      await get().loadProfile();
      console.log('[auth] Profile loaded. subscriptionStatus:', get().profile?.subscriptionStatus, 'model:', get().profile?.selectedModel);

      const user = get().user;
      if (user) {
        const subStore = useSubscriptionStore.getState();
        await subStore.initRevenueCat(String(user.id));
        await subStore.checkEntitlement();
        console.log('[auth] RevenueCat check done. isSubscribed:', subStore.isSubscribed);
      }

      const backendStatus = get().profile?.subscriptionStatus;
      if (!useSubscriptionStore.getState().isSubscribed &&
          (backendStatus === 'active' || backendStatus === 'cancelling')) {
        console.log('[auth] Backend subscription fallback: marking subscribed (status:', backendStatus, ')');
        useSubscriptionStore.setState({ isSubscribed: true });
      }

      if (useSubscriptionStore.getState().isSubscribed) {
        console.log('[auth] User subscribed, checking deploy status...');
        await useDeployStore.getState().checkStatus();
        const ds = useDeployStore.getState();
        console.log('[auth] Deploy status: isReady:', ds.isReady, 'ip:', ds.ipAddress, 'token:', ds.gatewayToken ? ds.gatewayToken.substring(0, 8) + '...' : 'null');
      } else {
        console.log('[auth] User NOT subscribed, skipping deploy check');
      }
    } catch (e) {
      console.error('[auth] init() error, logging out:', e);
      await get().logout();
    }

    set({ loading: false, initComplete: true });
    console.log('[auth] init() complete');
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
    console.log('[auth] afterAuthFlow() starting');
    await get().loadProfile();
    console.log('[auth] Profile loaded. subscriptionStatus:', get().profile?.subscriptionStatus);

    await useOnboardingStore.getState().completeOnboarding();

    const user = get().user;
    if (user) {
      const subStore = useSubscriptionStore.getState();
      await subStore.initRevenueCat(String(user.id));
      await subStore.checkEntitlement();
      console.log('[auth] RevenueCat check done. isSubscribed:', subStore.isSubscribed);
    }

    const rcSubscribed = useSubscriptionStore.getState().isSubscribed;
    const backendStatus = get().profile?.subscriptionStatus;
    const isSubscribed = rcSubscribed || backendStatus === 'active' || backendStatus === 'cancelling';
    console.log('[auth] Subscription check: rc:', rcSubscribed, 'backend:', backendStatus, 'final:', isSubscribed);

    if (isSubscribed) {
      useSubscriptionStore.setState({ isSubscribed: true });
      console.log('[auth] Fetching deploy status...');
      await useDeployStore.getState().checkStatus();
      const ds = useDeployStore.getState();
      console.log('[auth] Deploy status: isReady:', ds.isReady, 'ip:', ds.ipAddress, 'token:', ds.gatewayToken ? ds.gatewayToken.substring(0, 8) + '...' : 'null');
    }

    const targetScreen = isSubscribed ? 'chat' : 'plan';
    console.log('[auth] afterAuthFlow() done. Navigating to:', targetScreen);
    set({ loading: false });
    useNavigationStore.getState().setScreen(targetScreen);
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

    // Sync model from profile so ChatHeader shows correct model immediately
    if (profile?.selectedModel) {
      useChatStore.getState().syncModelFromServer(profile.selectedModel);
    }
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
