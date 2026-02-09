import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/theme/theme_controller.dart';
import '../../../branding/presentation/providers/branding_providers.dart';
import '../providers/auth_providers.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // Warm up branding as soon as we have auth context.
    Future.microtask(() async {
      try {
        final auth = ref.read(authControllerProvider);
        final companyId = auth.user?.companyId ?? 0;
        await ref.read(brandingControllerProvider.notifier).load(companyId: companyId);
        if (!mounted) return;
        final branding = ref.read(brandingControllerProvider).branding;
        ref.read(appThemeProvider.notifier).setBranding(branding);
      } catch (_) {
        // Never crash splash.
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final branding = ref.watch(brandingControllerProvider).branding;
    final base = ref.read(dioProvider).options.baseUrl.replaceAll(RegExp(r'/+$'), '');
    final rawLogo = (branding.logoUrl ?? '').trim();
    final logoUrl = rawLogo.isEmpty
        ? null
        : (rawLogo.startsWith('http') ? rawLogo : '$base/${rawLogo.replaceAll(RegExp(r'^/+'), '')}');

    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              _hex(branding.primaryColor),
              _hex(branding.secondaryColor),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.16),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: Colors.white.withOpacity(0.22)),
                ),
                padding: const EdgeInsets.all(18),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Image.asset(
                    'assets/logo_login.png',
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) {
                      if (logoUrl == null) return const Icon(Icons.chat_bubble_outline, color: Colors.white, size: 52);
                      return Image.network(
                        logoUrl,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => const Icon(Icons.chat_bubble_outline, color: Colors.white, size: 52),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'TR Multichat',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
              ),
              const SizedBox(height: 18),
              if (auth.loading) const CircularProgressIndicator(color: Colors.white),
              const SizedBox(height: 10),
              Text('Carregando…', style: TextStyle(color: Colors.white.withOpacity(0.85))),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

Color _hex(String v) {
  var s = v.trim().replaceAll('#', '').trim();
  if (s.length == 3) {
    s = '${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}';
  } else if (s.length == 4) {
    s = '${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}';
  }
  try {
    if (s.length == 6) return Color(int.parse('FF$s', radix: 16));
    if (s.length == 8) return Color(int.parse(s, radix: 16));
  } catch (_) {}
  return const Color(0xFF2BA9A5);
}

