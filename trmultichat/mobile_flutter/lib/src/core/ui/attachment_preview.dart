import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  // Fallback: open externally
  await launchUrl(uri, mode: LaunchMode.externalApplication);
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

