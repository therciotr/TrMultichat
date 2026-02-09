import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/socket/socket_client.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../domain/entities/chat_message.dart';
import '../../domain/repositories/chat_repository.dart';
import '../state/chat_state.dart';

class ChatController extends StateNotifier<ChatState> {
  final Ref _ref;
  final ChatRepository _repo;
  final SocketClient _socket;
  final int ticketId;

  StreamSubscription? _sub;
  StreamSubscription? _connSub;
  Timer? _pollTimer;
  CancelToken? _cancelToken;

  ChatController(this._ref, this._repo, this._socket, {required this.ticketId}) : super(ChatState.initial()) {
    _init();
  }

  Future<void> _init() async {
    await refresh();
    await _bindSocket();
    _bindPollingFallback();
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final (msgs, hasMore) = await _repo.getMessages(ticketId: ticketId, pageNumber: 1);
      state = state.copyWith(loading: false, messages: msgs, hasMore: hasMore, error: null);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao carregar mensagens');
    }
  }

  Future<void> _bindSocket() async {
    final auth = _ref.read(authControllerProvider);
    final companyId = auth.user?.companyId ?? 0;
    final token = auth.accessToken;

    if (companyId <= 0) return;
    await _socket.connect(jwt: token);
    _socket.joinTicket(ticketId);
    _socket.joinChatBox(companyId);
    _socket.joinNotification(companyId);

    final eventName = 'company-$companyId-appMessage';
    _sub?.cancel();
    _sub = _socket.on<Map<String, dynamic>>(eventName, (data) {
      if (data is Map) return data.cast<String, dynamic>();
      return <String, dynamic>{};
    }).listen((payload) {
      try {
        if (payload['action']?.toString() != 'create') return;
        final msgMap = (payload['message'] as Map?)?.cast<String, dynamic>();
        if (msgMap == null) return;
        final incoming = _fromSocketJson(msgMap);
        if (incoming.ticketId != ticketId) return;
        _mergeIncoming(incoming);
      } catch (_) {}
    });
  }

  void _bindPollingFallback() {
    _connSub?.cancel();
    _connSub = _socket.connectedStream.listen((connected) {
      if (connected) {
        _stopPolling();
      } else {
        _startPolling();
      }
    });
    if (!_socket.isConnected) {
      _startPolling();
    }
  }

  void _startPolling() {
    _pollTimer ??= Timer.periodic(const Duration(seconds: 6), (_) async {
      await _silentRefresh();
    });
  }

  void _stopPolling() {
    try {
      _pollTimer?.cancel();
    } catch (_) {}
    _pollTimer = null;
  }

  Future<void> _silentRefresh() async {
    try {
      final (msgs, hasMore) = await _repo.getMessages(ticketId: ticketId, pageNumber: 1);
      // Merge optimistic local messages without duplicating once server version arrives.
      final locals = state.messages.where((m) => m.id.startsWith('local-')).toList();
      final merged = <ChatMessage>[...msgs];

      bool hasEquivalentOnServer(ChatMessage local) {
        // If server already has a fromMe message with same body near the same time, drop local.
        return msgs.any((s) {
          if (!s.fromMe || !local.fromMe) return false;
          if (s.body.trim() != local.body.trim()) return false;
          final dt = s.createdAt.difference(local.createdAt).inSeconds.abs();
          return dt <= 60;
        });
      }

      for (final m in locals) {
        if (m.body.trim().isEmpty) continue;
        if (!hasEquivalentOnServer(m)) {
          merged.add(m);
        }
      }
      merged.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      state = state.copyWith(messages: merged, hasMore: hasMore);
    } catch (_) {
      // ignore in silent polling
    }
  }

  ChatMessage _fromSocketJson(Map<String, dynamic> json) {
    final createdAt = DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now();
    return ChatMessage(
      id: json['id']?.toString() ?? '',
      ticketId: int.tryParse(json['ticketId']?.toString() ?? '') ?? 0,
      fromMe: json['fromMe'] == true,
      body: json['body']?.toString() ?? '',
      createdAt: createdAt,
      mediaType: json['mediaType']?.toString(),
      mediaUrl: json['mediaUrl']?.toString(),
      pending: false,
      error: null,
    );
  }

  void _mergeIncoming(ChatMessage incoming) {
    final cur = state.messages;
    // Dedup by id
    if (cur.any((m) => m.id == incoming.id && m.id.isNotEmpty)) return;

    // Replace optimistic message if body matches and it's recent
    final idx = cur.indexWhere((m) {
      if (!m.pending) return false;
      if (!m.fromMe || !incoming.fromMe) return false;
      if (m.body.trim() != incoming.body.trim()) return false;
      final dt = incoming.createdAt.difference(m.createdAt).inSeconds.abs();
      return dt <= 40;
    });
    if (idx >= 0) {
      final next = [...cur];
      next[idx] = incoming;
      state = state.copyWith(messages: next);
      return;
    }

    state = state.copyWith(messages: [...cur, incoming]);
  }

  Future<void> sendText(String body) async {
    final trimmed = body.trim();
    if (trimmed.isEmpty) return;

    final optimistic = ChatMessage(
      id: 'local-${DateTime.now().microsecondsSinceEpoch}',
      ticketId: ticketId,
      fromMe: true,
      body: trimmed,
      createdAt: DateTime.now(),
      pending: true,
    );
    state = state.copyWith(messages: [...state.messages, optimistic]);

    try {
      await _repo.sendText(ticketId: ticketId, body: trimmed);
      // Final message will arrive via Socket.IO. If not, keep it but mark as delivered-ish.
      _markPendingAsSent(optimistic.id);
    } catch (e) {
      _markPendingAsError(optimistic.id, _humanizeSendError(e));
    }
  }

  Future<void> sendMedia({
    required String body,
    String? filePath,
    List<int>? fileBytes,
    required String fileName,
    String? mimeType,
  }) async {
    final caption = body.trim().isEmpty ? fileName : body.trim();
    final optimistic = ChatMessage(
      id: 'local-${DateTime.now().microsecondsSinceEpoch}',
      ticketId: ticketId,
      fromMe: true,
      body: caption,
      createdAt: DateTime.now(),
      pending: true,
      mediaType: mimeType,
    );
    state = state.copyWith(messages: [...state.messages, optimistic]);

    _cancelToken?.cancel('new_upload');
    _cancelToken = CancelToken();
    state = state.copyWith(
      uploading: true,
      uploadFileName: fileName,
      uploadFileIndex: 1,
      uploadFileTotal: 1,
      uploadProgress: 0,
    );
    try {
      await _repo.sendMedia(
        ticketId: ticketId,
        body: caption,
        filePath: filePath,
        fileBytes: fileBytes,
        fileName: fileName,
        mimeType: mimeType,
        onProgress: (sent, total) {
          if (total <= 0) return;
          final p = (sent / total).clamp(0, 1);
          state = state.copyWith(uploading: true, uploadProgress: p);
        },
        cancelToken: _cancelToken,
      );
      _markPendingAsSent(optimistic.id);
    } catch (e) {
      final cancelled = e is DioException && CancelToken.isCancel(e);
      _markPendingAsError(optimistic.id, cancelled ? 'Envio cancelado' : _humanizeSendError(e));
    } finally {
      _cancelToken = null;
      state = state.copyWith(
        uploading: false,
        uploadFileName: null,
        uploadFileIndex: null,
        uploadFileTotal: null,
        uploadProgress: null,
      );
    }
  }

  Future<void> sendMediaBatch({
    required String body,
    required List<({String? path, List<int>? bytes, String name, String? mimeType})> files,
  }) async {
    if (files.isEmpty) return;

    final captionFirst = body.trim().isEmpty ? files.first.name : body.trim();
    final now = DateTime.now();

    // optimistic bubbles (one per file)
    final optimistic = <ChatMessage>[];
    for (var i = 0; i < files.length; i++) {
      final f = files[i];
      final cap = i == 0 ? captionFirst : f.name;
      optimistic.add(
        ChatMessage(
          id: 'local-${DateTime.now().microsecondsSinceEpoch}-$i',
          ticketId: ticketId,
          fromMe: true,
          body: cap,
          createdAt: now.add(Duration(milliseconds: i)),
          pending: true,
          mediaType: null,
        ),
      );
    }
    state = state.copyWith(messages: [...state.messages, ...optimistic]);

    _cancelToken?.cancel('new_upload');
    _cancelToken = CancelToken();
    state = state.copyWith(
      uploading: true,
      uploadFileName: files.first.name,
      uploadFileIndex: 1,
      uploadFileTotal: files.length,
      uploadProgress: 0,
    );
    try {
      for (var i = 0; i < files.length; i++) {
        final f = files[i];
        final cap = i == 0 ? captionFirst : f.name;
        state = state.copyWith(
          uploading: true,
          uploadFileName: f.name,
          uploadFileIndex: i + 1,
          uploadFileTotal: files.length,
          uploadProgress: 0,
        );

        await _repo.sendMedia(
          ticketId: ticketId,
          body: cap,
          filePath: f.path,
          fileBytes: f.bytes,
          fileName: f.name,
          mimeType: f.mimeType,
          cancelToken: _cancelToken,
          onProgress: (sent, total) {
            if (total <= 0) return;
            final p = (sent / total).clamp(0, 1);
            state = state.copyWith(uploading: true, uploadProgress: p);
          },
        );
        _markPendingAsSent(optimistic[i].id);
      }
    } catch (e) {
      final cancelled = e is DioException && CancelToken.isCancel(e);
      final msg = cancelled ? 'Envio cancelado' : _humanizeSendError(e);

      // mark remaining pending optimistic as error
      for (final m in optimistic.where((m) => m.pending)) {
        _markPendingAsError(m.id, msg);
      }
    } finally {
      _cancelToken = null;
      state = state.copyWith(
        uploading: false,
        uploadFileName: null,
        uploadFileIndex: null,
        uploadFileTotal: null,
        uploadProgress: null,
      );
    }
  }

  String _humanizeSendError(Object e) {
    if (e is DioException) {
      final status = e.response?.statusCode;
      final data = e.response?.data;
      if (data is String) {
        final t = data.trim();
        if (t.isNotEmpty) return t;
      }
      if (data is Map && data['message'] != null) {
        final m = data['message']?.toString().trim();
        if (m != null && m.isNotEmpty) return m;
      }
      if (data is Map && data['error'] != null) {
        final m = data['error']?.toString().trim();
        if (m != null && m.isNotEmpty) return m;
      }
      if (status != null) return 'Falha ao enviar (HTTP $status)';
      final msg = (e.message ?? '').trim();
      if (msg.isNotEmpty) return msg;
      return 'Falha ao enviar';
    }
    return 'Falha ao enviar';
  }

  void cancelUpload() {
    try {
      _cancelToken?.cancel('user_cancel');
    } catch (_) {}
  }

  void _markPendingAsSent(String localId) {
    final cur = state.messages;
    final idx = cur.indexWhere((m) => m.id == localId);
    if (idx < 0) return;
    final next = [...cur];
    next[idx] = next[idx].copyWith(pending: false, error: null);
    state = state.copyWith(messages: next);
  }

  void _markPendingAsError(String localId, String error) {
    final cur = state.messages;
    final idx = cur.indexWhere((m) => m.id == localId);
    if (idx < 0) return;
    final next = [...cur];
    next[idx] = next[idx].copyWith(pending: false, error: error);
    state = state.copyWith(messages: next);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _connSub?.cancel();
    _stopPolling();
    try {
      _cancelToken?.cancel('dispose');
    } catch (_) {}
    super.dispose();
  }
}

