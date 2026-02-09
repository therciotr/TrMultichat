import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../env/app_env.dart';
import '../storage/secure_store.dart';

final flutterSecureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final secureStoreProvider = Provider<SecureStore>((ref) {
  return SecureStore(ref.watch(flutterSecureStorageProvider));
});

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppEnv.baseUrl(),
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {'Accept': 'application/json'},
    ),
  );

  // Logger only in debug
  if (bool.fromEnvironment('dart.vm.product') == false) {
    dio.interceptors.add(PrettyDioLogger(requestHeader: true, requestBody: true, responseBody: false, responseHeader: false));
  }

  // Auth header injector (reads from in-memory auth state set by AuthController)
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = ref.read(currentAccessTokenProvider);
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ),
  );

  return dio;
});

/// In-memory access token cache for interceptors (AuthController updates this).
final currentAccessTokenProvider = StateProvider<String?>((ref) => null);

String encodeJson(Object? v) => jsonEncode(v);

