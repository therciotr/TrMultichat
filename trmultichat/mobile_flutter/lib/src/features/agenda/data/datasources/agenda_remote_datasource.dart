import 'package:dio/dio.dart';
import '../../../../core/network/progress.dart';

import '../../domain/entities/agenda_event.dart';
import '../../domain/entities/agenda_attachment.dart';
import '../dto/agenda_event_dto.dart';
import 'package:http_parser/http_parser.dart';

class AgendaRemoteDataSource {
  final Dio _dio;
  AgendaRemoteDataSource(this._dio);

  Future<List<AgendaEvent>> list({DateTime? dateFrom, DateTime? dateTo}) async {
    final from = dateFrom ?? DateTime.now().subtract(const Duration(days: 7));
    final to = dateTo ?? DateTime.now().add(const Duration(days: 30));
    final res = await _dio.get(
      '/agenda/events',
      queryParameters: {
        'dateFrom': from.toUtc().toIso8601String(),
        'dateTo': to.toUtc().toIso8601String(),
      },
    );
    final data = (res.data as Map).cast<String, dynamic>();
    final records = (data['records'] as List? ?? const []).cast<dynamic>();
    return records.map((e) => AgendaEventDto.fromJson((e as Map).cast<String, dynamic>())).toList();
  }

  Future<List<AgendaAttachment>> listAttachments(String eventId) async {
    final res = await _dio.get('/agenda/events/$eventId/attachments');
    final data = (res.data as Map).cast<String, dynamic>();
    final records = (data['records'] as List? ?? const []).cast<dynamic>();
    return records
        .map((e) {
          final m = (e as Map).cast<String, dynamic>();
          return AgendaAttachment(
            id: m['id']?.toString() ?? '',
            filePath: m['filePath']?.toString() ?? '',
            fileName: m['fileName']?.toString() ?? '',
            fileType: m['fileType']?.toString(),
            fileSize: (m['fileSize'] as num?)?.toInt(),
          );
        })
        .toList();
  }

  Future<void> uploadAttachment({
    required String eventId,
    required String filePath,
    required String fileName,
    String? mimeType,
    UploadProgress? onProgress,
    CancelToken? cancelToken,
  }) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        filePath,
        filename: fileName,
        contentType: mimeType != null ? MediaType.parse(mimeType) : null,
      ),
    });
    await _dio.post(
      '/agenda/events/$eventId/attachments',
      data: form,
      cancelToken: cancelToken,
      onSendProgress: onProgress == null ? null : (sent, total) => onProgress(sent, total),
    );
  }
}

