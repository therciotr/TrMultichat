import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_thumbnail/video_thumbnail.dart';

import '../../../../core/attachments/attachment_cache_providers.dart';
import '../../../../core/di/core_providers.dart';
import '../../../../core/share/share_providers.dart';
import '../../../../core/ui/attachment_preview.dart';
import '../../../../core/utils/mime_guess.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../tickets/domain/entities/ticket.dart';
import '../../../tickets/presentation/providers/tickets_providers.dart';
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
  final _recorder = AudioRecorder();
  bool _isRecording = false;
  int _recordSeconds = 0;
  Timer? _recordTimer;
  String? _statusOverride;
  bool _loadingTicketMeta = false;

  @override
  void initState() {
    super.initState();
    _loadTicketMeta();
  }

  Future<void> _loadTicketMeta() async {
    setState(() => _loadingTicketMeta = true);
    try {
      final res =
          await ref.read(dioProvider).get('/tickets/${widget.ticketId}');
      final data =
          (res.data as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      final status = (data['status']?.toString() ?? '').trim().toLowerCase();
      if (!mounted) return;
      setState(() {
        _statusOverride = status.isEmpty ? null : status;
      });
    } catch (_) {
      // keep status from navigation fallback
    } finally {
      if (mounted) {
        setState(() => _loadingTicketMeta = false);
      }
    }
  }

  Future<void> _updateTicketStatus(String status) async {
    final next = status.trim().toLowerCase();
    if (next.isEmpty) return;
    final auth = ref.read(authControllerProvider);
    final userId = auth.user?.id;
    try {
      await ref.read(dioProvider).put(
        '/tickets/${widget.ticketId}',
        data: {
          'status': next,
          // Backend updates userId if present; keep assigned user when changing status.
          if (userId != null && userId > 0) 'userId': userId,
        },
      );
      // Refresh tickets list (home/all) and chat messages header state.
      try {
        await ref.read(ticketsControllerProvider.notifier).refresh();
      } catch (_) {}
      await _loadTicketMeta();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(next == 'closed'
                ? 'Chamado finalizado.'
                : 'Chamado atualizado.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao atualizar chamado: ${e.toString()}')),
      );
    }
  }

  Future<void> _deleteTicket() async {
    try {
      await ref.read(dioProvider).delete('/tickets/${widget.ticketId}');
      try {
        await ref.read(ticketsControllerProvider.notifier).refresh();
      } catch (_) {}
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Ticket apagado.')));
      // Go back to tickets list.
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/tickets');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao apagar ticket: ${e.toString()}')),
      );
    }
  }

  @override
  void dispose() {
    _recordTimer?.cancel();
    _recorder.dispose();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(chatControllerProvider(widget.ticketId));
    final ctrl = ref.read(chatControllerProvider(widget.ticketId).notifier);
    final ticket =
        widget.ticketExtra is Ticket ? widget.ticketExtra as Ticket : null;
    final title = ticket?.contact?.name.isNotEmpty == true
        ? ticket!.contact!.name
        : 'Atendimento #${widget.ticketId}';
    final status =
        (_statusOverride ?? ticket?.status ?? '').trim().toLowerCase();
    final auth = ref.watch(authControllerProvider);
    final isAdmin = auth.user?.admin == true ||
        auth.user?.isSuper == true ||
        (auth.user?.profile ?? '').toLowerCase() == 'admin' ||
        (auth.user?.profile ?? '').toLowerCase() == 'super';

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
              Text(ticket!.contact!.number,
                  style: const TextStyle(fontSize: 12, color: Colors.white70)),
          ],
        ),
        actions: [
          if (_loadingTicketMeta)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Center(
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
          if (!_loadingTicketMeta && status == 'pending')
            TextButton.icon(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Aceitar chamado'),
                    content: const Text(
                        'Deseja iniciar o atendimento deste ticket agora?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancelar')),
                      FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Aceitar')),
                    ],
                  ),
                );
                if (ok == true) {
                  await _updateTicketStatus('open');
                }
              },
              icon: const Icon(Icons.play_arrow, size: 18),
              label: const Text('Aceitar'),
            ),
          PopupMenuButton<String>(
            tooltip: 'Ações',
            onSelected: (v) async {
              if (v == 'close') {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Finalizar chamado'),
                    content: const Text('Deseja finalizar este chamado?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancelar')),
                      FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Finalizar')),
                    ],
                  ),
                );
                if (ok == true) await _updateTicketStatus('closed');
                return;
              }
              if (v == 'reopen') {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Reabrir chamado'),
                    content: const Text('Deseja reabrir este chamado?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancelar')),
                      FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Reabrir')),
                    ],
                  ),
                );
                if (ok == true) await _updateTicketStatus('open');
                return;
              }
              if (v == 'delete') {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Apagar ticket'),
                    content: const Text(
                        'Essa ação é permanente. Deseja apagar este ticket?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancelar')),
                      FilledButton(
                        style:
                            FilledButton.styleFrom(backgroundColor: Colors.red),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Apagar'),
                      ),
                    ],
                  ),
                );
                if (ok == true) await _deleteTicket();
                return;
              }
            },
            itemBuilder: (ctx) => [
              if (status != 'closed')
                const PopupMenuItem(
                    value: 'close', child: Text('Finalizar chamado')),
              if (status == 'closed')
                const PopupMenuItem(
                    value: 'reopen', child: Text('Reabrir chamado')),
              if (isAdmin) const PopupMenuDivider(),
              if (isAdmin)
                const PopupMenuItem(
                    value: 'delete', child: Text('Apagar ticket')),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
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
                            if (st.uploadFileIndex != null &&
                                st.uploadFileTotal != null)
                              '${st.uploadFileIndex}/${st.uploadFileTotal}',
                            if ((st.uploadFileName ?? '').trim().isNotEmpty)
                              '• ${st.uploadFileName}',
                            '— ${((st.uploadProgress ?? 0) * 100).toStringAsFixed(0)}%',
                          ].join(' '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                              fontSize: 12,
                              fontWeight: FontWeight.w700),
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
                  child: Text(st.error!,
                      style: const TextStyle(color: Colors.red)),
                ),
              Expanded(
                child: Container(
                  color: Theme.of(context).colorScheme.surface,
                  child: ListView.builder(
                    controller: _scroll,
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
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
                        mediaType: m.mediaType,
                        mediaUrl: m.mediaUrl,
                        onOpenMedia: m.mediaUrl == null
                            ? null
                            : () =>
                                _openMedia(m.mediaUrl!, mimeType: m.mediaType),
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
                isRecording: _isRecording,
                recordSeconds: _recordSeconds,
                micEnabled: !st.uploading,
                onToggleRecord: () async {
                  if (st.uploading) return;
                  FocusManager.instance.primaryFocus?.unfocus();
                  if (_isRecording) {
                    await _stopRecordingAndSend(ctrl);
                  } else {
                    await _startRecording();
                  }
                },
                onCancelRecording: () async {
                  if (!_isRecording) return;
                  await _cancelRecording();
                },
                onAttach: () async {
                  if (st.uploading) return;
                  FocusManager.instance.primaryFocus?.unfocus();
                  // iOS can return files without a filesystem path (e.g. iCloud/Files).
                  // Using withData ensures we can still upload.
                  final picked = await FilePicker.platform
                      .pickFiles(withData: true, allowMultiple: true);
                  final files = (picked?.files ?? const <PlatformFile>[])
                      .where((f) =>
                          (f.path != null && f.path!.trim().isNotEmpty) ||
                          (f.bytes != null && f.bytes!.isNotEmpty))
                      .map((f) => (
                            path: f.path,
                            bytes: f.bytes,
                            name: f.name,
                            mimeType: guessMimeType(f.name)
                          ))
                      .toList();
                  if (files.isEmpty) return;

                  if (!mounted) return;
                  FocusManager.instance.primaryFocus?.unfocus();
                  final action = await showModalBottomSheet<String>(
                    context: context,
                    useRootNavigator: true,
                    isScrollControlled: true,
                    useSafeArea: true,
                    showDragHandle: true,
                    builder: (ctx) {
                      final bottomInset = MediaQuery.viewInsetsOf(ctx).bottom;
                      return SafeArea(
                        child: Padding(
                          padding:
                              EdgeInsets.fromLTRB(16, 10, 16, 18 + bottomInset),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                files.length == 1
                                    ? files.first.name
                                    : '${files.length} anexos selecionados',
                                style: Theme.of(ctx)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'O que você deseja fazer?',
                                style: Theme.of(ctx)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                        color: Theme.of(ctx)
                                            .colorScheme
                                            .onSurfaceVariant),
                              ),
                              const SizedBox(height: 14),
                              FilledButton.icon(
                                onPressed: () => Navigator.pop(ctx, 'chat'),
                                icon: const Icon(Icons.send),
                                label: const Text('Enviar no chat'),
                              ),
                              const SizedBox(height: 10),
                              OutlinedButton.icon(
                                onPressed: () => Navigator.pop(ctx, 'email'),
                                icon: const Icon(Icons.email_outlined),
                                label: const Text('Enviar por e-mail'),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                  if (action == null) return;

                  if (action == 'email') {
                    final initialMsg = _text.text.trim();
                    if (!mounted) return;
                    final toCtrl = TextEditingController();
                    final subjCtrl = TextEditingController(
                        text: 'Anexo do atendimento #${widget.ticketId}');
                    final msgCtrl = TextEditingController(text: initialMsg);
                    try {
                      final sent = await showModalBottomSheet<bool>(
                        context: context,
                        useRootNavigator: true,
                        isScrollControlled: true,
                        useSafeArea: true,
                        showDragHandle: true,
                        builder: (ctx) {
                          final bottomInset =
                              MediaQuery.viewInsetsOf(ctx).bottom;
                          return Padding(
                            padding: EdgeInsets.fromLTRB(
                                16, 10, 16, 16 + bottomInset),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  'Enviar anexo por e-mail',
                                  style: Theme.of(ctx)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w900),
                                ),
                                const SizedBox(height: 12),
                                TextField(
                                  controller: toCtrl,
                                  keyboardType: TextInputType.emailAddress,
                                  decoration: const InputDecoration(
                                    labelText: 'Destinatário',
                                    hintText: 'email@exemplo.com',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                TextField(
                                  controller: subjCtrl,
                                  decoration: const InputDecoration(
                                      labelText: 'Assunto',
                                      border: OutlineInputBorder()),
                                ),
                                const SizedBox(height: 10),
                                TextField(
                                  controller: msgCtrl,
                                  minLines: 2,
                                  maxLines: 5,
                                  decoration: const InputDecoration(
                                      labelText: 'Mensagem',
                                      border: OutlineInputBorder()),
                                ),
                                const SizedBox(height: 12),
                                FilledButton.icon(
                                  onPressed: () => Navigator.pop(ctx, true),
                                  icon: const Icon(Icons.send),
                                  label: Text(
                                      'Enviar (${files.length} anexo${files.length > 1 ? 's' : ''})'),
                                ),
                                const SizedBox(height: 8),
                                OutlinedButton(
                                  onPressed: () => Navigator.pop(ctx, false),
                                  child: const Text('Cancelar'),
                                ),
                              ],
                            ),
                          );
                        },
                      );
                      if (sent != true) return;
                      await ctrl.sendTicketEmail(
                        toEmail: toCtrl.text,
                        subject: subjCtrl.text,
                        message: msgCtrl.text,
                        files: files
                            .map((f) => (
                                  name: f.name,
                                  mimeType: f.mimeType,
                                  path: f.path,
                                  bytes: f.bytes
                                ))
                            .toList(),
                      );
                    } finally {
                      toCtrl.dispose();
                      subjCtrl.dispose();
                      msgCtrl.dispose();
                    }
                    return;
                  }

                  if (files.length == 1) {
                    final f = files.first;
                    await ctrl.sendMedia(
                        body: _text.text,
                        filePath: f.path,
                        fileBytes: f.bytes,
                        fileName: f.name,
                        mimeType: f.mimeType);
                  } else {
                    await ctrl.sendMediaBatch(body: _text.text, files: files);
                  }
                  _text.clear();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openMedia(String mediaUrl, {String? mimeType}) async {
    await openAttachment(context, ref, urlOrPath: mediaUrl, mimeType: mimeType);
  }

  Future<void> _startRecording() async {
    try {
      final ok = await _recorder.hasPermission();
      if (!ok) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Permissão de microfone negada. Ative em Ajustes para gravar áudio.')),
        );
        return;
      }

      final dir = await getTemporaryDirectory();
      final filePath = p.join(
          dir.path, 'voice_${DateTime.now().millisecondsSinceEpoch}.m4a');
      await _recorder.start(
        const RecordConfig(
            encoder: AudioEncoder.aacLc,
            sampleRate: 44100,
            bitRate: 128000,
            numChannels: 1),
        path: filePath,
      );

      _recordTimer?.cancel();
      setState(() {
        _isRecording = true;
        _recordSeconds = 0;
      });
      _recordTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() => _recordSeconds++);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Falha ao iniciar gravação: $e')));
    }
  }

  Future<void> _stopRecordingAndSend(dynamic ctrl) async {
    _recordTimer?.cancel();
    _recordTimer = null;

    String? recordedPath;
    try {
      recordedPath = await _recorder.stop();
    } catch (_) {
      recordedPath = null;
    }

    if (mounted) {
      setState(() {
        _isRecording = false;
      });
    }

    if (recordedPath == null || recordedPath.trim().isEmpty) return;
    final name = p.basename(recordedPath);
    await ctrl.sendMedia(
      body: _text.text,
      filePath: recordedPath,
      fileBytes: null,
      fileName: name,
      mimeType: 'audio/mp4',
    );
    _text.clear();
  }

  Future<void> _cancelRecording() async {
    _recordTimer?.cancel();
    _recordTimer = null;
    try {
      await _recorder.cancel();
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _isRecording = false;
      _recordSeconds = 0;
    });
  }
}

