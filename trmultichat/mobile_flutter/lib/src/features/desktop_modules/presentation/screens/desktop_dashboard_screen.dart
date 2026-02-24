import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../dashboard/presentation/providers/dashboard_providers.dart';

class DesktopDashboardScreen extends ConsumerWidget {
  const DesktopDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncCounters = ref.watch(dashboardCountersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: asyncCounters.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Text(
            'Falha ao carregar indicadores',
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ),
        data: (c) {
          final cards = <_DashItem>[
            _DashItem(
              title: 'Pendentes',
              value: '${c.pending}',
              icon: Icons.hourglass_empty_outlined,
            ),
            _DashItem(
              title: 'Em atendimento',
              value: '${c.open}',
              icon: Icons.support_agent_outlined,
            ),
            _DashItem(
              title: 'Finalizados',
              value: '${c.closed}',
              icon: Icons.check_circle_outline,
            ),
            _DashItem(
              title: 'Tempo médio atendimento',
              value: '${c.avgSupportMinutes} min',
              icon: Icons.timer_outlined,
            ),
            _DashItem(
              title: 'Tempo médio espera',
              value: '${c.avgWaitMinutes} min',
              icon: Icons.schedule_outlined,
            ),
          ];

          return GridView.builder(
            padding: const EdgeInsets.all(14),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.8,
            ),
            itemCount: cards.length,
            itemBuilder: (context, i) {
              final item = cards[i];
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        child: Icon(item.icon),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.title,
                              style: Theme.of(context).textTheme.bodyMedium,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.value,
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _DashItem {
  final String title;
  final String value;
  final IconData icon;
  _DashItem({required this.title, required this.value, required this.icon});
}
