import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/providers.dart';
import '../core/errors/app_exception.dart';
import 'ticket_models.dart';
import 'tickets_service.dart';

final ticketStatusProvider = StateProvider<String>((ref) => 'open');
final ticketSearchProvider = StateProvider<String>((ref) => '');

final ticketsProvider = FutureProvider<List<Ticket>>((ref) async {
  final dio = ref.read(dioProvider);
  final status = ref.watch(ticketStatusProvider);
  final search = ref.watch(ticketSearchProvider);
  return TicketsService(dio).listTickets(status: status, search: search);
});

class TicketsListScreen extends ConsumerWidget {
  const TicketsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(ticketStatusProvider);
    final tickets = ref.watch(ticketsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tickets'),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(ticketsProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                onChanged: (v) => ref.read(ticketSearchProvider.notifier).state = v,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Buscar por nome, número ou última mensagem',
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'pending', label: Text('Pendente')),
                  ButtonSegment(value: 'open', label: Text('Aberto')),
                  ButtonSegment(value: 'closed', label: Text('Fechado')),
                ],
                selected: {status},
                onSelectionChanged: (s) => ref.read(ticketStatusProvider.notifier).state = s.first,
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: tickets.when(
                data: (list) => RefreshIndicator(
                  onRefresh: () async => ref.invalidate(ticketsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, i) => _TicketTile(ticket: list[i]),
                  ),
                ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) {
                  final msg = e is AppException ? e.message : e.toString();
                  return Center(child: Text('Erro: $msg'));
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TicketTile extends StatelessWidget {
  final Ticket ticket;
  const _TicketTile({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final contact = ticket.contact;
    return Card(
      child: ListTile(
        onTap: () => context.push('/tickets/${ticket.id}'),
        leading: CircleAvatar(
          child: Text((contact?.name.isNotEmpty == true ? contact!.name[0] : '#').toUpperCase()),
        ),
        title: Text(contact?.name.isNotEmpty == true ? contact!.name : 'Contato #${contact?.id ?? '-'}'),
        subtitle: Text(ticket.lastMessage ?? ''),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(ticket.status, style: const TextStyle(fontWeight: FontWeight.w700)),
            if ((ticket.unreadMessages ?? 0) > 0)
              Container(
                margin: const EdgeInsets.only(top: 6),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('${ticket.unreadMessages}', style: const TextStyle(color: Colors.white)),
              ),
          ],
        ),
      ),
    );
  }
}

