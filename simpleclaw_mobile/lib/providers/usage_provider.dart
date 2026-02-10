import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:simpleclaw_mobile/providers/auth_provider.dart';

class UsageState {
  final double used;
  final double limit;
  final double remaining;
  final bool loading;
  final String? error;

  const UsageState({
    this.used = 0,
    this.limit = 15,
    this.remaining = 15,
    this.loading = false,
    this.error,
  });

  UsageState copyWith({
    double? used,
    double? limit,
    double? remaining,
    bool? loading,
    String? Function()? error,
  }) {
    return UsageState(
      used: used ?? this.used,
      limit: limit ?? this.limit,
      remaining: remaining ?? this.remaining,
      loading: loading ?? this.loading,
      error: error != null ? error() : this.error,
    );
  }
}

class UsageNotifier extends StateNotifier<UsageState> {
  final Ref _ref;

  UsageNotifier(this._ref) : super(const UsageState());

  Future<void> loadUsage() async {
    state = state.copyWith(loading: true, error: () => null);

    try {
      final profileService = _ref.read(profileServiceProvider);
      final usage = await profileService.getUsage();

      state = state.copyWith(
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        loading: false,
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: () => 'Failed to load usage: $e',
      );
    }
  }
}

final usageProvider = StateNotifierProvider<UsageNotifier, UsageState>(
  (ref) => UsageNotifier(ref),
);
