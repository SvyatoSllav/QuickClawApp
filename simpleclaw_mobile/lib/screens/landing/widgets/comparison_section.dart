import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/widgets/gradient_text.dart';

class _Step {
  final String label;
  final int time;

  const _Step(this.label, this.time);
}

const _traditionalSteps = [
  _Step('Выбор и покупка сервера', 30),
  _Step('Создание SSH-ключей', 10),
  _Step('Подключение и настройка ОС', 20),
  _Step('Установка Docker и зависимостей', 30),
  _Step('Установка и сборка OpenClaw', 30),
  _Step('Настройка конфигурации', 30),
  _Step('Подключение Telegram и тесты', 30),
];

const _tabularFigures = [FontFeature.tabularFigures()];

class ComparisonSection extends StatelessWidget {
  const ComparisonSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 48),
      child: Column(
        children: [
          const _DividerWithLabel(),
          const SizedBox(height: 24),
          const GradientText(
            text: 'Традиционный метод vs SimpleClaw',
            fontSize: 24,
          ),
          const SizedBox(height: 32),
          const _TraditionalSide(),
          _horizontalDivider(),
          const _SimpleClawSide(),
        ],
      ),
    );
  }

  static Widget _horizontalDivider() {
    return Container(
      height: 2,
      margin: const EdgeInsets.symmetric(vertical: 24),
      color: Colors.white.withValues(alpha: 0.1),
    );
  }
}

class _DividerWithLabel extends StatelessWidget {
  const _DividerWithLabel();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Container(
            height: 2,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.transparent, Color(0xFF581D27)],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            Strings.comparison,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.zinc400,
            ),
          ),
        ),
        Expanded(
          child: Container(
            height: 2,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF581D27), Colors.transparent],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TraditionalSide extends StatelessWidget {
  const _TraditionalSide();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Strings.traditional,
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: AppColors.zinc400,
            fontStyle: FontStyle.italic,
          ),
        ),
        const SizedBox(height: 8),
        for (final step in _traditionalSteps)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    step.label,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.zinc400,
                    ),
                  ),
                ),
                Text(
                  '${step.time} мин',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppColors.zinc400,
                    fontFeatures: _tabularFigures,
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.only(top: 12),
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(
                color: Colors.white.withValues(alpha: 0.2),
                width: 2,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                Strings.total,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: Colors.white,
                  fontStyle: FontStyle.italic,
                ),
              ),
              Text(
                Strings.threeHours,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: Colors.white,
                  fontFeatures: _tabularFigures,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SimpleClawSide extends StatelessWidget {
  const _SimpleClawSide();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SimpleClaw',
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: AppColors.zinc400,
            fontStyle: FontStyle.italic,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          Strings.lessThanOneMin,
          style: GoogleFonts.inter(
            fontSize: 28,
            fontWeight: FontWeight.w600,
            color: Colors.white,
            fontFeatures: _tabularFigures,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Text(
              Strings.price,
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: AppColors.emerald400,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              Strings.oldPrice,
              style: GoogleFonts.inter(
                fontSize: 16,
                color: AppColors.zinc500,
                decoration: TextDecoration.lineThrough,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          Strings.simpleclawDesc,
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.zinc400),
        ),
        const SizedBox(height: 4),
        Text(
          Strings.apiCredits,
          style: GoogleFonts.inter(
            fontSize: 14,
            color: AppColors.emerald400.withValues(alpha: 0.8),
          ),
        ),
      ],
    );
  }
}
