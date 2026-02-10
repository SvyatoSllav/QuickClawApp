class ProfileData {
  const ProfileData({
    required this.selectedModel,
    required this.subscriptionStatus,
    this.subscriptionStartedAt,
    this.subscriptionExpiresAt,
    required this.autoRenew,
    required this.cancellationScheduled,
    this.cancelledAt,
    this.telegramBotUsername,
    required this.telegramBotValidated,
    this.avatarUrl,
    required this.tokensUsedUsd,
    required this.tokenLimitUsd,
  });

  final String selectedModel;
  final String subscriptionStatus;
  final DateTime? subscriptionStartedAt;
  final DateTime? subscriptionExpiresAt;
  final bool autoRenew;
  final bool cancellationScheduled;
  final DateTime? cancelledAt;
  final String? telegramBotUsername;
  final bool telegramBotValidated;
  final String? avatarUrl;
  final double tokensUsedUsd;
  final double tokenLimitUsd;

  factory ProfileData.fromJson(Map<String, dynamic> json) {
    return ProfileData(
      selectedModel: json['selected_model'] as String,
      subscriptionStatus: json['subscription_status'] as String,
      subscriptionStartedAt: json['subscription_started_at'] != null
          ? DateTime.parse(json['subscription_started_at'] as String)
          : null,
      subscriptionExpiresAt: json['subscription_expires_at'] != null
          ? DateTime.parse(json['subscription_expires_at'] as String)
          : null,
      autoRenew: json['auto_renew'] as bool,
      cancellationScheduled: json['cancellation_scheduled'] as bool,
      cancelledAt: json['cancelled_at'] != null
          ? DateTime.parse(json['cancelled_at'] as String)
          : null,
      telegramBotUsername: json['telegram_bot_username'] as String?,
      telegramBotValidated: json['telegram_bot_validated'] as bool,
      avatarUrl: json['avatar_url'] as String?,
      tokensUsedUsd: _parseDouble(json['tokens_used_usd']),
      tokenLimitUsd: (json['token_limit_usd'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'selected_model': selectedModel,
      'subscription_status': subscriptionStatus,
      'subscription_started_at': subscriptionStartedAt?.toIso8601String(),
      'subscription_expires_at': subscriptionExpiresAt?.toIso8601String(),
      'auto_renew': autoRenew,
      'cancellation_scheduled': cancellationScheduled,
      'cancelled_at': cancelledAt?.toIso8601String(),
      'telegram_bot_username': telegramBotUsername,
      'telegram_bot_validated': telegramBotValidated,
      'avatar_url': avatarUrl,
      'tokens_used_usd': tokensUsedUsd.toString(),
      'token_limit_usd': tokenLimitUsd,
    };
  }

  static double _parseDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }
}
