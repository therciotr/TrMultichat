import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';

import '../../../../core/di/core_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../controllers/contact_detail_controller.dart';
import '../providers/contacts_providers.dart';
import '../state/contact_detail_state.dart';

final contactDetailProvider = StateNotifierProvider.family<ContactDetailController, ContactDetailState, int>((ref, id) {
  return ContactDetailController(ref.watch(contactsRemoteDataSourceProvider), id);
});

class ContactDetailScreen extends ConsumerStatefulWidget {
  final int id;
  const ContactDetailScreen({super.key, required this.id});

  @override
  ConsumerState<ContactDetailScreen> createState() => _ContactDetailScreenState();
}

class _ContactDetailScreenState extends ConsumerState<ContactDetailScreen> {
  bool _creatingTicket = false;

  int? _extractTicketId(dynamic payload) {
    if (payload is Map) {
      final map = payload.cast<dynamic, dynamic>();
      final directId = int.tryParse('${map['id'] ?? ''}');
      if (directId != null && directId > 0) return directId;

      final ticket = map['ticket'];
      if (ticket is Map) {
        final ticketMap = ticket.cast<dynamic, dynamic>();
        final nestedId = int.tryParse('${ticketMap['id'] ?? ''}');
        if (nestedId != null && nestedId > 0) return nestedId;
      }
    }
    return null;
  }

  String _extractErrorMessage(dynamic payload) {
    if (payload is Map) {
      final map = payload.cast<dynamic, dynamic>();
      final message = map['message']?.toString().trim();
      if (message != null && message.isNotEmpty) return message;
      final error = map['error']?.toString().trim();
      if (error != null && error.isNotEmpty) return error;
    }
    return 'Não foi possível criar o ticket.';
  }

  Future<void> _createTicketForContact(ContactDetailState state) async {
    final c = state.contact;
    if (c == null || _creatingTicket) return;

    setState(() => _creatingTicket = true);
    try {
      final auth = ref.read(authControllerProvider);
      final userId = auth.user?.id;
      final res = await ref.read(dioProvider).post(
        '/tickets',
        data: {
          'contactId': c.id,
          'status': 'open',
          if (userId != null && userId > 0) 'userId': userId,
        },
      );

      final ticketId = _extractTicketId(res.data);
      if (!mounted) return;

      if (ticketId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ticket criado, mas não foi possível abrir automaticamente.')),
        );
        return;
      }

      context.push('/tickets/$ticketId');
    } on DioException catch (e) {
      final existingTicketId = _extractTicketId(e.response?.data);
      if (!mounted) return;

      if (existingTicketId != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Já existe ticket aberto para este contato. Abrindo atendimento.')),
        );
        context.push('/tickets/$existingTicketId');
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_extractErrorMessage(e.response?.data))),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível criar o ticket.')),
      );
    } finally {
      if (mounted) setState(() => _creatingTicket = false);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final st = ref.watch(contactDetailProvider(widget.id));
    final ctrl = ref.read(contactDetailProvider(widget.id).notifier);
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
                      const SizedBox(height: 10),
                      OutlinedButton.icon(
                        onPressed: _creatingTicket ? null : () => _createTicketForContact(st),
                        icon: _creatingTicket
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.add_comment_outlined),
                        label: Text(_creatingTicket ? 'Criando ticket...' : 'Criar ticket para este contato'),
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

