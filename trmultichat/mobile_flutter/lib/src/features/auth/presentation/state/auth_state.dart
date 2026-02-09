import '../../domain/entities/auth_user.dart';

class AuthState {
  final bool loading;
  final bool isAuthenticated;
  final AuthUser? user;
  final String? accessToken;
  final String? refreshToken;
  final String? error;

  const AuthState({
    required this.loading,
    required this.isAuthenticated,
    required this.user,
    required this.accessToken,
    required this.refreshToken,
    required this.error,
  });

  factory AuthState.initial() => const AuthState(
        loading: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        error: null,
      );

  AuthState copyWith({
    bool? loading,
    bool? isAuthenticated,
    AuthUser? user,
    String? accessToken,
    String? refreshToken,
    String? error,
  }) {
    return AuthState(
      loading: loading ?? this.loading,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      error: error,
    );
  }
}

