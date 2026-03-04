import '../../domain/entities/contact.dart';

class ContactDto {
  static Contact fromJson(Map<String, dynamic> json) {
    final profilePicRaw = json['profilePicUrl'];
    final profilePicUrl = (profilePicRaw == null)
        ? null
        : profilePicRaw.toString().trim().isEmpty
            ? null
            : profilePicRaw.toString();
    return Contact(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: (json['name']?.toString() ?? '').trim(),
      number: (json['number']?.toString() ?? '').trim(),
      profilePicUrl: profilePicUrl,
    );
  }
}
