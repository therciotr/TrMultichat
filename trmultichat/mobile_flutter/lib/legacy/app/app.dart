import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/branding_theme.dart';
import 'providers.dart';
import 'router.dart';

class TrMultichatApp extends ConsumerWidget {
  const TrMultichatApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final branding = ref.watch(brandingProvider);

    return MaterialApp.router(
      title: 'TR Multichat',
      debugShowCheckedModeBanner: false,
      theme: BrandingTheme.build(brightness: Brightness.light, branding: branding),
      darkTheme: BrandingTheme.build(brightness: Brightness.dark, branding: branding),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}

