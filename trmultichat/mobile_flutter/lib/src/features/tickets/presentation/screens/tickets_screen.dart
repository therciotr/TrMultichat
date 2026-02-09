import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/tickets_providers.dart';

class TicketsScreen extends ConsumerStatefulWidget {
  final String? initialSearch;
  final String? initialStatus; // pending|open|closed
  const TicketsScreen({super.key, this.initialSearch, this.initialStatus});

  @override
  ConsumerState<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends ConsumerState<TicketsScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final ctrl = ref.read(ticketsControllerProvider.notifier);
      final initSearch = (widget.initialSearch ?? '').trim();
      if (initSearch.isNotEmpty) {
        _searchCtrl.text = initSearch;
        ctrl.setSearch(initSearch);
      }
      final initStatus = (widget.initialStatus ?? '').trim();
      if (initStatus == 'pending' || initStatus == 'open' || initStatus == 'closed') {
        ctrl.setStatus(initStatus);
      } else {
        // ensure refresh if only search changed
        ctrl.refresh();
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(ticketsControllerProvider);
    final ctrl = ref.read(ticketsControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tickets'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'pending', label: Text('Pendente')),
                ButtonSegment(value: 'open', label: Text('Aberto')),
                ButtonSegment(value: 'closed', label: Text('Fechado')),
              ],
              selected: {st.status},
              onSelectionChanged: (s) => ctrl.setStatus(s.first),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchCtrl,
              onChanged: ctrl.setSearch,
              onSubmitted: (_) => ctrl.refresh(),
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: 'Buscar por nome, número ou última mensagem',
                suffixIcon: _searchCtrl.text.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          _searchCtrl.clear();
                          ctrl.setSearch('');
                          ctrl.refresh();
                          setState(() {});
                        },
                        icon: const Icon(Icons.close),
                      ),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
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
                itemCount: st.items.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final t = st.items[i];
                  final name = t.contact?.name.isNotEmpty == true ? t.contact!.name : 'Cliente';
                  final last = (t.lastMessage ?? '').trim();
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
                      child: Icon(Icons.person_outline, color: Theme.of(context).colorScheme.primary),
                    ),
                    title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(last.isEmpty ? '—' : last, maxLines: 1, overflow: TextOverflow.ellipsis),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      context.push('/tickets/${t.id}', extra: t);
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

