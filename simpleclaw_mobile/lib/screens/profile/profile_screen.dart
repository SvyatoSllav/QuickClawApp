import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/models/profile.dart';
import 'package:simpleclaw_mobile/models/subscription.dart';
import 'package:simpleclaw_mobile/providers/auth_provider.dart';
import 'package:simpleclaw_mobile/providers/deploy_provider.dart';
import 'package:simpleclaw_mobile/providers/navigation_provider.dart';
import 'package:simpleclaw_mobile/providers/usage_provider.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/header_bar.dart';
import 'package:simpleclaw_mobile/screens/success/widgets/deploy_progress.dart';
import 'package:simpleclaw_mobile/screens/success/widgets/pairing_info.dart';
import 'package:simpleclaw_mobile/widgets/progress_bar.dart';
import 'package:simpleclaw_mobile/widgets/spinner_icon.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authState = ref.read(authProvider);
      final subscription = authState.subscription;
      if (subscription == null || !subscription.isActive) return;

      ref.read(usageProvider.notifier).loadUsage();

      final deploy = ref.read(deployProvider);
      if (!deploy.isReady) {
        ref.read(deployProvider.notifier).startPolling();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final deploy = ref.watch(deployProvider);
    final usage = ref.watch(usageProvider);
    final subscription = authState.subscription;
    final profile = authState.profile;
    final hasActiveSub = subscription != null && subscription.isActive;

    return SingleChildScrollView(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Column(
            children: [
              const HeaderBar(),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 48, 16, 40),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 24),
                    _buildUserCard(
                      email: authState.user?.email ?? '',
                      model: profile?.selectedModel ?? 'claude-opus-4.5',
                    ),
                    const SizedBox(height: 16),
                    if (hasActiveSub && !deploy.isReady) ...[
                      _buildDeployCard(deploy),
                      const SizedBox(height: 16),
                    ],
                    _buildSubscriptionCard(
                      subscription: subscription,
                      profile: profile,
                      usage: usage,
                    ),
                    if (hasActiveSub && deploy.isReady) ...[
                      const SizedBox(height: 16),
                      const PairingInfo(),
                    ],
                    const SizedBox(height: 24),
                    _buildBackButton(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          Strings.profile,
          style: GoogleFonts.inter(
            fontSize: 28,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        GestureDetector(
          onTap: () => ref
              .read(navigationProvider.notifier)
              .setScreen(AppScreen.landing),
          child: const Icon(
            Icons.close,
            size: 24,
            color: AppColors.zinc400,
          ),
        ),
      ],
    );
  }

  Widget _buildUserCard({
    required String email,
    required String model,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.zinc900.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.zinc800),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.zinc800,
            ),
            child: const Icon(
              Icons.person,
              size: 32,
              color: AppColors.zinc500,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  email,
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  model,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppColors.zinc500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeployCard(DeployState deploy) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.zinc900.withValues(alpha: 0.5),
        border: Border.all(
          color: AppColors.blue500.withValues(alpha: 0.2),
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SpinnerIcon(size: 20, color: AppColors.blue400),
              const SizedBox(width: 8),
              Text(
                Strings.serverSetupTitle,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          DeployProgress(
            assigned: deploy.assigned,
            openclawRunning: deploy.openclawRunning,
            iconSize: 24,
            connectorHeight: 12,
          ),
          if (deploy.status == 'error') ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.red400.withValues(alpha: 0.1),
                border: Border.all(
                  color: AppColors.red400.withValues(alpha: 0.3),
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                Strings.errorOccurred,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.red400,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSubscriptionCard({
    required SubscriptionData? subscription,
    required ProfileData? profile,
    required UsageState usage,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.zinc900.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.zinc800),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            Strings.subscription,
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          if (subscription != null && subscription.isActive)
            _buildActiveSubscriptionDetails(
              subscription: subscription,
              profile: profile,
              usage: usage,
            )
          else
            Text(
              Strings.noSubscription,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: AppColors.zinc500,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildActiveSubscriptionDetails({
    required SubscriptionData subscription,
    required ProfileData? profile,
    required UsageState usage,
  }) {
    final isCancellationScheduled = profile?.cancellationScheduled ?? false;

    return Column(
      children: [
        _buildInfoRow(
          label: Strings.statusLabel,
          value: Strings.active,
          valueColor: AppColors.emerald400,
        ),
        const SizedBox(height: 12),
        _buildInfoRow(
          label: Strings.validUntil,
          value: _formatDate(subscription.currentPeriodEnd),
        ),
        const SizedBox(height: 16),
        _buildUsageSection(usage),
        const SizedBox(height: 16),
        if (isCancellationScheduled)
          _buildCancellationBanner(subscription)
        else
          _buildCancelButton(),
      ],
    );
  }

  Widget _buildInfoRow({
    required String label,
    required String value,
    Color valueColor = Colors.white,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.zinc400),
        ),
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: valueColor,
          ),
        ),
      ],
    );
  }

  Widget _buildUsageSection(UsageState usage) {
    return Container(
      padding: const EdgeInsets.only(top: 16),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: AppColors.zinc700.withValues(alpha: 0.5),
          ),
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                Strings.used,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.zinc400,
                ),
              ),
              Text(
                '${usage.used.toStringAsFixed(4)} / ${usage.limit.toInt()} \$',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          UsageProgressBar(used: usage.used, limit: usage.limit),
        ],
      ),
    );
  }

  Widget _buildCancellationBanner(SubscriptionData subscription) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.amber500.withValues(alpha: 0.1),
        border: Border.all(
          color: AppColors.amber500.withValues(alpha: 0.3),
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        '${Strings.subscriptionEnding} ${_formatDate(subscription.currentPeriodEnd)}',
        style: GoogleFonts.inter(fontSize: 14, color: AppColors.amber500),
        textAlign: TextAlign.center,
      ),
    );
  }

  Widget _buildCancelButton() {
    return SizedBox(
      width: double.infinity,
      child: TextButton(
        onPressed: () => _confirmCancel(context),
        style: TextButton.styleFrom(
          backgroundColor: AppColors.red400.withValues(alpha: 0.1),
          side: BorderSide(
            color: AppColors.red400.withValues(alpha: 0.3),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
        child: Text(
          Strings.cancelSubscription,
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.red400),
        ),
      ),
    );
  }

  Widget _buildBackButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: () => ref
            .read(navigationProvider.notifier)
            .setScreen(AppScreen.landing),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.zinc800,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: Text(
          Strings.back,
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  void _confirmCancel(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.modalBg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Text(
          Strings.cancelSubscription,
          style: GoogleFonts.inter(color: Colors.white),
        ),
        content: Text(
          Strings.cancelConfirm,
          style: GoogleFonts.inter(color: AppColors.zinc300),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              Strings.back,
              style: GoogleFonts.inter(color: AppColors.zinc400),
            ),
          ),
          TextButton(
            onPressed: () => _executeCancellation(ctx),
            child: Text(
              Strings.cancelSubscription,
              style: GoogleFonts.inter(color: AppColors.red400),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _executeCancellation(BuildContext dialogContext) async {
    Navigator.of(dialogContext).pop();

    try {
      final subService = ref.read(subscriptionServiceProvider);
      await subService.cancel();

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(Strings.subscriptionCancelled),
          backgroundColor: AppColors.zinc800,
        ),
      );

      await ref.read(authProvider.notifier).loadProfile();
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${Strings.errorOccurred}: $e'),
          backgroundColor: AppColors.red400,
        ),
      );
    }
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '';
    return DateFormat('dd.MM.yyyy').format(date);
  }
}
