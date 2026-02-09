import 'package:equatable/equatable.dart';

class TicketContact extends Equatable {
  final int id;
  final String name;
  final String number;
  final String? profilePicUrl;

  const TicketContact({required this.id, required this.name, required this.number, this.profilePicUrl});

  @override
  List<Object?> get props => [id, name, number, profilePicUrl];
}

class TicketQueue extends Equatable {
  final int id;
  final String name;
  final String? color;

  const TicketQueue({required this.id, required this.name, this.color});

  @override
  List<Object?> get props => [id, name, color];
}

class Ticket extends Equatable {
  final int id;
  final String status;
  final String? lastMessage;
  final DateTime? updatedAt;
  final TicketContact? contact;
  final TicketQueue? queue;

  const Ticket({
    required this.id,
    required this.status,
    this.lastMessage,
    this.updatedAt,
    this.contact,
    this.queue,
  });

  Ticket copyWith({
    String? status,
    String? lastMessage,
    DateTime? updatedAt,
    TicketContact? contact,
    TicketQueue? queue,
  }) {
    return Ticket(
      id: id,
      status: status ?? this.status,
      lastMessage: lastMessage ?? this.lastMessage,
      updatedAt: updatedAt ?? this.updatedAt,
      contact: contact ?? this.contact,
      queue: queue ?? this.queue,
    );
  }

  @override
  List<Object?> get props => [id, status, lastMessage, updatedAt, contact, queue];
}

