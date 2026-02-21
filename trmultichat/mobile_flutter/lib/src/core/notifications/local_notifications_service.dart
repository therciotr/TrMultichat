import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class LocalNotificationsService {
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;
  bool _permissionsRequested = false;
  int _notifSeq = 0;

  Future<void> init() async {
    if (_initialized) return;

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const settings = InitializationSettings(android: android, iOS: ios);

    await _plugin.initialize(settings);
    _initialized = true;
  }

  Future<void> requestPermissions() async {
    if (_permissionsRequested) return;
    var grantedAny = false;
    try {
      final darwin = _plugin.resolvePlatformSpecificImplementation<DarwinFlutterLocalNotificationsPlugin>();
      final granted = await darwin?.requestPermissions(alert: true, badge: true, sound: true);
      if (granted == true) grantedAny = true;
    } catch (_) {}
    try {
      // Fallback for environments exposing only iOS-specific implementation.
      final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
      final granted = await ios?.requestPermissions(alert: true, badge: true, sound: true);
      if (granted == true) grantedAny = true;
    } catch (_) {}
    // Keep trying on later calls when permission was not granted yet.
    _permissionsRequested = grantedAny;
  }

  Future<void> warmup() async {
    await init();
    await requestPermissions();
  }

  Future<void> show({
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_initialized) {
      await init();
    }
    // Ensure we requested sound permission at least once.
    await requestPermissions();

    const androidDetails = AndroidNotificationDetails(
      'trmultichat_messages',
      'Mensagens',
      channelDescription: 'Notificações de novas mensagens',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
      sound: 'default',
    );

    const details = NotificationDetails(android: androidDetails, iOS: iosDetails);
    final id = (DateTime.now().microsecondsSinceEpoch + (_notifSeq++ % 997)) & 0x7fffffff;

    await _plugin.show(
      id,
      title,
      body,
      details,
      payload: payload,
    );
  }
}

