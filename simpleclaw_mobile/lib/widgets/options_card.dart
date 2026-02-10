import 'package:flutter/material.dart';
import 'package:simpleclaw_mobile/config/theme.dart';

class OptionsCard extends StatelessWidget {
  final bool selected;
  final bool disabled;
  final VoidCallback? onTap;
  final Widget child;
  final String? tooltip;

  const OptionsCard({
    super.key,
    this.selected = false,
    this.disabled = false,
    this.onTap,
    required this.child,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    Widget card = GestureDetector(
      onTap: disabled ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        decoration: BoxDecoration(
          color: selected ? AppColors.cardBg : const Color(0xFF111114),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected
                ? Colors.white.withValues(alpha: 0.15)
                : Colors.white.withValues(alpha: 0.05),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              offset: const Offset(0, 1.5),
              blurRadius: 0.5,
              spreadRadius: 2.5,
              color: Colors.black.withValues(alpha: 0.4),
            ),
            const BoxShadow(
              blurRadius: 0.5,
              spreadRadius: 1,
              color: Colors.black,
            ),
          ],
        ),
        child: Opacity(
          opacity: disabled ? 0.5 : 1.0,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: child,
          ),
        ),
      ),
    );

    if (tooltip != null) {
      card = Tooltip(
        message: tooltip!,
        preferBelow: false,
        child: card,
      );
    }

    return card;
  }
}
