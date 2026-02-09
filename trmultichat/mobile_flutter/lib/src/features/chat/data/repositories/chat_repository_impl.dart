import '../../domain/entities/chat_message.dart';
import '../../domain/repositories/chat_repository.dart';
import '../datasources/chat_remote_datasource.dart';
import '../../../../core/network/progress.dart';
import 'package:dio/dio.dart';

class ChatRepositoryImpl implements ChatRepository {
  final ChatRemoteDataSource _remote;
  ChatRepositoryImpl(this._remote);

  @override
  Future<(List<ChatMessage> messages, bool hasMore)> getMessages({required int ticketId, int pageNumber = 1}) {
    return _remote.getMessages(ticketId: ticketId, pageNumber: pageNumber);
  }

  @override
  Future<void> sendText({required int ticketId, required String body}) => _remote.sendText(ticketId: ticketId, body: body);

  @override
  Future<void> sendMedia({
    required int ticketId,
    required String body,
    String? filePath,
    List<int>? fileBytes,
    required String fileName,
    String? mimeType,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  }) =>
      _remote.sendMedia(
        ticketId: ticketId,
        body: body,
        filePath: filePath,
        fileBytes: fileBytes,
        fileName: fileName,
        mimeType: mimeType,
        onProgress: onProgress,
        cancelToken: cancelToken,
      );

  @override
  Future<void> sendMediaBatch({
    required int ticketId,
    required String body,
    required List<({String? path, List<int>? bytes, String name, String? mimeType})> files,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  }) =>
      _remote.sendMediaBatch(
        ticketId: ticketId,
        body: body,
        files: files,
        onProgress: onProgress,
        cancelToken: cancelToken,
      );
}

