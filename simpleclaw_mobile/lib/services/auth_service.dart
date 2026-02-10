import 'package:google_sign_in/google_sign_in.dart';

import 'package:simpleclaw_mobile/core/network/api_client.dart';
import 'package:simpleclaw_mobile/models/auth_response.dart';

class AuthService {
  final ApiClient _apiClient;

  AuthService(this._apiClient);

  Future<AuthResponse> signInWithGoogle() async {
    final googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
    final account = await googleSignIn.signIn();
    if (account == null) {
      throw Exception('Google sign-in was cancelled');
    }

    final authentication = await account.authentication;
    final idToken = authentication.idToken;
    if (idToken == null) {
      throw Exception('Failed to obtain Google ID token');
    }

    final response = await _apiClient.post(
      '/auth/google/',
      data: {'token': idToken},
    );

    return AuthResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await _apiClient.post('/auth/logout/');
    } catch (_) {
      // Token might already be invalid; ignore errors.
    }

    try {
      await GoogleSignIn().signOut();
    } catch (_) {
      // Google sign-out failure is non-critical.
    }
  }
}
