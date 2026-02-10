import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:simpleclaw_mobile/config/app_config.dart';
import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/providers/auth_provider.dart';
import 'package:simpleclaw_mobile/providers/navigation_provider.dart';

class HeaderBar extends ConsumerWidget {
  const HeaderBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Row(
        children: [
          _LogoButton(ref: ref),
          const Spacer(),
          _SupportButton(),
          if (authState.isAuthenticated) ...[
            const SizedBox(width: 12),
            _AvatarMenu(ref: ref),
          ],
        ],
      ),
    );
  }
}

class _LogoButton extends StatelessWidget {
  final WidgetRef ref;

  const _LogoButton({required this.ref});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        ref.read(navigationProvider.notifier).setScreen(AppScreen.landing);
      },
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'SimpleClaw.com ',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: Colors.white,
            ),
          ),
          Text(
            'RU',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: AppColors.zinc400,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ),
    );
  }
}

class _SupportButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => launchUrl(Uri.parse('mailto:${AppConfig.supportEmail}')),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.email_outlined, size: 18, color: AppColors.zinc400),
          const SizedBox(width: 6),
          Text(
            Strings.support,
            style: GoogleFonts.inter(fontSize: 14, color: AppColors.zinc400),
          ),
        ],
      ),
    );
  }
}

class _AvatarMenu extends StatelessWidget {
  final WidgetRef ref;

  const _AvatarMenu({required this.ref});

  void _onSelected(String value) {
    if (value == 'profile') {
      ref.read(navigationProvider.notifier).setScreen(AppScreen.profile);
    } else if (value == 'logout') {
      ref.read(authProvider.notifier).logout();
      ref.read(navigationProvider.notifier).setScreen(AppScreen.landing);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      offset: const Offset(0, 40),
      color: AppColors.zinc900,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.zinc700),
      ),
      onSelected: _onSelected,
      itemBuilder: (_) => [
        PopupMenuItem(
          value: 'profile',
          child: Text(
            Strings.profile,
            style: GoogleFonts.inter(fontSize: 14, color: AppColors.zinc300),
          ),
        ),
        PopupMenuItem(
          value: 'logout',
          child: Text(
            Strings.logout,
            style: GoogleFonts.inter(fontSize: 14, color: AppColors.zinc300),
          ),
        ),
      ],
      child: Container(
        width: 36,
        height: 36,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.zinc800,
        ),
        child: const Icon(Icons.person, size: 20, color: AppColors.zinc400),
      ),
    );
  }
}
