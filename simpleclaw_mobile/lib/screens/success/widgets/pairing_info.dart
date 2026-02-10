import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';

class PairingInfo extends StatelessWidget {
  const PairingInfo({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.zinc900.withValues(alpha: 0.6),
        border: Border.all(
          color: AppColors.zinc700.withValues(alpha: 0.5),
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            Strings.pairingIntro,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.zinc300,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.zinc800.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              Strings.pairingCode,
              style: GoogleFonts.robotoMono(
                fontSize: 12,
                color: AppColors.zinc400,
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            Strings.pairingExplanation,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.zinc300,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}
