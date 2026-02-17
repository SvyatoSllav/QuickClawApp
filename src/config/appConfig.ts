export const AppConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://install-openclow.ru/api',
  googleClientId: '1568931022-iil9topt7v2n8p6m97crp4tc410800mf.apps.googleusercontent.com',
  revenueCatApiKeyIos: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
  revenueCatApiKeyAndroid: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
  revenueCatEntitlementId: 'pro',
  deployPollIntervalMs: 5000,
  supportEmail: 'tarasov.slavas2@gmail.com',
  frontendUrl: 'https://install-openclow.ru',
} as const;
