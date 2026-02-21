import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/di/core_providers.dart';
import '../core/notifications/notifications_providers.dart';
import '../core/socket/socket_providers.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/theme_controller.dart';
import '../features/auth/presentation/providers/auth_providers.dart';
import '../router/app_router.dart';

class TrMultichatApp extends ConsumerStatefulWidget {
  const TrMultichatApp({super.key});

  @override
  ConsumerState<TrMultichatApp> createState() => _TrMultichatAppState();
}

class _TrMultichatAppState extends ConsumerState<TrMultichatApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    final auth = ref.read(authControllerProvider);
    final socket = ref.read(socketClientProvider);
    final token = ref.read(currentAccessTokenProvider);
    // iOS can suspend socket connections; reconnect on resume to restore realtime updates.
    unawaited(socket.connect(jwt: token));
    if (auth.user?.companyId != null && (auth.user!.companyId > 0)) {
      socket.joinChatBox(auth.user!.companyId);
      socket.joinNotification(auth.user!.companyId);
    }
    unawaited(ref.read(localNotificationsProvider).requestPermissions());
  }

  @override
  Widget build(BuildContext context) {
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

