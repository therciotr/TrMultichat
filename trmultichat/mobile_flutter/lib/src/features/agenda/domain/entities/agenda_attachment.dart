import 'package:equatable/equatable.dart';

class AgendaAttachment extends Equatable {
  final String id;
  final String filePath;
  final String fileName;
  final String? fileType;
  final int? fileSize;

  const AgendaAttachment({
    required this.id,
    required this.filePath,
    required this.fileName,
    required this.fileType,
    required this.fileSize,
  });

  @override
  List<Object?> get props => [id, filePath, fileName, fileType, fileSize];
}

