import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/agenda_providers.dart';
import '../../domain/entities/agenda_event.dart';

class AgendaScreen extends ConsumerWidget {
  const AgendaScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final st = ref.watch(agendaControllerProvider);
    final ctrl = ref.read(agendaControllerProvider.notifier);

    Map<String, List<AgendaEvent>> groupByDay() {
      final map = <String, List<AgendaEvent>>{};
      for (final e in st.items) {
        final d = DateTime(e.startAt.year, e.startAt.month, e.startAt.day);
        final key = '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
        map[key] = (map[key] ?? [])..add(e);
      }
      return map;
    }

    final grouped = groupByDay();
    final keys = grouped.keys.toList()..sort();

    return Scaffold(
      appBar: AppBar(title: const Text('Agenda')),
      body: Column(
        children: [
          if (st.loading) const LinearProgressIndicator(minHeight: 2),
          if (st.error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(st.error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ctrl.refresh(),
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  if (!st.loading && st.items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 30),
                      child: Text(
                        'Nenhum evento na agenda.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                    ),
                  for (final day in keys) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 10, bottom: 6),
                      child: Text(day, style: const TextStyle(fontWeight: FontWeight.w900)),
                    ),
                    ...grouped[day]!.map((ev) {
                      final start = ev.startAt;
                      final end = ev.endAt;
                      final timeLabel = ev.allDay
                          ? 'Dia inteiro'
                          : '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')} - ${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
                      return InkWell(
                        onTap: () => context.push('/agenda/event', extra: ev),
                        borderRadius: BorderRadius.circular(16),
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Ink(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.55)),
                              color: Theme.of(context).colorScheme.surface,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 10,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).colorScheme.primary,
                                    borderRadius: BorderRadius.circular(99),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(ev.title.toString(), style: const TextStyle(fontWeight: FontWeight.w900)),
                                      const SizedBox(height: 2),
                                      Text(timeLabel, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                                      if ((ev.location?.toString() ?? '').trim().isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 4),
                                          child: Text(
                                            ev.location.toString(),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurfaceVariant),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

