import { create } from 'zustand';
import { Platform } from 'react-native';
import { UserData } from '../types/auth';
import { ProfileData } from '../types/profile';
import { SubscriptionData } from '../types/subscription';
import { PaymentResponse } from '../types/payment';
import { signInWithGoogle, signInWithGoogleUserInfo, signInWithApple as signInWithAppleApi, logoutFromBackend } from '../api/authApi';
import { getProfile } from '../api/profileApi';
import { createPayment, createPaymentWithToken } from '../api/paymentApi';
import { googleSignIn, googleSignOut } from '../services/googleAuth';
import { appleSignIn } from '../services/appleAuth';
import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getPendingTelegramToken,
} from '../services/secureStorage';
import { useSelectionStore } from './selectionStore';
import { useNavigationStore } from './navigationStore';
import { AppConfig } from '../config/appConfig';

interface AuthState {
  isAuthenticated: boolean;
  authToken: string | null;
  user: UserData | null;
  profile: ProfileData | null;
  subscription: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  signIn: () => Promise<void>;
  signInApple: () => Promise<void>;
  afterAuthFlow: () => Promise<void>;
  loadProfile: () => Promise<void>;
  createPayment: () => Promise<PaymentResponse | null>;
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

  init: async () => {
    const token = await getAuthToken();
    if (!token) return;

    set({ authToken: token, isAuthenticated: true, loading: true });

    try {
      await get().loadProfile();
      const { subscription } = get();
      if (subscription && subscription.isActive) {
        useNavigationStore.getState().setScreen('activeSubscription');
      }
    } catch {
      await get().logout();
    }
  },

  signIn: async () => {
    set({ loading: true, error: null });

    try {
      const result = await googleSignIn();
      const authResponse = result.type === 'token'
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
      set({
        loading: false,
        error: String(e),
      });
    }
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
      set({
        loading: false,
        error: String(e),
      });
    }
  },

  afterAuthFlow: async () => {
    await get().loadProfile();

    const { subscription } = get();
    if (subscription && subscription.isActive) {
      set({ loading: false });
      useNavigationStore.getState().setScreen('activeSubscription');
      return;
    }

    // On iOS, don't initiate payment (reader app approach — subscribe via web)
    if (Platform.OS === 'ios') {
      set({ loading: false });
      return;
    }

    if (Platform.OS === 'android') {
      // Native YooKassa SDK flow
      try {
        const { startYooKassaCheckout } = await import('../services/yookassaPayment');
        const pendingTelegramToken = await getPendingTelegramToken();
        const selectedModel = useSelectionStore.getState().selectedModel;

        const paymentToken = await startYooKassaCheckout({
          shopId: AppConfig.yookassaShopId,
          clientKey: AppConfig.yookassaClientKey,
          amount: AppConfig.subscriptionPriceRub,
          title: 'SimpleClaw',
          description: 'Подписка SimpleClaw',
        });

        await createPaymentWithToken({
          paymentToken,
          telegramToken: pendingTelegramToken,
          selectedModel,
        });

        set({ loading: false });
        useNavigationStore.getState().setScreen('success');
      } catch (e) {
        set({ loading: false, error: String(e) });
      }
      return;
    }

    // Web: browser redirect flow
    const payment = await get().createPayment();
    if (payment?.confirmationUrl) {
      const Linking = await import('expo-linking');
      await Linking.openURL(payment.confirmationUrl);
      useNavigationStore.getState().setScreen('success');
    }
  },

  loadProfile: async () => {
    const userData = await getProfile();
    const profile = userData.profile;
    const selectedModel = profile?.selectedModel ?? 'gemini-3-flash';

    useSelectionStore.getState().setModel(selectedModel);

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
      loading: false,
    });
  },

  createPayment: async () => {
    set({ loading: true, error: null });

    try {
      const pendingTelegramToken = await getPendingTelegramToken();
      const selectedModel = useSelectionStore.getState().selectedModel;

      const paymentResponse = await createPayment({
        telegramToken: pendingTelegramToken,
        selectedModel,
      });

      set({ loading: false });
      return paymentResponse;
    } catch (e) {
      set({ loading: false, error: String(e) });
      return null;
    }
  },

  logout: async () => {
    await logoutFromBackend();
    await googleSignOut();
    await clearAuthToken();

    set({
      isAuthenticated: false,
      authToken: null,
      user: null,
      profile: null,
      subscription: null,
      loading: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
