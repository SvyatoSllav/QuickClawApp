class TelegramValidation {
  const TelegramValidation({
    required this.valid,
    this.botUsername,
    this.botName,
  });

  final bool valid;
  final String? botUsername;
  final String? botName;

  factory TelegramValidation.fromJson(Map<String, dynamic> json) {
    return TelegramValidation(
      valid: json['valid'] as bool,
      botUsername: json['bot_username'] as String?,
      botName: json['bot_name'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'valid': valid,
      'bot_username': botUsername,
      'bot_name': botName,
    };
  }
}
