import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';

const _marqueeRows = [
  ['Чтение писем', 'Составление ответов', 'Перевод сообщений', 'Организация почты', 'Поддержка клиентов', 'Краткое изложение', 'Напоминания'],
  ['Планирование недели', 'Заметки на встречах', 'Учёт расходов', 'Управление подписками', 'Дедлайны', 'Синхронизация'],
  ['Поиск купонов', 'Сравнение цен', 'Анализ товаров', 'Расчёт зарплат', 'Возврат средств', 'Скидки'],
  ['Составление договоров', 'Исследование конкурентов', 'Создание счетов', 'Бронирование', 'Посты для соцсетей'],
];

class MarqueeSection extends StatelessWidget {
  const MarqueeSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                Text(
                  Strings.useCasesTitle,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 24,
                    fontWeight: FontWeight.w500,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  Strings.useCasesSubtitle,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 24,
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFF6A6B6C),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          ClipRect(
            child: ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: [
                  Colors.transparent,
                  Colors.white,
                  Colors.white,
                  Colors.transparent,
                ],
                stops: [0.0, 0.05, 0.95, 1.0],
              ).createShader(bounds),
              blendMode: BlendMode.dstIn,
              child: Column(
                children: [
                  for (final (index, items) in _marqueeRows.indexed)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: _MarqueeRow(
                        items: items,
                        duration: Duration(seconds: 38 + index * 2),
                        reverse: index.isOdd,
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

class _MarqueeRow extends StatefulWidget {
  final List<String> items;
  final Duration duration;
  final bool reverse;

  const _MarqueeRow({
    required this.items,
    required this.duration,
    this.reverse = false,
  });

  @override
  State<_MarqueeRow> createState() => _MarqueeRowState();
}

class _MarqueeRowState extends State<_MarqueeRow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _controller.stop(),
      onTapUp: (_) => _controller.repeat(),
      onTapCancel: () => _controller.repeat(),
      child: SizedBox(
        height: 44,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final progress = widget.reverse
                ? (1.0 - _controller.value)
                : _controller.value;
            return FractionalTranslation(
              translation: Offset(-progress, 0),
              child: child,
            );
          },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Duplicate the row for seamless infinite scrolling.
              for (var repeat = 0; repeat < 2; repeat++)
                for (final label in widget.items)
                  _MarqueeChip(label: label),
            ],
          ),
        ),
      ),
    );
  }
}

class _MarqueeChip extends StatelessWidget {
  final String label;

  const _MarqueeChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF111114),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: AppColors.zinc300,
        ),
      ),
    );
  }
}
