export const AppConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://claw-paw.com/api',
  googleClientId: '1568931022-iil9topt7v2n8p6m97crp4tc410800mf.apps.googleusercontent.com',
  googleClientIdIos: '1568931022-4fn2jd2jttsd45r3ogii6j0n2dfmcgc4.apps.googleusercontent.com',
  revenueCatApiKeyIos: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || 'test_dGKQHBuaWgCtJpofsRAXQcnPiPR',
  revenueCatApiKeyAndroid: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || 'test_dGKQHBuaWgCtJpofsRAXQcnPiPR',
  revenueCatEntitlementId: 'EasyClaw Pro',
  deployPollIntervalMs: 5000,
} as const;
