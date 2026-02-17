import { create } from 'zustand';
import { Platform } from 'react-native';
import { AppConfig } from '../config/appConfig';

interface SubscriptionState {
  isSubscribed: boolean;
  loading: boolean;
  error: string | null;
  initRevenueCat: (userId: string) => Promise<void>;
  loadOfferings: () => Promise<void>;
  purchasePackage: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkEntitlement: () => Promise<boolean>;
  logoutRevenueCat: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  isSubscribed: false,
  loading: false,
  error: null,

  initRevenueCat: async (userId) => {
    try {
      const Purchases = await import('react-native-purchases');
      const apiKey =
        Platform.OS === 'ios'
          ? AppConfig.revenueCatApiKeyIos
          : AppConfig.revenueCatApiKeyAndroid;

      if (!apiKey) return;

      Purchases.default.configure({ apiKey, appUserID: userId });
    } catch (e) {
      console.warn('RevenueCat init failed:', e);
    }
  },

  loadOfferings: async () => {
    set({ loading: true, error: null });
    try {
      const Purchases = await import('react-native-purchases');
      await Purchases.default.getOfferings();
      set({ loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  purchasePackage: async () => {
    set({ loading: true, error: null });
    try {
      const Purchases = await import('react-native-purchases');
      const offerings = await Purchases.default.getOfferings();
      const pkg = offerings.current?.availablePackages[0];
      if (!pkg) {
        set({ loading: false, error: 'No packages available' });
        return false;
      }

      const { customerInfo } = await Purchases.default.purchasePackage(pkg);
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

  restorePurchases: async () => {
    set({ loading: true, error: null });
    try {
      const Purchases = await import('react-native-purchases');
      const customerInfo = await Purchases.default.restorePurchases();
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
    try {
      const Purchases = await import('react-native-purchases');
      const customerInfo = await Purchases.default.getCustomerInfo();
      const isActive =
        customerInfo.entitlements.active[AppConfig.revenueCatEntitlementId] !==
        undefined;

      set({ isSubscribed: isActive });
      return isActive;
    } catch {
      return false;
    }
  },

  logoutRevenueCat: async () => {
    try {
      const Purchases = await import('react-native-purchases');
      await Purchases.default.logOut();
    } catch {
      // ignore
    }
    set({ isSubscribed: false });
  },
}));
