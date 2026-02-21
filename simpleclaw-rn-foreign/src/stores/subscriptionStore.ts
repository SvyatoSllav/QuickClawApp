import { create } from 'zustand';
import { Platform } from 'react-native';
import { AppConfig } from '../config/appConfig';
import apiClient from '../api/client';

// Lazy-load RevenueCat only on native (crashes Metro on web)
function getPurchases() {
  return require('react-native-purchases').default;
}
function getLOG_LEVEL() {
  return require('react-native-purchases').LOG_LEVEL;
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
  isSubscribed: false,
  loading: false,
  error: null,
  packages: [],
  selectedPackage: null,

  initRevenueCat: async (userId) => {
    if (Platform.OS === 'web') return;
    try {
      const apiKey =
        Platform.OS === 'ios'
          ? AppConfig.revenueCatApiKeyIos
          : AppConfig.revenueCatApiKeyAndroid;

      if (!apiKey) return;

      const Purchases = getPurchases();
      if (__DEV__) {
        Purchases.setLogLevel(getLOG_LEVEL().VERBOSE);
      }

      Purchases.configure({ apiKey, appUserID: userId });
    } catch (e) {
      console.warn('RevenueCat init failed:', e);
    }
  },

  loadOfferings: async () => {
    if (Platform.OS === 'web') {
      set({ loading: false, packages: [], selectedPackage: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const offerings = await getPurchases().getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      set({
        packages,
        selectedPackage: packages[0] ?? null,
        loading: false,
      });
    } catch (e) {
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
      const { customerInfo } = await getPurchases().purchasePackage(pkg);
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
    set({ loading: true, error: null });
    try {
      const RevenueCatUI = (await import('react-native-purchases-ui')).default;
      await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: AppConfig.revenueCatEntitlementId,
      });

      const customerInfo = await getPurchases().getCustomerInfo();
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
      console.warn('Customer Center failed:', e);
    }
  },

  restorePurchases: async () => {
    if (Platform.OS === 'web') return false;
    set({ loading: true, error: null });
    try {
      const customerInfo = await getPurchases().restorePurchases();
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
    if (Platform.OS === 'web') return false;
    try {
      const customerInfo = await getPurchases().getCustomerInfo();
      const isActive =
        customerInfo.entitlements.active[AppConfig.revenueCatEntitlementId] !==
        undefined;

      set({ isSubscribed: isActive });
      return isActive;
    } catch {
      return false;
    }
  },

  webPurchase: async () => {
    set({ loading: true, error: null });
    try {
      const { useAuthStore } = require('./authStore');
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('Not authenticated');

      await apiClient.post('/payments/webhook/revenuecat/', {
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: String(userId),
          expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
      });

      await useAuthStore.getState().loadProfile();
      set({ isSubscribed: true, loading: false });
      return true;
    } catch (e) {
      set({ loading: false, error: String(e) });
      return false;
    }
  },

  logoutRevenueCat: async () => {
    if (Platform.OS !== 'web') {
      try {
        await getPurchases().logOut();
      } catch {
        // ignore
      }
    }
    set({ isSubscribed: false, packages: [], selectedPackage: null });
  },
}));
