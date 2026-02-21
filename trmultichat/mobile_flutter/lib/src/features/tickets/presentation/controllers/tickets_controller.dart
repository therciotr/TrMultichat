import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/notifications/notifications_providers.dart';
import '../../../../core/socket/socket_client.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../dashboard/presentation/providers/dashboard_providers.dart';
import '../../data/datasources/tickets_remote_datasource.dart';
import '../../data/dto/ticket_dto.dart';
import '../../domain/entities/ticket.dart';
import '../state/tickets_state.dart';

class TicketsController extends StateNotifier<TicketsState> {
  final TicketsRemoteDataSource _remote;
  final Ref _ref;
  final SocketClient _socket;
  StreamSubscription? _subTicket;
  StreamSubscription? _subMsg;
  StreamSubscription? _subSocketRecreated;
  Timer? _syncDebounce;
  bool _syncing = false;
  bool _disposed = false;

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
    if (_disposed) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final list = await _remote.list(status: state.status, pageNumber: 1, searchParam: state.search);
      if (_disposed) return;
      state = state.copyWith(loading: false, items: list, error: null);
    } catch (_) {
      if (_disposed) return;
      state = state.copyWith(loading: false, error: 'Falha ao carregar tickets');
    }
  }

  void _scheduleSync() {
    if (_disposed) return;
    _syncDebounce?.cancel();
    _syncDebounce = Timer(const Duration(milliseconds: 500), () async {
      if (_disposed || _syncing) return;
      _syncing = true;
      try {
        await refresh();
        if (_disposed) return;
        _ref.invalidate(dashboardCountersProvider);
        _ref.invalidate(dashboardCountersTodayProvider);
      } finally {
        _syncing = false;
      }
    });
  }

  DateTime? _safeParseDate(String? raw, DateTime? fallback) {
    final dt = raw == null ? null : DateTime.tryParse(raw);
    return dt ?? fallback;
  }

  void _sortByUpdatedDesc(List<Ticket> items) {
    items.sort(
      (a, b) => (b.updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0))
          .compareTo(a.updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0)),
    );
  }

  bool _matchesCurrentStatus(String rawStatus) {
    return rawStatus.trim().toLowerCase() == state.status.trim().toLowerCase();
  }

  void _upsertTicketFromSocketMap(Map<String, dynamic> raw) {
    final id = int.tryParse(raw['id']?.toString() ?? '') ?? 0;
    if (id <= 0) return;
    final cur = state.items;
    final idx = cur.indexWhere((t) => t.id == id);
    if (idx >= 0) {
      final item = cur[idx];
      final nextItem = item.copyWith(
        status: raw['status']?.toString(),
        lastMessage: raw['lastMessage']?.toString() ?? item.lastMessage,
        updatedAt: _safeParseDate(raw['updatedAt']?.toString(), item.updatedAt),
      );
      final next = [...cur];
      next[idx] = nextItem;
      _sortByUpdatedDesc(next);
      if (_disposed) return;
      state = state.copyWith(items: next);
      return;
    }

    // If full ticket payload arrives, include it immediately when it belongs
    // to current status instead of waiting for periodic refresh.
    final status = raw['status']?.toString() ?? '';
    if (status.isNotEmpty && _matchesCurrentStatus(status)) {
      try {
        final parsed = TicketDto.fromJson(raw);
        final next = [parsed, ...cur];
        _sortByUpdatedDesc(next);
        if (_disposed) return;
        state = state.copyWith(items: next);
      } catch (_) {}
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
      if (_disposed) return;
      try {
        if (payload['action']?.toString() != 'update') return;
        final tk = (payload['ticket'] as Map?)?.cast<String, dynamic>();
        if (tk == null) return;
        _upsertTicketFromSocketMap(tk);
        // Always sync with backend to reflect status changes (pending/open/closed)
        // and cross-device updates where the ticket is not in the local filtered list.
        _scheduleSync();
      } catch (_) {}
    });

    // Also react to messages (some deployments may not emit full ticket updates for inbound messages)
    final msgEvent = 'company-$companyId-appMessage';
    _subMsg?.cancel();
    _subMsg = _socket.on<Map<String, dynamic>>(msgEvent, (data) {
      if (data is Map) return data.cast<String, dynamic>();
      return <String, dynamic>{};
    }).listen((payload) {
      if (_disposed) return;
      try {
        if (payload['action']?.toString() != 'create') return;
        final rawTicket = (payload['ticket'] as Map?)?.cast<String, dynamic>();
        if (rawTicket != null) {
          _upsertTicketFromSocketMap(rawTicket);
        }
        final msg = (payload['message'] as Map?)?.cast<String, dynamic>();
        if (msg != null) {
          final ticketId = int.tryParse(msg['ticketId']?.toString() ?? '') ?? 0;
          if (ticketId > 0) {
            final body = (msg['body']?.toString() ?? '').trim();
            final createdAt = msg['createdAt']?.toString();
            final cur = state.items;
            final idx = cur.indexWhere((t) => t.id == ticketId);
            if (idx >= 0) {
              final item = cur[idx];
              final nextItem = item.copyWith(
                lastMessage: body.isEmpty ? item.lastMessage : body,
                updatedAt: _safeParseDate(createdAt, item.updatedAt),
              );
              final next = [...cur];
              next[idx] = nextItem;
              _sortByUpdatedDesc(next);
              if (_disposed) return;
              state = state.copyWith(items: next);
            }
          }
        }
        _scheduleSync();
      } catch (_) {}
    });

    _subSocketRecreated?.cancel();
    _subSocketRecreated = _socket.socketRecreatedStream.listen((_) {
      if (_disposed) return;
      _bindSocket();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    try {
      _subTicket?.cancel();
    } catch (_) {}
    try {
      _subMsg?.cancel();
    } catch (_) {}
    try {
      _subSocketRecreated?.cancel();
    } catch (_) {}
    try {
      _syncDebounce?.cancel();
    } catch (_) {}
    super.dispose();
  }
}

