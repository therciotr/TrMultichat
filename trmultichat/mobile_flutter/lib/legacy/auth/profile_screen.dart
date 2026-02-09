import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/providers.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authStateProvider).session;
    final user = session?.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil e configurações')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: ListTile(
                leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                title: Text(user?.name ?? '-'),
                subtitle: Text('${user?.email ?? ''}\nEmpresa: ${user?.companyId ?? ''} • Perfil: ${user?.profile ?? ''}'),
                isThreeLine: true,
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: ListTile(
                leading: const Icon(Icons.palette_outlined),
                title: const Text('Recarregar branding'),
                subtitle: const Text('Atualiza cores/logo da empresa'),
                onTap: () async => ref.read(brandingProvider.notifier).loadBranding(),
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Sair'),
                onTap: () async {
                  await ref.read(authStateProvider.notifier).logout();
                  if (context.mounted) context.go('/login');
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

