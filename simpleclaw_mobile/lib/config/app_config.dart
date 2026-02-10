class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://install-openclow.ru/api',
  );

  static const String googleClientId =
      '1568931022-iil9topt7v2n8p6m97crp4tc410800mf.apps.googleusercontent.com';

  static const int deployPollIntervalMs = 5000;

  static const String supportEmail = 'tarasov.slavas2@gmail.com';

  static const String frontendUrl = 'https://install-openclow.ru';

  static const String demoVideoUrl = 'https://install-openclow.ru/demo.mp4';
}
