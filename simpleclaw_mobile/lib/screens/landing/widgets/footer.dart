import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:simpleclaw_mobile/config/app_config.dart';
import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';

class Footer extends StatelessWidget {
  const Footer({super.key});

  void _openArticle(String path) {
    launchUrl(Uri.parse('${AppConfig.frontendUrl}$path'));
  }

  void _openMail() {
    launchUrl(Uri.parse('mailto:${AppConfig.supportEmail}'));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 48, 16, 32),
      child: Column(
        children: [
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            runSpacing: 8,
            children: [
              _FooterLink(
                text: 'Как установить OpenClaw',
                onTap: () => _openArticle(
                  '/articles/how-to-install-openclaw.html',
                ),
              ),
              const _Dot(),
              _FooterLink(
                text: 'Что такое OpenClaw',
                onTap: () => _openArticle(
                  '/articles/what-is-openclaw.html',
                ),
              ),
              const _Dot(),
              _FooterLink(
                text: 'Топ 5 способов',
                onTap: () => _openArticle(
                  '/articles/top-5-ways-to-use-openclaw.html',
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            runSpacing: 8,
            children: [
              Text(
                Strings.author,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.white,
                ),
              ),
              const _Dot(),
              _FooterLink(
                text: Strings.contact,
                color: Colors.white,
                onTap: _openMail,
              ),
              const _Dot(),
              _FooterLink(
                text: Strings.agreement,
                onTap: () => _openArticle('/agreement.html'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 4,
      height: 4,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.6),
      ),
    );
  }
}

class _FooterLink extends StatelessWidget {
  final String text;
  final Color? color;
  final VoidCallback onTap;

  const _FooterLink({
    required this.text,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 14,
          color: color ?? AppColors.zinc400,
        ),
      ),
    );
  }
}
