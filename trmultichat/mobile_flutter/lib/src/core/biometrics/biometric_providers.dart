import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

import 'biometric_auth_service.dart';

final localAuthProvider = Provider<LocalAuthentication>((ref) => LocalAuthentication());

final biometricAuthServiceProvider = Provider<BiometricAuthService>((ref) {
  return BiometricAuthService(ref.watch(localAuthProvider));
});

