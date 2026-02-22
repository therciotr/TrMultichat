import 'package:dio/dio.dart';
import '../../../../core/network/progress.dart';

import '../../domain/entities/agenda_event.dart';
import '../../domain/entities/agenda_attachment.dart';
import '../dto/agenda_event_dto.dart';
import 'package:http_parser/http_parser.dart';

class AgendaRemoteDataSource {
  final Dio _dio;
  AgendaRemoteDataSource(this._dio);

  Future<List<AgendaEvent>> list({
    DateTime? dateFrom,
    DateTime? dateTo,
    int? userId,
  }) async {
    final from = dateFrom ?? DateTime.now().subtract(const Duration(days: 7));
    final to = dateTo ?? DateTime.now().add(const Duration(days: 30));
    final res = await _dio.get(
      '/agenda/events',
      queryParameters: {
        'dateFrom': from.toUtc().toIso8601String(),
        'dateTo': to.toUtc().toIso8601String(),
        if (userId != null && userId > 0) 'userId': userId,
      },
    );
    final data = (res.data as Map).cast<String, dynamic>();
    final records = (data['records'] as List? ?? const []).cast<dynamic>();
    return records
        .map((e) => AgendaEventDto.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<Map<String, dynamic>>> listUsers() async {
    final res = await _dio.get('/users/list');
    final data = res.data;
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList();
    }
    return const <Map<String, dynamic>>[];
  }

  Future<AgendaEvent> createEvent({
    required String title,
    String? description,
    required DateTime startAt,
    required DateTime endAt,
    bool allDay = false,
    String? location,
    String? color,
    String recurrenceType = 'none',
    int recurrenceInterval = 1,
    DateTime? recurrenceUntil,
    List<Map<String, dynamic>>? reminders,
    int? userId,
    bool notify = false,
  }) async {
    final payload = <String, dynamic>{
      'title': title.trim(),
      if ((description ?? '').trim().isNotEmpty)
        'description': description!.trim(),
      'startAt': startAt.toUtc().toIso8601String(),
      'endAt': endAt.toUtc().toIso8601String(),
      'allDay': allDay,
      'location': (location ?? '').trim(),
      if ((color ?? '').trim().isNotEmpty) 'color': color!.trim(),
      'recurrenceType': recurrenceType,
      'recurrenceInterval': recurrenceInterval,
      'recurrenceUntil': recurrenceUntil?.toUtc().toIso8601String(),
      'reminders': reminders ?? const <Map<String, dynamic>>[],
      'notify': notify,
      if (userId != null && userId > 0) 'userId': userId,
    };
    final res = await _dio.post('/agenda/events', data: payload);
    final data = (res.data as Map).cast<String, dynamic>();
    return AgendaEventDto.fromJson(data);
  }

  Future<void> deleteEvent(String eventId) async {
    final id = eventId.trim();
    if (id.isEmpty) return;
    await _dio.delete('/agenda/events/$id');
  }

  Future<List<AgendaAttachment>> listAttachments(String eventId) async {
    final res = await _dio.get('/agenda/events/$eventId/attachments');
    final data = (res.data as Map).cast<String, dynamic>();
    final records = (data['records'] as List? ?? const []).cast<dynamic>();
    return records.map((e) {
      final m = (e as Map).cast<String, dynamic>();
      return AgendaAttachment(
        id: m['id']?.toString() ?? '',
        filePath: m['filePath']?.toString() ?? '',
        fileName: m['fileName']?.toString() ?? '',
        fileType: m['fileType']?.toString(),
        fileSize: (m['fileSize'] as num?)?.toInt(),
      );
    }).toList();
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
      onSendProgress:
          onProgress == null ? null : (sent, total) => onProgress(sent, total),
    );
  }
}
