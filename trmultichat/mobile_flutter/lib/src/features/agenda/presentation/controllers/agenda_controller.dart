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

  Future<bool> createEvent({
    required String title,
    required DateTime startAt,
    required DateTime endAt,
    bool allDay = false,
    String? location,
    String? color,
  }) async {
    final trimmed = title.trim();
    if (trimmed.isEmpty) {
      state = state.copyWith(error: 'Informe o título do evento');
      return false;
    }
    if (!endAt.isAfter(startAt)) {
      state =
          state.copyWith(error: 'Data/hora final deve ser maior que a inicial');
      return false;
    }

    state = state.copyWith(loading: true, error: null);
    try {
      await _remote.createEvent(
        title: trimmed,
        startAt: startAt,
        endAt: endAt,
        allDay: allDay,
        location: location,
        color: color,
      );
      final list = await _remote.list();
      state = state.copyWith(loading: false, items: list, error: null);
      return true;
    } catch (e) {
      state = state.copyWith(loading: false, error: 'Falha ao criar evento');
      return false;
    }
  }
}
