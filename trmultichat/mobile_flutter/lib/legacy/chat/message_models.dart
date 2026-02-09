class ChatMessage {
  final String id;
  final int ticketId;
  final bool fromMe;
  final String body;
  final String? mediaType;
  final String? mediaUrl;
  final String createdAt;

  const ChatMessage({
    required this.id,
    required this.ticketId,
    required this.fromMe,
    required this.body,
    required this.createdAt,
    this.mediaType,
    this.mediaUrl,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id']?.toString() ?? '',
      ticketId: int.tryParse(json['ticketId']?.toString() ?? '') ?? 0,
      fromMe: json['fromMe'] == true,
      body: json['body']?.toString() ?? '',
      mediaType: json['mediaType']?.toString(),
      mediaUrl: json['mediaUrl']?.toString(),
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }
}

class MessagesPage {
  final List<ChatMessage> messages;
  final bool hasMore;
  const MessagesPage({required this.messages, required this.hasMore});
}

