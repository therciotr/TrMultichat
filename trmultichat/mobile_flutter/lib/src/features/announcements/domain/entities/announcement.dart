import 'package:equatable/equatable.dart';

class Announcement extends Equatable {
  final int id;
  final String title;
  final String text;
  final String? senderName;
  final DateTime createdAt;
  final int repliesCount;
  final int priority;
  final bool status;
  final bool sendToAll;
  final int? targetUserId;
  final bool allowReply;
  final String? mediaName;
  final String? mediaPath;

  const Announcement({
    required this.id,
    required this.title,
    required this.text,
    required this.senderName,
    required this.createdAt,
    required this.repliesCount,
    required this.priority,
    required this.status,
    required this.sendToAll,
    required this.targetUserId,
    required this.allowReply,
    required this.mediaName,
    required this.mediaPath,
  });

  @override
  List<Object?> get props => [
        id,
        title,
        text,
        senderName,
        createdAt,
        repliesCount,
        priority,
        status,
        sendToAll,
        targetUserId,
        allowReply,
        mediaName,
        mediaPath,
      ];
}

