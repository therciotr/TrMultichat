import 'package:equatable/equatable.dart';

class AuthUser extends Equatable {
  final int id;
  final String name;
  final String email;
  final int companyId;
  final bool admin;
  final String profile;
  final bool isSuper;

  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.companyId,
    required this.admin,
    required this.profile,
    required this.isSuper,
  });

  @override
  List<Object?> get props => [id, name, email, companyId, admin, profile, isSuper];
}

