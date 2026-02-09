import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../data/datasources/agenda_remote_datasource.dart';
import '../controllers/agenda_controller.dart';
import '../state/agenda_state.dart';

final agendaRemoteDataSourceProvider = Provider<AgendaRemoteDataSource>((ref) {
  return AgendaRemoteDataSource(ref.watch(dioProvider));
});

final agendaControllerProvider = StateNotifierProvider<AgendaController, AgendaState>((ref) {
  return AgendaController(ref.watch(agendaRemoteDataSourceProvider));
});

