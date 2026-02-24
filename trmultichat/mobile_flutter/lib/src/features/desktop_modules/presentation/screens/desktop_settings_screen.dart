import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';

class DesktopSettingsScreen extends ConsumerStatefulWidget {
  const DesktopSettingsScreen({super.key});

  @override
  ConsumerState<DesktopSettingsScreen> createState() =>
      _DesktopSettingsScreenState();
}

class _DesktopSettingsScreenState extends ConsumerState<DesktopSettingsScreen> {
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _settings = const <Map<String, dynamic>>[];
  final _filterCtrl = TextEditingController();

  Dio get _dio => ref.read(dioProvider);

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _filterCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _dio.get('/settings');
      final data = (res.data as List?) ?? const <dynamic>[];
      _settings =
          data.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    } catch (_) {
      _error = 'Falha ao carregar configurações';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveValue(String key, String value) async {
    try {
      await _dio.put('/settings/$key', data: <String, dynamic>{'value': value});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Configuração "$key" salva.')),
      );
      await _fetch();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao salvar "$key".')),
      );
    }
  }

  Future<void> _editValueDialog(String key, String currentValue) async {
    final ctrl = TextEditingController(text: currentValue);
    final next = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Editar "$key"'),
          content: TextField(
            controller: ctrl,
            maxLines: 3,
            minLines: 1,
            decoration: const InputDecoration(labelText: 'Valor'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(ctrl.text.trim()),
              child: const Text('Salvar'),
            ),
          ],
        );
      },
    );
    ctrl.dispose();
    if (next == null) return;
    await _saveValue(key, next);
  }

  @override
  Widget build(BuildContext context) {
    final filter = _filterCtrl.text.trim().toLowerCase();
    final filtered = _settings.where((s) {
      final k = (s['key'] ?? '').toString().toLowerCase();
      final v = (s['value'] ?? '').toString().toLowerCase();
      return filter.isEmpty || k.contains(filter) || v.contains(filter);
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Configurações')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _filterCtrl,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      labelText: 'Filtrar chave/valor',
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
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final item = filtered[i];
                final key = (item['key'] ?? '').toString();
                final value = (item['value'] ?? '').toString();
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: Text(
                            key,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 5,
                          child: Text(
                            value.isEmpty ? '—' : value,
                            overflow: TextOverflow.ellipsis,
                            maxLines: 2,
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 96,
                          child: OutlinedButton.icon(
                            onPressed: () => _editValueDialog(key, value),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 10),
                            ),
                            icon: const Icon(Icons.edit_outlined, size: 14),
                            label: const Text('Editar'),
                          ),
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
