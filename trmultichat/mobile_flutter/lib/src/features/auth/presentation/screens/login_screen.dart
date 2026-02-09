import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../branding/presentation/providers/branding_providers.dart';
import '../providers/auth_providers.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
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
    final loading = auth.loading;
    final primary = _hex(branding.primaryColor);
    final hasSession = ref.watch(hasSavedSessionProvider).value == true;
    // Avoid calling biometrics plugin during app startup/build.
    // We'll attempt Face ID only when user taps the button.
    final canBioLogin = hasSession;

    return Scaffold(
      body: SafeArea(
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                _hex(branding.primaryColor).withOpacity(0.18),
                Colors.white,
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const SizedBox(height: 6),
              Center(
                child: Container(
                  width: 92,
                  height: 92,
                  decoration: BoxDecoration(
                    color: primary.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: primary.withOpacity(0.18)),
                  ),
                  padding: const EdgeInsets.all(14),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: Image.asset(
                      'assets/logo_login.png',
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) {
                        if (logoUrl == null) {
                          return Icon(Icons.chat_bubble_outline, color: primary, size: 44);
                        }
                        return Image.network(
                          logoUrl,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => Icon(Icons.chat_bubble_outline, color: primary, size: 44),
                        );
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'TR Multichat',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 18),
              if (auth.error != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.withOpacity(0.25)),
                  ),
                  child: Text(auth.error!, style: const TextStyle(color: Colors.red)),
                ),
              const SizedBox(height: 12),
              TextField(
                controller: _email,
                enabled: !loading,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'E-mail', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                enabled: !loading,
                obscureText: true,
                textInputAction: TextInputAction.done,
                decoration: const InputDecoration(labelText: 'Senha', border: OutlineInputBorder()),
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton(
                  onPressed: loading ? null : _submit,
                  child: Text(loading ? 'Entrando...' : 'Entrar'),
                ),
              ),
              const SizedBox(height: 10),
              if (canBioLogin)
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton.icon(
                    onPressed: loading ? null : () => ref.read(authControllerProvider.notifier).biometricLogin(),
                    icon: const Icon(Icons.face),
                    label: const Text('Entrar com Face ID'),
                  ),
                ),
              if (canBioLogin) const SizedBox(height: 6),
              TextButton(
                onPressed: loading ? null : () => _showForgotDialog(context),
                child: const Text('Esqueci minha senha'),
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }

  void _submit() {
    final email = _email.text.trim();
    final password = _password.text;
    ref.read(authControllerProvider.notifier).login(email: email, password: password);
  }

  Future<void> _showForgotDialog(BuildContext context) async {
    final ctrl = TextEditingController(text: _email.text.trim());
    try {
      await showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Recuperar senha'),
          content: TextField(
            controller: ctrl,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'E-mail'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            FilledButton(
              onPressed: () async {
                final email = ctrl.text.trim();
                try {
                  await ref.read(authRepositoryProvider).forgotPassword(email: email);
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Se existir, enviamos o link por e-mail.')));
                  }
                } catch (_) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Falha ao solicitar recuperação.')));
                  }
                }
              },
              child: const Text('Enviar'),
            ),
          ],
        ),
      );
    } finally {
      ctrl.dispose();
    }
  }
}

Color _hex(String v) {
  final s = v.replaceAll('#', '').trim();
  if (s.length == 6) return Color(int.parse('FF$s', radix: 16));
  if (s.length == 8) return Color(int.parse(s, radix: 16));
  return const Color(0xFF2BA9A5);
}

