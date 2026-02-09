import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/socket/socket_providers.dart';
import '../../data/datasources/tickets_remote_datasource.dart';
import '../controllers/tickets_controller.dart';
import '../state/tickets_state.dart';

final ticketsRemoteDataSourceProvider = Provider<TicketsRemoteDataSource>((ref) {
  return TicketsRemoteDataSource(ref.watch(dioProvider));
});

final ticketsControllerProvider = StateNotifierProvider<TicketsController, TicketsState>((ref) {
  ref.watch(socketBootstrapProvider);
  return TicketsController(ref.watch(ticketsRemoteDataSourceProvider), ref, ref.watch(socketClientProvider));
});

