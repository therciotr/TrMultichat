import 'package:dio/dio.dart';

import '../../../../core/di/core_providers.dart';
import '../dto/login_response_dto.dart';

class AuthRemoteDataSource {
  final Dio _dio;
  AuthRemoteDataSource(this._dio);

  Future<LoginResponseDto> login({required String email, required String password}) async {
    final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    return LoginResponseDto.fromJson((res.data as Map).cast<String, dynamic>());
  }

  Future<void> forgotPassword({required String email}) async {
    await _dio.post('/auth/forgot-password', data: {'email': email});
  }

  Future<void> resetPassword({required String token, required String password}) async {
    await _dio.post('/auth/reset-password', data: {'token': token, 'password': password});
  }
}

