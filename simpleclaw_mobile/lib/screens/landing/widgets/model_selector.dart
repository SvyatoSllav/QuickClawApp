import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/providers/model_selection_provider.dart';
import 'package:simpleclaw_mobile/widgets/options_card.dart';

class _ModelInfo {
  final String id;
  final String name;
  final String iconUrl;
  final String tooltip;

  const _ModelInfo({
    required this.id,
    required this.name,
    required this.iconUrl,
    required this.tooltip,
  });
}

const _models = [
  _ModelInfo(
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg',
    tooltip: 'Лучший баланс цены и качества',
  ),
  _ModelInfo(
    id: 'claude-opus-4.5',
    name: 'Claude Opus 4.5',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg',
    tooltip: 'Самая эффективная для сложных задач',
  ),
  _ModelInfo(
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Google_Gemini_icon_2025.svg/960px-Google_Gemini_icon_2025.svg.png',
    tooltip: 'Самая бюджетная и быстрая',
  ),
];

class ModelSelector extends ConsumerWidget {
  const ModelSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selection = ref.watch(modelSelectionProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Strings.modelQuestion,
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),
        for (final (index, model) in _models.indexed)
          Padding(
            padding: EdgeInsets.only(
              bottom: index < _models.length - 1 ? 12 : 0,
            ),
            child: _ModelCard(
              model: model,
              isSelected: selection.selectedModel == model.id,
              onTap: () => ref
                  .read(modelSelectionProvider.notifier)
                  .setModel(model.id),
            ),
          ),
      ],
    );
  }
}

class _ModelCard extends StatelessWidget {
  final _ModelInfo model;
  final bool isSelected;
  final VoidCallback onTap;

  const _ModelCard({
    required this.model,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return OptionsCard(
      selected: isSelected,
      tooltip: model.tooltip,
      onTap: onTap,
      child: Row(
        children: [
          CachedNetworkImage(
            imageUrl: model.iconUrl,
            width: 20,
            height: 20,
            errorWidget: (_, __, ___) => const SizedBox(width: 20, height: 20),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              model.name,
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: isSelected ? Colors.white : AppColors.zinc400,
              ),
            ),
          ),
          if (isSelected)
            const Icon(Icons.check, size: 20, color: AppColors.zinc400),
        ],
      ),
    );
  }
}
