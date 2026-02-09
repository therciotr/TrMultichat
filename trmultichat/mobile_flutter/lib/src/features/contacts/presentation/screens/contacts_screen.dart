import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/contacts_providers.dart';

class ContactsScreen extends ConsumerStatefulWidget {
  const ContactsScreen({super.key});

  @override
  ConsumerState<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends ConsumerState<ContactsScreen> {
  final _search = TextEditingController();
  final _listCtrl = ScrollController();

  bool _scrollBound = false;

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
    _scrollBound = true;
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

    return Scaffold(
      appBar: AppBar(title: const Text('Contatos')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _search,
              onChanged: ctrl.setSearch,
              onSubmitted: (_) => ctrl.refresh(),
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: 'Buscar por nome ou número',
                filled: true,
                fillColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.55),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
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
                itemCount: st.items.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final c = st.items[i];
                  final name = c.name.trim().isEmpty ? 'Contato' : c.name.trim();
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
                      child: Icon(Icons.person_outline, color: Theme.of(context).colorScheme.primary),
                    ),
                    title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(c.number, maxLines: 1, overflow: TextOverflow.ellipsis),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      context.push('/contacts/${c.id}');
                    },
                  );
                },
              ),
            ),
          ),
          if (st.loading && st.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text('Carregando mais...', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
            ),
        ],
      ),
    );
  }
}

