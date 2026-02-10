import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppScreen { landing, success, profile, activeSubscription }

class NavigationNotifier extends StateNotifier<AppScreen> {
  NavigationNotifier() : super(AppScreen.landing);

  void setScreen(AppScreen screen) {
    state = screen;
  }
}

final navigationProvider =
    StateNotifierProvider<NavigationNotifier, AppScreen>(
  (ref) => NavigationNotifier(),
);
