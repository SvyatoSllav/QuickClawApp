import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:simpleclaw_mobile/core/network/api_client.dart';
import 'package:simpleclaw_mobile/core/storage/secure_storage.dart';
import 'package:simpleclaw_mobile/models/payment.dart';
import 'package:simpleclaw_mobile/models/profile.dart';
import 'package:simpleclaw_mobile/models/subscription.dart';
import 'package:simpleclaw_mobile/models/user.dart';
import 'package:simpleclaw_mobile/providers/model_selection_provider.dart';
import 'package:simpleclaw_mobile/services/auth_service.dart';
import 'package:simpleclaw_mobile/services/payment_service.dart';
import 'package:simpleclaw_mobile/services/profile_service.dart';
import 'package:simpleclaw_mobile/services/server_service.dart';
import 'package:simpleclaw_mobile/services/subscription_service.dart';
import 'package:simpleclaw_mobile/services/telegram_service.dart';

// ---------------------------------------------------------------------------
// Service providers
// ---------------------------------------------------------------------------

final secureStorageProvider = Provider<SecureStorageService>(
  (ref) => SecureStorageService(),
);

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(ref.read(secureStorageProvider)),
);

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.read(apiClientProvider)),
);

final profileServiceProvider = Provider<ProfileService>(
  (ref) => ProfileService(ref.read(apiClientProvider)),
);

final serverServiceProvider = Provider<ServerService>(
  (ref) => ServerService(ref.read(apiClientProvider)),
);

final telegramServiceProvider = Provider<TelegramService>(
  (ref) => TelegramService(ref.read(apiClientProvider)),
);

final paymentServiceProvider = Provider<PaymentService>(
  (ref) => PaymentService(ref.read(apiClientProvider)),
);

final subscriptionServiceProvider = Provider<SubscriptionService>(
  (ref) => SubscriptionService(ref.read(apiClientProvider)),
);

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

class AuthState {
  final bool isAuthenticated;
  final String? authToken;
  final UserData? user;
  final ProfileData? profile;
  final SubscriptionData? subscription;
  final bool loading;
  final String? error;

  const AuthState({
    this.isAuthenticated = false,
    this.authToken,
    this.user,
    this.profile,
    this.subscription,
    this.loading = false,
    this.error,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    String? Function()? authToken,
    UserData? Function()? user,
    ProfileData? Function()? profile,
    SubscriptionData? Function()? subscription,
    bool? loading,
    String? Function()? error,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      authToken: authToken != null ? authToken() : this.authToken,
      user: user != null ? user() : this.user,
      profile: profile != null ? profile() : this.profile,
      subscription: subscription != null ? subscription() : this.subscription,
      loading: loading ?? this.loading,
      error: error != null ? error() : this.error,
    );
  }
}

// ---------------------------------------------------------------------------
// Auth notifier
// ---------------------------------------------------------------------------

class AuthNotifier extends StateNotifier<AuthState> {
  final Ref _ref;

  AuthNotifier(this._ref) : super(const AuthState());

  /// Check for a stored token and restore the session if found.
  Future<void> init() async {
    final storage = _ref.read(secureStorageProvider);
    final token = await storage.getAuthToken();

    if (token == null || token.isEmpty) return;

    state = state.copyWith(
      authToken: () => token,
      isAuthenticated: true,
      loading: true,
    );

    try {
      await loadProfile();
    } catch (_) {
      await logout();
    }
  }

  /// Perform Google sign-in and run the post-authentication flow.
  Future<void> signIn() async {
    state = state.copyWith(loading: true, error: () => null);

    try {
      final authService = _ref.read(authServiceProvider);
      final authResponse = await authService.signInWithGoogle();

      final storage = _ref.read(secureStorageProvider);
      await storage.setAuthToken(authResponse.token);

      if (!mounted) return;

      state = state.copyWith(
        authToken: () => authResponse.token,
        user: () => authResponse.user,
        isAuthenticated: true,
      );

      await afterAuthFlow();
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        error: () => e.toString(),
      );
    }
  }

  /// Post-authentication: load the profile, then either stay on the profile
  /// screen (if subscription is active) or create a payment.
  Future<void> afterAuthFlow() async {
    await loadProfile();

    if (!mounted) return;

    if (state.subscription != null && state.subscription!.isActive) {
      state = state.copyWith(loading: false);
      return;
    }

    await _createPayment();
  }

  /// Fetch the user profile and derive the subscription state.
  ///
  /// The backend may provide subscription data in two forms:
  ///   1. A top-level `subscription` field on the profile response.
  ///   2. Subscription fields embedded inside `profile` (subscription_status,
  ///      auto_renew, etc.).
  ///
  /// This mirrors the Vue.js frontend logic (App.vue lines 746-778).
  Future<void> loadProfile() async {
    final profileService = _ref.read(profileServiceProvider);
    final userData = await profileService.getProfile();

    if (!mounted) return;

    final profile = userData.profile;
    final selectedModel = profile?.selectedModel ?? 'claude-opus-4.5';

    _ref.read(modelSelectionProvider.notifier).setModel(selectedModel);

    // Derive SubscriptionData from the embedded profile fields.
    SubscriptionData? subscription;
    if (profile != null) {
      final status = profile.subscriptionStatus;
      if (status == 'active' || status == 'cancelling') {
        subscription = SubscriptionData(
          isActive: true,
          autoRenew: profile.autoRenew,
          status: status,
          currentPeriodStart: profile.subscriptionStartedAt,
          currentPeriodEnd: profile.subscriptionExpiresAt,
          cancelledAt: profile.cancelledAt,
          hasPaymentMethod: true,
          serverIp: null,
        );
      }
    }

    state = state.copyWith(
      isAuthenticated: true,
      user: () => userData,
      profile: () => profile,
      subscription: () => subscription,
      loading: false,
    );
  }

  /// Create a payment and return the [PaymentResponse] so the UI layer
  /// can open the confirmation URL (e.g. via url_launcher).
  Future<PaymentResponse?> createPayment() {
    return _createPayment();
  }

  Future<PaymentResponse?> _createPayment() async {
    state = state.copyWith(loading: true, error: () => null);

    try {
      final storage = _ref.read(secureStorageProvider);
      final pendingTelegramToken = await storage.getPendingTelegramToken();

      final selectedModel = state.profile?.selectedModel ?? 'claude-opus-4.5';

      final paymentService = _ref.read(paymentServiceProvider);
      final paymentResponse = await paymentService.createPayment(
        telegramToken: pendingTelegramToken,
        selectedModel: selectedModel,
      );

      if (!mounted) return null;
      state = state.copyWith(loading: false);

      return paymentResponse;
    } catch (e) {
      if (!mounted) return null;
      state = state.copyWith(
        loading: false,
        error: () => e.toString(),
      );
      return null;
    }
  }

  /// Clear all auth state and storage.
  Future<void> logout() async {
    final authService = _ref.read(authServiceProvider);
    await authService.logout();

    final storage = _ref.read(secureStorageProvider);
    await storage.clearAuthToken();

    if (!mounted) return;

    state = const AuthState();
  }

  void clearError() {
    state = state.copyWith(error: () => null);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(ref),
);
