import 'package:flutter/material.dart';
import 'package:simpleclaw_mobile/config/theme.dart';

class UsageProgressBar extends StatelessWidget {
  final double used;
  final double limit;

  const UsageProgressBar({
    super.key,
    required this.used,
    required this.limit,
  });

  double get _percent => limit > 0 ? (used / limit) * 100 : 0;

  Color get _barColor {
    if (_percent > 90) return AppColors.red400;
    if (_percent > 70) return AppColors.amber500;
    return AppColors.emerald500;
  }

  @override
  Widget build(BuildContext context) {
    final clampedFraction = (_percent.clamp(0, 100)) / 100;
    return Container(
      height: 12,
      decoration: BoxDecoration(
        color: AppColors.zinc800,
        borderRadius: BorderRadius.circular(999),
      ),
      clipBehavior: Clip.hardEdge,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return Stack(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 500),
                width: constraints.maxWidth * clampedFraction,
                decoration: BoxDecoration(
                  color: _barColor,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
