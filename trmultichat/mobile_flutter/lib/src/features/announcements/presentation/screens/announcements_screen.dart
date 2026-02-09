import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/announcements_providers.dart';

class AnnouncementsScreen extends ConsumerStatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  ConsumerState<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends ConsumerState<AnnouncementsScreen> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(announcementsControllerProvider);
    final ctrl = ref.read(announcementsControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('Comunicados')),
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
                hintText: 'Buscar comunicados',
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
                itemCount: st.items.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final a = st.items[i];
                  final isRead = st.readIds.contains(a.id);
                  final title = a.title.trim().isEmpty ? 'Comunicado' : a.title.trim();
                  final sub = a.text.trim().replaceAll('\n', ' ');
                  return ListTile(
                    leading: Stack(
                      children: [
                        CircleAvatar(
                          backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
                          child: Icon(Icons.campaign_outlined, color: Theme.of(context).colorScheme.primary),
                        ),
                        if (!isRead)
                          Positioned(
                            right: 0,
                            top: 0,
                            child: Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                color: Colors.redAccent,
                                borderRadius: BorderRadius.circular(99),
                                border: Border.all(color: Theme.of(context).colorScheme.surface, width: 2),
                              ),
                            ),
                          )
                      ],
                    ),
                    title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(sub.isEmpty ? (a.senderName ?? '') : sub, maxLines: 2, overflow: TextOverflow.ellipsis),
                    trailing: a.repliesCount > 0
                        ? Chip(
                            label: Text('${a.repliesCount}'),
                            visualDensity: VisualDensity.compact,
                          )
                        : const Icon(Icons.chevron_right),
                    onTap: () async {
                      await ctrl.markRead(a.id);
                      if (!context.mounted) return;
                      context.push('/announcements/${a.id}');
                    },
                  );
                },
              ),
            ),
          ),
          if (!st.loading && st.items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Nenhum comunicado.',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ),
        ],
      ),
    );
  }
}

