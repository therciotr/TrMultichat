import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';

class DesktopQuickMessagesScreen extends ConsumerStatefulWidget {
  const DesktopQuickMessagesScreen({super.key});

  @override
  ConsumerState<DesktopQuickMessagesScreen> createState() => _DesktopQuickMessagesScreenState();
}

class _DesktopQuickMessagesScreenState extends ConsumerState<DesktopQuickMessagesScreen> {
  final _searchCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _items = const <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Dio get _dio => ref.read(dioProvider);

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _dio.get('/quick-messages', queryParameters: <String, dynamic>{
        'searchParam': _searchCtrl.text.trim(),
        'pageNumber': 1,
      });
      final data = (res.data as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
      final records = (data['records'] as List? ?? const <dynamic>[]);
      setState(() {
        _items = records.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
      });
    } catch (_) {
      setState(() => _error = 'Falha ao carregar respostas rápidas');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(int id) async {
    setState(() => _loading = true);
    try {
      await _dio.delete('/quick-messages/$id');
      await _fetch();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível excluir a resposta rápida.')),
      );
      setState(() => _loading = false);
    }
  }

  String _absoluteMediaUrl(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    final base = _dio.options.baseUrl.replaceAll(RegExp(r'/+$'), '');
    return '$base/${value.replaceAll(RegExp(r'^/+'), '')}';
  }

