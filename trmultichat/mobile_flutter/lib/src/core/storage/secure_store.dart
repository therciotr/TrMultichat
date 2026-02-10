import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStore {
  static const _kAccessToken = 'accessToken';
  static const _kRefreshToken = 'refreshToken';
  static const _kUserJson = 'userJson';

  final FlutterSecureStorage _storage;
  const SecureStore(this._storage);

  // Generic helpers (used for "read" markers, preferences, etc.)
  Future<void> writeString(String key, String value) => _storage.write(key: key, value: value);
  Future<String?> readString(String key) => _storage.read(key: key);
  Future<void> deleteKey(String key) => _storage.delete(key: key);

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required String userJson,
  }) async {
    await _storage.write(key: _kAccessToken, value: accessToken);
    await _storage.write(key: _kRefreshToken, value: refreshToken);
    await _storage.write(key: _kUserJson, value: userJson);
  }

  /// Updates only the tokens, keeping the existing stored userJson.
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _kAccessToken, value: accessToken);
    await _storage.write(key: _kRefreshToken, value: refreshToken);
  }

  Future<String?> readAccessToken() => _storage.read(key: _kAccessToken);
  Future<String?> readRefreshToken() => _storage.read(key: _kRefreshToken);
  Future<String?> readUserJson() => _storage.read(key: _kUserJson);

  Future<void> clear() async {
    await _storage.delete(key: _kAccessToken);
    await _storage.delete(key: _kRefreshToken);
    await _storage.delete(key: _kUserJson);
  }
}

