import 'dart:convert';

import '../../../../core/storage/secure_store.dart';
import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';
import '../dto/login_response_dto.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remote;
  final SecureStore _store;

  AuthRepositoryImpl(this._remote, this._store);

  @override
  Future<(AuthUser user, String accessToken, String refreshToken)> login({
    required String email,
    required String password,
  }) async {
    final dto = await _remote.login(email: email, password: password);
    await saveSession(user: dto.user, accessToken: dto.accessToken, refreshToken: dto.refreshToken);
    return (dto.user, dto.accessToken, dto.refreshToken);
  }

  @override
  Future<void> forgotPassword({required String email}) => _remote.forgotPassword(email: email);

  @override
  Future<void> resetPassword({required String token, required String password}) =>
      _remote.resetPassword(token: token, password: password);

  @override
  Future<(AuthUser user, String accessToken, String refreshToken)?> loadSession() async {
    final at = await _store.readAccessToken();
    final rt = await _store.readRefreshToken();
    final uj = await _store.readUserJson();
    if (at == null || at.isEmpty || rt == null || rt.isEmpty || uj == null || uj.isEmpty) return null;
    final map = (jsonDecode(uj) as Map).cast<String, dynamic>();
    final dto = LoginResponseDto.fromJson({'accessToken': at, 'refreshToken': rt, 'user': map});
    return (dto.user, dto.accessToken, dto.refreshToken);
  }

  @override
  Future<void> saveSession({required AuthUser user, required String accessToken, required String refreshToken}) async {
    await _store.saveSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      userJson: jsonEncode({
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'companyId': user.companyId,
        'admin': user.admin,
        'profile': user.profile,
        'super': user.isSuper,
      }),
    );
  }

  @override
  Future<void> logout() async {
    await _store.clear();
  }
}

