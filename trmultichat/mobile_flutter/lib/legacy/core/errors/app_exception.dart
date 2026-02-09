class AppException implements Exception {
  final String message;
  final int? statusCode;
  final Object? raw;

  const AppException(this.message, {this.statusCode, this.raw});

  @override
  String toString() => 'AppException(statusCode: $statusCode, message: $message)';
}

