import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'local_notifications_service.dart';

final localNotificationsProvider = Provider<LocalNotificationsService>((ref) {
  final svc = LocalNotificationsService();
  // Lazy init; call init on demand
  return svc;
});

