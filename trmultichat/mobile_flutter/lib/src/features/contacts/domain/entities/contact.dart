import 'package:equatable/equatable.dart';

class Contact extends Equatable {
  final int id;
  final String name;
  final String number;
  final String? profilePicUrl;

  const Contact({required this.id, required this.name, required this.number, this.profilePicUrl});

  @override
  List<Object?> get props => [id, name, number, profilePicUrl];
}

