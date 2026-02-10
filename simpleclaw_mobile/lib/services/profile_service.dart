import 'package:simpleclaw_mobile/core/network/api_client.dart';
import 'package:simpleclaw_mobile/models/usage.dart';
import 'package:simpleclaw_mobile/models/user.dart';

class ProfileService {
  final ApiClient _apiClient;

  ProfileService(this._apiClient);

  Future<UserData> getProfile() async {
    final response = await _apiClient.get('/profile/');
    return UserData.fromJson(response.data as Map<String, dynamic>);
  }

  Future<UsageData> getUsage() async {
    final response = await _apiClient.get('/profile/usage/');
    return UsageData.fromJson(response.data as Map<String, dynamic>);
  }
}
