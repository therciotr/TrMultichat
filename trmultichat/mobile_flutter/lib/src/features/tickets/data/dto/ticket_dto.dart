import '../../domain/entities/ticket.dart';

class TicketDto {
  static Ticket fromJson(Map<String, dynamic> json) {
    final c = (json['contact'] as Map?)?.cast<String, dynamic>();
    final q = (json['queue'] as Map?)?.cast<String, dynamic>();
    return Ticket(
      id: (json['id'] as num?)?.toInt() ?? 0,
      status: (json['status'] as String?) ?? '',
      lastMessage: json['lastMessage'] as String?,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt'].toString()) : null,
      contact: c == null
          ? null
          : TicketContact(
              id: (c['id'] as num?)?.toInt() ?? 0,
              name: (c['name'] as String?) ?? '',
              number: (c['number'] as String?) ?? '',
              profilePicUrl: c['profilePicUrl'] as String?,
            ),
      queue: q == null
          ? null
          : TicketQueue(
              id: (q['id'] as num?)?.toInt() ?? 0,
              name: (q['name'] as String?) ?? '',
              color: q['color'] as String?,
            ),
    );
  }
}

