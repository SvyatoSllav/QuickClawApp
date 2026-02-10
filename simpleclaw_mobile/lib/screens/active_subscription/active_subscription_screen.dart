import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/providers/navigation_provider.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/header_bar.dart';

class ActiveSubscriptionScreen extends ConsumerWidget {
  const ActiveSubscriptionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SingleChildScrollView(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Column(
            children: [
              const HeaderBar(),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 64, 16, 40),
                child: Column(
                  children: [
                    _buildCheckIcon(),
                    const SizedBox(height: 24),
                    Text(
                      Strings.openclawActive,
                      style: GoogleFonts.inter(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      Strings.openclawActiveDesc,
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        color: AppColors.zinc300,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),
                    ElevatedButton(
                      onPressed: () {
                        ref
                            .read(navigationProvider.notifier)
                            .setScreen(AppScreen.profile);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.zinc800,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 14,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        Strings.openProfile,
                        style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCheckIcon() {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.emerald500.withValues(alpha: 0.2),
      ),
      child: const Center(
        child: Icon(Icons.check, size: 48, color: AppColors.emerald400),
      ),
    );
  }
}
