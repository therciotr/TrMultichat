import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart';

import '../dto/chat_message_dto.dart';
import '../../domain/entities/chat_message.dart';
import '../../../../core/network/progress.dart';

class ChatRemoteDataSource {
  final Dio _dio;
  ChatRemoteDataSource(this._dio);

  Future<(List<ChatMessage> messages, bool hasMore)> getMessages({
    required int ticketId,
    int pageNumber = 1,
  }) async {
    final res = await _dio.get('/messages/$ticketId', queryParameters: {'pageNumber': pageNumber});
    final data = (res.data as Map).cast<String, dynamic>();
    final list = (data['messages'] as List? ?? const []).cast<dynamic>();
    final msgs = list.map((e) => ChatMessageDto.fromJson((e as Map).cast<String, dynamic>())).toList();
    final hasMore = data['hasMore'] == true;
    return (msgs, hasMore);
  }

  /// POST /messages/:ticketId
  /// - text: JSON { body }
  /// - media: multipart/form-data with fields { body } and file(s) key "file"
  Future<void> sendText({required int ticketId, required String body}) async {
    // Some backends mount multipart middleware on this route; using FormData
    // keeps it compatible for both text-only and media messages.
    final form = FormData.fromMap({'body': body});
    await _dio.post('/messages/$ticketId', data: form);
  }

  Future<void> sendMedia({
    required int ticketId,
    required String body,
    String? filePath,
    List<int>? fileBytes,
    required String fileName,
    String? mimeType,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  }) async {
    final mf = () async {
      if (filePath != null && filePath.trim().isNotEmpty) {
        return MultipartFile.fromFile(
          filePath,
          filename: fileName,
          contentType: mimeType != null ? MediaType.parse(mimeType) : null,
        );
      }
      final bytes = fileBytes;
      if (bytes != null && bytes.isNotEmpty) {
        return MultipartFile.fromBytes(
          bytes,
          filename: fileName,
          contentType: mimeType != null ? MediaType.parse(mimeType) : null,
        );
      }
      throw ArgumentError('Missing filePath/fileBytes');
    }();
    final form = FormData.fromMap({
      'body': body,
      'file': await mf,
    });
    await _dio.post(
      '/messages/$ticketId',
      data: form,
      cancelToken: cancelToken,
      onSendProgress: onProgress == null ? null : (sent, total) => onProgress(sent, total),
    );
  }

  Future<void> sendMediaBatch({
    required int ticketId,
    required String body,
    required List<({String? path, List<int>? bytes, String name, String? mimeType})> files,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  }) async {
    if (files.isEmpty) return;
    final multipart = <MultipartFile>[];
    for (final f in files) {
      if (f.path != null && f.path!.trim().isNotEmpty) {
        multipart.add(
          await MultipartFile.fromFile(
            f.path!,
            filename: f.name,
            contentType: f.mimeType != null ? MediaType.parse(f.mimeType!) : null,
          ),
        );
        continue;
      }
      final bytes = f.bytes;
      if (bytes != null && bytes.isNotEmpty) {
        multipart.add(
          MultipartFile.fromBytes(
            bytes,
            filename: f.name,
            contentType: f.mimeType != null ? MediaType.parse(f.mimeType!) : null,
          ),
        );
      }
    }
    if (multipart.isEmpty) return;
    final form = FormData.fromMap({
      'body': body,
      'file': multipart,
    });
    await _dio.post(
      '/messages/$ticketId',
      data: form,
      cancelToken: cancelToken,
      onSendProgress: onProgress == null ? null : (sent, total) => onProgress(sent, total),
    );
  }

  /// POST /tickets/:ticketId/email
  /// Backend uses company SMTP settings and sends a premium HTML email.
  Future<void> sendTicketEmail({
    required int ticketId,
    required String toEmail,
    required String subject,
    required String message,
    required List<({String name, String? mimeType, String? path, List<int>? bytes})> files,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  }) async {
    if (files.isEmpty) {
      throw ArgumentError('files is required');
    }
    final multipart = <MultipartFile>[];
    for (final f in files) {
      if (f.path != null && f.path!.trim().isNotEmpty) {
        multipart.add(
          await MultipartFile.fromFile(
            f.path!,
            filename: f.name,
            contentType: f.mimeType != null ? MediaType.parse(f.mimeType!) : null,
          ),
        );
        continue;
      }
      final bytes = f.bytes;
      if (bytes != null && bytes.isNotEmpty) {
        multipart.add(
          MultipartFile.fromBytes(
            bytes,
            filename: f.name,
            contentType: f.mimeType != null ? MediaType.parse(f.mimeType!) : null,
          ),
        );
      }
    }
    if (multipart.isEmpty) {
      throw ArgumentError('No valid file paths/bytes');
    }
    final form = FormData.fromMap({
      'toEmail': toEmail,
      'subject': subject,
      'message': message,
      'file': multipart,
    });
    await _dio.post(
      '/tickets/$ticketId/email',
      data: form,
      cancelToken: cancelToken,
      onSendProgress: onProgress == null ? null : (sent, total) => onProgress(sent, total),
    );
  }
}

