import '../../domain/entities/announcement.dart';

class AnnouncementDto {
  static Announcement fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: (json['id'] as num?)?.toInt() ?? 0,
      title: (json['title'] as String?) ?? '',
      text: (json['text'] as String?) ?? '',
      senderName: json['senderName'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      repliesCount: (json['repliesCount'] as num?)?.toInt() ?? 0,
    );
  }
}

