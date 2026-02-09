import '../../domain/entities/auth_user.dart';

class LoginResponseDto {
  final String accessToken;
  final String refreshToken;
  final AuthUser user;

  const LoginResponseDto({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory LoginResponseDto.fromJson(Map<String, dynamic> json) {
    final u = (json['user'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    return LoginResponseDto(
      accessToken: (json['accessToken'] as String?) ?? (json['token'] as String?) ?? '',
      refreshToken: (json['refreshToken'] as String?) ?? '',
      user: AuthUser(
        id: (u['id'] as num?)?.toInt() ?? 0,
        name: (u['name'] as String?) ?? '',
        email: (u['email'] as String?) ?? '',
        companyId: (u['companyId'] as num?)?.toInt() ?? 0,
        admin: (u['admin'] as bool?) ?? false,
        profile: (u['profile'] as String?) ?? (u['admin'] == true ? 'admin' : 'user'),
        isSuper: (u['super'] as bool?) ?? false,
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'user': {
          'id': user.id,
          'name': user.name,
          'email': user.email,
          'companyId': user.companyId,
          'admin': user.admin,
          'profile': user.profile,
          'super': user.isSuper,
        }
      };
}

