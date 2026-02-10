import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/widgets/gradient_text.dart';

class HeroSection extends StatelessWidget {
  const HeroSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 32, 16, 16),
      child: Column(
        children: [
          const GradientText(text: Strings.heroTitle),
          const SizedBox(height: 12),
          Text(
            Strings.heroSubtitle,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.zinc400,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}
