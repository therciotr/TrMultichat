import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../controllers/contact_detail_controller.dart';
import '../providers/contacts_providers.dart';
import '../state/contact_detail_state.dart';

final contactDetailProvider = StateNotifierProvider.family<ContactDetailController, ContactDetailState, int>((ref, id) {
  return ContactDetailController(ref.watch(contactsRemoteDataSourceProvider), id);
});

class ContactDetailScreen extends ConsumerWidget {
  final int id;
  const ContactDetailScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final st = ref.watch(contactDetailProvider(id));
    final ctrl = ref.read(contactDetailProvider(id).notifier);
    final c = st.contact;

    return Scaffold(
      appBar: AppBar(title: const Text('Contato')),
      body: SafeArea(
        child: Column(
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
                    if (c == null && !st.loading)
                      Text('Contato não encontrado.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                    if (c != null) ...[
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
                            child: Icon(Icons.person_outline, color: Theme.of(context).colorScheme.primary, size: 28),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  c.name.trim().isEmpty ? 'Contato' : c.name.trim(),
                                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(c.number, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: () {
                          final q = Uri.encodeComponent(c.number.trim());
                          context.push('/tickets/all?search=$q');
                        },
                        icon: const Icon(Icons.confirmation_number_outlined),
                        label: const Text('Ver tickets deste contato'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

