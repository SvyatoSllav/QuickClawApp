import 'package:simpleclaw_mobile/core/network/api_client.dart';
import 'package:simpleclaw_mobile/models/telegram_validation.dart';

class TelegramService {
  final ApiClient _apiClient;

  TelegramService(this._apiClient);

  Future<TelegramValidation> validate(String token) async {
    final response = await _apiClient.post(
      '/telegram/validate/',
      data: {'token': token},
    );
    return TelegramValidation.fromJson(response.data as Map<String, dynamic>);
  }
}
