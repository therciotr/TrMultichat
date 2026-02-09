import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/providers.dart';
import 'home_service.dart';

final homeMetricsProvider = FutureProvider<HomeMetrics>((ref) async {
  final dio = ref.read(dioProvider);
  return HomeService(dio).getMetrics();
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authStateProvider).session;
    final metrics = ref.watch(homeMetricsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('TR Multichat'),
        actions: [
          IconButton(onPressed: () => context.push('/announcements'), icon: const Icon(Icons.campaign_outlined)),
          IconButton(onPressed: () => context.push('/agenda'), icon: const Icon(Icons.event_outlined)),
          IconButton(onPressed: () => context.push('/profile'), icon: const Icon(Icons.person_outline)),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Olá, ${session?.user.name ?? ''}', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () => context.push('/tickets'),
              icon: const Icon(Icons.support_agent),
              label: const Text('Abrir Tickets'),
            ),
            const SizedBox(height: 16),
            metrics.when(
              data: (m) => Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _MetricCard(title: 'Pendentes', value: '${m.pending}'),
                  _MetricCard(title: 'Abertos', value: '${m.open}'),
                  _MetricCard(title: 'Fechados', value: '${m.closed}'),
                ],
              ),
              loading: () => const Center(child: Padding(padding: EdgeInsets.all(18), child: CircularProgressIndicator())),
              error: (e, _) => Text('Erro ao carregar métricas: $e'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String title;
  final String value;
  const _MetricCard({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: (MediaQuery.of(context).size.width - 16 * 2 - 12) / 2,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 10),
              Text(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900)),
            ],
          ),
        ),
      ),
    );
  }
}

