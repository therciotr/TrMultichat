import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

class SocketService {
  final String baseUrl;
  io.Socket? _socket;

  SocketService({required this.baseUrl});

  bool get isConnected => _socket?.connected == true;

  Future<void> connect() async {
    if (_socket != null) return;
    final socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(999999)
          .setReconnectionDelay(800)
          .build(),
    );
    _socket = socket;
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  void joinChatBox(int companyId) => _socket?.emit('joinChatBox', companyId);
  void joinTicket(int ticketId) => _socket?.emit('joinTicket', ticketId);
  void joinNotification(int companyId) => _socket?.emit('joinNotification', companyId);

  Stream<T> on<T>(String event, T Function(dynamic data) mapper) {
    final ctrl = StreamController<T>.broadcast();
    _socket?.on(event, (data) {
      try {
        ctrl.add(mapper(data));
      } catch (_) {}
    });
    ctrl.onCancel = () => _socket?.off(event);
    return ctrl.stream;
  }
}

