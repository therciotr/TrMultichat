class Env {
  // Ajuste aqui para testes em device físico em dev:
  // ex.: 'http://192.168.0.10:4004'
  static const String devBaseUrl = 'http://localhost:4004';
  static const String prodBaseUrl = 'https://api.trmultichat.com.br';

  static String baseUrl({required bool isDebug}) => isDebug ? devBaseUrl : prodBaseUrl;
}

