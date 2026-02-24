import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';

class DesktopQuickMessagesScreen extends ConsumerStatefulWidget {
  const DesktopQuickMessagesScreen({super.key});

  @override
  ConsumerState<DesktopQuickMessagesScreen> createState() => _DesktopQuickMessagesScreenState();
}

class _DesktopQuickMessagesScreenState extends ConsumerState<DesktopQuickMessagesScreen> {
  final _searchCtrl = TextEditingController();
  final _shortcodeCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _items = const <Map<String, dynamic>>[];
  int? _editingId;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _shortcodeCtrl.dispose();
    _messageCtrl.dispose();
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

  Future<void> _save() async {
    final shortcode = _shortcodeCtrl.text.trim();
    final message = _messageCtrl.text.trim();
    if (shortcode.isEmpty || message.isEmpty) return;
    setState(() => _loading = true);
    try {
      final payload = <String, dynamic>{
        'shortcode': shortcode,
        'message': message,
      };
      if (_editingId == null) {
        await _dio.post('/quick-messages', data: payload);
      } else {
        await _dio.put('/quick-messages/$_editingId', data: payload);
      }
      _shortcodeCtrl.clear();
      _messageCtrl.clear();
      _editingId = null;
      await _fetch();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível salvar a resposta rápida.')),
      );
      setState(() => _loading = false);
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Respostas rápidas')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
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
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _shortcodeCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Atalho (ex: saudacao)',
                    prefixIcon: Icon(Icons.flash_on_outlined),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _messageCtrl,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Mensagem',
                    prefixIcon: Icon(Icons.message_outlined),
                  ),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton.icon(
                    onPressed: _save,
                    icon: const Icon(Icons.save_outlined),
                    label: Text(_editingId == null ? 'Criar' : 'Salvar edição'),
                  ),
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
                return Card(
                  child: ListTile(
                    title: Text('/$shortcode', style: const TextStyle(fontWeight: FontWeight.w900)),
                    subtitle: Text(message, maxLines: 2, overflow: TextOverflow.ellipsis),
                    trailing: Wrap(
                      spacing: 4,
                      children: [
                        IconButton(
                          tooltip: 'Editar',
                          onPressed: () {
                            setState(() {
                              _editingId = id;
                              _shortcodeCtrl.text = shortcode;
                              _messageCtrl.text = message;
                            });
                          },
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
