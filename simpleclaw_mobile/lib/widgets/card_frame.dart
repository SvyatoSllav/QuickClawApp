import 'package:flutter/material.dart';
import 'package:simpleclaw_mobile/config/theme.dart';

class CardFrame extends StatelessWidget {
  final Widget child;

  const CardFrame({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.08),
          width: 2,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            offset: const Offset(0, 8),
            blurRadius: 32,
            color: Colors.black.withValues(alpha: 0.42),
          ),
        ],
      ),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.background,
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.05),
            width: 1,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        clipBehavior: Clip.hardEdge,
        child: child,
      ),
    );
  }
}
