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
    required String filePath,
    required String fileName,
    String? mimeType,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  }) async {
    final form = FormData.fromMap({
      'text': text,
      'file': await MultipartFile.fromFile(
        filePath,
        filename: fileName,
        contentType: mimeType != null ? MediaType.parse(mimeType) : null,
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

