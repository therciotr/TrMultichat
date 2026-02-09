import '../../domain/entities/announcement.dart';
import '../../domain/entities/announcement_reply.dart';

class AnnouncementDetailState {
  static const _unset = Object();

  final bool loading;
  final Announcement? announcement;
  final List<AnnouncementReply> replies;
  final bool sending;
  final String? uploadFileName;
  final double? uploadProgress; // 0..1
  final String? error;

  const AnnouncementDetailState({
    required this.loading,
    required this.announcement,
    required this.replies,
    required this.sending,
    required this.uploadFileName,
    required this.uploadProgress,
    required this.error,
  });

  factory AnnouncementDetailState.initial() => const AnnouncementDetailState(
        loading: true,
        announcement: null,
        replies: [],
        sending: false,
        uploadFileName: null,
        uploadProgress: null,
        error: null,
      );

  AnnouncementDetailState copyWith({
    bool? loading,
    Announcement? announcement,
    List<AnnouncementReply>? replies,
    bool? sending,
    Object? uploadFileName = _unset,
    Object? uploadProgress = _unset,
    String? error,
  }) {
    return AnnouncementDetailState(
      loading: loading ?? this.loading,
      announcement: announcement ?? this.announcement,
      replies: replies ?? this.replies,
      sending: sending ?? this.sending,
      uploadFileName: identical(uploadFileName, _unset) ? this.uploadFileName : (uploadFileName as String?),
      uploadProgress: identical(uploadProgress, _unset) ? this.uploadProgress : (uploadProgress as double?),
      error: error,
    );
  }
}

