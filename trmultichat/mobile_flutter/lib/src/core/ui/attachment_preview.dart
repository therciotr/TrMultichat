import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:open_filex/open_filex.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../attachments/attachment_cache_providers.dart';
import '../attachments/attachment_cache_service.dart';
import '../di/core_providers.dart';

Future<void> openAttachment(
  BuildContext context,
  WidgetRef ref, {
  required String urlOrPath,
  String? mimeType,
}) async {
  final base = ref.read(dioProvider).options.baseUrl.replaceAll(RegExp(r'/+$'), '');
  final raw = urlOrPath.trim();
  if (raw.isEmpty) return;

  final url = raw.startsWith('http') ? raw : '$base/${raw.replaceAll(RegExp(r'^/+'), '')}';
  final uri = Uri.tryParse(url);
  if (uri == null) return;

  final lower = uri.toString().toLowerCase();
  final mt = (mimeType ?? '').toLowerCase();
  final isPdf = lower.endsWith('.pdf') || mt.contains('application/pdf');
  final isImage = mt.startsWith('image/') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp');
  final isAudio = mt.startsWith('audio/') ||
      lower.endsWith('.mp3') ||
      lower.endsWith('.m4a') ||
      lower.endsWith('.ogg') ||
      lower.endsWith('.wav') ||
      lower.endsWith('.aac') ||
      lower.endsWith('.amr') ||
      lower.endsWith('.opus');

  // Offline-first: if cached, open locally
  try {
    final cache = ref.read(attachmentCacheProvider);
    final cached = await cache.getCachedFile(uri.toString(), mimeType: mimeType);
    if (cached != null) {
      if (isImage) {
        if (!context.mounted) return;
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => _ImageViewerScreen(url: uri.toString(), localFile: cached, mimeType: mimeType)),
        );
        return;
      }
      if (isAudio) {
        if (!context.mounted) return;
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => _AudioPlayerScreen(url: uri.toString(), localFile: cached, mimeType: mimeType)),
        );
        return;
      }
      // PDFs and other files open with native viewer
      await OpenFilex.open(cached.path);
      return;
    }
  } catch (_) {}

  if (!context.mounted) return;
  if (isPdf) {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => _PdfWebViewScreen(url: uri.toString(), mimeType: mimeType)),
    );
    return;
  }
  if (isImage) {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => _ImageViewerScreen(url: uri.toString(), localFile: null, mimeType: mimeType)),
    );
    return;
  }
  if (isAudio) {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => _AudioPlayerScreen(url: uri.toString(), localFile: null, mimeType: mimeType)),
    );
    return;
  }

  // Fallback: open externally
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

class _AudioPlayerScreen extends ConsumerStatefulWidget {
  final String url;
  final File? localFile;
  final String? mimeType;
  const _AudioPlayerScreen({required this.url, required this.localFile, required this.mimeType});

  @override
  ConsumerState<_AudioPlayerScreen> createState() => _AudioPlayerScreenState();
}

class _AudioPlayerScreenState extends ConsumerState<_AudioPlayerScreen> {
  final _player = AudioPlayer();
  Duration? _duration;
  Duration _pos = Duration.zero;
  bool _ready = false;
  bool _downloading = false;
  double? _progress;

  @override
  void initState() {
    super.initState();
    _init();
    _player.durationStream.listen((d) {
      if (mounted) setState(() => _duration = d);
    });
    _player.positionStream.listen((p) {
      if (mounted) setState(() => _pos = p);
    });
  }

  Future<void> _init() async {
    try {
      if (widget.localFile != null) {
        await _player.setFilePath(widget.localFile!.path);
      } else {
        await _player.setUrl(widget.url);
      }
      if (mounted) setState(() => _ready = true);
    } catch (_) {
      if (mounted) setState(() => _ready = false);
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dur = _duration ?? Duration.zero;
    final maxMs = dur.inMilliseconds <= 0 ? 1 : dur.inMilliseconds;
    final posMs = _pos.inMilliseconds.clamp(0, maxMs);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Áudio'),
        actions: [
          IconButton(
            tooltip: 'Salvar offline',
            onPressed: _downloading ? null : () => _download(context),
            icon: const Icon(Icons.download_outlined),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_downloading) const LinearProgressIndicator(minHeight: 2),
            if (_progress != null && _downloading)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text('${((_progress ?? 0) * 100).toStringAsFixed(0)}%'),
              ),
            const SizedBox(height: 18),
            StreamBuilder<PlayerState>(
              stream: _player.playerStateStream,
              builder: (context, snap) {
                final ps = snap.data;
                final playing = ps?.playing == true;
                final processing = ps?.processingState;
                final busy = processing == ProcessingState.loading || processing == ProcessingState.buffering;
                return FilledButton.icon(
                  onPressed: !_ready || busy
                      ? null
                      : () async {
                          if (playing) {
                            await _player.pause();
                          } else {
                            await _player.play();
                          }
                        },
                  icon: Icon(playing ? Icons.pause : Icons.play_arrow),
                  label: Text(playing ? 'Pausar' : 'Reproduzir'),
                );
              },
            ),
            const SizedBox(height: 10),
            Slider(
              value: posMs.toDouble(),
              min: 0,
              max: maxMs.toDouble(),
              onChanged: !_ready
                  ? null
                  : (v) async {
                      await _player.seek(Duration(milliseconds: v.toInt()));
                    },
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_fmt(_pos), style: Theme.of(context).textTheme.bodySmall),
                Text(_fmt(dur), style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(Duration d) {
    String two(int n) => n.toString().padLeft(2, '0');
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '${two(m)}:${two(s)}';
  }

  Future<void> _download(BuildContext context) async {
    setState(() {
      _downloading = true;
      _progress = 0;
    });
    try {
      final cache = ref.read(attachmentCacheProvider);
      final file = await cache.downloadToCache(
        widget.url,
        mimeType: widget.mimeType,
        onReceiveProgress: (rcv, total) {
          if (total <= 0) return;
          final p = (rcv / total).clamp(0, 1);
          if (mounted) setState(() => _progress = p);
        },
      );
      await _player.setFilePath(file.path);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Salvo para offline.')));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Falha ao baixar.')));
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }
}

class _ImageViewerScreen extends ConsumerStatefulWidget {
  final String url;
  final File? localFile;
  final String? mimeType;
  const _ImageViewerScreen({required this.url, required this.localFile, required this.mimeType});

