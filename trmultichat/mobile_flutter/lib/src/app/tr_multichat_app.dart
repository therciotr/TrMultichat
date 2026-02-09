import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/app_theme.dart';
import '../core/theme/theme_controller.dart';
import '../features/auth/presentation/providers/auth_providers.dart';
import '../router/app_router.dart';

class TrMultichatApp extends ConsumerWidget {
  const TrMultichatApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeState = ref.watch(appThemeProvider);
    final router = ref.watch(appRouterProvider);
    final auth = ref.watch(authControllerProvider);

    return MaterialApp.router(
      title: 'TR Multichat',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(themeState.branding),
      darkTheme: AppTheme.dark(themeState.branding),
      themeMode: themeState.mode,
      routerConfig: router(isAuthed: auth.isAuthenticated, isBootstrapping: auth.loading),
    );
  }
}

