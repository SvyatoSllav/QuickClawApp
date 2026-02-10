import 'package:flutter/material.dart';

import 'package:simpleclaw_mobile/screens/landing/widgets/channel_selector.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/comparison_section.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/footer.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/header_bar.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/hero_section.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/login_section.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/marquee_section.dart';
import 'package:simpleclaw_mobile/screens/landing/widgets/model_selector.dart';
import 'package:simpleclaw_mobile/widgets/card_frame.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: const Column(
            children: [
              HeaderBar(),
              HeroSection(),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: CardFrame(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Column(
                      children: [
                        ModelSelector(),
                        SizedBox(height: 32),
                        ChannelSelector(),
                        SizedBox(height: 32),
                        LoginSection(),
                      ],
                    ),
                  ),
                ),
              ),
              ComparisonSection(),
              MarqueeSection(),
              Footer(),
            ],
          ),
        ),
      ),
    );
  }
}
