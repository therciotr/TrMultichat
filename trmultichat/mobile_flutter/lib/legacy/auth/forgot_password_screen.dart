import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/providers.dart';
import '../core/errors/app_exception.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _loading = false;
  String? _msg;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _loading = true;
      _msg = null;
    });
    try {
      await ref.read(authServiceProvider).forgotPassword(_email.text.trim());
      setState(() => _msg = 'Se o e-mail existir, você receberá um link para redefinir a senha.');
    } catch (e) {
      final msg = e is AppException ? e.message : 'Erro ao solicitar';
      setState(() => _msg = msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recuperar senha')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Informe seu e-mail para receber o link de recuperação.'),
              const SizedBox(height: 12),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                decoration: const InputDecoration(labelText: 'E-mail', prefixIcon: Icon(Icons.alternate_email)),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : _send,
                child: Text(_loading ? 'Enviando...' : 'Enviar link'),
              ),
              const SizedBox(height: 12),
              if (_msg != null) Text(_msg!),
              const Spacer(),
              TextButton(
                onPressed: () => context.pop(),
                child: const Text('Voltar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

