import 'dart:io';
import 'dart:typed_data';

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
  Uint8List? _pickedBytes;

  bool _isImageFile(String? name, String? path, String? mimeType) {
    final n = (name ?? '').toLowerCase();
    final p = (path ?? '').toLowerCase();
    final m = (mimeType ?? '').toLowerCase();
    return m.startsWith('image/') ||
        n.endsWith('.png') ||
        n.endsWith('.jpg') ||
        n.endsWith('.jpeg') ||
        n.endsWith('.webp') ||
        n.endsWith('.gif') ||
        p.endsWith('.png') ||
        p.endsWith('.jpg') ||
        p.endsWith('.jpeg') ||
        p.endsWith('.webp') ||
        p.endsWith('.gif');
  }

  IconData _pickedFileIcon(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.pdf')) return Icons.picture_as_pdf_outlined;
    if (n.endsWith('.doc') || n.endsWith('.docx')) return Icons.description_outlined;
    if (n.endsWith('.xls') || n.endsWith('.xlsx')) return Icons.table_chart_outlined;
    if (n.endsWith('.zip') || n.endsWith('.rar') || n.endsWith('.7z')) return Icons.folder_zip_outlined;
    if (n.endsWith('.mp4') || n.endsWith('.mov') || n.endsWith('.avi') || n.endsWith('.mkv') || n.endsWith('.webm')) {
      return Icons.videocam_outlined;
    }
    if (n.endsWith('.mp3') || n.endsWith('.m4a') || n.endsWith('.wav') || n.endsWith('.ogg') || n.endsWith('.aac')) {
      return Icons.audiotrack_outlined;
    }
    return Icons.insert_drive_file_outlined;
  }

  Future<void> _confirmDelete({
    required AnnouncementDetailController ctrl,
  }) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir chat interno?'),
        content: const Text('Essa acao e permanente.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton.tonal(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final deleted = await ctrl.deleteAnnouncement();
    if (!mounted) return;
    if (!deleted) {
      final err =
          ref.read(announcementDetailProvider(widget.id)).error?.trim() ?? '';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            err.isNotEmpty ? err : 'Falha ao excluir chat interno',
          ),
        ),
      );
      return;
    }
    await ref.read(announcementsControllerProvider.notifier).refresh();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Chat interno excluido com sucesso')),
    );
    Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  bool _hasUsableLocalPath(String? path) {
    final p = (path ?? '').trim();
    if (p.isEmpty) return false;
    // Android pickers can return content:// URIs; MultipartFile.fromFile
    // requires a real local filesystem path.
    return p.startsWith('/');
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(announcementDetailProvider(widget.id));
    final ctrl = ref.read(announcementDetailProvider(widget.id).notifier);
    final a = st.announcement;
    final auth = ref.watch(authControllerProvider);
    final isAdmin = auth.user?.admin == true ||
        auth.user?.isSuper == true ||
        (auth.user?.profile ?? '').toLowerCase() == 'admin' ||
        (auth.user?.profile ?? '').toLowerCase() == 'super';

    return Scaffold(
      appBar: AppBar(
        title: Text(
            (a?.title ?? '').trim().isEmpty ? 'Chat - Interno' : (a!.title)),
        actions: [
          if (isAdmin)
            IconButton(
              tooltip: 'Excluir',
              onPressed: st.loading || st.sending
                  ? null
                  : () => _confirmDelete(ctrl: ctrl),
              icon: const Icon(Icons.delete_outline),
            ),
        ],
      ),
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
                            final picked = await FilePicker.platform
                                .pickFiles(withData: true, withReadStream: true);
                            final f = picked?.files.isNotEmpty == true ? picked!.files.first : null;
                            if (f == null) return;
                            final hasPath = _hasUsableLocalPath(f.path);
                            Uint8List? bytes = f.bytes;
                            final hasStream = f.readStream != null;
                            if (!hasPath &&
                                (bytes == null || bytes.isEmpty) &&
                                !hasStream) {
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text(
                                        'Nao foi possivel ler o arquivo selecionado')),
                              );
                              return;
                            }
                            setState(() {
                              _picked = f;
                              _pickedBytes = bytes;
                            });
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
                            final file = _picked;
                            final bytes = _pickedBytes;
                            final usablePath = _hasUsableLocalPath(file?.path);
                            final stream = (!usablePath &&
                                    (bytes == null || bytes.isEmpty))
                                ? file?.readStream
                                : null;
                            final ok = await ctrl.send(
                              text,
                              filePath: usablePath ? file?.path : null,
                              fileBytes: bytes ?? file?.bytes,
                              fileStream: stream,
                              fileSize: stream == null ? null : file?.size,
                              fileName: file?.name,
                              mimeType: null,
                            );
                            if (!ok) {
                              if (!mounted) return;
                              final err = ref
                                      .read(announcementDetailProvider(widget.id))
                                      .error
                                      ?.trim() ??
                                  '';
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                    content: Text(err.isNotEmpty
                                        ? err
                                        : 'Falha ao enviar mensagem/anexo')),
                              );
                              return;
                            }
                            _reply.clear();
                            if (mounted) {
                              setState(() {
                                _picked = null;
                                _pickedBytes = null;
                              });
                            }
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
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 260),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.55),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.6),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_isImageFile(_picked!.name, _picked!.path, null))
                        ClipRRect(
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(11),
                            bottomLeft: Radius.circular(11),
                          ),
                          child: (_pickedBytes != null && _pickedBytes!.isNotEmpty)
                              ? Image.memory(
                                  _pickedBytes!,
                                  width: 56,
                                  height: 56,
                                  fit: BoxFit.cover,
                                )
                              : ((_picked!.path ?? '').trim().isNotEmpty
                                  ? Image.file(
                                      File(_picked!.path!),
                                      width: 56,
                                      height: 56,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => SizedBox(
                                        width: 56,
                                        height: 56,
                                        child: Icon(
                                          Icons.image_outlined,
                                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                                        ),
                                      ),
                                    )
                                  : SizedBox(
                                      width: 56,
                                      height: 56,
                                      child: Icon(
                                        Icons.image_outlined,
                                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                                      ),
                                    )),
                        )
                      else
                        SizedBox(
                          width: 56,
                          height: 56,
                          child: Icon(
                            _pickedFileIcon(_picked!.name),
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(
                            _picked!.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Remover anexo',
                        visualDensity: VisualDensity.compact,
                        onPressed: () => setState(() {
                          _picked = null;
                          _pickedBytes = null;
                        }),
                        icon: const Icon(Icons.close, size: 18),
                      ),
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

class _ReplyBubble extends ConsumerWidget {
  final AnnouncementReply reply;
  const _ReplyBubble({required this.reply});

  bool _isImage(String? mediaType, String? mediaPathOrName) {
    final mt = (mediaType ?? '').toLowerCase();
    final target = (mediaPathOrName ?? '').toLowerCase();
    return mt.startsWith('image/') ||
        target.endsWith('.png') ||
        target.endsWith('.jpg') ||
        target.endsWith('.jpeg') ||
        target.endsWith('.webp') ||
        target.endsWith('.gif');
  }

  bool _isVideo(String? mediaType, String? mediaPathOrName) {
    final mt = (mediaType ?? '').toLowerCase();
    final target = (mediaPathOrName ?? '').toLowerCase();
    return mt.startsWith('video/') ||
        target.endsWith('.mp4') ||
        target.endsWith('.mov') ||
        target.endsWith('.avi') ||
        target.endsWith('.mkv') ||
        target.endsWith('.webm');
  }

  bool _isAudio(String? mediaType, String? mediaPathOrName) {
    final mt = (mediaType ?? '').toLowerCase();
    final target = (mediaPathOrName ?? '').toLowerCase();
    return mt.startsWith('audio/') ||
        target.endsWith('.mp3') ||
        target.endsWith('.m4a') ||
        target.endsWith('.wav') ||
        target.endsWith('.ogg') ||
        target.endsWith('.aac') ||
        target.endsWith('.opus');
  }

  IconData _fileIcon(String? mediaType, String? mediaPathOrName) {
    final target = (mediaPathOrName ?? '').toLowerCase();
    if (_isImage(mediaType, mediaPathOrName)) return Icons.image_outlined;
    if (_isVideo(mediaType, mediaPathOrName)) return Icons.videocam_outlined;
    if (_isAudio(mediaType, mediaPathOrName)) return Icons.audiotrack_outlined;
    if (target.endsWith('.pdf')) return Icons.picture_as_pdf_outlined;
    if (target.endsWith('.doc') || target.endsWith('.docx')) {
      return Icons.description_outlined;
    }
    if (target.endsWith('.xls') || target.endsWith('.xlsx')) {
      return Icons.table_chart_outlined;
    }
    if (target.endsWith('.zip') || target.endsWith('.rar') || target.endsWith('.7z')) {
      return Icons.folder_zip_outlined;
    }
    return Icons.attach_file;
  }

  String _absoluteUrl(String raw, WidgetRef ref) {
    if (raw.startsWith('http')) return raw;
    final base = ref.read(dioProvider).options.baseUrl.replaceAll(RegExp(r'/+$'), '');
    return '$base/${raw.replaceAll(RegExp(r'^/+'), '')}';
  }

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
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () => openAttachment(
                    context,
                    ref,
                    urlOrPath: reply.mediaPath!,
                    mimeType: reply.mediaType,
                  ),
                  child: _isImage(reply.mediaType, reply.mediaPath ?? reply.mediaName)
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            _absoluteUrl(reply.mediaPath!, ref),
                            width: 180,
                            height: 120,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 180,
                              height: 70,
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              decoration: BoxDecoration(
                                color: Colors.black12,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                children: [
                                  Icon(_fileIcon(reply.mediaType, reply.mediaPath ?? reply.mediaName), color: fg),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      reply.mediaName ?? 'Abrir anexo',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(color: fg, decoration: TextDecoration.underline),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        )
                      : Container(
                          constraints: const BoxConstraints(minWidth: 180, maxWidth: 240),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.black12,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              Icon(_fileIcon(reply.mediaType, reply.mediaPath ?? reply.mediaName), color: fg),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  reply.mediaName ?? 'Abrir anexo',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(color: fg, decoration: TextDecoration.underline),
                                ),
                              ),
                            ],
                          ),
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

