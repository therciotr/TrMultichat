import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/utils/phone_format.dart';
import '../../../dashboard/presentation/providers/dashboard_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
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

  Future<void> _acceptTicket(int ticketId) async {
    final auth = ref.read(authControllerProvider);
    final userId = auth.user?.id;
    try {
      await ref.read(dioProvider).put(
        '/tickets/$ticketId',
        data: {
          'status': 'open',
          if (userId != null && userId > 0) 'userId': userId,
        },
      );
      await ref.read(ticketsControllerProvider.notifier).refresh();
      ref.invalidate(dashboardCountersProvider);
      ref.invalidate(dashboardCountersTodayProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ticket aceito com sucesso.')),
      );
      if (!mounted) return;
      context.push('/tickets/$ticketId');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao aceitar ticket: ${e.toString()}')),
      );
    }
  }

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
      if (initStatus == 'pending' ||
          initStatus == 'open' ||
          initStatus == 'closed') {
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
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
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
                  final rawName = (t.contact?.name ?? '').trim();
                  final phone = formatPhoneBr(t.contact?.number);
                  final name = (rawName.isNotEmpty &&
                          !RegExp(r'^\d+$').hasMatch(rawName))
                      ? rawName
                      : (phone.isNotEmpty ? phone : 'Cliente');
                  final last = (t.lastMessage ?? '').trim();
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Theme.of(context)
                          .colorScheme
                          .primary
                          .withOpacity(0.12),
                      child: Icon(Icons.person_outline,
                          color: Theme.of(context).colorScheme.primary),
                    ),
                    title: Text(name,
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      last.isEmpty ? (phone.isNotEmpty ? phone : '—') : last,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: t.status.trim().toLowerCase() == 'pending'
                        ? FilledButton.tonal(
                            onPressed: () => _acceptTicket(t.id),
                            style: FilledButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              minimumSize: const Size(0, 0),
                            ),
                            child: const Text('Aceitar'),
                          )
                        : const Icon(Icons.chevron_right),
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
