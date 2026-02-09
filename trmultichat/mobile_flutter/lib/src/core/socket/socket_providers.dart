import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../di/core_providers.dart';
import '../env/app_env.dart';
import 'socket_client.dart';

final socketClientProvider = Provider<SocketClient>((ref) {
  final base = AppEnv.baseUrl();
  return SocketClient(baseUrl: base);
});

final socketBootstrapProvider = FutureProvider<void>((ref) async {
  final token = ref.watch(currentAccessTokenProvider);
  final socket = ref.watch(socketClientProvider);
  await socket.connect(jwt: token);
});

