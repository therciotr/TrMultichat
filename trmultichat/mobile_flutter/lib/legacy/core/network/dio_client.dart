import 'package:dio/dio.dart';

import '../config/env.dart';
import '../errors/app_exception.dart';

class DioClient {
  final Dio dio;

  DioClient._(this.dio);

  factory DioClient({
    required bool isDebug,
    String? accessToken,
  }) {
    final d = Dio(
      BaseOptions(
        baseUrl: Env.baseUrl(isDebug: isDebug),
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 30),
        headers: {
          if (accessToken != null && accessToken.isNotEmpty) 'Authorization': 'Bearer $accessToken',
        },
      ),
    );

    d.interceptors.add(
      InterceptorsWrapper(
        onError: (e, handler) {
          final status = e.response?.statusCode;
          final msg = (e.response?.data is Map && (e.response?.data as Map).containsKey('message'))
              ? String((e.response?.data as Map)['message'])
              : (e.message ?? 'Erro de rede');
          handler.reject(
            DioException(
              requestOptions: e.requestOptions,
              response: e.response,
              error: AppException(msg, statusCode: status, raw: e),
              type: e.type,
            ),
          );
        },
      ),
    );

    return DioClient._(d);
  }
}

