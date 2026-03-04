import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'dart:convert';

import '../../../../core/di/core_providers.dart';
import '../../../../core/utils/phone_format.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../controllers/contact_detail_controller.dart';
import '../providers/contacts_providers.dart';
import '../state/contact_detail_state.dart';

final contactDetailProvider = StateNotifierProvider.family<
    ContactDetailController, ContactDetailState, int>((ref, id) {
  return ContactDetailController(
      ref.watch(contactsRemoteDataSourceProvider), id);
});

class ContactDetailScreen extends ConsumerStatefulWidget {
  final int id;
  const ContactDetailScreen({super.key, required this.id});

  @override
  ConsumerState<ContactDetailScreen> createState() =>
      _ContactDetailScreenState();
}

class _ContactDetailScreenState extends ConsumerState<ContactDetailScreen> {
  bool _creatingTicket = false;

  bool _isAdminProfile(String? profile) {
    final p = (profile ?? '').trim().toLowerCase();
    return p == 'admin' || p == 'super';
  }

  Future<List<({int id, String name})>> _loadQueues() async {
    final res = await ref.read(dioProvider).get('/queue');
    final raw = res.data;
    if (raw is! List) return const [];
    final out = <({int id, String name})>[];
    for (final item in raw) {
      if (item is! Map) continue;
      final map = item.cast<dynamic, dynamic>();
      final id = int.tryParse('${map['id'] ?? ''}') ?? 0;
      if (id <= 0) continue;
      final name = '${map['name'] ?? ''}'.trim();
      out.add((id: id, name: name.isEmpty ? 'Fila $id' : name));
    }
    return out;
  }

  Future<int?> _pickQueueId({
    required List<({int id, String name})> queues,
    required bool allowNoQueue,
  }) async {
    if (queues.isEmpty) return null;
    if (queues.length == 1 && !allowNoQueue) return queues.first.id;

    return showDialog<int?>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Selecione uma fila'),
        children: [
          if (allowNoQueue)
            SimpleDialogOption(
              onPressed: () => Navigator.of(ctx).pop(null),
              child: const Text('Sem fila'),
            ),
          ...queues.map(
            (q) => SimpleDialogOption(
              onPressed: () => Navigator.of(ctx).pop(q.id),
              child: Text(q.name),
            ),
          ),
        ],
      ),
    );
  }

  int? _extractTicketId(dynamic payload) {
    if (payload is String) {
      final txt = payload.trim();
      if (txt.isEmpty) return null;
      try {
        final decoded = jsonDecode(txt);
        return _extractTicketId(decoded);
      } catch (_) {
        return null;
      }
    }
    if (payload is Map) {
      final map = payload.cast<dynamic, dynamic>();
      final directId = int.tryParse('${map['id'] ?? ''}');
      if (directId != null && directId > 0) return directId;

      final errorPayload = map['error'];
      final fromError = _extractTicketId(errorPayload);
      if (fromError != null && fromError > 0) return fromError;

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
      final canSkipQueue =
          (auth.user?.admin ?? false) || _isAdminProfile(auth.user?.profile);
      int? queueId;

      try {
        final queues = await _loadQueues();
        if (queues.isEmpty) {
          if (!canSkipQueue) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Nenhuma fila disponível para seu usuário.'),
              ),
            );
            return;
          }
        } else if (queues.length == 1) {
          queueId = queues.first.id;
        } else {
          queueId = await _pickQueueId(
            queues: queues,
            allowNoQueue: canSkipQueue,
          );
          if (!canSkipQueue && queueId == null) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                  content: Text('Selecione uma fila para continuar.')),
            );
            return;
          }
        }
      } on DioException catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_extractErrorMessage(e.response?.data))),
        );
        return;
      }

      final res = await ref.read(dioProvider).post(
        '/tickets',
        data: {
          'contactId': c.id,
          'status': 'open',
          if (userId != null && userId > 0) 'userId': userId,
          if (queueId != null && queueId > 0) 'queueId': queueId,
        },
      );

      final ticketId = _extractTicketId(res.data);
      if (!mounted) return;

      if (ticketId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Ticket criado, mas não foi possível abrir automaticamente.')),
        );
        return;
      }

      context.push('/tickets/$ticketId');
    } on DioException catch (e) {
      final existingTicketId = _extractTicketId(e.response?.data);
      if (!mounted) return;

      if (existingTicketId != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Já existe ticket aberto para este contato. Abrindo atendimento.')),
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
  Widget build(BuildContext context) {
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
                child:
                    Text(st.error!, style: const TextStyle(color: Colors.red)),
              ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => ctrl.refresh(),
                child: ListView(
                  padding: const EdgeInsets.all(14),
                  children: [
                    if (c == null && !st.loading)
                      Text('Contato não encontrado.',
                          style: TextStyle(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant)),
                    if (c != null) ...[
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: Theme.of(context)
                                .colorScheme
                                .primary
                                .withValues(alpha: 0.12),
                            child: Icon(Icons.person_outline,
                                color: Theme.of(context).colorScheme.primary,
                                size: 28),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  c.name.trim().isEmpty
                                      ? 'Contato'
                                      : c.name.trim(),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 18),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  formatPhoneBr(c.number),
                                  style: TextStyle(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant),
                                ),
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
                        onPressed: _creatingTicket
                            ? null
                            : () => _createTicketForContact(st),
                        icon: _creatingTicket
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.add_comment_outlined),
                        label: Text(_creatingTicket
                            ? 'Criando ticket...'
                            : 'Criar ticket para este contato'),
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
