import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../dashboard/presentation/providers/dashboard_providers.dart';

class DesktopDashboardScreen extends ConsumerWidget {
  const DesktopDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncCounters = ref.watch(dashboardCountersProvider);
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Gerência (Dashboard)')),
      body: asyncCounters.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Text(
            'Falha ao carregar indicadores',
            style: TextStyle(color: cs.error),
          ),
        ),
        data: (c) {
          final indicatorCards = <_DashItem>[
            _DashItem(
              title: 'Pendentes',
              value: '${c.pending}',
              icon: Icons.hourglass_empty_outlined,
              hint: 'Demandas aguardando ação',
            ),
            _DashItem(
              title: 'Em atendimento',
              value: '${c.open}',
              icon: Icons.support_agent_outlined,
              hint: 'Tickets em operação',
            ),
            _DashItem(
              title: 'Finalizados',
              value: '${c.closed}',
              icon: Icons.check_circle_outline,
              hint: 'Tickets concluídos',
            ),
            _DashItem(
              title: 'Tempo médio atendimento',
              value: '${c.avgSupportMinutes} min',
              icon: Icons.timer_outlined,
              hint: 'Produtividade da equipe',
            ),
            _DashItem(
              title: 'Tempo médio espera',
              value: '${c.avgWaitMinutes} min',
              icon: Icons.schedule_outlined,
              hint: 'SLA percebido pelo cliente',
            ),
          ];

          final ranking = _buildRanking(c.pending, c.open, c.closed);
          final totalTickets = c.pending + c.open + c.closed;

          return LayoutBuilder(
            builder: (context, constraints) {
              final contentWidth = constraints.maxWidth;
              final cardsPerRow = contentWidth >= 1240
                  ? 4
                  : contentWidth >= 980
                      ? 3
                      : 2;
              final cardWidth =
                  (contentWidth - 36 - ((cardsPerRow - 1) * 12)) / cardsPerRow;

              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ExecutiveHeader(
                      totalTickets: totalTickets,
                      closed: c.closed,
                    ),
                    const SizedBox(height: 14),
                    _SectionTitle(
                      title: 'Indicadores',
                      subtitle: 'Visão operacional em tempo real',
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: indicatorCards
                          .map(
                            (item) => SizedBox(
                              width: cardWidth,
                              child: _IndicatorCard(item: item),
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: 16),
                    _SectionTitle(
                      title: 'Rankings',
                      subtitle: 'Priorização por volume',
                    ),
                    const SizedBox(height: 10),
                    _RankingsCard(ranking: ranking, totalTickets: totalTickets),
                    const SizedBox(height: 12),
                    _PerformanceCard(
                      avgSupportMinutes: c.avgSupportMinutes,
                      avgWaitMinutes: c.avgWaitMinutes,
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  List<_RankingItem> _buildRanking(int pending, int open, int closed) {
    final ranking = <_RankingItem>[
      _RankingItem(
          label: 'Finalizados',
          value: closed,
          icon: Icons.emoji_events_outlined),
      _RankingItem(
          label: 'Em atendimento',
          value: open,
          icon: Icons.local_fire_department_outlined),
      _RankingItem(
          label: 'Pendentes',
          value: pending,
          icon: Icons.hourglass_bottom_outlined),
    ];
    ranking.sort((a, b) => b.value.compareTo(a.value));
    return ranking;
  }
}

class _DashItem {
  final String title;
  final String value;
  final IconData icon;
  final String hint;
  _DashItem({
    required this.title,
    required this.value,
    required this.icon,
    required this.hint,
  });
}

class _RankingItem {
  final String label;
  final int value;
  final IconData icon;
  _RankingItem({required this.label, required this.value, required this.icon});
}

class _ExecutiveHeader extends StatelessWidget {
  final int totalTickets;
  final int closed;

  const _ExecutiveHeader({required this.totalTickets, required this.closed});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final closureRate = totalTickets > 0 ? (closed / totalTickets) * 100 : 0.0;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            cs.primary,
            cs.primary.withOpacity(0.82),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: cs.primary.withOpacity(0.20),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Painel Gerencial',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: cs.onPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Acompanhe indicadores, produtividade e prioridade operacional em uma visão única.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: cs.onPrimary.withOpacity(0.92),
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: cs.onPrimary.withOpacity(0.12),
              border: Border.all(color: cs.onPrimary.withOpacity(0.18)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Taxa de conclusão',
                  style: TextStyle(
                    color: cs.onPrimary.withOpacity(0.86),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${closureRate.toStringAsFixed(1)}%',
                  style: TextStyle(
                    color: cs.onPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final String subtitle;

  const _SectionTitle({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: cs.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}

class _IndicatorCard extends StatelessWidget {
  final _DashItem item;

  const _IndicatorCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: cs.surface,
        border: Border.all(color: cs.outlineVariant.withOpacity(0.50)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: cs.primaryContainer.withOpacity(0.50),
            ),
            child: Icon(item.icon, color: cs.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: cs.onSurfaceVariant,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.value,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.hint,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: cs.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RankingsCard extends StatelessWidget {
  final List<_RankingItem> ranking;
  final int totalTickets;

  const _RankingsCard({required this.ranking, required this.totalTickets});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: cs.surface,
        border: Border.all(color: cs.outlineVariant.withOpacity(0.5)),
      ),
      child: Column(
        children: List.generate(ranking.length, (index) {
          final item = ranking[index];
          final percent =
              totalTickets > 0 ? (item.value / totalTickets) * 100 : 0.0;
          return Padding(
            padding:
                EdgeInsets.only(bottom: index == ranking.length - 1 ? 0 : 10),
            child: Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: cs.primaryContainer.withOpacity(0.55),
                  ),
                  child: Center(
                    child: Text(
                      '${index + 1}',
                      style: TextStyle(
                        color: cs.primary,
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Icon(item.icon, size: 18, color: cs.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.label,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                Text(
                  '${item.value} (${percent.toStringAsFixed(1)}%)',
                  style: TextStyle(
                    color: cs.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _PerformanceCard extends StatelessWidget {
  final int avgSupportMinutes;
  final int avgWaitMinutes;

  const _PerformanceCard({
    required this.avgSupportMinutes,
    required this.avgWaitMinutes,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final supportScore = (1 - (avgSupportMinutes / 5000)).clamp(0.0, 1.0);
    final waitScore = (1 - (avgWaitMinutes / 5000)).clamp(0.0, 1.0);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: cs.surface,
        border: Border.all(color: cs.outlineVariant.withOpacity(0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Performance',
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          _ScoreLine(
            label: 'Atendimento',
            value: avgSupportMinutes,
            progress: supportScore,
          ),
          const SizedBox(height: 8),
          _ScoreLine(
            label: 'Espera',
            value: avgWaitMinutes,
            progress: waitScore,
          ),
        ],
      ),
    );
  }
}

class _ScoreLine extends StatelessWidget {
  final String label;
  final int value;
  final double progress;

  const _ScoreLine({
    required this.label,
    required this.value,
    required this.progress,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: cs.onSurfaceVariant,
                ),
              ),
            ),
            Text(
              '$value min',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 8,
          ),
        ),
      ],
    );
  }
}
