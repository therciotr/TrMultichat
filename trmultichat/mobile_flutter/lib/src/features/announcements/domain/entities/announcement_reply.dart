import 'package:equatable/equatable.dart';

class AnnouncementReply extends Equatable {
  final String id;
  final String text;
  final String? mediaPath;
  final String? mediaName;
  final String? mediaType;
  final DateTime createdAt;
  final int userId;
  final String userName;

  const AnnouncementReply({
    required this.id,
    required this.text,
    required this.mediaPath,
    required this.mediaName,
    required this.mediaType,
    required this.createdAt,
    required this.userId,
    required this.userName,
  });

  @override
  List<Object?> get props => [id, text, mediaPath, mediaName, mediaType, createdAt, userId, userName];
}

