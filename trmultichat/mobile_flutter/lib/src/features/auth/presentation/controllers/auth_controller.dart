import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/biometrics/biometric_providers.dart';
import '../../../../core/di/core_providers.dart';
import '../../../../core/notifications/notifications_providers.dart';
import '../../../../core/socket/socket_providers.dart';
import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../state/auth_state.dart';

class AuthController extends StateNotifier<AuthState> {
  final AuthRepository _repo;
  final Ref _ref;
  StreamSubscription? _msgSub;
  bool _bootstrapped = false;

  AuthController(this._repo, this._ref) : super(AuthState.initial()) {
    _bootstrap();
  }

  void _bindGlobalMessageNotifications(int companyId) {
    _msgSub?.cancel();
    if (companyId <= 0) return;
    final socket = _ref.read(socketClientProvider);
    final eventName = 'company-$companyId-appMessage';
    _msgSub = socket.on<Map<String, dynamic>>(eventName, (data) {
      if (data is Map) return data.cast<String, dynamic>();
      return <String, dynamic>{};
    }).listen((payload) {
      try {
        if (payload['action']?.toString() != 'create') return;
        final msg = (payload['message'] as Map?)?.cast<String, dynamic>();
        if (msg == null) return;
        final fromMe = msg['fromMe'] == true;
        if (fromMe) return;
        final body = (msg['body']?.toString() ?? '').trim();
        if (body.isEmpty) return;
        final title = (msg['contactName']?.toString() ?? '').trim().isNotEmpty ? msg['contactName']!.toString() : 'Nova mensagem';
        _ref.read(localNotificationsProvider).show(
              title: title,
              body: body,
              payload: 'ticket:${msg['ticketId'] ?? ''}',
            );
      } catch (_) {}
    });
  }

  Future<void> _bootstrap() async {
    if (_bootstrapped) return;
    _bootstrapped = true;
    final startedAt = DateTime.now();
    const minSplash = Duration(milliseconds: 1400);
    try {
      final session = await _repo.loadSession();
      if (session == null) {
        final elapsed = DateTime.now().difference(startedAt);
        if (elapsed < minSplash) await Future.delayed(minSplash - elapsed);
        state = state.copyWith(loading: false, isAuthenticated: false, error: null);
        _ref.read(currentAccessTokenProvider.notifier).state = null;
        try {
          _msgSub?.cancel();
        } catch (_) {}
        _msgSub = null;
        return;
      }

      // Keep the session stored; user can unlock via Face ID from Login screen.
      final elapsed = DateTime.now().difference(startedAt);
      if (elapsed < minSplash) await Future.delayed(minSplash - elapsed);
      state = state.copyWith(loading: false, isAuthenticated: false, error: null);
      _ref.read(currentAccessTokenProvider.notifier).state = null;
    } catch (_) {
      // Never keep the app stuck on splash/loading.
      state = state.copyWith(loading: false, isAuthenticated: false, error: null);
      _ref.read(currentAccessTokenProvider.notifier).state = null;
    }
  }

  Future<void> biometricLogin() async {
    // Called from Login screen when user taps FaceID button.
    state = state.copyWith(loading: true, error: null);
    final session = await _repo.loadSession();
    if (session == null) {
      state = state.copyWith(loading: false, error: 'Nenhuma sessão salva');
      return;
    }
    final biometric = _ref.read(biometricAuthServiceProvider);
    final available = await biometric.isAvailable();
    if (!available) {
      state = state.copyWith(loading: false, error: 'Face ID/biometria não disponível');
      return;
    }
    final ok = await biometric.authenticate(reason: 'Use o Face ID/biometria para entrar no TR - Multichat');
    if (!ok) {
      state = state.copyWith(loading: false, error: null);
      return;
    }
    await _applySession(session);
  }

  Future<void> _applySession(
    (AuthUser, String, String) session, {
    DateTime? startedAt,
    Duration? minSplash,
  }) async {
    final user = session.$1;
    final at = session.$2;
    final rt = session.$3;
    _ref.read(currentAccessTokenProvider.notifier).state = at;
    if (startedAt != null && minSplash != null) {
      final elapsed = DateTime.now().difference(startedAt);
      if (elapsed < minSplash) await Future.delayed(minSplash - elapsed);
    }
    state = state.copyWith(
      loading: false,
      isAuthenticated: true,
      user: user,
      accessToken: at,
      refreshToken: rt,
      error: null,
    );
    // Notifications infra (local) - warm up asynchronously (avoid startup crashes).
    try {
      Future.microtask(() async {
        try {
          await _ref.read(localNotificationsProvider).warmup();
        } catch (_) {}
      });
    } catch (_) {}
    // Connect socket after restoring session
    try {
      await _ref.read(socketBootstrapProvider.future);
      final socket = _ref.read(socketClientProvider);
      if (user.companyId > 0) {
        socket.joinChatBox(user.companyId);
        socket.joinNotification(user.companyId);
      }
    } catch (_) {}
    _bindGlobalMessageNotifications(user.companyId);
  }

  Future<void> login({required String email, required String password}) async {
    state = state.copyWith(loading: true, error: null);
    try {
      final session = await _repo.login(email: email, password: password);
      await _applySession(session);
    } catch (e) {
      state = state.copyWith(loading: false, error: 'Falha no login');
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    _ref.read(currentAccessTokenProvider.notifier).state = null;
    try {
      _msgSub?.cancel();
    } catch (_) {}
    _msgSub = null;
    state = state.copyWith(
      loading: false,
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    );
  }

  @override
  void dispose() {
    try {
      _msgSub?.cancel();
    } catch (_) {}
    _msgSub = null;
    super.dispose();
  }
}

