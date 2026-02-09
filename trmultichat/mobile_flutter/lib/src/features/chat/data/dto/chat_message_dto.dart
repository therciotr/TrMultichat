import '../../domain/entities/chat_message.dart';

class ChatMessageDto {
  static ChatMessage fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id']?.toString() ?? '',
      ticketId: int.tryParse(json['ticketId']?.toString() ?? '') ?? 0,
      fromMe: json['fromMe'] == true,
      body: json['body']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      mediaType: json['mediaType']?.toString(),
      mediaUrl: json['mediaUrl']?.toString(),
      pending: false,
      error: null,
    );
  }
}

