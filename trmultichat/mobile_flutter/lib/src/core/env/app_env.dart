class AppEnv {
  static const String prodBaseUrl = 'https://api.trmultichat.com.br';
  static const String devBaseUrl = 'http://5.161.196.30:4004';

  /// API base URL.
  ///
  /// Defaults to production. Override for local dev with:
  /// `flutter run --dart-define=API_BASE_URL=http://<ip>:4004`
  static const String apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');

  static String baseUrl() {
    final override = apiBaseUrl.trim();
    if (override.isNotEmpty) return override;

    // In release builds, always default to production.
    // In debug/profile, default to your VPS to make device testing easier.
    const isRelease = bool.fromEnvironment('dart.vm.product');
    return isRelease ? prodBaseUrl : devBaseUrl;
  }
}

