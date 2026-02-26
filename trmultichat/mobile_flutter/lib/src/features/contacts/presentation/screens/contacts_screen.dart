import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../auth/presentation/providers/auth_providers.dart';
import '../providers/contacts_providers.dart';

class ContactsScreen extends ConsumerStatefulWidget {
  const ContactsScreen({super.key});

  @override
  ConsumerState<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends ConsumerState<ContactsScreen> {
  final _search = TextEditingController();
  final _listCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _listCtrl.addListener(() {
      if (!_listCtrl.hasClients) return;
      final pos = _listCtrl.position;
      if (pos.pixels >= pos.maxScrollExtent - 220) {
        ref.read(contactsControllerProvider.notifier).loadMore();
      }
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _listCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(contactsControllerProvider);
    final ctrl = ref.read(contactsControllerProvider.notifier);
    final cs = Theme.of(context).colorScheme;
    final platform = Theme.of(context).platform;
    final isDesktop = platform == TargetPlatform.macOS ||
        platform == TargetPlatform.windows ||
        platform == TargetPlatform.linux;

    String initialsFromName(String name) {
      final clean = name.trim();
      if (clean.isEmpty) return 'C';
      final parts = clean.split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
      if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
      return '${parts.first.substring(0, 1)}${parts.last.substring(0, 1)}'
          .toUpperCase();
    }

    Widget contactTile(dynamic c) {
      final name = c.name.trim().isEmpty ? 'Contato' : c.name.trim();
      final initials = initialsFromName(name);
      return InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/contacts/${c.id}'),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: cs.surface,
            border: Border.all(color: cs.outlineVariant.withOpacity(0.45)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: cs.primary.withOpacity(0.14),
                ),
                alignment: Alignment.center,
                child: Text(
                  initials,
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: cs.primary,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      c.number,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: cs.onSurfaceVariant),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: isDesktop
          ? null
          : AppBar(
              title: const Text('Contatos'),
              actions: [
                IconButton(
                  tooltip: 'Sair',
                  icon: const Icon(Icons.logout),
                  onPressed: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Sair'),
                        content: const Text('Deseja sair da sua conta?'),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: const Text('Cancelar'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            child: const Text('Sair'),
                          ),
                        ],
                      ),
                    );
                    if (ok != true) return;
                    await ref.read(authControllerProvider.notifier).logout();
                    if (!mounted) return;
                    context.go('/login');
                  },
                ),
              ],
            ),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(isDesktop ? 18 : 12, isDesktop ? 18 : 12,
                isDesktop ? 18 : 12, 0),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: cs.surface,
                border: Border.all(color: cs.outlineVariant.withOpacity(0.5)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  if (isDesktop) ...[
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: cs.primary.withOpacity(0.14),
                      ),
                      child: Icon(Icons.people_outline, color: cs.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Contatos',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                  if (!isDesktop)
                    const SizedBox.shrink()
                  else
                    const SizedBox(width: 10),
                  Expanded(
                    flex: isDesktop ? 3 : 1,
                    child: TextField(
                      controller: _search,
                      onChanged: ctrl.setSearch,
                      onSubmitted: (_) => ctrl.refresh(),
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.search),
                        hintText: 'Buscar por nome ou número',
                        filled: true,
                        fillColor: cs.surfaceContainerHighest.withOpacity(0.55),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (st.loading) const LinearProgressIndicator(minHeight: 2),
          if (st.error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(st.error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ctrl.refresh(),
              child: ListView.separated(
                controller: _listCtrl,
                padding: EdgeInsets.fromLTRB(
                  isDesktop ? 18 : 12,
                  12,
                  isDesktop ? 18 : 12,
                  90,
                ),
                itemCount: st.items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final c = st.items[i];
                  return contactTile(c);
                },
              ),
            ),
          ),
          if (!st.loading && st.items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Text(
                'Nenhum contato encontrado.',
                style: TextStyle(color: cs.onSurfaceVariant),
              ),
            ),
          if (st.loading && st.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text('Carregando mais...',
                  style: TextStyle(color: cs.onSurfaceVariant)),
            ),
        ],
      ),
    );
  }
}
