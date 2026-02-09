import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/ui/attachment_preview.dart';
import '../../../../core/utils/mime_guess.dart';
import '../../../tickets/domain/entities/ticket.dart';
import '../providers/chat_providers.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final int ticketId;
  final Object? ticketExtra; // optional Ticket from navigation
  const ChatScreen({super.key, required this.ticketId, this.ticketExtra});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(chatControllerProvider(widget.ticketId));
    final ctrl = ref.read(chatControllerProvider(widget.ticketId).notifier);
    final ticket = widget.ticketExtra is Ticket ? widget.ticketExtra as Ticket : null;
    final title = ticket?.contact?.name.isNotEmpty == true ? ticket!.contact!.name : 'Atendimento #${widget.ticketId}';

    // Auto-scroll to bottom on new messages
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
            if (ticket?.contact?.number.isNotEmpty == true)
              Text(ticket!.contact!.number, style: const TextStyle(fontSize: 12, color: Colors.white70)),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (st.loading) const LinearProgressIndicator(minHeight: 2),
            if (st.uploading) const LinearProgressIndicator(minHeight: 2),
            if (st.uploading && st.uploadProgress != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                child: Row(
                  children: [
                    const Spacer(),
                    Flexible(
                      child: Text(
                        [
                          'Enviando',
                          if (st.uploadFileIndex != null && st.uploadFileTotal != null) '${st.uploadFileIndex}/${st.uploadFileTotal}',
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
              child: Container(
                color: Theme.of(context).colorScheme.surface,
                child: ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                  itemCount: st.messages.length,
                  itemBuilder: (context, i) {
                    final m = st.messages[i];
                    final isMe = m.fromMe;
                    return _Bubble(
                      message: m.body,
                      isMe: isMe,
                      pending: m.pending,
                      error: m.error,
                      mediaUrl: m.mediaUrl,
                      onOpenMedia: m.mediaUrl == null ? null : () => _openMedia(m.mediaUrl!),
                    );
                  },
                ),
              ),
            ),
            _Composer(
              controller: _text,
              onSend: () async {
                final v = _text.text;
                _text.clear();
                await ctrl.sendText(v);
              },
              onAttach: () async {
                if (st.uploading) return;
                // iOS can return files without a filesystem path (e.g. iCloud/Files).
                // Using withData ensures we can still upload.
                final picked = await FilePicker.platform.pickFiles(withData: true, allowMultiple: true);
                final files = (picked?.files ?? const <PlatformFile>[])
                    .where((f) => (f.path != null && f.path!.trim().isNotEmpty) || (f.bytes != null && f.bytes!.isNotEmpty))
                    .map((f) => (path: f.path, bytes: f.bytes, name: f.name, mimeType: guessMimeType(f.name)))
                    .toList();
                if (files.isEmpty) return;
                if (files.length == 1) {
                  final f = files.first;
                  await ctrl.sendMedia(body: _text.text, filePath: f.path, fileBytes: f.bytes, fileName: f.name, mimeType: f.mimeType);
                } else {
                  await ctrl.sendMediaBatch(body: _text.text, files: files);
                }
                _text.clear();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openMedia(String mediaUrl) async {
    await openAttachment(context, ref, urlOrPath: mediaUrl);
  }
}

class _Composer extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onAttach;
  final VoidCallback onSend;
  const _Composer({required this.controller, required this.onAttach, required this.onSend});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.5))),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onAttach,
            icon: const Icon(Icons.attach_file),
            tooltip: 'Anexar',
          ),
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(
                hintText: 'Mensagem',
                filled: true,
                fillColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.55),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              borderRadius: BorderRadius.circular(18),
            ),
            child: IconButton(
              onPressed: onSend,
              icon: const Icon(Icons.send),
              color: Colors.white,
              tooltip: 'Enviar',
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final String message;
  final bool isMe;
  final bool pending;
  final String? error;
  final String? mediaUrl;
  final VoidCallback? onOpenMedia;

  const _Bubble({
    required this.message,
    required this.isMe,
    required this.pending,
    required this.error,
    required this.mediaUrl,
    required this.onOpenMedia,
  });

  @override
  Widget build(BuildContext context) {
    final bg = isMe ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.surfaceContainerHighest;
    final fg = isMe ? Colors.white : Theme.of(context).colorScheme.onSurface;
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 5),
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(isMe ? 14 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 14),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (mediaUrl != null)
              InkWell(
                onTap: onOpenMedia,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.insert_drive_file_outlined, color: fg),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Abrir anexo',
                          style: TextStyle(color: fg, decoration: TextDecoration.underline),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Text(message, style: TextStyle(color: fg, height: 1.25)),
            const SizedBox(height: 6),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (pending) Icon(Icons.access_time, size: 14, color: fg.withOpacity(0.85)),
                if (error != null) ...[
                  Icon(Icons.error_outline, size: 14, color: Colors.red.shade200),
                  const SizedBox(width: 6),
                  Text(error!, style: TextStyle(color: Colors.red.shade200, fontSize: 11)),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

