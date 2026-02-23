import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../core/env/app_env.dart';

class WebModuleScreen extends StatefulWidget {
  final String title;
  final String modulePath;
  final String? originOverride;

  const WebModuleScreen({
    super.key,
    required this.title,
    required this.modulePath,
    this.originOverride,
  });

  @override
  State<WebModuleScreen> createState() => _WebModuleScreenState();
}

class _WebModuleScreenState extends State<WebModuleScreen> {
  late final WebViewController _controller;
  int _progress = 0;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (value) {
            if (!mounted) return;
            setState(() => _progress = value.clamp(0, 100));
          },
        ),
      )
      ..loadRequest(_moduleUri());
  }

  Uri _moduleUri() {
    final origin = _resolveWebBaseUri(
      widget.originOverride?.trim().isNotEmpty == true
          ? widget.originOverride!.trim()
          : null,
    );
    final path = widget.modulePath.trim();
    final normalized =
        path.isEmpty ? '/' : (path.startsWith('/') ? path : '/$path');
    return origin.replace(path: normalized);
  }

  Uri _resolveWebBaseUri(String? override) {
    if (override != null) {
      final parsed = Uri.tryParse(override);
      if (parsed != null && parsed.host.isNotEmpty) return parsed;
    }

    final api = AppEnv.baseUrl();
    final parsed = Uri.tryParse(api);
    if (parsed == null || parsed.host.isEmpty) {
      return Uri.parse('https://app.trmultichat.com.br');
    }

    final host = parsed.host;
    if (host == 'api.trmultichat.com.br') {
      return Uri(
        scheme: parsed.scheme.isEmpty ? 'https' : parsed.scheme,
        host: 'app.trmultichat.com.br',
      );
    }
    if (host.startsWith('api.')) {
      return Uri(
        scheme: parsed.scheme.isEmpty ? 'https' : parsed.scheme,
        host: host.replaceFirst('api.', 'app.'),
      );
    }
    if (host.contains('localhost') ||
        RegExp(r'^\d+\.\d+\.\d+\.\d+$').hasMatch(host)) {
      return Uri(
        scheme: parsed.scheme.isEmpty ? 'http' : parsed.scheme,
        host: host,
        port: 3000,
      );
    }
    return Uri.parse('https://app.trmultichat.com.br');
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = _progress < 100;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            tooltip: 'Voltar',
            onPressed: () => _controller.canGoBack().then((v) {
              if (v) {
                _controller.goBack();
              }
            }),
            icon: const Icon(Icons.arrow_back),
          ),
          IconButton(
            tooltip: 'Atualizar',
            onPressed: () => _controller.reload(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (isLoading) const LinearProgressIndicator(minHeight: 2),
        ],
      ),
    );
  }
}
