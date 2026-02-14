import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/socket/socket_client.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/agenda_remote_datasource.dart';
import '../state/agenda_state.dart';

class AgendaController extends StateNotifier<AgendaState> {
  final AgendaRemoteDataSource _remote;
  final Ref _ref;
  final SocketClient _socket;
  StreamSubscription? _agendaSub;
  StreamSubscription? _socketRecreatedSub;
  bool _disposed = false;
  int? _selectedUserId;

  AgendaController(this._remote, this._ref, this._socket)
      : super(AgendaState.initial()) {
    refresh();
    _bindSocket();
  }

  Future<void> refresh() async {
    if (_disposed) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final list = await _remote.list(userId: _selectedUserId);
      if (_disposed) return;
      state = state.copyWith(loading: false, items: list, error: null);
    } catch (_) {
      if (_disposed) return;
      state = state.copyWith(loading: false, error: 'Falha ao carregar agenda');
    }
  }

  void setUserFilter(int? userId) {
    _selectedUserId = (userId != null && userId > 0) ? userId : null;
    refresh();
  }

  Future<bool> createEvent({
    required String title,
    String? description,
    required DateTime startAt,
    required DateTime endAt,
    bool allDay = false,
    String? location,
    String? color,
    String recurrenceType = 'none',
    int recurrenceInterval = 1,
    DateTime? recurrenceUntil,
    List<Map<String, dynamic>>? reminders,
    int? userId,
    bool notify = false,
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
        description: description,
        startAt: startAt,
        endAt: endAt,
        allDay: allDay,
        location: location,
        color: color,
        recurrenceType: recurrenceType,
        recurrenceInterval: recurrenceInterval,
        recurrenceUntil: recurrenceUntil,
        reminders: reminders,
        userId: userId,
        notify: notify,
      );
      final list = await _remote.list(userId: _selectedUserId);
      if (_disposed) return false;
      state = state.copyWith(loading: false, items: list, error: null);
      return true;
    } catch (e) {
      if (_disposed) return false;
      state = state.copyWith(loading: false, error: 'Falha ao criar evento');
      return false;
    }
  }

  void _bindSocket() {
    final companyId = _ref.read(authControllerProvider).user?.companyId ?? 0;
    if (companyId <= 0) return;

    final eventName = 'company-$companyId-agenda';
    _agendaSub?.cancel();
    _agendaSub = _socket.on<Map<String, dynamic>>(eventName, (data) {
      if (data is Map) return data.cast<String, dynamic>();
      return <String, dynamic>{};
    }).listen((payload) async {
      if (_disposed) return;
      final action = (payload['action']?.toString() ?? '').trim().toLowerCase();
      if (action != 'create' && action != 'update' && action != 'delete')
        return;
      await refresh();
    });

    _socketRecreatedSub?.cancel();
    _socketRecreatedSub = _socket.socketRecreatedStream.listen((_) {
      if (_disposed) return;
      _bindSocket();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    try {
      _agendaSub?.cancel();
    } catch (_) {}
    try {
      _socketRecreatedSub?.cancel();
    } catch (_) {}
    super.dispose();
  }
}
