import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';
import 'package:simpleclaw_mobile/widgets/pulse_dot.dart';

class DeployProgress extends StatelessWidget {
  final bool assigned;
  final bool openclawRunning;
  final double iconSize;
  final double connectorHeight;

  const DeployProgress({
    super.key,
    required this.assigned,
    required this.openclawRunning,
    this.iconSize = 32,
    this.connectorHeight = 16,
  });

  bool get _deployReady => assigned && openclawRunning;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildStep(
          done: true,
          active: false,
          label: Strings.paymentDone,
        ),
        _buildConnector(active: assigned),
        _buildStep(
          done: assigned,
          active: !assigned,
          label: assigned ? Strings.serverAssigned : Strings.serverAssigning,
        ),
        _buildConnector(active: _deployReady),
        _buildStep(
          done: _deployReady,
          active: assigned && !openclawRunning,
          label: _stepThreeLabel,
        ),
      ],
    );
  }

  String get _stepThreeLabel {
    if (_deployReady) return Strings.openclawConfigured;
    if (assigned) return Strings.openclawConfiguring;
    return Strings.openclawPending;
  }

  Widget _buildStep({
    required bool done,
    required String label,
    bool active = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          _buildStepIcon(done: done, active: active),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: _stepColor(done: done, active: active),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _stepColor({required bool done, required bool active}) {
    if (done) return AppColors.emerald400;
    if (active) return AppColors.zinc400;
    return AppColors.zinc600;
  }

  Widget _buildStepIcon({required bool done, required bool active}) {
    final halfIcon = iconSize * 0.5;
    final dotSize = iconSize * 0.375;

    return Container(
      width: iconSize,
      height: iconSize,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: done
            ? AppColors.emerald500.withValues(alpha: 0.2)
            : AppColors.zinc800,
      ),
      child: Center(
        child: done
            ? Icon(Icons.check, size: halfIcon, color: AppColors.emerald400)
            : active
                ? PulseDot(size: dotSize)
                : Container(
                    width: dotSize,
                    height: dotSize,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.zinc600,
                    ),
                  ),
      ),
    );
  }

  Widget _buildConnector({required bool active}) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(left: (iconSize / 2) - 0.5),
        width: 1,
        height: connectorHeight,
        color: active
            ? AppColors.emerald500.withValues(alpha: 0.4)
            : AppColors.zinc700,
      ),
    );
  }
}
