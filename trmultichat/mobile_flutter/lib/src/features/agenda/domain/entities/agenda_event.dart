import 'package:equatable/equatable.dart';

class AgendaEvent extends Equatable {
  final String id;
  final String seriesId;
  final String title;
  final DateTime startAt;
  final DateTime endAt;
  final bool allDay;
  final String? location;
  final String? color;

  const AgendaEvent({
    required this.id,
    required this.seriesId,
    required this.title,
    required this.startAt,
    required this.endAt,
    required this.allDay,
    required this.location,
    required this.color,
  });

  @override
  List<Object?> get props => [id, seriesId, title, startAt, endAt, allDay, location, color];
}

