import { create } from 'zustand';
import { Platform } from 'react-native';
import { AppConfig } from '../config/appConfig';
import apiClient from '../api/client';

// TODO: RevenueCat temporarily disabled — native binary is stale and crashes
// with "Purchases-TrackedEvent is not a supported event type". Re-enable after
// rebuilding native app with: npx expo prebuild --clean && npx expo run:ios
function getPurchases(): any {
  return null;
}
function getLOG_LEVEL(): any {
  return null;
}

type PurchasesPackage = any;

interface SubscriptionState {
  isSubscribed: boolean;
  loading: boolean;
  error: string | null;
  packages: PurchasesPackage[];
  selectedPackage: PurchasesPackage | null;
  initRevenueCat: (userId: string) => Promise<void>;
  loadOfferings: () => Promise<void>;
  selectPackage: (pkg: PurchasesPackage) => void;
  purchaseSelected: () => Promise<boolean>;
  presentPaywall: () => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
  restorePurchases: () => Promise<boolean>;
  checkEntitlement: () => Promise<boolean>;
  webPurchase: () => Promise<boolean>;
  logoutRevenueCat: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  // TODO: RevenueCat disabled — bypass subscription gate for testing
  isSubscribed: true,
  loading: false,
  error: null,
  packages: [],
  selectedPackage: null,

  initRevenueCat: async (userId) => {
    if (Platform.OS === 'web') {
      if (__DEV__) console.log('[subscription] initRevenueCat skipped (web)');
      return;
    }
    if (__DEV__) console.log('[subscription] initRevenueCat for user:', userId);
    try {
      const apiKey =
        Platform.OS === 'ios'
          ? AppConfig.revenueCatApiKeyIos
          : AppConfig.revenueCatApiKeyAndroid;

      if (!apiKey) return;

      const Purchases = getPurchases();
      if (!Purchases) return; // RevenueCat disabled
      if (__DEV__) {
        Purchases.setLogLevel(getLOG_LEVEL()?.VERBOSE);
      }

      Purchases.configure({ apiKey, appUserID: userId });
    } catch (e) {
      if (__DEV__) console.warn('RevenueCat init failed:', e);
    }
  },

  loadOfferings: async () => {
    if (Platform.OS === 'web') {
      if (__DEV__) console.log('[subscription] loadOfferings skipped (web)');
      set({ loading: false, packages: [], selectedPackage: null });
      return;
    }
    const Purchases = getPurchases();
    if (!Purchases) { set({ loading: false }); return; }
    if (__DEV__) console.log('[subscription] loadOfferings starting...');
    set({ loading: true, error: null });
    try {
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      if (__DEV__) console.log('[subscription] loadOfferings: found', packages.length, 'packages');
      set({
        packages,
        selectedPackage: packages[0] ?? null,
        loading: false,
      });
    } catch (e) {
      if (__DEV__) console.error('[subscription] loadOfferings error:', e);
      set({ loading: false, error: String(e) });
    }
  },

  selectPackage: (pkg) => {
    set({ selectedPackage: pkg });
  },

  purchaseSelected: async () => {
    const pkg = get().selectedPackage;
    if (!pkg) {
      set({ error: 'No package selected' });
      return false;
    }

    set({ loading: true, error: null });
    try {
      const Purchases = getPurchases();
      if (!Purchases) { set({ loading: false }); return false; }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isActive =
        customerInfo.entitlements.active[AppConfig.revenueCatEntitlementId] !==
        undefined;

      set({ isSubscribed: isActive, loading: false });
      return isActive;
    } catch (e: any) {
      if (e.userCancelled) {
        set({ loading: false });
        return false;
      }
      set({ loading: false, error: String(e) });
      return false;
    }
  },

  presentPaywall: async () => {
    const Purchases = getPurchases();
    if (!Purchases) { return false; }
    set({ loading: true, error: null });
    try {
      const RevenueCatUI = (await import('react-native-purchases-ui')).default;
      await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: AppConfig.revenueCatEntitlementId,
      });