  Future<void> _openForm([Map<String, dynamic>? initial]) async {
    final id = (initial?['id'] as num?)?.toInt();
    final shortcodeCtrl = TextEditingController(
      text: (initial?['shortcode'] ?? '').toString(),
    );
    final messageCtrl = TextEditingController(
      text: (initial?['message'] ?? '').toString(),
    );
    final categoryCtrl = TextEditingController(
      text: (initial?['category'] ?? '').toString(),
    );
    bool active = initial?['status'] != false;
    bool general = initial?['geral'] == true;
    String existingMediaPath = (initial?['mediaPath'] ?? '').toString();
    PlatformFile? pickedFile;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text(id == null ? 'Nova resposta rápida' : 'Editar resposta rápida'),
          content: SizedBox(
            width: 760,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      color: Theme.of(context)
                          .colorScheme
                          .primary
                          .withOpacity(0.08),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Dica premium',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Use atalhos curtos, categorias claras e, quando fizer sentido, anexe um arquivo para acelerar ainda mais o atendimento.',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: shortcodeCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Atalho',
                      prefixIcon: Icon(Icons.flash_on_outlined),
                      hintText: 'Ex.: saudacao, pix, horario',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: categoryCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Categoria',
                      prefixIcon: Icon(Icons.category_outlined),
                      hintText: 'Ex.: Saudações, Vendas, Financeiro',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: messageCtrl,
                    minLines: 4,
                    maxLines: 8,
                    decoration: const InputDecoration(
                      labelText: 'Mensagem',
                      prefixIcon: Icon(Icons.message_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      FilterChip(
                        label: const Text('Ativo'),
                        selected: active,
                        onSelected: (v) => setLocal(() => active = v),
                      ),
                      FilterChip(
                        label: const Text('Geral'),
                        selected: general,
                        onSelected: (v) => setLocal(() => general = v),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: () async {
                          final picked = await FilePicker.platform.pickFiles(
                            withData: true,
                          );
                          final file = picked?.files.isNotEmpty == true
                              ? picked!.files.first
                              : null;
                          if (file == null) return;
                          setLocal(() => pickedFile = file);
                        },
                        icon: const Icon(Icons.attach_file),
                        label: const Text('Selecionar anexo'),
                      ),
                      const SizedBox(width: 10),
                      if (pickedFile != null)
                        Expanded(
                          child: Text(
                            pickedFile!.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        )
                      else if (existingMediaPath.trim().isNotEmpty)
                        Expanded(
                          child: Text(
                            existingMediaPath.split('/').last,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                  if (existingMediaPath.trim().isNotEmpty || pickedFile != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: Theme.of(context)
                              .colorScheme
                              .outlineVariant
                              .withOpacity(0.45),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.attachment_outlined),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              pickedFile?.name ?? existingMediaPath.split('/').last,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton.icon(
              onPressed: () async {
                final shortcode = shortcodeCtrl.text.trim();
                final message = messageCtrl.text.trim();
                if (shortcode.isEmpty || message.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Atalho e mensagem são obrigatórios.'),
                    ),
                  );
                  return;
                }
                try {
                  final payload = <String, dynamic>{
                    'shortcode': shortcode,
                    'message': message,
                    'category': categoryCtrl.text.trim(),
                    'status': active,
                    'geral': general,
                    if (existingMediaPath.trim().isNotEmpty)
                      'mediaPath': existingMediaPath,
                  };
                  final response = id == null
                      ? await _dio.post('/quick-messages', data: payload)
                      : await _dio.put('/quick-messages/$id', data: payload);
                  final saved = (response.data as Map?)?.cast<String, dynamic>() ??
                      const <String, dynamic>{};
                  final savedId = (saved['id'] as num?)?.toInt();
                  if (savedId != null && pickedFile != null) {
                    final form = FormData();
                    final file = pickedFile!;
                    if (file.bytes != null && file.bytes!.isNotEmpty) {
                      form.files.add(
                        MapEntry(
                          'file',
                          MultipartFile.fromBytes(file.bytes!, filename: file.name),
                        ),
                      );
                    } else if ((file.path ?? '').trim().isNotEmpty) {
                      form.files.add(
                        MapEntry(
                          'file',
                          await MultipartFile.fromFile(file.path!, filename: file.name),
                        ),
                      );
                    }
                    form.fields.add(const MapEntry('typeArch', 'quickMessage'));
                    await _dio.post('/quick-messages/$savedId/media-upload', data: form);
                  }
                  if (!mounted) return;
                  Navigator.of(ctx).pop();
                  await _fetch();
                } catch (_) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content:
                          Text('Não foi possível salvar a resposta rápida.'),
                    ),
                  );
                }
              },
              icon: const Icon(Icons.save_outlined),
              label: Text(id == null ? 'Criar' : 'Salvar'),
            ),
          ],
        ),
      ),
    );
    shortcodeCtrl.dispose();
    messageCtrl.dispose();
    categoryCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Respostas rápidas')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    gradient: LinearGradient(
                      colors: [
                        cs.primary.withOpacity(0.12),
                        cs.tertiary.withOpacity(0.10),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Respostas rápidas',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Organize atalhos, categorias e anexos para responder com muito mais velocidade no Ticket e no Chat Interno.',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchCtrl,
                        onSubmitted: (_) => _fetch(),
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          labelText: 'Buscar atalho',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    FilledButton.icon(
                      onPressed: _fetch,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Atualizar'),
                    ),
                    const SizedBox(width: 10),
                    FilledButton.icon(
                      onPressed: () => _openForm(),
                      icon: const Icon(Icons.add),
                      label: const Text('Nova'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(10),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
              itemCount: _items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final m = _items[i];
                final id = (m['id'] as num?)?.toInt() ?? 0;
                final shortcode = (m['shortcode'] ?? '').toString();
                final message = (m['message'] ?? '').toString();
                final category = (m['category'] ?? '').toString().trim();
                final mediaPath = (m['mediaPath'] ?? '').toString().trim();
                return Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    title: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '/$shortcode',
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                        ),
                        if (category.isNotEmpty)
                          Chip(
                            label: Text(category),
                            visualDensity: VisualDensity.compact,
                          ),
                        if (mediaPath.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          const Chip(
                            label: Text('Com anexo'),
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ],
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(height: 6),
                        Text(
                          message,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (mediaPath.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            mediaPath.split('/').last,
                            style: TextStyle(
                              color: cs.onSurfaceVariant,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                    trailing: Wrap(
                      spacing: 4,
                      children: [
                        IconButton(
                          tooltip: 'Copiar atalho',
                          onPressed: () async {
                            await Clipboard.setData(
                              ClipboardData(text: '/$shortcode'),
                            );
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Atalho /$shortcode copiado.'),
                              ),
                            );
                          },
                          icon: const Icon(Icons.copy_outlined),
                        ),
                        IconButton(
                          tooltip: 'Editar',
                          onPressed: () => _openForm(m),
                          icon: const Icon(Icons.edit_outlined),
                        ),
                        IconButton(
                          tooltip: 'Excluir',
                          onPressed: id <= 0 ? null : () => _delete(id),
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
