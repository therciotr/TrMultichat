import 'package:equatable/equatable.dart';

class Announcement extends Equatable {
  final int id;
  final String title;
  final String text;
  final String? senderName;
  final DateTime createdAt;
  final int repliesCount;

  const Announcement({
    required this.id,
    required this.title,
    required this.text,
    required this.senderName,
    required this.createdAt,
    required this.repliesCount,
  });

  @override
  List<Object?> get props => [id, title, text, senderName, createdAt, repliesCount];
}

