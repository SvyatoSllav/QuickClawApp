import 'package:simpleclaw_mobile/core/network/api_client.dart';
import 'package:simpleclaw_mobile/models/subscription.dart';

class SubscriptionService {
  final ApiClient _apiClient;

  SubscriptionService(this._apiClient);

  Future<SubscriptionData> getStatus() async {
    final response = await _apiClient.get('/subscription/');
    return SubscriptionData.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> cancel({bool immediate = false}) async {
    await _apiClient.post(
      '/subscription/cancel/',
      data: {'immediate': immediate},
    );
  }
}
