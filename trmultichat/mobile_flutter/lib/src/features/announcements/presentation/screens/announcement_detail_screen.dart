import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/ui/attachment_preview.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../controllers/announcement_detail_controller.dart';
import '../providers/announcements_providers.dart';
import '../../domain/entities/announcement_reply.dart';
import '../state/announcement_detail_state.dart';

final announcementDetailProvider = StateNotifierProvider.family<AnnouncementDetailController, AnnouncementDetailState, int>((ref, id) {
  return AnnouncementDetailController(ref.watch(announcementsRemoteDataSourceProvider), id);
});

class AnnouncementDetailScreen extends ConsumerStatefulWidget {
  final int id;
  const AnnouncementDetailScreen({super.key, required this.id});

  @override
  ConsumerState<AnnouncementDetailScreen> createState() => _AnnouncementDetailScreenState();
}

class _AnnouncementDetailScreenState extends ConsumerState<AnnouncementDetailScreen> {
  final _reply = TextEditingController();
  PlatformFile? _picked;

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(announcementDetailProvider(widget.id));
    final ctrl = ref.read(announcementDetailProvider(widget.id).notifier);
    final a = st.announcement;

    return Scaffold(
      appBar: AppBar(title: const Text('Comunicado')),
      body: SafeArea(
        child: Column(
          children: [
            if (st.loading) const LinearProgressIndicator(minHeight: 2),
            if (st.sending && st.uploadProgress != null) const LinearProgressIndicator(minHeight: 2),
            if (st.sending && st.uploadProgress != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                child: Row(
                  children: [
                    const Spacer(),
                    Flexible(
                      child: Text(
                        [
                          'Enviando',
                          if ((st.uploadFileName ?? '').trim().isNotEmpty) '• ${st.uploadFileName}',
                          '— ${((st.uploadProgress ?? 0) * 100).toStringAsFixed(0)}%',
                        ].join(' '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Cancelar envio',
                      onPressed: () => ctrl.cancelUpload(),
                      icon: const Icon(Icons.close, size: 18),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
              ),
            if (st.error != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text(st.error!, style: const TextStyle(color: Colors.red)),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  if (a != null) ...[
                    Text(a.title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text(
                      a.senderName ?? '',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.55)),
                        color: Theme.of(context).colorScheme.surface,
                      ),
                      child: Text(a.text.trim().isEmpty ? '—' : a.text.trim()),
                    ),
                    const SizedBox(height: 16),
                    Text('Respostas', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                  ],
                  ...st.replies.map((r) {
                    return _ReplyBubble(reply: r);
                  }),
                  if (!st.loading && st.replies.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text('Sem respostas.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                    ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.5))),
              ),
              child: Row(
                children: [
                  IconButton(
                    tooltip: 'Anexar',
                    onPressed: st.sending
                        ? null
                        : () async {
                            final picked = await FilePicker.platform.pickFiles(withData: false);
                            final f = picked?.files.isNotEmpty == true ? picked!.files.first : null;
                            if (f == null) return;
                            setState(() => _picked = f);
                          },
                    icon: const Icon(Icons.attach_file),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _reply,
                      minLines: 1,
                      maxLines: 4,
                      decoration: InputDecoration(
                        hintText: 'Responder',
                        filled: true,
                        fillColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.55),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: st.sending
                        ? null
                        : () async {
                            final text = _reply.text;
                            _reply.clear();
                            final file = _picked;
                            setState(() => _picked = null);
                            await ctrl.send(
                              text,
                              filePath: file?.path,
                              fileName: file?.name,
                              mimeType: null,
                            );
                          },
                    child: Text(st.sending ? '...' : 'Enviar'),
                  ),
                ],
              ),
            ),
            if (_picked != null)
              Container(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                alignment: Alignment.centerLeft,
                child: Chip(
                  label: Text(_picked!.name, overflow: TextOverflow.ellipsis),
                  onDeleted: () => setState(() => _picked = null),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ReplyBubble extends ConsumerWidget {
  final AnnouncementReply reply;
  const _ReplyBubble({required this.reply});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.read(authControllerProvider).user?.id == reply.userId;
    final bg = me ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.surfaceContainerHighest;
    final fg = me ? Colors.white : Theme.of(context).colorScheme.onSurface;

    return Align(
      alignment: me ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 5),
        padding: const EdgeInsets.all(10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!me)
              Text(
                reply.userName,
                style: TextStyle(color: fg.withOpacity(0.85), fontWeight: FontWeight.w800, fontSize: 12),
              ),
            if (!me) const SizedBox(height: 4),
            if (reply.mediaPath != null && (reply.mediaPath ?? '').trim().isNotEmpty)
              InkWell(
                onTap: () => openAttachment(context, ref, urlOrPath: reply.mediaPath!, mimeType: reply.mediaType),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.attach_file, color: fg),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          reply.mediaName ?? 'Abrir anexo',
                          style: TextStyle(color: fg, decoration: TextDecoration.underline),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Text(reply.text.trim().isEmpty ? '—' : reply.text.trim(), style: TextStyle(color: fg)),
          ],
        ),
      ),
    );
  }
}

