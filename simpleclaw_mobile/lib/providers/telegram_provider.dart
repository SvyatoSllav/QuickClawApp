import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:simpleclaw_mobile/providers/auth_provider.dart';

class TelegramState {
  final String pendingToken;
  final bool isModalVisible;
  final bool isValidating;
  final String? validationError;

  const TelegramState({
    this.pendingToken = '',
    this.isModalVisible = false,
    this.isValidating = false,
    this.validationError,
  });

  TelegramState copyWith({
    String? pendingToken,
    bool? isModalVisible,
    bool? isValidating,
    String? Function()? validationError,
  }) {
    return TelegramState(
      pendingToken: pendingToken ?? this.pendingToken,
      isModalVisible: isModalVisible ?? this.isModalVisible,
      isValidating: isValidating ?? this.isValidating,
      validationError: validationError != null
          ? validationError()
          : this.validationError,
    );
  }
}

class TelegramNotifier extends StateNotifier<TelegramState> {
  final Ref _ref;

  TelegramNotifier(this._ref) : super(const TelegramState());

  void showModal() {
    state = state.copyWith(isModalVisible: true);
  }

  void hideModal() {
    state = state.copyWith(isModalVisible: false);
  }

  void setToken(String token) {
    state = state.copyWith(pendingToken: token, validationError: () => null);
  }

  Future<void> savePendingToken() async {
    if (state.pendingToken.isEmpty) return;

    final storage = _ref.read(secureStorageProvider);
    await storage.setPendingTelegramToken(state.pendingToken);
  }

  Future<void> validatePendingToken() async {
    final storage = _ref.read(secureStorageProvider);
    final token = await storage.getPendingTelegramToken();
    if (token == null || token.isEmpty) return;

    state = state.copyWith(isValidating: true, validationError: () => null);

    try {
      final telegramService = _ref.read(telegramServiceProvider);
      await telegramService.validate(token);
      await storage.clearPendingTelegramToken();

      state = state.copyWith(
        isValidating: false,
        pendingToken: '',
      );
    } catch (e) {
      state = state.copyWith(
        isValidating: false,
        validationError: () => 'Failed to validate telegram token: $e',
      );
    }
  }

  void reset() {
    state = const TelegramState();
  }
}

final telegramProvider =
    StateNotifierProvider<TelegramNotifier, TelegramState>(
  (ref) => TelegramNotifier(ref),
);
