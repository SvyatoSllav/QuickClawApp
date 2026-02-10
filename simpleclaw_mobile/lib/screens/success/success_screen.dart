import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/providers/deploy_provider.dart';
import 'package:simpleclaw_mobile/providers/navigation_provider.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/header_bar.dart';
import 'package:simpleclaw_mobile/screens/success/widgets/deploy_progress.dart';
import 'package:simpleclaw_mobile/screens/success/widgets/pairing_info.dart';
import 'package:simpleclaw_mobile/widgets/spinner_icon.dart';

class SuccessScreen extends ConsumerStatefulWidget {
  const SuccessScreen({super.key});

  @override
  ConsumerState<SuccessScreen> createState() => _SuccessScreenState();
}

class _SuccessScreenState extends ConsumerState<SuccessScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(deployProvider.notifier).startPolling();
    });
  }

  @override
  Widget build(BuildContext context) {
    final deploy = ref.watch(deployProvider);

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
                    _buildStatusIcon(isReady: deploy.isReady),
                    const SizedBox(height: 24),
                    _buildTitle(isReady: deploy.isReady),
                    const SizedBox(height: 8),
                    _buildSubtitle(isReady: deploy.isReady),
                    const SizedBox(height: 24),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 350),
                      child: DeployProgress(
                        assigned: deploy.assigned,
                        openclawRunning: deploy.openclawRunning,
                      ),
                    ),
                    if (deploy.isReady) _buildReadyActions(),
                    if (deploy.status == 'error') _buildErrorBanner(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusIcon({required bool isReady}) {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isReady
            ? AppColors.emerald500.withValues(alpha: 0.2)
            : AppColors.blue500.withValues(alpha: 0.2),
      ),
      child: Center(
        child: isReady
            ? const Icon(Icons.check, size: 48, color: AppColors.emerald400)
            : const SpinnerIcon(size: 40, color: AppColors.blue400),
      ),
    );
  }

  Widget _buildTitle({required bool isReady}) {
    return Text(
      isReady ? Strings.botReady : Strings.serverSetup,
      style: GoogleFonts.inter(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
      textAlign: TextAlign.center,
    );
  }

  Widget _buildSubtitle({required bool isReady}) {
    return Text(
      isReady ? Strings.botReadyDesc : Strings.paymentSuccess,
      style: GoogleFonts.inter(fontSize: 16, color: AppColors.zinc300),
      textAlign: TextAlign.center,
    );
  }

  Widget _buildReadyActions() {
    return Column(
      children: [
        const SizedBox(height: 16),
        Text(
          Strings.writeBotTelegram,
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: AppColors.emerald400,
          ),
        ),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: () {
            ref
                .read(navigationProvider.notifier)
                .setScreen(AppScreen.profile);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.zinc800,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
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
        const SizedBox(height: 24),
        const PairingInfo(),
      ],
    );
  }

  Widget _buildErrorBanner() {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.red400.withValues(alpha: 0.1),
          border: Border.all(
            color: AppColors.red400.withValues(alpha: 0.3),
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          Strings.deployError,
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.red400),
        ),
      ),
    );
  }
}
