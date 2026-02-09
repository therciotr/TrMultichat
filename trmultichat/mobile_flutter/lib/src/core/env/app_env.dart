class AppEnv {
  static const String prodBaseUrl = 'https://api.trmultichat.com.br';

  /// API base URL.
  ///
  /// Defaults to production. Override when needed with:
  /// `flutter run --dart-define=API_BASE_URL=http://<ip>:4004`
  static const String apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: prodBaseUrl);

  static String baseUrl() {
    final v = apiBaseUrl.trim();
    return v.isEmpty ? prodBaseUrl : v;
  }
}

