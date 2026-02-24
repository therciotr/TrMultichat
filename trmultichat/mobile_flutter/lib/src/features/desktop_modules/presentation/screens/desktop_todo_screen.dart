import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class DesktopTodoScreen extends StatefulWidget {
  const DesktopTodoScreen({super.key});

  @override
  State<DesktopTodoScreen> createState() => _DesktopTodoScreenState();
}

class _DesktopTodoScreenState extends State<DesktopTodoScreen> {
  static const _storage = FlutterSecureStorage();
  static const _storageKey = 'desktop_todo_tasks_v1';

  final _textCtrl = TextEditingController();
  final List<Map<String, dynamic>> _tasks = <Map<String, dynamic>>[];
  int? _editingIndex;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final raw = await _storage.read(key: _storageKey);
      if (raw == null || raw.trim().isEmpty) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      _tasks
        ..clear()
        ..addAll(decoded.whereType<Map>().map((e) => e.cast<String, dynamic>()));
    } catch (_) {
      // Keep resilient for corrupted local data.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _persist() async {
    try {
      await _storage.write(key: _storageKey, value: jsonEncode(_tasks));
    } catch (_) {}
  }

  Future<void> _saveTask() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;

    final nowIso = DateTime.now().toIso8601String();
    if (_editingIndex != null && _editingIndex! >= 0 && _editingIndex! < _tasks.length) {
      _tasks[_editingIndex!] = <String, dynamic>{
        ..._tasks[_editingIndex!],
        'text': text,
        'updatedAt': nowIso,
      };
    } else {
      _tasks.add(<String, dynamic>{
        'id': nowIso,
        'text': text,
        'createdAt': nowIso,
        'updatedAt': nowIso,
      });
    }
    setState(() {
      _editingIndex = null;
      _textCtrl.clear();
    });
    await _persist();
  }

  Future<void> _deleteTask(int index) async {
    if (index < 0 || index >= _tasks.length) return;
    _tasks.removeAt(index);
    if (_editingIndex == index) {
      _editingIndex = null;
      _textCtrl.clear();
    }
    setState(() {});
    await _persist();
  }

  void _editTask(int index) {
    if (index < 0 || index >= _tasks.length) return;
    setState(() {
      _editingIndex = index;
      _textCtrl.text = (_tasks[index]['text'] ?? '').toString();
    });
  }

  String _fmt(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return '—';
    final dd = d.day.toString().padLeft(2, '0');
    final mm = d.month.toString().padLeft(2, '0');
    final hh = d.hour.toString().padLeft(2, '0');
    final mi = d.minute.toString().padLeft(2, '0');
    return '$dd/$mm/${d.year} $hh:$mi';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tarefa')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textCtrl,
                    onSubmitted: (_) => _saveTask(),
                    decoration: const InputDecoration(
                      labelText: 'Nova tarefa',
                      prefixIcon: Icon(Icons.playlist_add_check),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton.icon(
                  onPressed: _saveTask,
                  icon: const Icon(Icons.save_outlined),
                  label: Text(_editingIndex == null ? 'Adicionar' : 'Salvar'),
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: _tasks.isEmpty
                ? Center(
                    child: Text(
                      'Nenhuma tarefa ainda.',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
                    itemCount: _tasks.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final t = _tasks[i];
                      return Card(
                        child: ListTile(
                          title: Text(
                            (t['text'] ?? '').toString(),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text('Atualizada em ${_fmt((t['updatedAt'] ?? '').toString())}'),
                          trailing: Wrap(
                            spacing: 4,
                            children: [
                              IconButton(
                                tooltip: 'Editar',
                                onPressed: () => _editTask(i),
                                icon: const Icon(Icons.edit_outlined),
                              ),
                              IconButton(
                                tooltip: 'Excluir',
                                onPressed: () => _deleteTask(i),
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
