import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_models.dart';
import '../auth/auth_service.dart';
import '../core/branding/branding_model.dart';
import '../core/branding/branding_service.dart';
import '../core/network/dio_client.dart';
import '../core/storage/secure_storage.dart';

final secureStoreProvider = Provider<SecureStore>((ref) => SecureStore());

final authStateProvider = StateNotifierProvider<AuthStateNotifier, AuthState>((ref) {
  return AuthStateNotifier(ref);
});

class AuthState {
  final AuthSession? session;
  final bool bootstrapped;
  const AuthState({required this.session, required this.bootstrapped});
  factory AuthState.initial() => const AuthState(session: null, bootstrapped: false);
}

class AuthStateNotifier extends StateNotifier<AuthState> {
  final Ref ref;
  AuthStateNotifier(this.ref) : super(AuthState.initial());

  Future<void> bootstrap() async {
    final store = ref.read(secureStoreProvider);
    final at = await store.read(SecureStore.kAccessToken);
    final rt = await store.read(SecureStore.kRefreshToken);
    final userJson = await store.read(SecureStore.kUserJson);
    if (at != null && rt != null && userJson != null) {
      try {
        final map = jsonDecode(userJson) as Map<String, dynamic>;
        final user = AuthUser.fromJson(map);
        state = AuthState(session: AuthSession(user: user, accessToken: at, refreshToken: rt), bootstrapped: true);
        return;
      } catch (_) {}
    }
    state = const AuthState(session: null, bootstrapped: true);
  }

  Future<void> setSession(AuthSession session) async {
    final store = ref.read(secureStoreProvider);
    await store.write(SecureStore.kAccessToken, session.accessToken);
    await store.write(SecureStore.kRefreshToken, session.refreshToken);
    await store.write(SecureStore.kUserJson, jsonEncode(session.user.toJson()));
    await store.write(SecureStore.kCompanyId, session.user.companyId.toString());
    state = AuthState(session: session, bootstrapped: true);
  }

  Future<void> logout() async {
    final store = ref.read(secureStoreProvider);
    await store.deleteAll();
    state = const AuthState(session: null, bootstrapped: true);
  }
}

final dioProvider = Provider((ref) {
  final s = ref.watch(authStateProvider).session;
  return DioClient(isDebug: kDebugMode, accessToken: s?.accessToken).dio;
});

final authServiceProvider = Provider<AuthService>((ref) => AuthService(ref.read(dioProvider)));

final brandingServiceProvider = Provider<BrandingService>((ref) => BrandingService(ref.read(dioProvider)));

final brandingProvider = StateNotifierProvider<BrandingNotifier, Branding?>((ref) => BrandingNotifier(ref));

class BrandingNotifier extends StateNotifier<Branding?> {
  final Ref ref;
  BrandingNotifier(this.ref) : super(null);

  Future<void> loadBranding() async {
    final session = ref.read(authStateProvider).session;
    final companyId = session?.user.companyId;
    final svc = ref.read(brandingServiceProvider);
    state = await svc.getBranding(companyId: companyId);
  }
}

