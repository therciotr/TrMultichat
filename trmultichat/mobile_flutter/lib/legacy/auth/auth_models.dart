class AuthUser {
  final int id;
  final String name;
  final String email;
  final int companyId; // tenantId/companyId in backend
  final String profile;

  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.companyId,
    required this.profile,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      companyId: int.tryParse((json['companyId'] ?? json['tenantId'])?.toString() ?? '') ?? 0,
      profile: json['profile']?.toString() ?? (json['admin'] == true ? 'admin' : 'user'),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'companyId': companyId,
        'profile': profile,
      };
}

class AuthSession {
  final AuthUser user;
  final String accessToken;
  final String refreshToken;

  const AuthSession({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
  });
}

