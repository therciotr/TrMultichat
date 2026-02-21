import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../di/core_providers.dart';
import 'local_notifications_service.dart';
import 'push_notifications_service.dart';

final localNotificationsProvider = Provider<LocalNotificationsService>((ref) {
  final svc = LocalNotificationsService();
  // Lazy init; call init on demand
  return svc;
});

final pushNotificationsProvider = Provider<PushNotificationsService>((ref) {
  final svc = PushNotificationsService(
    ref.read(dioProvider),
    ref.read(localNotificationsProvider),
  );
  ref.onDispose(svc.dispose);
  return svc;
});

