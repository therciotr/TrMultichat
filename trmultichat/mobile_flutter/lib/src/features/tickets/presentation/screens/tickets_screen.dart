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
  int? _hoveredTicketId;
  int? _pressedTicketId;

  String _initialsFromName(String name) {
    final clean = name.trim();
    if (clean.isEmpty) return 'C';
    final parts =
        clean.split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first.substring(0, 1)}${parts.last.substring(0, 1)}'
        .toUpperCase();
  }

  Widget _statusChip(BuildContext context, String rawStatus) {
    final cs = Theme.of(context).colorScheme;
    final status = rawStatus.trim().toLowerCase();
    late final String label;
    late final Color bg;
    late final Color fg;
    switch (status) {
      case 'pending':
        label = 'Pendente';
        bg = Colors.orange.withValues(alpha: 0.14);
        fg = Colors.orange.shade700;
        break;
      case 'closed':
        label = 'Fechado';
        bg = Colors.green.withValues(alpha: 0.14);
        fg = Colors.green.shade700;
        break;
      default:
        label = 'Aberto';
        bg = cs.primary.withValues(alpha: 0.14);
        fg = cs.primary;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: fg),
      ),
    );
  }

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
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final platform = theme.platform;
    final isDesktop = platform == TargetPlatform.macOS ||
        platform == TargetPlatform.windows ||
        platform == TargetPlatform.linux;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tickets'),
        actions: [
          IconButton(
            tooltip: 'Sair',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final router = GoRouter.of(context);
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
              router.go('/login');
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
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cs.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                    color: cs.outlineVariant.withValues(alpha: 0.45)),
                boxShadow: [
                  BoxShadow(
                    color: cs.shadow.withValues(alpha: 0.05),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: TextField(
                controller: _searchCtrl,
                onChanged: (v) {
                  ctrl.setSearch(v);
                  setState(() {});
                },
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
                  filled: true,
                  fillColor: cs.surfaceContainerHighest.withValues(alpha: 0.55),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                        color: cs.outlineVariant.withValues(alpha: 0.35)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: cs.primary, width: 1.1),
                  ),
                ),
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
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final t = st.items[i];
                  final rawName = (t.contact?.name ?? '').trim();
                  final phone = formatPhoneBr(t.contact?.number);
                  final name = (rawName.isNotEmpty &&
                          !RegExp(r'^\d+$').hasMatch(rawName))
                      ? rawName
                      : (phone.isNotEmpty ? phone : 'Cliente');
                  final last = (t.lastMessage ?? '').trim();
                  final initials = _initialsFromName(name);
                  final hovered = isDesktop && _hoveredTicketId == t.id;
                  final pressed = isDesktop && _pressedTicketId == t.id;
                  final subtitleText =
                      last.isEmpty ? (phone.isNotEmpty ? phone : '—') : last;
                  return AnimatedScale(
                    duration: const Duration(milliseconds: 150),
                    scale: hovered ? 1.006 : 1,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () => context.push('/tickets/${t.id}', extra: t),
                      onHover: isDesktop
                          ? (v) {
                              final next = v ? t.id : null;
                              if (_hoveredTicketId == next) return;
                              setState(() => _hoveredTicketId = next);
                            }
                          : null,
                      onHighlightChanged: isDesktop
                          ? (v) =>
                              setState(() => _pressedTicketId = v ? t.id : null)
                          : null,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        curve: Curves.easeOutCubic,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          color: hovered
                              ? cs.surfaceContainerHighest
                                  .withValues(alpha: 0.2)
                              : cs.surface,
                          border: Border.all(
                            color: hovered
                                ? cs.primary.withValues(alpha: 0.42)
                                : cs.outlineVariant.withValues(alpha: 0.5),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: cs.shadow
                                  .withValues(alpha: hovered ? 0.09 : 0.04),
                              blurRadius: hovered ? 24 : 14,
                              offset: Offset(0, hovered ? 12 : 8),
                            ),
                          ],
                        ),
                        child: AnimatedOpacity(
                          duration: const Duration(milliseconds: 140),
                          opacity: pressed ? 0.92 : 1,
                          child: Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  gradient: LinearGradient(
                                    colors: [
                                      cs.primary.withValues(alpha: 0.24),
                                      cs.tertiary.withValues(alpha: 0.2),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                ),
                                child: Text(
                                  initials,
                                  style: TextStyle(
                                    color: cs.primary,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: theme.textTheme.titleSmall
                                            ?.copyWith(
                                                fontWeight: FontWeight.w800)),
                                    const SizedBox(height: 5),
                                    Text(
                                      subtitleText,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: theme.textTheme.bodySmall
                                          ?.copyWith(
                                              color: cs.onSurfaceVariant,
                                              fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              if (t.status.trim().toLowerCase() == 'pending')
                                Padding(
                                  padding: const EdgeInsets.only(right: 6),
                                  child: FilledButton.tonal(
                                    onPressed: () => _acceptTicket(t.id),
                                    style: FilledButton.styleFrom(
                                      visualDensity: VisualDensity.compact,
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 6),
                                      minimumSize: const Size(0, 0),
                                    ),
                                    child: const Text('Aceitar'),
                                  ),
                                )
                              else
                                _statusChip(context, t.status),
                              const SizedBox(width: 6),
                              Container(
                                width: 30,
                                height: 30,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(9),
                                  color: hovered
                                      ? cs.primary.withValues(alpha: 0.16)
                                      : cs.surfaceContainerHighest
                                          .withValues(alpha: 0.6),
                                ),
                                child: Icon(
                                  Icons.chevron_right,
                                  color: hovered
                                      ? cs.primary
                                      : cs.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
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
