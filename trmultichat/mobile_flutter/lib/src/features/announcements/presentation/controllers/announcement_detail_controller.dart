import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/announcements_remote_datasource.dart';
import '../state/announcement_detail_state.dart';

class AnnouncementDetailController extends StateNotifier<AnnouncementDetailState> {
  final AnnouncementsRemoteDataSource _remote;
  final int id;
  CancelToken? _cancelToken;
  Timer? _pollTimer;
  bool _disposed = false;

  AnnouncementDetailController(this._remote, this.id) : super(AnnouncementDetailState.initial()) {
    refresh();
    _startPolling();
  }

  Future<void> refresh() async {
    if (_disposed) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final a = await _remote.getById(id);
      final replies = await _remote.getReplies(id);
      if (_disposed) return;
      state = state.copyWith(loading: false, announcement: a, replies: replies, error: null);
    } catch (_) {
      if (_disposed) return;
      state = state.copyWith(loading: false, error: 'Falha ao carregar comunicado');
    }
  }

  Future<bool> send(
    String text, {
    String? filePath,
    List<int>? fileBytes,
    Stream<List<int>>? fileStream,
    int? fileSize,
    String? fileName,
    String? mimeType,
  }) async {
    if (_disposed) return false;
    final t = text.trim();
    final hasPath = filePath != null && filePath.trim().isNotEmpty;
    final hasBytes = fileBytes != null && fileBytes.isNotEmpty;
    final hasStream = fileStream != null;
    final hasFile = hasPath || hasBytes || hasStream;
    if (t.isEmpty && !hasFile) return false;
    _cancelToken?.cancel('new_upload');
    _cancelToken = hasFile ? CancelToken() : null;
    state = state.copyWith(
      sending: true,
      uploadFileName: hasFile ? fileName : null,
      uploadProgress: hasFile ? 0.0 : null,
    );
    try {
      if (hasFile) {
        await _remote.postReplyWithFile(
          id,
          text: t,
          filePath: hasPath ? filePath : null,
          fileBytes: hasBytes ? fileBytes : null,
          fileStream: (!hasPath && !hasBytes) ? fileStream : null,
          fileSize: (!hasPath && !hasBytes) ? fileSize : null,
          fileName: (fileName ?? 'arquivo').trim().isEmpty ? 'arquivo' : fileName!,
          mimeType: mimeType,
          cancelToken: _cancelToken,
          onProgress: (sent, total) {
            if (total <= 0) return;
            final p = (sent / total).clamp(0, 1);
            if (_disposed) return;
            state = state.copyWith(sending: true, uploadProgress: p);
          },
        );
      } else {
        await _remote.postReply(id, text: t);
      }
      final replies = await _remote.getReplies(id);
      if (_disposed) return false;
      state = state.copyWith(sending: false, uploadFileName: null, uploadProgress: null, replies: replies);
      return true;
    } catch (e) {
      final cancelled = e is DioException && CancelToken.isCancel(e);
      String message = cancelled ? 'Envio cancelado' : 'Falha ao enviar resposta';
      if (!cancelled && e is DioException) {
        final status = e.response?.statusCode;
        final data = e.response?.data;
        if (status != null) {
          message = 'Falha ao enviar resposta (HTTP $status)';
        }
        final textData = data?.toString().trim() ?? '';
        if (textData.isNotEmpty && textData.length < 220) {
          message = '$message: $textData';
        }
      }
      if (_disposed) return false;
      state = state.copyWith(
        sending: false,
        uploadFileName: null,
        uploadProgress: null,
        error: message,
      );
      return false;
    } finally {
      _cancelToken = null;
    }
  }

  Future<bool> deleteAnnouncement() async {
    if (_disposed) return false;
    state = state.copyWith(loading: true, error: null);
    try {
      await _remote.delete(id);
      if (_disposed) return false;
      state = state.copyWith(loading: false, error: null);
      return true;
    } catch (_) {
      if (_disposed) return false;
      state = state.copyWith(loading: false, error: 'Falha ao excluir chat interno');
      return false;
    }
  }

  void cancelUpload() {
    try {
      _cancelToken?.cancel('user_cancel');
    } catch (_) {}
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) async {
      await _refreshRepliesSilently();
    });
  }

  Future<void> _refreshRepliesSilently() async {
    if (_disposed || state.loading || state.sending) return;
    try {
      final replies = await _remote.getReplies(id);
      if (_disposed) return;
      state = state.copyWith(replies: replies);
    } catch (_) {
      // Ignore background polling failures.
    }
  }

  @override
  void dispose() {
    _disposed = true;
    try {
      _pollTimer?.cancel();
    } catch (_) {}
    try {
      _cancelToken?.cancel('dispose');
    } catch (_) {}
    super.dispose();
  }
}

