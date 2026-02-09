import '../../domain/entities/announcement_reply.dart';

class AnnouncementReplyDto {
  static AnnouncementReply fromJson(Map<String, dynamic> json) {
    return AnnouncementReply(
      id: json['id']?.toString() ?? '',
      text: (json['text'] as String?) ?? '',
      mediaPath: json['mediaPath'] as String?,
      mediaName: json['mediaName'] as String?,
      mediaType: json['mediaType'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      userId: (json['userId'] as num?)?.toInt() ?? 0,
      userName: (json['userName'] as String?) ?? '',
    );
  }
}

