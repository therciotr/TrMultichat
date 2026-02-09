import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/app/tr_multichat_app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
  };

  // Catch async errors (helps avoid "white screen" with silent failures)
  WidgetsBinding.instance.platformDispatcher.onError = (error, stack) {
    FlutterError.reportError(
      FlutterErrorDetails(
        exception: error,
        stack: stack,
        library: 'platform_dispatcher',
      ),
    );
    return true;
  };

  ErrorWidget.builder = (details) {
    return Material(
      color: Colors.white,
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Text(
            details.exceptionAsString(),
            style: const TextStyle(color: Colors.red, fontSize: 12),
          ),
        ),
      ),
    );
  };

  runApp(const ProviderScope(child: TrMultichatApp()));
}

