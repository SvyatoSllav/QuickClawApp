import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/providers/model_selection_provider.dart';
import 'package:simpleclaw_mobile/providers/telegram_provider.dart';
import 'package:simpleclaw_mobile/widgets/options_card.dart';

class _ChannelInfo {
  final String id;
  final String name;
  final String iconUrl;
  final bool disabled;

  const _ChannelInfo({
    required this.id,
    required this.name,
    required this.iconUrl,
    required this.disabled,
  });
}

const _channels = [
  _ChannelInfo(
    id: 'telegram',
    name: 'Telegram',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png',
    disabled: false,
  ),
  _ChannelInfo(
    id: 'discord',
    name: 'Discord',
    iconUrl: 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png',
    disabled: true,
  ),
  _ChannelInfo(
    id: 'whatsapp',
    name: 'WhatsApp',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/960px-WhatsApp.svg.png',
    disabled: true,
  ),
];

class ChannelSelector extends ConsumerWidget {
  const ChannelSelector({super.key});

  void _onChannelTap(WidgetRef ref, _ChannelInfo channel) {
    if (channel.disabled) return;

    ref.read(modelSelectionProvider.notifier).setChannel(channel.id);

    if (channel.id == 'telegram') {
      ref.read(telegramProvider.notifier).showModal();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selection = ref.watch(modelSelectionProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Strings.channelQuestion,
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),
        for (final (index, channel) in _channels.indexed)
          Padding(
            padding: EdgeInsets.only(
              bottom: index < _channels.length - 1 ? 12 : 0,
            ),
            child: _ChannelCard(
              channel: channel,
              isSelected: selection.selectedChannel == channel.id,
              onTap: () => _onChannelTap(ref, channel),
            ),
          ),
      ],
    );
  }
}

class _ChannelCard extends StatelessWidget {
  final _ChannelInfo channel;
  final bool isSelected;
  final VoidCallback onTap;

  const _ChannelCard({
    required this.channel,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        OptionsCard(
          selected: isSelected,
          disabled: channel.disabled,
          onTap: onTap,
          child: Row(
            children: [
              CachedNetworkImage(
                imageUrl: channel.iconUrl,
                width: 20,
                height: 20,
                errorWidget: (_, __, ___) =>
                    const SizedBox(width: 20, height: 20),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  channel.name,
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
        ),
        if (channel.disabled)
          Positioned(
            bottom: 4,
            right: 8,
            child: Text(
              Strings.soon,
              style: GoogleFonts.inter(
                fontSize: 10,
                color: AppColors.zinc400,
              ),
            ),
          ),
      ],
    );
  }
}