class _Composer extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onAttach;
  final bool isRecording;
  final int recordSeconds;
  final bool micEnabled;
  final VoidCallback onToggleRecord;
  final VoidCallback onCancelRecording;
  final VoidCallback onSend;
  const _Composer({
    required this.controller,
    required this.onAttach,
    required this.isRecording,
    required this.recordSeconds,
    required this.micEnabled,
    required this.onToggleRecord,
    required this.onCancelRecording,
    required this.onSend,
  });

  String _fmt(int s) {
    final mm = (s ~/ 60).toString().padLeft(2, '0');
    final ss = (s % 60).toString().padLeft(2, '0');
    return '$mm:$ss';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
            top: BorderSide(
                color: Theme.of(context)
                    .colorScheme
                    .outlineVariant
                    .withOpacity(0.5))),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onAttach,
            icon: const Icon(Icons.attach_file),
            tooltip: 'Anexar',
          ),
          IconButton(
            onPressed: micEnabled ? onToggleRecord : null,
            icon:
                Icon(isRecording ? Icons.stop_circle_outlined : Icons.mic_none),
            tooltip: isRecording ? 'Parar e enviar' : 'Gravar áudio',
          ),
          Expanded(
            child: isRecording
                ? Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .surfaceContainerHighest
                          .withOpacity(0.55),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.fiber_manual_record,
                            color: Colors.red, size: 16),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Gravando ${_fmt(recordSeconds)}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontWeight: FontWeight.w700),
                          ),
                        ),
                        IconButton(
                          onPressed: onCancelRecording,
                          tooltip: 'Cancelar',
                          icon: const Icon(Icons.close, size: 18),
                          visualDensity: VisualDensity.compact,
                        ),
                      ],
                    ),
                  )
                : TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => onSend(),
                    decoration: InputDecoration(
                      hintText: 'Mensagem',
                      filled: true,
                      fillColor: Theme.of(context)
                          .colorScheme
                          .surfaceContainerHighest
                          .withOpacity(0.55),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
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

class _Bubble extends ConsumerWidget {
  final String message;
  final bool isMe;
  final bool pending;
  final String? error;
  final String? mediaType;
  final String? mediaUrl;
  final VoidCallback? onOpenMedia;

  const _Bubble({
    required this.message,
    required this.isMe,
    required this.pending,
    required this.error,
    required this.mediaType,
    required this.mediaUrl,
    required this.onOpenMedia,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bg = isMe
        ? Theme.of(context).colorScheme.primary
        : Theme.of(context).colorScheme.surfaceContainerHighest;
    final fg = isMe ? Colors.white : Theme.of(context).colorScheme.onSurface;
    final mt = (mediaType ?? '').toLowerCase();
    final rawMediaUrl = mediaUrl?.trim();
    final urlLower = (rawMediaUrl ?? '').toLowerCase();

    final isImage = mt.startsWith('image/') ||
        urlLower.endsWith('.png') ||
        urlLower.endsWith('.jpg') ||
        urlLower.endsWith('.jpeg') ||
        urlLower.endsWith('.webp');
    final isVideo = mt.startsWith('video/') ||
        urlLower.endsWith('.mp4') ||
        urlLower.endsWith('.mov') ||
        urlLower.endsWith('.m4v') ||
        urlLower.endsWith('.webm');
    final isAudio = mt.startsWith('audio/') ||
        mt == 'audio' ||
        urlLower.endsWith('.mp3') ||
        urlLower.endsWith('.m4a') ||
        urlLower.endsWith('.ogg') ||
        urlLower.endsWith('.wav') ||
        urlLower.endsWith('.aac') ||
        urlLower.endsWith('.amr') ||
        urlLower.endsWith('.opus');

    String? fullUrl;
    String? guessedFileName;
    if (rawMediaUrl != null && rawMediaUrl.isNotEmpty) {
      final base =
          ref.read(dioProvider).options.baseUrl.replaceAll(RegExp(r'/+$'), '');
      fullUrl = rawMediaUrl.startsWith('http')
          ? rawMediaUrl
          : '$base/${rawMediaUrl.replaceAll(RegExp(r'^/+'), '')}';
      guessedFileName = Uri.tryParse(fullUrl)?.pathSegments.last;
    }

    bool isPlaceholder(String s) {
      final t = s.trim();
      return t.startsWith('[') && t.endsWith(']') && t.length <= 24;
    }

    bool looksLikeFileName(String s) {
      final t = s.trim();
      if (t.length > 140) return false;
      return RegExp(r'\.[a-z0-9]{2,6}$', caseSensitive: false).hasMatch(t);
    }

    bool shouldShowCaption() {
      final t = message.trim();
      if (t.isEmpty) return false;
      if (isPlaceholder(t)) return false;
      if ((guessedFileName ?? '').isNotEmpty && t == guessedFileName)
        return false;
      if ((isImage || isVideo) && looksLikeFileName(t))
        return false; // hide raw filename for image/video
      return true;
    }

    Widget buildMediaHeader() {
      if (fullUrl == null) return const SizedBox.shrink();

      if (isImage) {
        return _MediaThumb(
          kind: _ThumbKind.image,
          url: fullUrl!,
          isMe: isMe,
          onTap: onOpenMedia,
        );
      }
      if (isVideo) {
        return _MediaThumb(
          kind: _ThumbKind.video,
          url: fullUrl!,
          isMe: isMe,
          onTap: onOpenMedia,
        );
      }

      // Audio + documents keep the compact "open" row
      final label = isAudio ? 'Ouvir áudio' : 'Abrir anexo';
      final icon = isAudio
          ? Icons.play_circle_outline
          : Icons.insert_drive_file_outlined;
      final name = (!isAudio && (guessedFileName ?? '').isNotEmpty)
          ? guessedFileName!
          : '';
      return InkWell(
        onTap: onOpenMedia,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: fg),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  name.isNotEmpty ? '$label • $name' : label,
                  style: TextStyle(
                      color: fg, decoration: TextDecoration.underline),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 5),
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
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
            if (mediaUrl != null) buildMediaHeader(),
            if (shouldShowCaption())
              Text(
                message,
                style: TextStyle(color: fg, height: 1.25),
              ),
            const SizedBox(height: 6),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (pending)
                  Icon(Icons.access_time,
                      size: 14, color: fg.withOpacity(0.85)),
                if (error != null) ...[
                  Icon(Icons.error_outline,
                      size: 14, color: Colors.red.shade200),
                  const SizedBox(width: 6),
                  Text(error!,
                      style:
                          TextStyle(color: Colors.red.shade200, fontSize: 11)),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

enum _ThumbKind { image, video }

class _MediaThumb extends ConsumerWidget {
  final _ThumbKind kind;
  final String url;
  final bool isMe;
  final VoidCallback? onTap;
  const _MediaThumb(
      {required this.kind,
      required this.url,
      required this.isMe,
      required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = BorderRadius.circular(12);
    final fg = isMe ? Colors.white : Theme.of(context).colorScheme.onSurface;
    final cache = ref.read(attachmentCacheProvider);

    Widget placeholder({required bool isVideo}) {
      return Container(
        height: 180,
        width: double.infinity,
        decoration: BoxDecoration(
          color: (isMe ? Colors.white : Theme.of(context).colorScheme.surface)
              .withOpacity(0.10),
          borderRadius: r,
        ),
        child: Center(
          child: Icon(
              isVideo ? Icons.play_circle_outline : Icons.image_outlined,
              color: fg.withOpacity(0.85),
              size: 48),
        ),
      );
    }

    Future<Widget> buildImage() async {
      try {
        final cached = await cache.getCachedFile(url);
        if (cached != null && await cached.exists()) {
          return Image.file(cached, fit: BoxFit.cover);
        }
      } catch (_) {}
      return Image.network(
        url,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => placeholder(isVideo: false),
        loadingBuilder: (ctx, child, prog) {
          if (prog == null) return child;
          return Stack(
            fit: StackFit.expand,
            children: [
              Container(color: Colors.black12),
              Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    value: prog.expectedTotalBytes == null
                        ? null
                        : (prog.cumulativeBytesLoaded /
                                (prog.expectedTotalBytes ?? 1))
                            .clamp(0, 1),
                  ),
                ),
              ),
            ],
          );
        },
      );
    }

    Future<Uint8List?> buildVideoThumbBytes() async {
      try {
        final cached = await cache.getCachedFile(url);
        final source = cached != null ? cached.path : url;
        return await VideoThumbnail.thumbnailData(
          video: source,
          imageFormat: ImageFormat.JPEG,
          maxHeight: 240,
          quality: 55,
          timeMs: 0,
        );
      } catch (_) {
        return null;
      }
    }

    Widget child;
    if (kind == _ThumbKind.image) {
      child = FutureBuilder<Widget>(
        future: buildImage(),
        builder: (context, snap) {
          final w = snap.data ?? placeholder(isVideo: false);
          return ClipRRect(
              borderRadius: r,
              child: SizedBox(height: 180, width: double.infinity, child: w));
        },
      );
    } else {
      child = FutureBuilder<Uint8List?>(
        future: buildVideoThumbBytes(),
        builder: (context, snap) {
          final bytes = snap.data;
          final w = bytes == null
              ? placeholder(isVideo: true)
              : Image.memory(bytes, fit: BoxFit.cover);
          return ClipRRect(
            borderRadius: r,
            child: SizedBox(
              height: 180,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  w,
                  Container(color: Colors.black.withOpacity(0.10)),
                  Center(
                    child: Icon(Icons.play_circle_fill,
                        color: Colors.white.withOpacity(0.92), size: 54),
                  ),
                ],
              ),
            ),
          );
        },
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: r,
        child: child,
      ),
    );
  }
}

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
