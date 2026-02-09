class Contact {
  final int id;
  final String name;
  final String number;
  final String? profilePicUrl;

  const Contact({required this.id, required this.name, required this.number, this.profilePicUrl});

  factory Contact.fromJson(Map<String, dynamic> json) {
    return Contact(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      name: json['name']?.toString() ?? '',
      number: json['number']?.toString() ?? '',
      profilePicUrl: json['profilePicUrl']?.toString(),
    );
  }
}

class QueueInfo {
  final int id;
  final String name;
  final String? color;
  const QueueInfo({required this.id, required this.name, this.color});

  factory QueueInfo.fromJson(Map<String, dynamic> json) {
    return QueueInfo(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      name: json['name']?.toString() ?? '',
      color: json['color']?.toString(),
    );
  }
}

class Ticket {
  final int id;
  final String status;
  final String? lastMessage;
  final String? updatedAt;
  final Contact? contact;
  final QueueInfo? queue;
  final int? unreadMessages;

  const Ticket({
    required this.id,
    required this.status,
    this.lastMessage,
    this.updatedAt,
    this.contact,
    this.queue,
    this.unreadMessages,
  });

  factory Ticket.fromJson(Map<String, dynamic> json) {
    return Ticket(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      status: json['status']?.toString() ?? '',
      lastMessage: json['lastMessage']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
      contact: json['contact'] is Map ? Contact.fromJson((json['contact'] as Map).cast<String, dynamic>()) : null,
      queue: json['queue'] is Map ? QueueInfo.fromJson((json['queue'] as Map).cast<String, dynamic>()) : null,
      unreadMessages: json['unreadMessages'] is num ? (json['unreadMessages'] as num).toInt() : int.tryParse(json['unreadMessages']?.toString() ?? ''),
    );
  }
}

