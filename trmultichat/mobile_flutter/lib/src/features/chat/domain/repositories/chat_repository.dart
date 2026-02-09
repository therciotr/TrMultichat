import '../entities/chat_message.dart';
import '../../../../core/network/progress.dart';
import 'package:dio/dio.dart';

abstract class ChatRepository {
  Future<(List<ChatMessage> messages, bool hasMore)> getMessages({required int ticketId, int pageNumber});
  Future<void> sendText({required int ticketId, required String body});
  Future<void> sendMedia({
    required int ticketId,
    required String body,
    String? filePath,
    List<int>? fileBytes,
    required String fileName,
    String? mimeType,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  });
  Future<void> sendMediaBatch({
    required int ticketId,
    required String body,
    required List<({String? path, List<int>? bytes, String name, String? mimeType})> files,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  });

  Future<void> sendTicketEmail({
    required int ticketId,
    required String toEmail,
    required String subject,
    required String message,
    required List<({String name, String? mimeType, String? path, List<int>? bytes})> files,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  });
}

