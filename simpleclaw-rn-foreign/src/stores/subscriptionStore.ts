import { create } from 'zustand';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import { AppConfig } from '../config/appConfig';

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
  logoutRevenueCat: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isSubscribed: false,
  loading: false,
  error: null,
  packages: [],
  selectedPackage: null,

  initRevenueCat: async (userId) => {
    try {
      const apiKey =
        Platform.OS === 'ios'
          ? AppConfig.revenueCatApiKeyIos
          : AppConfig.revenueCatApiKeyAndroid;

      if (!apiKey) return;

      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
      }

      Purchases.configure({ apiKey, appUserID: userId });
    } catch (e) {
      console.warn('RevenueCat init failed:', e);
    }
  },

  loadOfferings: async () => {
    set({ loading: true, error: null });
    try {
      const offerings = await Purchases.getOfferings();
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
      console.warn('Customer Center failed:', e);
    }
  },

  restorePurchases: async () => {
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
    try {
      const customerInfo = await Purchases.getCustomerInfo();
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
      await Purchases.logOut();
    } catch {
      // ignore
    }
    set({ isSubscribed: false, packages: [], selectedPackage: null });
  },
}));
