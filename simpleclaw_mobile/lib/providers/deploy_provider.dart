import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:simpleclaw_mobile/config/app_config.dart';
import 'package:simpleclaw_mobile/providers/auth_provider.dart';

class DeployState {
  final bool assigned;
  final bool openclawRunning;
  final String status;

  const DeployState({
    this.assigned = false,
    this.openclawRunning = false,
    this.status = '',
  });

  bool get isReady => assigned && openclawRunning;

  DeployState copyWith({
    bool? assigned,
    bool? openclawRunning,
    String? status,
  }) {
    return DeployState(
      assigned: assigned ?? this.assigned,
      openclawRunning: openclawRunning ?? this.openclawRunning,
      status: status ?? this.status,
    );
  }
}

class DeployNotifier extends StateNotifier<DeployState> {
  final Ref _ref;
  Timer? _pollTimer;

  DeployNotifier(this._ref) : super(const DeployState());

  void startPolling() {
    stopPolling();
    checkStatus();
    _pollTimer = Timer.periodic(
      const Duration(milliseconds: AppConfig.deployPollIntervalMs),
      (_) => checkStatus(),
    );
  }

  void stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> checkStatus() async {
    final authState = _ref.read(authProvider);
    if (authState.authToken == null) return;

    try {
      final serverService = _ref.read(serverServiceProvider);
      final serverStatus = await serverService.getStatus();

      if (!mounted) return;

      state = DeployState(
        assigned: serverStatus.assigned,
        openclawRunning: serverStatus.openclawRunning,
        status: serverStatus.status ?? '',
      );

      if (serverStatus.assigned && serverStatus.openclawRunning) {
        stopPolling();
      }

      if (serverStatus.status == 'error') {
        stopPolling();
      }
    } catch (_) {
      // Auth might not be ready yet; keep polling.
    }
  }

  @override
  void dispose() {
    stopPolling();
    super.dispose();
  }
}

final deployProvider = StateNotifierProvider<DeployNotifier, DeployState>(
  (ref) => DeployNotifier(ref),
);
