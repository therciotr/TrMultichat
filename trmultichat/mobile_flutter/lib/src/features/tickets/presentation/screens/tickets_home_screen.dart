import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/utils/phone_format.dart';
import '../../../dashboard/presentation/providers/dashboard_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../providers/tickets_providers.dart';

class TicketsHomeScreen extends ConsumerStatefulWidget {
  const TicketsHomeScreen({super.key});

  @override
  ConsumerState<TicketsHomeScreen> createState() => _TicketsHomeScreenState();
}

class _TicketsHomeScreenState extends ConsumerState<TicketsHomeScreen> {
  final _search = TextEditingController();
  Timer? _autoRefreshTimer;

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
    _autoRefreshTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (!mounted) return;
      try {
        await ref.read(ticketsControllerProvider.notifier).refresh();
      } catch (_) {}
      ref.invalidate(dashboardCountersProvider);
      ref.invalidate(dashboardCountersTodayProvider);
    });
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final counters = ref.watch(dashboardCountersProvider);
    final countersToday = ref.watch(dashboardCountersTodayProvider);
    final tickets = ref.watch(ticketsControllerProvider);
    final ticketsCtrl = ref.read(ticketsControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Multichat'),
        actions: [
          IconButton(
            onPressed: () => context.push('/tickets/all'),
            icon: const Icon(Icons.list_alt_outlined),
            tooltip: 'Ver todos',
          ),
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
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
                    FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sair')),
                  ],
                ),
              );
              if (ok != true) return;
              await ref.read(authControllerProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await ref.refresh(dashboardCountersProvider.future);
          await ticketsCtrl.refresh();
        },
        child: ListView(
          padding: const EdgeInsets.all(14),
          children: [
            TextField(
              controller: _search,
              onChanged: ticketsCtrl.setSearch,
              onSubmitted: (_) => ticketsCtrl.refresh(),
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: 'Buscar contato',
                filled: true,
                fillColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.55),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 14),

            counters.when(
              data: (c) => Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: _MetricCard(title: 'Pendentes', value: c.pending, tone: _Tone.warning)),
                      const SizedBox(width: 10),
                      Expanded(child: _MetricCard(title: 'Abertos', value: c.open, tone: _Tone.info)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: countersToday.when(
                          data: (t) => _MetricCard(title: 'Fechados hoje', value: t.closed, tone: _Tone.success),
                          loading: () => const _MetricCard(title: 'Fechados hoje', value: 0, tone: _Tone.success, loading: true),
                          error: (_, __) => _MetricCard(title: 'Fechados hoje', value: c.closed, tone: _Tone.success),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _MetricCard(
                          title: 'SLA médio',
                          value: c.avgSupportMinutes,
                          suffix: 'min',
                          tone: _Tone.info,
                          icon: Icons.timer_outlined,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _MetricCard(
                          title: 'Espera média',
                          value: c.avgWaitMinutes,
                          suffix: 'min',
                          tone: _Tone.warning,
                          icon: Icons.hourglass_bottom_outlined,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              loading: () => const SizedBox(height: 74, child: Center(child: CircularProgressIndicator())),
              error: (_, __) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 18),
            Row(
              children: [
                Text('Últimos Tickets', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const Spacer(),
                TextButton(
                  onPressed: () => context.push('/tickets/all'),
                  child: const Text('Ver todos'),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (tickets.loading) const LinearProgressIndicator(minHeight: 2),
            if (tickets.error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(tickets.error!, style: const TextStyle(color: Colors.red)),
              ),
            const SizedBox(height: 8),
            ...tickets.items.take(10).map((t) {
              final rawName = (t.contact?.name ?? '').trim();
              final phone = formatPhoneBr(t.contact?.number);
              final name = (rawName.isNotEmpty && !RegExp(r'^\d+$').hasMatch(rawName))
                  ? rawName
                  : (phone.isNotEmpty ? phone : 'Cliente');
              final sub = (t.lastMessage ?? '').trim().isEmpty
                  ? (phone.isNotEmpty ? phone : '—')
                  : (t.lastMessage ?? '').trim();
              return _TicketRow(
                title: name,
                subtitle: sub,
                status: t.status,
                onTap: () => context.push('/tickets/${t.id}', extra: t),
                onAccept: t.status.trim().toLowerCase() == 'pending'
                    ? () => _acceptTicket(t.id)
                    : null,
              );
            }),
            if (tickets.items.isEmpty && !tickets.loading)
              Padding(
                padding: const EdgeInsets.only(top: 18),
                child: Text(
                  'Nenhum ticket encontrado.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TicketRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final String status;
  final VoidCallback onTap;
  final VoidCallback? onAccept;

  const _TicketRow({
    required this.title,
    required this.subtitle,
    required this.status,
    required this.onTap,
    this.onAccept,
  });

  @override
  Widget build(BuildContext context) {
    final chip = _statusChip(context, status);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Ink(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.55)),
          color: Theme.of(context).colorScheme.surface,
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
              child: Icon(Icons.person_outline, color: Theme.of(context).colorScheme.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            if (onAccept != null)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: FilledButton.tonal(
                  onPressed: onAccept,
                  style: FilledButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    minimumSize: const Size(0, 0),
                  ),
                  child: const Text('Aceitar'),
                ),
              )
            else
              chip,
            const SizedBox(width: 4),
            Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ],
        ),
      ),
    );
  }
}

Widget _statusChip(BuildContext context, String status) {
  final s = status.trim().toLowerCase();
  late final String label;
  late final Color bg;
  late final Color fg;
  if (s == 'pending') {
    label = 'Pendente';
    bg = Colors.orange.withOpacity(0.14);
    fg = Colors.orange.shade700;
  } else if (s == 'closed') {
    label = 'Fechado';
    bg = Colors.green.withOpacity(0.14);
    fg = Colors.green.shade700;
  } else {
    label = 'Aberto';
    bg = Theme.of(context).colorScheme.primary.withOpacity(0.14);
    fg = Theme.of(context).colorScheme.primary;
  }
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
    child: Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 12)),
  );
}

enum _Tone { info, warning, success }

class _MetricCard extends StatelessWidget {
  final String title;
  final int value;
  final _Tone tone;
  final String? suffix;
  final IconData? icon;
  final bool loading;

  const _MetricCard({
    required this.title,
    required this.value,
    required this.tone,
    this.suffix,
    this.icon,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      _Tone.warning => (Colors.orange.withOpacity(0.14), Colors.orange.shade700),
      _Tone.success => (Colors.green.withOpacity(0.14), Colors.green.shade700),
      _Tone.info => (Theme.of(context).colorScheme.primary.withOpacity(0.14), Theme.of(context).colorScheme.primary),
    };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.55)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, color: fg, size: 18),
                const SizedBox(width: 6),
              ],
              if (loading)
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: fg),
                )
              else
                Text(
                  suffix == null ? value.toString() : '$value $suffix',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: fg),
                ),
            ],
          ),
          const SizedBox(height: 2),
          Text(title, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Container(height: 6, width: 36, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99))),
        ],
      ),
    );
  }
}

