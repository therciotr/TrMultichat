import 'package:dio/dio.dart';

import '../core/errors/app_exception.dart';
import '../core/network/api_endpoints.dart';
import 'auth_models.dart';

class AuthService {
  final Dio _dio;
  AuthService(this._dio);

  Future<AuthSession> login({required String email, required String password}) async {
    try {
      final res = await _dio.post(ApiEndpoints.authLogin, data: {'email': email, 'password': password});
      final data = res.data as Map;
      final user = AuthUser.fromJson((data['user'] as Map).cast<String, dynamic>());
      final at = data['accessToken']?.toString() ?? '';
      final rt = data['refreshToken']?.toString() ?? '';
      if (at.isEmpty || rt.isEmpty) throw const AppException('Token inválido');
      return AuthSession(user: user, accessToken: at, refreshToken: rt);
    } catch (e) {
      if (e is DioException && e.error is AppException) {
        throw e.error as AppException;
      }
      throw AppException('Falha no login', raw: e);
    }
  }

  Future<void> forgotPassword(String email) async {
    try {
      await _dio.post(ApiEndpoints.authForgotPassword, data: {'email': email});
    } catch (e) {
      if (e is DioException && e.error is AppException) throw e.error as AppException;
      throw AppException('Erro ao solicitar recuperação de senha', raw: e);
    }
  }
}

