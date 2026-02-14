import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../auth/presentation/providers/auth_providers.dart';
import '../controllers/announcements_controller.dart';
import '../providers/announcements_providers.dart';

class AnnouncementsScreen extends ConsumerStatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  ConsumerState<AnnouncementsScreen> createState() =>
      _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends ConsumerState<AnnouncementsScreen> {
  final _search = TextEditingController();

  Future<void> _openCreateDialog() async {
    final ctrl = ref.read(announcementsControllerProvider.notifier);
    final ok = await showModalBottomSheet<bool>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => _CreateInternalChatSheet(controller: ctrl),
    );
    if (ok == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chat interno criado com sucesso.')),
      );
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(announcementsControllerProvider);
    final ctrl = ref.read(announcementsControllerProvider.notifier);
    final auth = ref.watch(authControllerProvider);
    final isAdmin = auth.user?.admin == true ||
        auth.user?.isSuper == true ||
        (auth.user?.profile ?? '').toLowerCase() == 'admin' ||
        (auth.user?.profile ?? '').toLowerCase() == 'super';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat - Interno'),
        actions: [
          IconButton(
            tooltip: 'Sair',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Sair'),
                  content: const Text('Deseja sair da sua conta?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancelar'),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Sair'),
                    ),
                  ],
                ),
              );
              if (ok != true) return;
              await ref.read(authControllerProvider.notifier).logout();
              if (!mounted) return;
              context.go('/login');
            },
          ),
        ],
      ),
      floatingActionButton: isAdmin
          ? FloatingActionButton.extended(
              onPressed: _openCreateDialog,
              icon: const Icon(Icons.add),
              label: const Text('Novo chat'),
            )
          : null,
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
                hintText: 'Buscar no chat interno',
                filled: true,
                fillColor: Theme.of(context)
                    .colorScheme
                    .surfaceContainerHighest
                    .withOpacity(0.55),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none),
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
                  final title =
                      a.title.trim().isEmpty ? 'Informativo' : a.title.trim();
                  final sub = a.text.trim().replaceAll('\n', ' ');
                  return ListTile(
                    leading: Stack(
                      children: [
                        CircleAvatar(
                          backgroundColor: Theme.of(context)
                              .colorScheme
                              .primary
                              .withOpacity(0.12),
                          child: Icon(Icons.campaign_outlined,
                              color: Theme.of(context).colorScheme.primary),
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
                                border: Border.all(
                                    color:
                                        Theme.of(context).colorScheme.surface,
                                    width: 2),
                              ),
                            ),
                          )
                      ],
                    ),
                    title: Text(title,
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(sub.isEmpty ? (a.senderName ?? '') : sub,
                        maxLines: 2, overflow: TextOverflow.ellipsis),
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
                'Nenhuma conversa no Chat Interno.',
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ),
        ],
      ),
    );
  }
}

class _CreateInternalChatSheet extends StatefulWidget {
  final AnnouncementsController controller;
  const _CreateInternalChatSheet({required this.controller});

  @override
  State<_CreateInternalChatSheet> createState() =>
      _CreateInternalChatSheetState();
}

class _CreateInternalChatSheetState extends State<_CreateInternalChatSheet> {
  final _titleCtrl = TextEditingController();
  final _textCtrl = TextEditingController();
  bool _allowReply = true;
  bool _sendToAll = true;
  bool _saving = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_saving) return;
    setState(() => _saving = true);
    final ok = await widget.controller.create(
      title: _titleCtrl.text,
      text: _textCtrl.text,
      sendToAll: _sendToAll,
      allowReply: _allowReply,
      priority: 3,
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (ok == true) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Novo Chat - Interno',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(
              labelText: 'Titulo',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _textCtrl,
            minLines: 4,
            maxLines: 8,
            decoration: const InputDecoration(
              labelText: 'Mensagem',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Enviar para todos'),
            value: _sendToAll,
            onChanged: (v) => setState(() => _sendToAll = v),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Permitir respostas'),
            value: _allowReply,
            onChanged: (v) => setState(() => _allowReply = v),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _saving ? null : _submit,
            icon: const Icon(Icons.send),
            label: Text(_saving ? 'Criando...' : 'Criar'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _saving ? null : () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
        ],
      ),
    );
  }
}
