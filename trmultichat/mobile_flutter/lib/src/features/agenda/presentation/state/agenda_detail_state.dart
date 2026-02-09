import '../../domain/entities/agenda_event.dart';
import '../../domain/entities/agenda_attachment.dart';

class AgendaDetailState {
  static const _unset = Object();

  final bool loading;
  final AgendaEvent event;
  final List<AgendaAttachment> attachments;
  final bool uploading;
  final String? uploadFileName;
  final double? uploadProgress; // 0..1
  final String? error;

  const AgendaDetailState({
    required this.loading,
    required this.event,
    required this.attachments,
    required this.uploading,
    required this.uploadFileName,
    required this.uploadProgress,
    required this.error,
  });

  factory AgendaDetailState.initial(AgendaEvent ev) => AgendaDetailState(
        loading: true,
        event: ev,
        attachments: const [],
        uploading: false,
        uploadFileName: null,
        uploadProgress: null,
        error: null,
      );

  AgendaDetailState copyWith({
    bool? loading,
    AgendaEvent? event,
    List<AgendaAttachment>? attachments,
    bool? uploading,
    Object? uploadFileName = _unset,
    Object? uploadProgress = _unset,
    String? error,
  }) {
    return AgendaDetailState(
      loading: loading ?? this.loading,
      event: event ?? this.event,
      attachments: attachments ?? this.attachments,
      uploading: uploading ?? this.uploading,
      uploadFileName: identical(uploadFileName, _unset) ? this.uploadFileName : (uploadFileName as String?),
      uploadProgress: identical(uploadProgress, _unset) ? this.uploadProgress : (uploadProgress as double?),
      error: error,
    );
  }
}

