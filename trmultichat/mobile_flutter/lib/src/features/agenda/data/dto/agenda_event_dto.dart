import '../../domain/entities/agenda_event.dart';

class AgendaEventDto {
  static AgendaEvent fromJson(Map<String, dynamic> json) {
    final start = DateTime.tryParse(json['startAt']?.toString() ?? '') ?? DateTime.now();
    final end = DateTime.tryParse(json['endAt']?.toString() ?? '') ?? start.add(const Duration(hours: 1));
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