      const customerInfo = await Purchases.getCustomerInfo();
      const isActive =
        customerInfo.entitlements.active[AppConfig.revenueCatEntitlementId] !==
        undefined;

      set({ isSubscribed: isActive, loading: false });
      return isActive;
    } catch (e: any) {
      if (e.userCancelled) {
        set({ loading: false });
        return false;
      }
      set({ loading: false, error: String(e) });
      return false;
    }
  },

  presentCustomerCenter: async () => {
    try {
      const RevenueCatUI = (await import('react-native-purchases-ui')).default;
      await RevenueCatUI.presentCustomerCenter();
    } catch (e) {
      if (__DEV__) console.warn('Customer Center failed:', e);
    }
  },

  restorePurchases: async () => {
    if (Platform.OS === 'web') return false;
    const Purchases = getPurchases();
    if (!Purchases) return false;
    set({ loading: true, error: null });
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isActive =
        customerInfo.entitlements.active[AppConfig.revenueCatEntitlementId] !==
        undefined;

      set({ isSubscribed: isActive, loading: false });
      return isActive;
    } catch (e) {
      set({ loading: false, error: String(e) });
      return false;
    }
  },

  checkEntitlement: async () => {
    if (Platform.OS === 'web') {
      if (__DEV__) console.log('[subscription] checkEntitlement skipped (web)');
      return false;
    }
    const Purchases = getPurchases();
    if (!Purchases) return false;
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isActive =
        customerInfo.entitlements.active[AppConfig.revenueCatEntitlementId] !==
        undefined;
      if (__DEV__) console.log('[subscription] checkEntitlement:', isActive, 'entitlementId:', AppConfig.revenueCatEntitlementId);
      set({ isSubscribed: isActive });
      return isActive;
    } catch (e) {
      if (__DEV__) console.error('[subscription] checkEntitlement error:', e);
      return false;
    }
  },

  webPurchase: async () => {
    if (__DEV__) console.log('[subscription] webPurchase starting...');
    set({ loading: true, error: null });
    try {
      const { useAuthStore } = require('./authStore');
      const authState = useAuthStore.getState();
      const userId = authState.user?.id;
      const token = authState.authToken;
      if (__DEV__) console.log('[subscription] webPurchase userId:', userId, 'hasToken:', !!token);
      if (!userId) throw new Error('Not authenticated');

      const payload = {
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: String(userId),
          expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
      };
      const url = '/payments/webhook/revenuecat/';
      if (__DEV__) console.log('[subscription] webPurchase POST', url, JSON.stringify(payload));

      const response = await apiClient.post(url, payload);
      if (__DEV__) console.log('[subscription] webPurchase response status:', response.status, 'data:', JSON.stringify(response.data));

      if (__DEV__) console.log('[subscription] webPurchase reloading profile...');
      await useAuthStore.getState().loadProfile();
      if (__DEV__) console.log('[subscription] webPurchase profile reloaded. subscriptionStatus:', useAuthStore.getState().profile?.subscriptionStatus);
      if (__DEV__) console.log('[subscription] webPurchase SUCCESS');
      set({ isSubscribed: true, loading: false });
      return true;
    } catch (e: any) {
      if (__DEV__) console.error('[subscription] webPurchase ERROR:', e);
      if (__DEV__) console.error('[subscription] webPurchase ERROR details — message:', e?.message, 'response.status:', e?.response?.status, 'response.data:', JSON.stringify(e?.response?.data));
      set({ loading: false, error: String(e) });
      return false;
    }
  },

  logoutRevenueCat: async () => {
    const Purchases = getPurchases();
    if (Purchases && Platform.OS !== 'web') {
      try {
        await Purchases.logOut();
      } catch {
        // ignore
      }
    }
    set({ isSubscribed: false, packages: [], selectedPackage: null });
  },
}));
