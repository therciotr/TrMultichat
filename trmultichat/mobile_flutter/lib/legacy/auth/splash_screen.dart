import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/providers.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      await ref.read(authStateProvider.notifier).bootstrap();
      // Load branding if already logged
      if (ref.read(authStateProvider).session != null) {
        await ref.read(brandingProvider.notifier).loadBranding();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final branding = ref.watch(brandingProvider);
    final primary = Theme.of(context).colorScheme.primary;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [primary, Theme.of(context).colorScheme.secondary],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if ((branding?.logoUrl ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Icon(Icons.chat_bubble_outline, size: 64, color: Colors.white.withOpacity(0.9)),
                ),
              Text(
                'TR Multichat',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 18),
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

