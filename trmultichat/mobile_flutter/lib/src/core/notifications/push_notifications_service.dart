import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'local_notifications_service.dart';

class PushNotificationsService {
  PushNotificationsService(this._dio, this._localNotifications);

  final Dio _dio;
  final LocalNotificationsService _localNotifications;

  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<RemoteMessage>? _foregroundMsgSub;
  bool _initialized = false;
  bool _firebaseReady = false;

  Future<void> initializeForAuthenticatedUser() async {
    if (_initialized) return;
    if (!Platform.isIOS && !Platform.isAndroid) return;

    if (!_firebaseReady) {
      try {
        await Firebase.initializeApp();
        _firebaseReady = true;
      } catch (_) {
        // App build may not have Firebase config yet; keep local notifications alive.
        return;
      }
    }

    final messaging = FirebaseMessaging.instance;
    try {
      await messaging.requestPermission(alert: true, badge: true, sound: true, provisional: false);
    } catch (_) {}
    try {
      await messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    } catch (_) {}

    _tokenRefreshSub ??= messaging.onTokenRefresh.listen((token) {
      unawaited(_syncToken(token));
    });
    _foregroundMsgSub ??= FirebaseMessaging.onMessage.listen((message) {
      unawaited(_showForegroundNotification(message));
    });

    try {
      final token = await messaging.getToken();
      if (token != null && token.trim().isNotEmpty) {
        await _syncToken(token);
      }
    } catch (_) {}

    _initialized = true;
  }

  Future<void> unregisterCurrentToken() async {
    if (!Platform.isIOS && !Platform.isAndroid) return;
    if (!_firebaseReady) {
      try {
        await Firebase.initializeApp();
        _firebaseReady = true;
      } catch (_) {
        return;
      }
    }
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.trim().isEmpty) return;
      await _dio.delete(
        '/devices/push-token',
        data: <String, dynamic>{'token': token},
      );
    } catch (_) {}
  }

  Future<void> _syncToken(String token) async {
    final normalized = token.trim();
    if (normalized.isEmpty) return;
    try {
      await _dio.post(
        '/devices/push-token',
        data: <String, dynamic>{
          'token': normalized,
          'platform': Platform.isIOS ? 'ios' : (Platform.isAndroid ? 'android' : 'unknown'),
        },
      );
    } catch (_) {}
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    try {
      final title = (message.notification?.title ?? message.data['title'] ?? '').toString().trim();
      final body = (message.notification?.body ?? message.data['body'] ?? '').toString().trim();
      if (title.isEmpty && body.isEmpty) return;
      await _localNotifications.show(
        title: title.isNotEmpty ? title : 'Nova mensagem',
        body: body.isNotEmpty ? body : 'Nova mensagem recebida',
        payload: 'ticket:${message.data['ticketId'] ?? ''}',
      );
    } catch (_) {}
  }

  void dispose() {
    try {
      _tokenRefreshSub?.cancel();
    } catch (_) {}
    try {
      _foregroundMsgSub?.cancel();
    } catch (_) {}
    _tokenRefreshSub = null;
    _foregroundMsgSub = null;
    _initialized = false;
  }
}
