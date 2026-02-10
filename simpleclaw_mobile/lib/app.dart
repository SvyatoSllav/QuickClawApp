import 'package:flutter/material.dart';

import 'package:simpleclaw_mobile/config/routes.dart';
import 'package:simpleclaw_mobile/config/theme.dart';
import 'package:simpleclaw_mobile/core/utils/strings.dart';

class SimpleClawApp extends StatefulWidget {
  const SimpleClawApp({super.key});

  @override
  State<SimpleClawApp> createState() => _SimpleClawAppState();
}

class _SimpleClawAppState extends State<SimpleClawApp> {
  late final _router = buildRouter();

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: Strings.appTitle,
      theme: buildAppTheme(),
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
    );
  }
}
