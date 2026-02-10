import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import 'package:simpleclaw_mobile/config/app_config.dart';
import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/core/utils/validators.dart';
import 'package:simpleclaw_mobile/providers/auth_provider.dart';
import 'package:simpleclaw_mobile/providers/telegram_provider.dart';

void showTelegramModal(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.modalBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const _TelegramModalContent(),
  );
}

class _TelegramModalContent extends ConsumerStatefulWidget {
  const _TelegramModalContent();

  @override
  ConsumerState<_TelegramModalContent> createState() =>
      _TelegramModalContentState();
}

class _TelegramModalContentState
    extends ConsumerState<_TelegramModalContent> {
  late final TextEditingController _tokenController;
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;

  @override
  void initState() {
    super.initState();
    _tokenController = TextEditingController(
      text: ref.read(telegramProvider).pendingToken,
    );
    _initVideo();
  }

  void _initVideo() {
    _videoController = VideoPlayerController.networkUrl(
      Uri.parse(AppConfig.demoVideoUrl),
    )..initialize().then((_) {
        if (!mounted) return;
        _chewieController = ChewieController(
          videoPlayerController: _videoController!,
          autoPlay: true,
          looping: true,
          showControls: false,
          aspectRatio: 9 / 16,
        );
        setState(() {});
      });
  }

  @override
  void dispose() {
    _tokenController.dispose();
    _chewieController?.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final token = _tokenController.text;
    final isValid = isValidTelegramToken(token);
    final showError = token.isNotEmpty && !isValid;

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildDragHandle(),
              const SizedBox(height: 20),
              _buildHeader(),
              const SizedBox(height: 20),
              _buildInstructions(),
              const SizedBox(height: 20),
              _buildTokenInput(showError: showError),
              if (showError) ...[
                const SizedBox(height: 8),
                Text(
                  Strings.tokenError,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppColors.red400,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              _buildSaveButton(
                isLoading: authState.loading,
                isValid: isValid,
              ),
              const SizedBox(height: 24),
              _buildVideoDemo(),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDragHandle() {
    return Center(
      child: Container(
        width: 40,
        height: 4,
        decoration: BoxDecoration(
          color: AppColors.zinc700,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Image.network(
          'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png',
          width: 40,
          height: 40,
          errorBuilder: (_, __, ___) => const SizedBox(width: 40, height: 40),
        ),
        const SizedBox(width: 12),
        Text(
          Strings.connectTelegram,
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ],
    );
  }

  Widget _buildInstructions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Strings.howToGetToken,
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.zinc400),
        ),
        const SizedBox(height: 12),
        _buildLinkedStep(
          number: '1',
          prefix: 'Откройте ',
          highlight: '@BotFather',
          suffix: ' в Telegram',
          url: 'https://t.me/BotFather',
        ),
        _buildLinkedStep(
          number: '2',
          prefix: 'Отправьте команду ',
          highlight: '/newbot',
        ),
        _buildSimpleStep('3', 'Придумайте имя и username для бота'),
        _buildSimpleStep('4', 'Скопируйте полученный токен'),
        _buildSimpleStep('5', 'Вставьте токен ниже и нажмите «Сохранить»'),
      ],
    );
  }

  Widget _buildTokenInput({required bool showError}) {
    final borderColor = showError ? AppColors.red400 : AppColors.zinc700;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Strings.tokenLabel,
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.zinc400),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _tokenController,
          onChanged: (val) =>
              ref.read(telegramProvider.notifier).setToken(val),
          style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
          decoration: InputDecoration(
            hintText: Strings.tokenPlaceholder,
            hintStyle: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.zinc500,
            ),
            filled: true,
            fillColor: AppColors.zinc800,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: borderColor),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: borderColor),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: showError ? AppColors.red400 : AppColors.blue500,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSaveButton({
    required bool isLoading,
    required bool isValid,
  }) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: (isLoading || !isValid) ? null : _onSave,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.blue600,
          disabledBackgroundColor: AppColors.blue600.withValues(alpha: 0.5),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        icon: const Icon(Icons.check, size: 20),
        label: Text(
          isLoading ? Strings.saving : Strings.saveAndConnect,
          style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }

  Future<void> _onSave() async {
    await ref.read(telegramProvider.notifier).savePendingToken();
    if (!mounted) return;
    Navigator.of(context).pop();
    ref.read(authProvider.notifier).signIn();
  }

  Widget _buildVideoDemo() {
    if (_chewieController == null) return const SizedBox.shrink();

    return Center(
      child: Container(
        width: 200,
        height: 400,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.zinc800, width: 4),
        ),
        clipBehavior: Clip.hardEdge,
        child: Chewie(controller: _chewieController!),
      ),
    );
  }

  Widget _buildLinkedStep({
    required String number,
    required String prefix,
    required String highlight,
    String? suffix,
    String? url,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$number. ',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Colors.white,
            ),
          ),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: prefix,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.zinc300,
                    ),
                  ),
                  if (url != null)
                    WidgetSpan(
                      child: GestureDetector(
                        onTap: () => launchUrl(Uri.parse(url)),
                        child: Text(
                          highlight,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: AppColors.blue400,
                          ),
                        ),
                      ),
                    )
                  else
                    TextSpan(
                      text: highlight,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: AppColors.zinc300,
                        backgroundColor: AppColors.zinc800,
                      ),
                    ),
                  if (suffix != null)
                    TextSpan(
                      text: suffix,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: AppColors.zinc300,
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

  Widget _buildSimpleStep(String number, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$number. ',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Colors.white,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: AppColors.zinc300,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
