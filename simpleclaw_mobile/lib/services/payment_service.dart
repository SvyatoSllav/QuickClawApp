import 'package:simpleclaw_mobile/core/network/api_client.dart';
import 'package:simpleclaw_mobile/models/payment.dart';

class PaymentService {
  final ApiClient _apiClient;

  PaymentService(this._apiClient);

  Future<PaymentResponse> createPayment({
    String? telegramToken,
    required String selectedModel,
  }) async {
    final response = await _apiClient.post(
      '/payments/create/',
      data: {
        'telegram_token': telegramToken,
        'selected_model': selectedModel,
      },
    );
    return PaymentResponse.fromJson(response.data as Map<String, dynamic>);
  }
}
