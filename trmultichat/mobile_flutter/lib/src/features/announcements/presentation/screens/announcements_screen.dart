import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:typed_data';

import '../../../../core/di/core_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/announcements_remote_datasource.dart';
import '../../domain/entities/announcement.dart';
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

  bool _hasUsableLocalPath(String? path) {
    final p = (path ?? '').trim();
    if (p.isEmpty) return false;
    return p.startsWith('/');
  }

  Future<List<Map<String, dynamic>>> _loadUsers({
    String search = '',
  }) async {
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        '/users/list',
        queryParameters: {
          'pageNumber': 1,
          if (search.trim().isNotEmpty) 'searchParam': search.trim(),
        },
      );
      final raw = res.data;
      if (raw is List) {
        return raw
            .whereType<Map>()
            .map((e) => e.cast<String, dynamic>())
            .toList();
      }
      if (raw is Map) {
        final data = raw.cast<String, dynamic>();
        final list = (data['users'] ?? data['records'] ?? data['items']);
        if (list is List) {
          return list
              .whereType<Map>()
              .map((e) => e.cast<String, dynamic>())
              .toList();
        }
      }
    } catch (_) {}
    return const [];
  }

  Future<void> _openEditor([Announcement? initial]) async {
    final remote = ref.read(announcementsRemoteDataSourceProvider);
    final titleCtrl = TextEditingController(text: initial?.title ?? '');
    final textCtrl = TextEditingController(text: initial?.text ?? '');
    bool status = initial?.status ?? true;
    int priority = initial?.priority ?? 3;
    bool sendToAll = initial?.sendToAll ?? true;
    int? targetUserId = initial?.targetUserId;
    bool allowReply = initial?.allowReply ?? true;
    bool removeExistingMedia = false;
    bool saving = false;
    bool usersLoading = false;
    String userSearch = '';
    List<Map<String, dynamic>> users = const [];
    PlatformFile? picked;
    Uint8List? pickedBytes;

    Future<void> refreshUsers(StateSetter setLocal) async {
      setLocal(() => usersLoading = true);
      final result = await _loadUsers(search: userSearch);
      setLocal(() {
        users = result;
        usersLoading = false;
      });
    }

    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text(
            initial == null ? 'Novo Chat - Interno' : 'Editar Chat - Interno',
          ),
          content: SizedBox(
            width: 720,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Titulo',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: textCtrl,
                    minLines: 5,
                    maxLines: 8,
                    decoration: const InputDecoration(
                      labelText: 'Mensagem',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          value: priority,
                          decoration: const InputDecoration(
                            labelText: 'Prioridade',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(value: 1, child: Text('Alta')),
                            DropdownMenuItem(value: 2, child: Text('Media')),
                            DropdownMenuItem(value: 3, child: Text('Baixa')),
                          ],
                          onChanged: (v) =>
                              setLocal(() => priority = v ?? priority),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<bool>(
                          value: status,
                          decoration: const InputDecoration(
                            labelText: 'Status',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(value: true, child: Text('Ativo')),
                            DropdownMenuItem(
                                value: false, child: Text('Inativo')),
                          ],
                          onChanged: (v) => setLocal(() => status = v ?? true),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Enviar para todos'),
                    value: sendToAll,
                    onChanged: (v) async {
                      setLocal(() => sendToAll = v);
                      if (!v && users.isEmpty && !usersLoading) {
                        await refreshUsers(setLocal);
                      }
                    },
                  ),
                  if (!sendToAll) ...[
                    const SizedBox(height: 8),
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Buscar usuario',
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (v) => userSearch = v,
                      onSubmitted: (_) => refreshUsers(setLocal),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<int?>(
                      value: targetUserId,
                      decoration: const InputDecoration(
                        labelText: 'Usuario',
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        const DropdownMenuItem<int?>(
                          value: null,
                          child: Text('Selecione...'),
                        ),
                        ...users.map((u) {
                          final id = (u['id'] as num?)?.toInt();
                          final name =
                              (u['name'] ?? 'Usuario').toString().trim();
                          return DropdownMenuItem<int?>(
                            value: id,
                            child: Text(id == null ? name : '$name (#$id)'),
                          );
                        }),
                      ],
                      onChanged: (v) => setLocal(() => targetUserId = v),
                    ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed:
                            usersLoading ? null : () => refreshUsers(setLocal),
                        icon: const Icon(Icons.refresh),
                        label: Text(
                          usersLoading ? 'Carregando usuarios...' : 'Atualizar usuarios',
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Permitir resposta do usuario'),
                    value: allowReply,
                    onChanged: (v) => setLocal(() => allowReply = v),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Anexo',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      OutlinedButton.icon(
                        onPressed: saving
                            ? null
                            : () async {
                                final result = await FilePicker.platform
                                    .pickFiles(
                                      withData: true,
                                      withReadStream: true,
                                    );
                                final file = result?.files.isNotEmpty == true
                                    ? result!.files.first
                                    : null;
                                if (file == null) return;
                                setLocal(() {
                                  picked = file;
                                  pickedBytes = file.bytes;
                                });
                              },
                        icon: const Icon(Icons.attach_file),
                        label: Text(
                          picked == null ? 'Anexar arquivo' : picked!.name,
                        ),
                      ),
                      if (initial?.mediaName != null &&
                          initial!.mediaName!.trim().isNotEmpty &&
                          !removeExistingMedia &&
                          picked == null)
                        InputChip(
                          label: Text(initial.mediaName!),
                          onDeleted: () => setLocal(() {
                            removeExistingMedia = true;
                          }),
                        ),
                      if (picked != null)
                        InputChip(
                          label: Text(picked!.name),
                          onDeleted: () => setLocal(() {
                            picked = null;
                            pickedBytes = null;
                          }),
                        ),
                      if (removeExistingMedia)
                        const Chip(label: Text('Anexo atual sera removido')),
                    ],
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.of(ctx).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton.icon(
              onPressed: saving
                  ? null
                  : () async {
                      if (titleCtrl.text.trim().isEmpty ||
                          textCtrl.text.trim().isEmpty) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Informe titulo e mensagem'),
                          ),
                        );
                        return;
                      }
                      setLocal(() => saving = true);
                      try {
                        final saved = initial == null
                            ? await remote.create(
                                title: titleCtrl.text,
                                text: textCtrl.text,
                                priority: priority,
                                status: status,
                                sendToAll: sendToAll,
                                targetUserId: targetUserId,
                                allowReply: allowReply,
                              )
                            : await remote.update(
                                id: initial.id,
                                title: titleCtrl.text,
                                text: textCtrl.text,
                                priority: priority,
                                status: status,
                                sendToAll: sendToAll,
                                targetUserId: targetUserId,
                                allowReply: allowReply,
                              );

                        if (removeExistingMedia && initial?.mediaPath != null) {
                          await remote.deleteMedia(saved.id);
                        }
                        if (picked != null) {
                          final file = picked!;
                          final usablePath = _hasUsableLocalPath(file.path);
                          await remote.uploadMedia(
                            saved.id,
                            filePath: usablePath ? file.path : null,
                            fileBytes: pickedBytes ?? file.bytes,
                            fileStream:
                                (!usablePath &&
                                        ((pickedBytes ?? file.bytes) == null ||
                                            (pickedBytes ?? file.bytes)!.isEmpty))
                                    ? file.readStream
                                    : null,
                            fileSize: file.readStream == null ? null : file.size,
                            fileName: file.name,
                          );
                        }
                        await ref
                            .read(announcementsControllerProvider.notifier)
                            .refresh();
                        if (!mounted) return;
                        Navigator.of(ctx).pop(true);
                      } catch (e) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Falha ao salvar chat interno: $e')),
                        );
                        setLocal(() => saving = false);
                      }
                    },
              icon: const Icon(Icons.save_outlined),
              label: Text(
                saving
                    ? 'Salvando...'
                    : (initial == null ? 'Criar' : 'Salvar'),
              ),
            ),
          ],
        ),
      ),
    );
    titleCtrl.dispose();
    textCtrl.dispose();
    if (ok == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            initial == null
                ? 'Chat interno criado com sucesso.'
                : 'Chat interno atualizado com sucesso.',
          ),
        ),
      );
    }
  }

  Future<void> _deleteAnnouncement(Announcement item) async {
    final remote = ref.read(announcementsRemoteDataSourceProvider);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir chat interno?'),
        content: Text('Deseja excluir "${item.title.trim().isEmpty ? 'Sem titulo' : item.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      if ((item.mediaPath ?? '').trim().isNotEmpty) {
        try {
          await remote.deleteMedia(item.id);
        } catch (_) {}
      }
      await remote.delete(item.id);
      await ref.read(announcementsControllerProvider.notifier).refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chat interno excluido com sucesso.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao excluir chat interno: $e')),
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
              onPressed: () => _openEditor(),
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
                  final priorityLabel = switch (a.priority) {
                    1 => 'Alta',
                    2 => 'Media',
                    _ => 'Baixa',
                  };
                  final destination = a.sendToAll
                      ? 'Todos'
                      : (a.targetUserId != null
                          ? 'Usuario #${a.targetUserId}'
                          : 'Usuario');
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    child: ListTile(
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
                      title: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 6),
                          Text(
                            sub.isEmpty ? (a.senderName ?? '') : sub,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              Chip(
                                label: Text(priorityLabel),
                                visualDensity: VisualDensity.compact,
                              ),
                              Chip(
                                label: Text(a.status ? 'Ativo' : 'Inativo'),
                                visualDensity: VisualDensity.compact,
                              ),
                              Chip(
                                label: Text('Destino: $destination'),
                                visualDensity: VisualDensity.compact,
                              ),
                              Chip(
                                label: Text(
                                    a.allowReply ? 'Resposta: Sim' : 'Resposta: Nao'),
                                visualDensity: VisualDensity.compact,
                              ),
                              if ((a.mediaName ?? '').trim().isNotEmpty)
                                Chip(
                                  label: Text(a.mediaName!),
                                  visualDensity: VisualDensity.compact,
                                ),
                              if (a.repliesCount > 0)
                                Chip(
                                  label: Text('${a.repliesCount} respostas'),
                                  visualDensity: VisualDensity.compact,
                                ),
                            ],
                          ),
                        ],
                      ),
                      trailing: Wrap(
                        spacing: 4,
                        children: [
                          IconButton(
                            tooltip: 'Abrir respostas',
                            onPressed: () async {
                              await ctrl.markRead(a.id);
                              if (!context.mounted) return;
                              context.push('/announcements/${a.id}');
                            },
                            icon: const Icon(Icons.chat_bubble_outline),
                          ),
                          if (isAdmin)
                            IconButton(
                              tooltip: 'Editar',
                              onPressed: () => _openEditor(a),
                              icon: const Icon(Icons.edit_outlined),
                            ),
                          if (isAdmin)
                            IconButton(
                              tooltip: 'Excluir',
                              onPressed: () => _deleteAnnouncement(a),
                              icon: const Icon(Icons.delete_outline),
                            ),
                        ],
                      ),
                      onTap: () async {
                        await ctrl.markRead(a.id);
                        if (!context.mounted) return;
                        context.push('/announcements/${a.id}');
                      },
                    ),
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
