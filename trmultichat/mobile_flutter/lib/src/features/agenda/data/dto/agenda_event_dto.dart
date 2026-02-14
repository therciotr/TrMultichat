import '../../domain/entities/agenda_event.dart';

class AgendaEventDto {
  static AgendaEvent fromJson(Map<String, dynamic> json) {
    final parsedStart = DateTime.tryParse(json['startAt']?.toString() ?? '');
    final parsedEnd = DateTime.tryParse(json['endAt']?.toString() ?? '');
    final startRaw = parsedStart ?? DateTime.now();
    final start = startRaw.isUtc ? startRaw.toLocal() : startRaw;
    final endRaw = parsedEnd ?? start.add(const Duration(hours: 1));
    final end = endRaw.isUtc ? endRaw.toLocal() : endRaw;
    final title = (json['title'] as String?) ?? '';
    return AgendaEvent(
      id: json['id']?.toString() ?? '',
      seriesId: json['seriesId']?.toString() ?? (json['id']?.toString() ?? ''),
      title: title.trim().isEmpty ? 'Evento' : title.trim(),
      startAt: start,
      endAt: end,
      allDay: json['allDay'] == true,
      location: json['location']?.toString(),
      color: json['color']?.toString(),
    );
  }
}

