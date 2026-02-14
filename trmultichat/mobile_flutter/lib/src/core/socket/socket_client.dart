import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

class SocketClient {
  final String baseUrl;
  io.Socket? _socket;
  final _connected = StreamController<bool>.broadcast();
  final _socketRecreated = StreamController<void>.broadcast();
  String? _jwt;

  int? _pendingChatCompanyId;
  int? _pendingNotificationCompanyId;
  final Set<int> _pendingTickets = <int>{};

  SocketClient({required this.baseUrl});

  bool get isConnected => _socket?.connected == true;
  Stream<bool> get connectedStream => _connected.stream;
  Stream<void> get socketRecreatedStream => _socketRecreated.stream;

  Future<void> connect({String? jwt}) async {
    final nextJwt = jwt?.trim().isEmpty == true ? null : jwt?.trim();
    var recreated = false;

    // If token changed, recreate the socket to update auth headers.
    if (_socket != null && nextJwt != _jwt) {
      _disposeSocketOnly();
      recreated = true;
    }

    if (_socket != null) {
      // Ensure it connects (some configs may not auto-connect).
      try {
        _socket!.connect();
      } catch (_) {}
      return;
    }
    _jwt = nextJwt;

    final opts = io.OptionBuilder()
        // Allow polling fallback (improves iOS reliability on some networks)
        .setTransports(['polling', 'websocket'])
        .enableReconnection()
        .setReconnectionAttempts(999999)
        .setReconnectionDelay(800)
        .setTimeout(20000)
        .build();

    // Attach token (backend may ignore today, but required by spec)
    final headers = <String, dynamic>{};
    if (nextJwt != null && nextJwt.isNotEmpty) {
      headers['Authorization'] = 'Bearer $nextJwt';
      opts['auth'] = {'token': nextJwt};
    }
    if (headers.isNotEmpty) {
      opts['extraHeaders'] = headers;
    }

    final socket = io.io(baseUrl, opts);
    _socket = socket;
    try {
      socket.connect();
    } catch (_) {}

    socket.onConnect((_) {
      _connected.add(true);
      _flushPendingJoins();
    });
    socket.onDisconnect((_) => _connected.add(false));
    socket.onConnectError((_) => _connected.add(false));
    socket.onError((_) => _connected.add(false));
    if (recreated) {
      _socketRecreated.add(null);
    }
  }

  void _flushPendingJoins() {
    final s = _socket;
    if (s == null) return;
    if (_pendingChatCompanyId != null) {
      s.emit('joinChatBox', _pendingChatCompanyId);
    }
    if (_pendingNotificationCompanyId != null) {
      s.emit('joinNotification', _pendingNotificationCompanyId);
    }
    for (final t in _pendingTickets) {
      s.emit('joinTicket', t);
    }
  }

  void _disposeSocketOnly() {
    try {
      _socket?.dispose();
    } catch (_) {}
    _socket = null;
  }

  void dispose() {
    _disposeSocketOnly();
    try {
      _connected.close();
    } catch (_) {}
    try {
      _socketRecreated.close();
    } catch (_) {}
  }

  // Rooms used by backend
  void joinChatBox(int companyId) {
    _pendingChatCompanyId = companyId;
    _socket?.emit('joinChatBox', companyId);
  }

  void joinTicket(int ticketId) {
    _pendingTickets.add(ticketId);
    _socket?.emit('joinTicket', ticketId);
  }

  void joinNotification(int companyId) {
    _pendingNotificationCompanyId = companyId;
    _socket?.emit('joinNotification', companyId);
  }

  Stream<T> on<T>(String event, T Function(dynamic data) mapper) {
    final ctrl = StreamController<T>.broadcast();
    void handler(dynamic data) {
      try {
        ctrl.add(mapper(data));
      } catch (_) {}
    }
    _socket?.on(event, handler);
    ctrl.onCancel = () {
      try {
        _socket?.off(event, handler);
      } catch (_) {}
    };
    return ctrl.stream;
  }
}

