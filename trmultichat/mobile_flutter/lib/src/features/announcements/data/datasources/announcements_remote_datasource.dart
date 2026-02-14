import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart';

import '../../domain/entities/announcement.dart';
import '../../domain/entities/announcement_reply.dart';
import '../dto/announcement_dto.dart';
import '../dto/announcement_reply_dto.dart';
import '../../../../core/network/progress.dart';

class AnnouncementsRemoteDataSource {
  final Dio _dio;
  AnnouncementsRemoteDataSource(this._dio);

  Future<List<int>> _readAllBytes(Stream<List<int>> stream) async {
    final out = <int>[];
    await for (final chunk in stream) {
      out.addAll(chunk);
    }
    return out;
  }

  Future<(List<Announcement> items, bool hasMore)> list({int pageNumber = 1, String searchParam = ''}) async {
    final res = await _dio.get(
      '/announcements',
      queryParameters: {
        'pageNumber': pageNumber,
        if (searchParam.trim().isNotEmpty) 'searchParam': searchParam.trim(),
      },
    );
    final raw = res.data;
    // Backend shape can vary:
    // - { records: [...] }
    // - { announcements: [...] }
    // - [ ... ]
    late final List<dynamic> records;
    if (raw is List) {
      records = raw;
    } else if (raw is Map) {
      final data = raw.cast<String, dynamic>();
      final r = data['records'];
      final a = data['announcements'];
      if (r is List) {
        records = r;
      } else if (a is List) {
        records = a;
      } else {
        records = const [];
      }
    } else {
      records = const [];
    }
    final items = records.map((e) => AnnouncementDto.fromJson((e as Map).cast<String, dynamic>())).toList();
    // No hasMore provided; infer by limit=50
    final hasMore = items.length == 50;
    return (items, hasMore);
  }

  Future<Announcement> getById(int id) async {
    final res = await _dio.get('/announcements/$id');
    return AnnouncementDto.fromJson((res.data as Map).cast<String, dynamic>());
  }

  Future<void> delete(int id) async {
    await _dio.delete('/announcements/$id');
  }

  Future<Announcement> create({
    required String title,
    required String text,
    int priority = 3,
    bool status = true,
    bool sendToAll = true,
    int? targetUserId,
    bool allowReply = true,
  }) async {
    final payload = <String, dynamic>{
      'title': title.trim(),
      'text': text.trim(),
      'priority': priority,
      'status': status,
      'sendToAll': sendToAll,
      'allowReply': allowReply,
      if (!sendToAll && targetUserId != null && targetUserId > 0)
        'targetUserId': targetUserId,
    };
    final res = await _dio.post('/announcements', data: payload);
    return AnnouncementDto.fromJson((res.data as Map).cast<String, dynamic>());
  }

  Future<List<AnnouncementReply>> getReplies(int id) async {
    final res = await _dio.get('/announcements/$id/replies');
    final data = (res.data as Map).cast<String, dynamic>();
    final records = (data['records'] as List? ?? const []).cast<dynamic>();
    return records.map((e) => AnnouncementReplyDto.fromJson((e as Map).cast<String, dynamic>())).toList();
  }

  Future<void> postReply(int id, {required String text}) async {
    await _dio.post('/announcements/$id/replies', data: {'text': text});
  }

  Future<void> postReplyWithFile(
    int id, {
    required String text,
    required String fileName,
    String? filePath,
    List<int>? fileBytes,
    Stream<List<int>>? fileStream,
    int? fileSize,
    String? mimeType,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  }) async {
    final hasPath = filePath != null && filePath.trim().isNotEmpty;
    final initialHasBytes = fileBytes != null && fileBytes.isNotEmpty;
    final hasStream = fileStream != null;
    if (!hasPath && !initialHasBytes && !hasStream) {
      throw ArgumentError('filePath, fileBytes or fileStream is required');
    }

    List<int>? resolvedBytes = fileBytes;
    Stream<List<int>>? resolvedStream = fileStream;
    int? resolvedStreamSize = fileSize;

    // Some Android providers expose only readStream and omit size.
    // In this case, buffer the stream once and upload bytes.
    if ((resolvedBytes == null || resolvedBytes.isEmpty) &&
        resolvedStream != null &&
        (resolvedStreamSize == null || resolvedStreamSize <= 0)) {
      final buffered = await _readAllBytes(resolvedStream);
      resolvedBytes = buffered.isEmpty ? null : buffered;
      resolvedStream = null;
      resolvedStreamSize = null;
    }

    final hasBytes = resolvedBytes != null && resolvedBytes.isNotEmpty;
    final hasUsableStream =
        resolvedStream != null && resolvedStreamSize != null && resolvedStreamSize > 0;
    final mediaType = mimeType != null ? MediaType.parse(mimeType) : null;
    final form = FormData.fromMap({
      'text': text,
      // Prefer bytes when available. This avoids failures with content://
      // URIs returned by Android file pickers.
      'file': hasBytes
          ? MultipartFile.fromBytes(
              resolvedBytes!,
              filename: fileName,
              contentType: mediaType,
            )
          : hasUsableStream
              ? MultipartFile(
                  resolvedStream!,
                  resolvedStreamSize!,
                  filename: fileName,
                  contentType: mediaType,
                )
          : await MultipartFile.fromFile(
              filePath!,
              filename: fileName,
              contentType: mediaType,
            ),
    });
    await _dio.post(
      '/announcements/$id/replies',
      data: form,
      cancelToken: cancelToken,
      onSendProgress: onProgress == null ? null : (sent, total) => onProgress(sent, total),
    );
  }
}

