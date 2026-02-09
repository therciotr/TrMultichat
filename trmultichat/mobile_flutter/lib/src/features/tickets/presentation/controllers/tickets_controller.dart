import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/notifications/notifications_providers.dart';
import '../../../../core/socket/socket_client.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/tickets_remote_datasource.dart';
import '../state/tickets_state.dart';

class TicketsController extends StateNotifier<TicketsState> {
  final TicketsRemoteDataSource _remote;
  final Ref _ref;
  final SocketClient _socket;
  StreamSubscription? _subTicket;
  StreamSubscription? _subMsg;

  TicketsController(this._remote, this._ref, this._socket) : super(TicketsState.initial()) {
    // Default status for the "home" is open (latest tickets)
    refresh();
    _bindSocket();
  }

  void setStatus(String status) {
    state = state.copyWith(status: status);
    refresh();
  }

  void setSearch(String v) {
    state = state.copyWith(search: v);
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final list = await _remote.list(status: state.status, pageNumber: 1, searchParam: state.search);
      state = state.copyWith(loading: false, items: list, error: null);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao carregar tickets');
    }
  }

  void _bindSocket() {
    final auth = _ref.read(authControllerProvider);
    final companyId = auth.user?.companyId ?? 0;
    if (companyId <= 0) return;

    final eventName = 'company-$companyId-ticket';
    _subTicket?.cancel();
    _subTicket = _socket.on<Map<String, dynamic>>(eventName, (data) {
      if (data is Map) return data.cast<String, dynamic>();
      return <String, dynamic>{};
    }).listen((payload) {
      try {
        if (payload['action']?.toString() != 'update') return;
        final tk = (payload['ticket'] as Map?)?.cast<String, dynamic>();
        if (tk == null) return;
        final id = int.tryParse(tk['id']?.toString() ?? '') ?? 0;
        if (id <= 0) return;
        final last = tk['lastMessage']?.toString();
        final updatedAt = tk['updatedAt']?.toString();

        final cur = state.items;
        final idx = cur.indexWhere((t) => t.id == id);
        if (idx < 0) return;
        final item = cur[idx];
        final nextItem = item.copyWith(
          lastMessage: last ?? item.lastMessage,
          updatedAt: updatedAt != null ? DateTime.tryParse(updatedAt) : item.updatedAt,
        );
        final next = [...cur];
        next[idx] = nextItem;
        // Keep "latest" ordering roughly by updatedAt
        next.sort((a, b) => (b.updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0)).compareTo(a.updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0)));
        state = state.copyWith(items: next);
      } catch (_) {}
    });

    // Also react to messages (some deployments may not emit full ticket updates for inbound messages)
    final msgEvent = 'company-$companyId-appMessage';
    _subMsg?.cancel();
    _subMsg = _socket.on<Map<String, dynamic>>(msgEvent, (data) {
      if (data is Map) return data.cast<String, dynamic>();
      return <String, dynamic>{};
    }).listen((payload) {
      try {
        if (payload['action']?.toString() != 'create') return;
        final msg = (payload['message'] as Map?)?.cast<String, dynamic>();
        if (msg == null) return;
        final ticketId = int.tryParse(msg['ticketId']?.toString() ?? '') ?? 0;
        if (ticketId <= 0) return;
        final body = (msg['body']?.toString() ?? '').trim();
        final createdAt = msg['createdAt']?.toString();
        final fromMe = msg['fromMe'] == true;

        final cur = state.items;
        final idx = cur.indexWhere((t) => t.id == ticketId);
        if (idx < 0) return;
        final item = cur[idx];
        final nextItem = item.copyWith(
          lastMessage: body.isEmpty ? item.lastMessage : body,
          updatedAt: createdAt != null ? DateTime.tryParse(createdAt) : item.updatedAt,
        );
        final next = [...cur];
        next[idx] = nextItem;
        next.sort((a, b) => (b.updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0)).compareTo(a.updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0)));
        state = state.copyWith(items: next);

        // Local notification is handled globally in AuthController (so it works in any tab).
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    try {
      _subTicket?.cancel();
    } catch (_) {}
    try {
      _subMsg?.cancel();
    } catch (_) {}
    super.dispose();
  }
}

