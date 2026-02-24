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
  StreamSubscription? _socketRecreatedSub;
  Timer? _notifPollTimer;
  final Map<int, DateTime> _knownTicketUpdates = <int, DateTime>{};
  final Map<int, String> _knownTicketFingerprints = <int, String>{};
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
        if (msg == null) {
          // Some backend flows emit ticket-only updates. Poll once to avoid
          // losing iOS notifications when message payload is partial.
          unawaited(_pollTicketNotifications());
          return;
        }
        final fromMe = _isTruthy(msg['fromMe']);
        if (fromMe) return;
        final body = _notificationBodyFromMessage(msg);
        final contactName = ((msg['contact'] as Map?)?['name']?.toString() ?? '').trim();
        final contactNameFallback = (msg['contactName']?.toString() ?? '').trim();
        final title = contactName.isNotEmpty
            ? contactName
            : (contactNameFallback.isNotEmpty ? contactNameFallback : 'Nova mensagem');
        unawaited(
          _showLocalNotification(
            title: title,
            body: body,
            payload: 'ticket:${msg['ticketId'] ?? ''}',
          ),
        );
      } catch (_) {}
    });
  }

  bool _isTruthy(dynamic v) {
    if (v == true) return true;
    final s = (v?.toString() ?? '').trim().toLowerCase();
    return s == '1' || s == 'true' || s == 'yes';
  }

  DateTime? _parseDate(dynamic raw) {
    final s = (raw?.toString() ?? '').trim();
    if (s.isEmpty) return null;
    return DateTime.tryParse(s);
  }

  String _ticketTitle(Map<String, dynamic> t) {
    final c = (t['contact'] as Map?)?.cast<String, dynamic>();
    final name = (c?['name']?.toString() ?? '').trim();
    if (name.isNotEmpty) return name;
    final id = int.tryParse(t['id']?.toString() ?? '') ?? 0;
    return id > 0 ? 'Ticket #$id' : 'Nova mensagem';
  }

  String _notificationBodyFromMessage(Map<String, dynamic> msg) {
    final rawBody = (msg['body']?.toString() ?? '').trim();
    if (rawBody.isNotEmpty) return rawBody;
    final altBody = (msg['message']?.toString() ?? '').trim();
    if (altBody.isNotEmpty) return altBody;
    final textBody = (msg['text']?.toString() ?? '').trim();
    if (textBody.isNotEmpty) return textBody;
    final mediaUrl = (msg['mediaUrl']?.toString() ?? '').trim();
    final mediaType = (msg['mediaType']?.toString() ?? '').trim().toLowerCase();
    if (mediaUrl.isNotEmpty) {
      if (mediaType.startsWith('image')) return 'Nova imagem recebida';
      if (mediaType.startsWith('audio')) return 'Novo audio recebido';
      if (mediaType.startsWith('video')) return 'Novo video recebido';
      return 'Novo arquivo recebido';
    }
    // Some backend payloads are partial; never skip the alert entirely.
    return 'Nova mensagem recebida';
  }

  Future<void> _showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    try {
      await _ref.read(localNotificationsProvider).show(
            title: title,
            body: body,
            payload: payload,
          );
    } catch (_) {
      // Retry after warmup to recover from init/permission races in iOS builds.
      try {
        await _ref.read(localNotificationsProvider).warmup();
        await _ref.read(localNotificationsProvider).show(
              title: title,
              body: body,
              payload: payload,
            );
      } catch (_) {}
    }
  }

  Future<void> _pollTicketNotifications() async {
    final dio = _ref.read(dioProvider);
    const statuses = ['open', 'pending'];
    const maxPagesPerStatus = 5;
    final latest = <int, ({DateTime at, String msg, String title, String fp})>{};

    for (final st in statuses) {
      for (var page = 1; page <= maxPagesPerStatus; page++) {
        try {
          final res = await dio.get('/tickets', queryParameters: {'status': st, 'pageNumber': page});
          final data = res.data;
          if (data is! List || data.isEmpty) break;
          for (final row in data) {
            if (row is! Map) continue;
            final t = row.cast<String, dynamic>();
            final id = int.tryParse(t['id']?.toString() ?? '') ?? 0;
            if (id <= 0) continue;
            final at = _parseDate(t['updatedAt']);
            if (at == null) continue;
            final msg = (t['lastMessage']?.toString() ?? '').trim();
            final title = _ticketTitle(t);
            final fp = '${at.toIso8601String()}|$msg';
            final existing = latest[id];
            if (existing == null || at.isAfter(existing.at)) {
              latest[id] = (at: at, msg: msg, title: title, fp: fp);
            }
          }
        } catch (_) {
          break;
        }
      }
    }

    if (latest.isEmpty) return;

    // First poll only seeds baseline to avoid burst notifications.
    if (_knownTicketUpdates.isEmpty) {
      for (final e in latest.entries) {
        _knownTicketUpdates[e.key] = e.value.at;
        _knownTicketFingerprints[e.key] = e.value.fp;
      }
      return;
    }

    for (final e in latest.entries) {
      final old = _knownTicketUpdates[e.key];
      final oldFp = _knownTicketFingerprints[e.key];
      final changedAt = old != null && e.value.at.isAfter(old);
      final changedPayload = oldFp != null && oldFp != e.value.fp;
      if (old != null && (changedAt || changedPayload)) {
        final body = e.value.msg.isNotEmpty ? e.value.msg : 'Nova atividade no atendimento';
        try {
          await _showLocalNotification(
            title: e.value.title,
            body: body,
            payload: 'ticket:${e.key}',
          );
        } catch (_) {}
      }
      _knownTicketUpdates[e.key] = e.value.at;
      _knownTicketFingerprints[e.key] = e.value.fp;
    }
  }

  void _stopNotifPolling() {
    try {
      _notifPollTimer?.cancel();
    } catch (_) {}
    _notifPollTimer = null;
  }

  void _startNotifPolling() {
    _notifPollTimer ??= Timer.periodic(const Duration(seconds: 4), (_) {
      _pollTicketNotifications();
    });
  }

  void _bindNotificationFallbackPolling() {
    _startNotifPolling();
    // Trigger one immediate cycle on bind to reduce time-to-first-alert.
    _pollTicketNotifications();
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
        try {
          _socketRecreatedSub?.cancel();
        } catch (_) {}
        _stopNotifPolling();
        _knownTicketUpdates.clear();
        _knownTicketFingerprints.clear();
        _msgSub = null;
        _socketRecreatedSub = null;
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
        try {
          await _ref.read(pushNotificationsProvider).initializeForAuthenticatedUser();
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
    _bindNotificationFallbackPolling();
    try {
      _socketRecreatedSub?.cancel();
    } catch (_) {}
    _socketRecreatedSub = _ref.read(socketClientProvider).socketRecreatedStream.listen((_) {
      final cid = state.user?.companyId ?? user.companyId;
      _bindGlobalMessageNotifications(cid);
    });
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
    try {
      await _ref.read(pushNotificationsProvider).unregisterCurrentToken();
    } catch (_) {}
    try {
      await _repo.logout();
    } catch (_) {
      // Even if secure storage/keychain fails, force local logout state.
    }
    _ref.read(currentAccessTokenProvider.notifier).state = null;
    try {
      _msgSub?.cancel();
    } catch (_) {}
    try {
      _socketRecreatedSub?.cancel();
    } catch (_) {}
    _stopNotifPolling();
    _knownTicketUpdates.clear();
    _knownTicketFingerprints.clear();
    _msgSub = null;
    _socketRecreatedSub = null;
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
    try {
      _socketRecreatedSub?.cancel();
    } catch (_) {}
    _stopNotifPolling();
    _knownTicketUpdates.clear();
    _knownTicketFingerprints.clear();
    _msgSub = null;
    _socketRecreatedSub = null;
    super.dispose();
  }
}

