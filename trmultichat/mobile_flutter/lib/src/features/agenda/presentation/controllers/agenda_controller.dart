import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/agenda_remote_datasource.dart';
import '../state/agenda_state.dart';

class AgendaController extends StateNotifier<AgendaState> {
  final AgendaRemoteDataSource _remote;
  AgendaController(this._remote) : super(AgendaState.initial()) {
    refresh();
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final list = await _remote.list();
      state = state.copyWith(loading: false, items: list, error: null);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao carregar agenda');
    }
  }
}

