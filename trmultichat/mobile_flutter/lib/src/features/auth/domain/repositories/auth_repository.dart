import '../entities/auth_user.dart';

abstract class AuthRepository {
  Future<(AuthUser user, String accessToken, String refreshToken)> login({
    required String email,
    required String password,
  });

  Future<void> forgotPassword({required String email});
  Future<void> resetPassword({required String token, required String password});

  Future<(AuthUser user, String accessToken, String refreshToken)?> loadSession();
  Future<void> saveSession({required AuthUser user, required String accessToken, required String refreshToken});
  Future<void> logout();
}

