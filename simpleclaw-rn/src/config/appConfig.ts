export const AppConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://install-openclow.ru/api',
  googleClientId: '1568931022-iil9topt7v2n8p6m97crp4tc410800mf.apps.googleusercontent.com',
  deployPollIntervalMs: 5000,
  supportEmail: 'tarasov.slavas2@gmail.com',
  frontendUrl: 'https://install-openclow.ru',
  demoVideoUrl: 'https://install-openclow.ru/demo.mp4',
  yookassaShopId: process.env.EXPO_PUBLIC_YOOKASSA_SHOP_ID || '',
  yookassaClientKey: process.env.EXPO_PUBLIC_YOOKASSA_CLIENT_KEY || '',
  subscriptionPriceRub: '2999',
} as const;
