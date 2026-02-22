import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/agenda_remote_datasource.dart';
import '../../domain/entities/agenda_event.dart';
import '../state/agenda_detail_state.dart';

class AgendaDetailController extends StateNotifier<AgendaDetailState> {
  final AgendaRemoteDataSource _remote;
  final String eventId; // seriesId
  CancelToken? _cancelToken;

  AgendaDetailController(this._remote, AgendaEvent ev)
      : eventId = ev.seriesId,
        super(AgendaDetailState.initial(ev)) {
    refresh();
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final list = await _remote.listAttachments(eventId);
      state = state.copyWith(loading: false, attachments: list);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao carregar anexos');
    }
  }

  Future<void> upload({required String filePath, required String fileName, String? mimeType}) async {
    _cancelToken?.cancel('new_upload');
    _cancelToken = CancelToken();
    state = state.copyWith(uploading: true, uploadFileName: fileName, uploadProgress: 0, error: null);
    try {
      await _remote.uploadAttachment(
        eventId: eventId,
        filePath: filePath,
        fileName: fileName,
        mimeType: mimeType,
        cancelToken: _cancelToken,
        onProgress: (sent, total) {
          if (total <= 0) return;
          final p = (sent / total).clamp(0, 1);
          state = state.copyWith(uploading: true, uploadProgress: p);
        },
      );
      final list = await _remote.listAttachments(eventId);
      state = state.copyWith(uploading: false, uploadFileName: null, uploadProgress: null, attachments: list);
    } catch (e) {
      final cancelled = e is DioException && CancelToken.isCancel(e);
      state = state.copyWith(
        uploading: false,
        uploadFileName: null,
        uploadProgress: null,
        error: cancelled ? 'Envio cancelado' : 'Falha ao enviar anexo',
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

  Future<bool> deleteEvent() async {
    final id = eventId.trim();
    if (id.isEmpty) {
      state = state.copyWith(error: 'Evento inválido para exclusão');
      return false;
    }

    state = state.copyWith(loading: true, error: null);
    try {
      await _remote.deleteEvent(id);
      state = state.copyWith(loading: false);
      return true;
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao excluir evento');
      return false;
    }
  }
}

