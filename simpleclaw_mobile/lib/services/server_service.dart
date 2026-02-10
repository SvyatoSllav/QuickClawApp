import 'package:simpleclaw_mobile/core/network/api_client.dart';
import 'package:simpleclaw_mobile/models/server_pool.dart';
import 'package:simpleclaw_mobile/models/server_status.dart';

class ServerService {
  final ApiClient _apiClient;

  ServerService(this._apiClient);

  Future<ServerStatus> getStatus() async {
    final response = await _apiClient.get('/server/status/');
    return ServerStatus.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ServerPool> getPool() async {
    final response = await _apiClient.get('/server/pool/');
    return ServerPool.fromJson(response.data as Map<String, dynamic>);
  }
}
