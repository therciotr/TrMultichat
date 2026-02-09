import 'package:equatable/equatable.dart';

class ChatMessage extends Equatable {
  final String id;
  final int ticketId;
  final bool fromMe;
  final String body;
  final DateTime createdAt;
  final String? mediaType;
  final String? mediaUrl;
  final bool pending; // optimistic
  final String? error;

  const ChatMessage({
    required this.id,
    required this.ticketId,
    required this.fromMe,
    required this.body,
    required this.createdAt,
    this.mediaType,
    this.mediaUrl,
    this.pending = false,
    this.error,
  });

  ChatMessage copyWith({
    String? id,
    String? body,
    DateTime? createdAt,
    String? mediaType,
    String? mediaUrl,
    bool? pending,
    String? error,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      ticketId: ticketId,
      fromMe: fromMe,
      body: body ?? this.body,
      createdAt: createdAt ?? this.createdAt,
      mediaType: mediaType ?? this.mediaType,
      mediaUrl: mediaUrl ?? this.mediaUrl,
      pending: pending ?? this.pending,
      error: error,
    );
  }

  @override
  List<Object?> get props => [id, ticketId, fromMe, body, createdAt, mediaType, mediaUrl, pending, error];
}

