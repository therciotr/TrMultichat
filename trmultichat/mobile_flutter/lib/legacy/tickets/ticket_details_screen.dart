import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class TicketDetailsScreen extends StatelessWidget {
  final int ticketId;
  const TicketDetailsScreen({super.key, required this.ticketId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Ticket #$ticketId')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: ListTile(
                leading: const Icon(Icons.chat_bubble_outline),
                title: const Text('Atendimento (Chat)'),
                subtitle: const Text('Mensagens em tempo real'),
                onTap: () => context.push('/chat/$ticketId'),
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('Contato'),
                subtitle: const Text('Detalhes do cliente (em breve)'),
                onTap: () {},
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: ListTile(
                leading: const Icon(Icons.label_outline),
                title: const Text('Tags'),
                subtitle: const Text('Gerenciar tags do ticket (em breve)'),
                onTap: () {},
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: ListTile(
                leading: const Icon(Icons.sticky_note_2_outlined),
                title: const Text('Notas internas'),
                subtitle: const Text('Anotações do ticket/contato (em breve)'),
                onTap: () {},
              ),
            ),
          ],
        ),
      ),
    );
  }
}

