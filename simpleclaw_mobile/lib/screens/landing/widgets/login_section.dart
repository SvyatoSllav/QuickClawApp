import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/providers/auth_provider.dart';
import 'package:simpleclaw_mobile/providers/server_pool_provider.dart';

class LoginSection extends ConsumerWidget {
  const LoginSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    if (authState.isAuthenticated) {
      return const _AuthenticatedHint();
    }

    final serverPool = ref.watch(serverPoolProvider);
    final availableServers =
        serverPool.whenOrNull(data: (pool) => pool.available) ?? 5;

    return _UnauthenticatedLogin(
      authState: authState,
      availableServers: availableServers,
      onSignIn: () => ref.read(authProvider.notifier).signIn(),
    );
  }
}

class _AuthenticatedHint extends StatelessWidget {
  const _AuthenticatedHint();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.zinc800.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.zinc700),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.email_outlined, size: 24, color: AppColors.blue400),
          const SizedBox(width: 12),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: 'Нажмите на кнопку ',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.zinc300,
                    ),
                  ),
                  TextSpan(
                    text: 'Telegram',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.blue400,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  TextSpan(
                    text: ' и введите токен бота',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.zinc300,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UnauthenticatedLogin extends StatelessWidget {
  final AuthState authState;
  final int availableServers;
  final VoidCallback onSignIn;

  const _UnauthenticatedLogin({
    required this.authState,
    required this.availableServers,
    required this.onSignIn,
  });

  @override
  Widget build(BuildContext context) {
    final isDisabled = authState.loading || availableServers == 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _GoogleSignInButton(
          isLoading: authState.loading,
          isDisabled: isDisabled,
          onPressed: onSignIn,
        ),
        if (authState.error != null) ...[
          const SizedBox(height: 8),
          Text(
            authState.error!,
            style: GoogleFonts.inter(fontSize: 14, color: AppColors.red400),
          ),
        ],
        const SizedBox(height: 8),
        _ServerAvailability(availableServers: availableServers),
      ],
    );
  }
}

class _GoogleSignInButton extends StatelessWidget {
  final bool isLoading;
  final bool isDisabled;
  final VoidCallback onPressed;

  const _GoogleSignInButton({
    required this.isLoading,
    required this.isDisabled,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: isDisabled ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          disabledBackgroundColor: Colors.white.withValues(alpha: 0.5),
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 0,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.network(
              'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/500px-Google_%22G%22_logo.svg.png',
              width: 20,
              height: 20,
              errorBuilder: (_, __, ___) =>
                  const SizedBox(width: 20, height: 20),
            ),
            const SizedBox(width: 8),
            Text(
              isLoading ? Strings.loginLoading : Strings.loginButton,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.black,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServerAvailability extends StatelessWidget {
  final int availableServers;

  const _ServerAvailability({required this.availableServers});

  @override
  Widget build(BuildContext context) {
    if (availableServers <= 0) {
      return Text(
        Strings.noServers,
        style: GoogleFonts.inter(
          fontSize: 14,
          color: AppColors.red400,
          fontWeight: FontWeight.w500,
        ),
      );
    }

    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: Strings.loginPrompt,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: const Color(0xFF6A6B6C),
            ),
          ),
          const TextSpan(text: ' '),
          TextSpan(
            text: '${Strings.serversLimited} $availableServers',
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.indigo400,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
