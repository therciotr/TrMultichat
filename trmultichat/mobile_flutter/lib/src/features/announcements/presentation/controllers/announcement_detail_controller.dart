import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/announcements_remote_datasource.dart';
import '../state/announcement_detail_state.dart';

class AnnouncementDetailController extends StateNotifier<AnnouncementDetailState> {
  final AnnouncementsRemoteDataSource _remote;
  final int id;
  CancelToken? _cancelToken;

  AnnouncementDetailController(this._remote, this.id) : super(AnnouncementDetailState.initial()) {
    refresh();
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final a = await _remote.getById(id);
      final replies = await _remote.getReplies(id);
      state = state.copyWith(loading: false, announcement: a, replies: replies, error: null);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao carregar comunicado');
    }
  }

  Future<void> send(
    String text, {
    String? filePath,
    String? fileName,
    String? mimeType,
  }) async {
    final t = text.trim();
    final hasFile = filePath != null && filePath.trim().isNotEmpty;
    if (t.isEmpty && !hasFile) return;
    _cancelToken?.cancel('new_upload');
    _cancelToken = hasFile ? CancelToken() : null;
    state = state.copyWith(
      sending: true,
      uploadFileName: hasFile ? fileName : null,
      uploadProgress: hasFile ? 0 : null,
    );
    try {
      if (hasFile) {
        await _remote.postReplyWithFile(
          id,
          text: t,
          filePath: filePath!,
          fileName: (fileName ?? 'arquivo').trim().isEmpty ? 'arquivo' : fileName!,
          mimeType: mimeType,
          cancelToken: _cancelToken,
          onProgress: (sent, total) {
            if (total <= 0) return;
            final p = (sent / total).clamp(0, 1);
            state = state.copyWith(sending: true, uploadProgress: p);
          },
        );
      } else {
        await _remote.postReply(id, text: t);
      }
      final replies = await _remote.getReplies(id);
      state = state.copyWith(sending: false, uploadFileName: null, uploadProgress: null, replies: replies);
    } catch (e) {
      final cancelled = e is DioException && CancelToken.isCancel(e);
      state = state.copyWith(
        sending: false,
        uploadFileName: null,
        uploadProgress: null,
        error: cancelled ? 'Envio cancelado' : 'Falha ao enviar resposta',
      );
    } finally {
      _cancelToken = null;
    }
  }

  void cancelUpload() {
    try {
      _cancelToken?.cancel('user_cancel');
    } catch (_) {}
  }
}

