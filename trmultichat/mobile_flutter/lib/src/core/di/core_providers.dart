import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../env/app_env.dart';
import '../storage/secure_store.dart';

class _TokenRefreshCoordinator {
  Future<void>? _refreshing;

  Future<String?> refreshIfNeeded(Ref ref, {required String baseUrl}) async {
    if (_refreshing != null) {
      await _refreshing;
      return ref.read(currentAccessTokenProvider);
    }

    final store = ref.read(secureStoreProvider);
    final rt = await store.readRefreshToken();
    if (rt == null || rt.trim().isEmpty) return null;

    final completer = Completer<void>();
    _refreshing = completer.future;
    try {
      final refreshDio = Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 20),
          receiveTimeout: const Duration(seconds: 30),
          headers: const {'Accept': 'application/json'},
        ),
      );
      final res = await refreshDio.post('/auth/refresh', data: {'refreshToken': rt});
      final data = (res.data is Map) ? (res.data as Map).cast<String, dynamic>() : <String, dynamic>{};
      final at = (data['accessToken']?.toString() ?? data['token']?.toString() ?? '').trim();
      final newRt = (data['refreshToken']?.toString() ?? '').trim();
      if (at.isEmpty || newRt.isEmpty) return null;

      await store.saveTokens(accessToken: at, refreshToken: newRt);
      ref.read(currentAccessTokenProvider.notifier).state = at;
      return at;
    } catch (_) {
      return null;
    } finally {
      completer.complete();
      _refreshing = null;
    }
  }
}

final _tokenRefreshCoordinatorProvider = Provider<_TokenRefreshCoordinator>((ref) => _TokenRefreshCoordinator());

final flutterSecureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final secureStoreProvider = Provider<SecureStore>((ref) {
  return SecureStore(ref.watch(flutterSecureStorageProvider));
});

bool _isLikelyLocalBaseUrl(String baseUrl) {
  final u = Uri.tryParse(baseUrl.trim());
  final host = (u?.host ?? '').toLowerCase();
  if (host.isEmpty) return false;
  if (host == 'localhost' || host == '127.0.0.1' || host.endsWith('.local')) return true;
  // naive private ranges
  if (host.startsWith('10.') || host.startsWith('192.168.')) return true;
  if (host.startsWith('172.')) {
    final parts = host.split('.');
    if (parts.length >= 2) {
      final second = int.tryParse(parts[1]) ?? -1;
      if (second >= 16 && second <= 31) return true;
    }
  }
  return false;
}

Dio _buildDio(Ref ref, {required String baseUrl}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {'Accept': 'application/json'},
    ),
  );

  // Logger only in debug/profile
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
}

/// Dio fixed to production base URL (useful for fallback).
final prodDioProvider = Provider<Dio>((ref) {
  return _buildDio(ref, baseUrl: AppEnv.prodBaseUrl);
});

final dioProvider = Provider<Dio>((ref) {
  final dio = _buildDio(ref, baseUrl: AppEnv.baseUrl());

  // If running against a local dev API over Wi‑Fi, allow a transparent fallback to production
  // when the local host/IP is unreachable (common when switching to mobile data).
  dio.interceptors.add(
    InterceptorsWrapper(
      onError: (e, handler) async {
        final ro = e.requestOptions;
        final alreadyTried = ro.extra['__fallback_prod_tried__'] == true;
        final base = (ro.baseUrl).trim();
        final shouldTry =
            !alreadyTried &&
            base.isNotEmpty &&
            base != AppEnv.prodBaseUrl &&
            _isLikelyLocalBaseUrl(base) &&
            (e.type == DioExceptionType.connectionError ||
                e.type == DioExceptionType.connectionTimeout ||
                e.type == DioExceptionType.sendTimeout ||
                e.type == DioExceptionType.receiveTimeout ||
                e.type == DioExceptionType.unknown);

        if (!shouldTry) return handler.next(e);

        try {
          final prodDio = ref.read(prodDioProvider);
          final opts = Options(
            method: ro.method,
            headers: ro.headers,
            responseType: ro.responseType,
            contentType: ro.contentType,
            followRedirects: ro.followRedirects,
            validateStatus: ro.validateStatus,
            receiveTimeout: ro.receiveTimeout,
            sendTimeout: ro.sendTimeout,
            extra: {...ro.extra, '__fallback_prod_tried__': true},
          );
          final res = await prodDio.request(
            ro.path,
            data: ro.data,
            queryParameters: ro.queryParameters,
            options: opts,
          );
          return handler.resolve(res);
        } catch (_) {
          return handler.next(e);
        }
      },
    ),
  );

  // Auto-refresh access token when it expires (fixes "Invalid token" mid-upload).
  dio.interceptors.add(
    InterceptorsWrapper(
      onError: (e, handler) async {
        final status = e.response?.statusCode;
        if (status != 401) return handler.next(e);

        final ro = e.requestOptions;
        final alreadyTried = ro.extra['__token_refresh_tried__'] == true;
        final path = ro.path.toLowerCase();
        final isAuthEndpoint = path.contains('/auth/login') || path.contains('/auth/refresh') || path.contains('/auth/refresh_token');
        if (alreadyTried || isAuthEndpoint) return handler.next(e);

        final baseUrl = ro.baseUrl.trim().isEmpty ? AppEnv.baseUrl() : ro.baseUrl.trim();
        final coordinator = ref.read(_tokenRefreshCoordinatorProvider);
        final newAt = await coordinator.refreshIfNeeded(ref, baseUrl: baseUrl);
        if (newAt == null || newAt.trim().isEmpty) return handler.next(e);

        try {
          final newHeaders = <String, dynamic>{...ro.headers, 'Authorization': 'Bearer $newAt'};
          final opts = Options(
            method: ro.method,
            headers: newHeaders,
            responseType: ro.responseType,
            contentType: ro.contentType,
            followRedirects: ro.followRedirects,
            validateStatus: ro.validateStatus,
            receiveTimeout: ro.receiveTimeout,
            sendTimeout: ro.sendTimeout,
            extra: {...ro.extra, '__token_refresh_tried__': true},
          );

          final res = await dio.request(
            ro.path,
            data: ro.data,
            queryParameters: ro.queryParameters,
            options: opts,
          );
          return handler.resolve(res);
        } catch (_) {
          return handler.next(e);
        }
      },
    ),
  );

  return dio;
});

/// In-memory access token cache for interceptors (AuthController updates this).
final currentAccessTokenProvider = StateProvider<String?>((ref) => null);

String encodeJson(Object? v) => jsonEncode(v);

