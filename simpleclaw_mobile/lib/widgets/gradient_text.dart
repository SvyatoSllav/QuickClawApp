import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class GradientText extends StatelessWidget {
  final String text;
  final double? fontSize;
  final FontWeight fontWeight;
  final TextAlign textAlign;

  const GradientText({
    super.key,
    required this.text,
    this.fontSize,
    this.fontWeight = FontWeight.w600,
    this.textAlign = TextAlign.center,
  });

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final defaultSize = screenWidth >= 768 ? 42.0 : 28.0;

    return ShaderMask(
      shaderCallback: (bounds) => const LinearGradient(
        colors: [
          Color(0xFFFAFAFA),
          Colors.white,
          Color(0xFFCFCFCF),
        ],
        stops: [0.0, 0.4971, 1.0],
      ).createShader(bounds),
      child: Text(
        text,
        textAlign: textAlign,
        style: GoogleFonts.inter(
          fontSize: fontSize ?? defaultSize,
          fontWeight: fontWeight,
          color: Colors.white,
          height: 1.2,
        ),
      ),
    );
  }
}
