import '../../domain/entities/chat_message.dart';

class ChatState {
  static const _unset = Object();

  final bool loading;
  final List<ChatMessage> messages;
  final bool hasMore;
  final bool uploading;
  final String? uploadFileName;
  final int? uploadFileIndex; // 1-based
  final int? uploadFileTotal;
  final double? uploadProgress; // 0..1
  final String? error;

  const ChatState({
    required this.loading,
    required this.messages,
    required this.hasMore,
    required this.uploading,
    required this.uploadFileName,
    required this.uploadFileIndex,
    required this.uploadFileTotal,
    required this.uploadProgress,
    required this.error,
  });

  factory ChatState.initial() => const ChatState(
        loading: true,
        messages: [],
        hasMore: false,
        uploading: false,
        uploadFileName: null,
        uploadFileIndex: null,
        uploadFileTotal: null,
        uploadProgress: null,
        error: null,
      );

  ChatState copyWith({
    bool? loading,
    List<ChatMessage>? messages,
    bool? hasMore,
    bool? uploading,
    Object? uploadFileName = _unset,
    Object? uploadFileIndex = _unset,
    Object? uploadFileTotal = _unset,
    Object? uploadProgress = _unset,
    String? error,
  }) {
    return ChatState(
      loading: loading ?? this.loading,
      messages: messages ?? this.messages,
      hasMore: hasMore ?? this.hasMore,
      uploading: uploading ?? this.uploading,
      uploadFileName: identical(uploadFileName, _unset) ? this.uploadFileName : (uploadFileName as String?),
      uploadFileIndex: identical(uploadFileIndex, _unset) ? this.uploadFileIndex : (uploadFileIndex as int?),
      uploadFileTotal: identical(uploadFileTotal, _unset) ? this.uploadFileTotal : (uploadFileTotal as int?),
      uploadProgress: identical(uploadProgress, _unset) ? this.uploadProgress : (uploadProgress as double?),
      error: error,
    );
  }
}

