import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static const String _authTokenKey = 'auth_token';
  static const String _pendingTelegramTokenKey = 'pending_telegram_token';

  final FlutterSecureStorage _storage;

  SecureStorageService()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
          iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
        );

  Future<String?> getAuthToken() {
    return _storage.read(key: _authTokenKey);
  }

  Future<void> setAuthToken(String token) {
    return _storage.write(key: _authTokenKey, value: token);
  }

  Future<void> clearAuthToken() {
    return _storage.delete(key: _authTokenKey);
  }

  Future<String?> getPendingTelegramToken() {
    return _storage.read(key: _pendingTelegramTokenKey);
  }

  Future<void> setPendingTelegramToken(String token) {
    return _storage.write(key: _pendingTelegramTokenKey, value: token);
  }

  Future<void> clearPendingTelegramToken() {
    return _storage.delete(key: _pendingTelegramTokenKey);
  }
}