  @override
  ConsumerState<_ImageViewerScreen> createState() => _ImageViewerScreenState();
}

class _ImageViewerScreenState extends ConsumerState<_ImageViewerScreen> {
  double? _progress;
  bool _downloading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Anexo'),
        actions: [
          IconButton(
            tooltip: 'Salvar offline',
            onPressed: _downloading ? null : () => _download(context),
            icon: const Icon(Icons.download_outlined),
          ),
          IconButton(
            tooltip: 'Abrir externo',
            onPressed: () => launchUrl(Uri.parse(widget.url), mode: LaunchMode.externalApplication),
            icon: const Icon(Icons.open_in_new),
          ),
        ],
      ),
      body: Stack(
        children: [
          Center(
            child: InteractiveViewer(
              minScale: 0.8,
              maxScale: 4,
              child: widget.localFile != null
                  ? Image.file(widget.localFile!)
                  : Image.network(
                      widget.url,
                      errorBuilder: (_, __, ___) => Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text('Não foi possível abrir a imagem.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                      ),
                    ),
            ),
          ),
          if (_downloading) const LinearProgressIndicator(minHeight: 2),
          if (_progress != null && _downloading)
            Positioned(
              left: 0,
              right: 0,
              bottom: 18,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.6),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text('${((_progress ?? 0) * 100).toStringAsFixed(0)}%', style: const TextStyle(color: Colors.white)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _download(BuildContext context) async {
    setState(() {
      _downloading = true;
      _progress = 0;
    });
    try {
      final cache = ref.read(attachmentCacheProvider);
      await cache.downloadToCache(
        widget.url,
        mimeType: widget.mimeType,
        onReceiveProgress: (rcv, total) {
          if (total <= 0) return;
          final p = rcv / total;
          if (mounted) setState(() => _progress = p.clamp(0, 1));
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Salvo para offline.')));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Falha ao baixar.')));
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }
}

class _PdfWebViewScreen extends ConsumerStatefulWidget {
  final String url;
  final String? mimeType;
  const _PdfWebViewScreen({required this.url, required this.mimeType});

  @override
  ConsumerState<_PdfWebViewScreen> createState() => _PdfWebViewScreenState();
}

class _PdfWebViewScreenState extends ConsumerState<_PdfWebViewScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _downloading = false;
  double? _progress;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => setState(() => _loading = false),
          onWebResourceError: (_) => setState(() => _loading = false),
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Anexo'),
        actions: [
          IconButton(
            tooltip: 'Salvar offline',
            onPressed: _downloading ? null : () => _download(context),
            icon: const Icon(Icons.download_outlined),
          ),
          IconButton(
            tooltip: 'Abrir externo',
            onPressed: () => launchUrl(Uri.parse(widget.url), mode: LaunchMode.externalApplication),
            icon: const Icon(Icons.open_in_new),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          if (_downloading) const LinearProgressIndicator(minHeight: 2),
          if (_progress != null && _downloading)
            Positioned(
              left: 0,
              right: 0,
              bottom: 18,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.6),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text('${((_progress ?? 0) * 100).toStringAsFixed(0)}%', style: const TextStyle(color: Colors.white)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _download(BuildContext context) async {
    setState(() {
      _downloading = true;
      _progress = 0;
    });
    try {
      final cache = ref.read(attachmentCacheProvider);
      final file = await cache.downloadToCache(
        widget.url,
        mimeType: widget.mimeType,
        onReceiveProgress: (rcv, total) {
          if (total <= 0) return;
          final p = rcv / total;
          if (mounted) setState(() => _progress = p.clamp(0, 1));
        },
      );
      await OpenFilex.open(file.path);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Falha ao baixar.')));
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }
}

