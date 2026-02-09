import '../../domain/entities/contact.dart';

class ContactDto {
  static Contact fromJson(Map<String, dynamic> json) {
    return Contact(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: (json['name'] as String?) ?? '',
      number: (json['number'] as String?) ?? '',
      profilePicUrl: json['profilePicUrl'] as String?,
    );
  }
}

