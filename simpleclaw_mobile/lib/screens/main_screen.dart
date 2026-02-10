import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/providers/auth_provider.dart';
import 'package:simpleclaw_mobile/providers/navigation_provider.dart';
import 'package:simpleclaw_mobile/providers/telegram_provider.dart';
import 'package:simpleclaw_mobile/screens/active_subscription/active_subscription_screen.dart';
import 'package:simpleclaw_mobile/screens/landing/landing_screen.dart';
import 'package:simpleclaw_mobile/screens/profile/profile_screen.dart';
import 'package:simpleclaw_mobile/screens/success/success_screen.dart';
import 'package:simpleclaw_mobile/screens/telegram_modal/telegram_modal.dart';

class MainScreen extends ConsumerStatefulWidget {
  const MainScreen({super.key});

  @override
  ConsumerState<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends ConsumerState<MainScreen> {
  bool _modalShowing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authProvider.notifier).init();
    });
  }

  @override
  Widget build(BuildContext context) {
    final screen = ref.watch(navigationProvider);
    final telegramState = ref.watch(telegramProvider);

    if (telegramState.isModalVisible && !_modalShowing) {
      _modalShowing = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        showTelegramModal(context);
        ref.read(telegramProvider.notifier).hideModal();
        _modalShowing = false;
      });
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: _buildScreen(screen),
      ),
    );
  }

  Widget _buildScreen(AppScreen screen) {
    switch (screen) {
      case AppScreen.landing:
        return const LandingScreen();
      case AppScreen.success:
        return const SuccessScreen();
      case AppScreen.profile:
        return const ProfileScreen();
      case AppScreen.activeSubscription:
        return const ActiveSubscriptionScreen();
    }
  }
}
