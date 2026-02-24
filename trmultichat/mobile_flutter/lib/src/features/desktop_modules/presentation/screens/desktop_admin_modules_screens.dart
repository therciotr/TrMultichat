import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';

abstract class _BaseCrudScreen<T extends ConsumerStatefulWidget>
    extends ConsumerState<T> {
  Dio get dio => ref.read(dioProvider);
  bool loading = false;
  String? error;

  Future<void> safeRun(Future<void> Function() fn) async {
    if (!mounted) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await fn();
    } catch (e) {
      if (!mounted) return;
      setState(() => error = 'Falha ao processar operação');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro: $e')),
      );
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }
}

class DesktopUsersScreen extends ConsumerStatefulWidget {
  const DesktopUsersScreen({super.key});
  @override
  ConsumerState<DesktopUsersScreen> createState() => _DesktopUsersScreenState();
}

class _DesktopUsersScreenState extends _BaseCrudScreen<DesktopUsersScreen> {
  List<Map<String, dynamic>> rows = const [];

  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final res = await dio.get('/users/list');
      final data = res.data;
      final list = (data is List
          ? data
          : (data is Map && data['users'] is List
              ? data['users']
              : const <dynamic>[]));
      rows =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    });
  }

  Future<void> openForm([Map<String, dynamic>? initial]) async {
    final name =
        TextEditingController(text: (initial?['name'] ?? '').toString());
    final email =
        TextEditingController(text: (initial?['email'] ?? '').toString());
    final password = TextEditingController();
    String profile = (initial?['profile'] ?? 'user').toString();
    bool admin = initial?['admin'] == true;
    final id = (initial?['id'] as num?)?.toInt();

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text(id == null ? 'Novo usuário' : 'Editar usuário'),
          content: SizedBox(
            width: 520,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Nome')),
                const SizedBox(height: 8),
                TextField(
                    controller: email,
                    decoration: const InputDecoration(labelText: 'E-mail')),
                const SizedBox(height: 8),
                TextField(
                  controller: password,
                  obscureText: true,
                  decoration: InputDecoration(
                      labelText:
                          id == null ? 'Senha' : 'Nova senha (opcional)'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: profile,
                  items: const [
                    DropdownMenuItem(value: 'user', child: Text('Usuário')),
                    DropdownMenuItem(
                        value: 'admin', child: Text('Administrador')),
                    DropdownMenuItem(value: 'super', child: Text('Super')),
                  ],
                  onChanged: (v) => setLocal(() => profile = v ?? 'user'),
                  decoration: const InputDecoration(labelText: 'Perfil'),
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  value: admin,
                  title: const Text('Admin'),
                  onChanged: (v) => setLocal(() => admin = v),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancelar')),
            FilledButton(
              onPressed: () async {
                final payload = <String, dynamic>{
                  'name': name.text.trim(),
                  'email': email.text.trim(),
                  'profile': profile,
                  'admin': admin,
                };
                if (id == null) {
                  payload['password'] = password.text.trim().isEmpty
                      ? '123456'
                      : password.text.trim();
                  await dio.post('/users', data: payload);
                } else {
                  await dio.put('/users/$id', data: payload);
                  if (password.text.trim().isNotEmpty) {
                    await dio.put('/users/$id/password/raw',
                        data: {'password': password.text.trim()});
                  }
                }
                if (!mounted) return;
                Navigator.pop(ctx);
                await fetch();
              },
              child: const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
    name.dispose();
    email.dispose();
    password.dispose();
  }

  Future<void> deleteRow(int id) async {
    await safeRun(() async {
      await dio.delete('/users/$id');
      await fetch();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Usuários')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          if (error != null)
            Padding(
                padding: const EdgeInsets.all(10),
                child: Text(error!, style: const TextStyle(color: Colors.red))),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(14),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = rows[i];
                final id = (r['id'] as num?)?.toInt() ?? 0;
                return Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    title: Text((r['name'] ?? '').toString(),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(
                        '${r['email'] ?? ''} • perfil: ${r['profile'] ?? 'user'}'),
                    trailing: _CrudActionButtons(
                      onEdit: () => openForm(r),
                      onDelete: id <= 0 ? null : () => deleteRow(id),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openForm(),
        label: const Text('Novo usuário'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class DesktopTagsScreen extends ConsumerStatefulWidget {
  const DesktopTagsScreen({super.key});
  @override
  ConsumerState<DesktopTagsScreen> createState() => _DesktopTagsScreenState();
}

class _DesktopTagsScreenState extends _BaseCrudScreen<DesktopTagsScreen> {
  List<Map<String, dynamic>> rows = const [];

  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final res = await dio.get('/tags/list');
      final list = (res.data as List? ?? const <dynamic>[]);
      rows =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    });
  }

  Future<void> openForm([Map<String, dynamic>? initial]) async {
    final id = (initial?['id'] as num?)?.toInt();
    final name =
        TextEditingController(text: (initial?['name'] ?? '').toString());
    final color = TextEditingController(
        text: (initial?['color'] ?? '#0B4C46').toString());
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(id == null ? 'Nova tag' : 'Editar tag'),
        content: SizedBox(
          width: 440,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nome')),
              const SizedBox(height: 8),
              TextField(
                  controller: color,
                  decoration: const InputDecoration(labelText: 'Cor (hex)')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: () async {
              final payload = {
                'name': name.text.trim(),
                'color': color.text.trim()
              };
              if (id == null) {
                await dio.post('/tags', data: payload);
              } else {
                await dio.put('/tags/$id', data: payload);
              }
              if (!mounted) return;
              Navigator.pop(ctx);
              await fetch();
            },
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    name.dispose();
    color.dispose();
  }

  Future<void> deleteRow(int id) async {
    await safeRun(() async {
      await dio.delete('/tags/$id');
      await fetch();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tags')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(14),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = rows[i];
                final id = (r['id'] as num?)?.toInt() ?? 0;
                return Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    leading: CircleAvatar(
                        backgroundColor:
                            _parseColor((r['color'] ?? '#0B4C46').toString())),
                    title: Text((r['name'] ?? '').toString(),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text((r['color'] ?? '').toString()),
                    trailing: _CrudActionButtons(
                      onEdit: () => openForm(r),
                      onDelete: id <= 0 ? null : () => deleteRow(id),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openForm(),
        label: const Text('Nova tag'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class DesktopQueuesScreen extends ConsumerStatefulWidget {
  const DesktopQueuesScreen({super.key});
  @override
  ConsumerState<DesktopQueuesScreen> createState() =>
      _DesktopQueuesScreenState();
}

class _DesktopQueuesScreenState extends _BaseCrudScreen<DesktopQueuesScreen> {
  List<Map<String, dynamic>> rows = const [];

  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final res = await dio.get('/queue');
      final list = (res.data as List? ?? const <dynamic>[]);
      rows =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    });
  }

  Future<void> openForm([Map<String, dynamic>? initial]) async {
    final id = (initial?['id'] as num?)?.toInt();
    final name =
        TextEditingController(text: (initial?['name'] ?? '').toString());
    final color = TextEditingController(
        text: (initial?['color'] ?? '#0B4C46').toString());
    final greeting = TextEditingController(
        text: (initial?['greetingMessage'] ?? '').toString());
    final outOfHours = TextEditingController(
        text: (initial?['outOfHoursMessage'] ?? '').toString());
    final orderQueue =
        TextEditingController(text: (initial?['orderQueue'] ?? '').toString());
    final integrationId = TextEditingController(
        text: (initial?['integrationId'] ?? '').toString());
    final promptId =
        TextEditingController(text: (initial?['promptId'] ?? '').toString());

    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(id == null ? 'Nova fila' : 'Editar fila'),
        content: SizedBox(
          width: 620,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Nome')),
                const SizedBox(height: 8),
                TextField(
                    controller: color,
                    decoration: const InputDecoration(labelText: 'Cor (hex)')),
                const SizedBox(height: 8),
                TextField(
                    controller: greeting,
                    decoration: const InputDecoration(
                        labelText: 'Mensagem de saudação')),
                const SizedBox(height: 8),
                TextField(
                    controller: outOfHours,
                    decoration: const InputDecoration(
                        labelText: 'Mensagem fora de horário')),
                const SizedBox(height: 8),
                TextField(
                    controller: orderQueue,
                    decoration:
                        const InputDecoration(labelText: 'Ordem da fila')),
                const SizedBox(height: 8),
                TextField(
                    controller: integrationId,
                    decoration:
                        const InputDecoration(labelText: 'ID integração')),
                const SizedBox(height: 8),
                TextField(
                    controller: promptId,
                    decoration: const InputDecoration(labelText: 'ID prompt')),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: () async {
              final payload = <String, dynamic>{
                'name': name.text.trim(),
                'color': color.text.trim(),
                'greetingMessage': greeting.text.trim(),
                'outOfHoursMessage': outOfHours.text.trim(),
                'orderQueue': orderQueue.text.trim(),
                'integrationId': integrationId.text.trim(),
                'promptId': promptId.text.trim(),
                'schedules': const [],
              };
              if (id == null) {
                await dio.post('/queue', data: payload);
              } else {
                await dio.put('/queue/$id', data: payload);
              }
              if (!mounted) return;
              Navigator.pop(ctx);
              await fetch();
            },
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    name.dispose();
    color.dispose();
    greeting.dispose();
    outOfHours.dispose();
    orderQueue.dispose();
    integrationId.dispose();
    promptId.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Filas')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(14),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = rows[i];
                final id = (r['id'] as num?)?.toInt() ?? 0;
                return Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    title: Text((r['name'] ?? '').toString(),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text('Cor: ${r['color'] ?? '#0B4C46'}'),
                    trailing: _CrudActionButtons(
                      onEdit: () => openForm(r),
                      onDelete: id <= 0
                          ? null
                          : () async {
                              await safeRun(() async {
                                await dio.delete('/queue/$id');
                                await fetch();
                              });
                            },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openForm(),
        label: const Text('Nova fila'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class DesktopConnectionsScreen extends ConsumerStatefulWidget {
  const DesktopConnectionsScreen({super.key});
  @override
  ConsumerState<DesktopConnectionsScreen> createState() =>
      _DesktopConnectionsScreenState();
}

class _DesktopConnectionsScreenState
    extends _BaseCrudScreen<DesktopConnectionsScreen> {
  List<Map<String, dynamic>> rows = const [];
  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final res = await dio.get('/whatsapp');
      final list = (res.data as List? ?? const <dynamic>[]);
      rows =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    });
  }

  Future<void> openForm([Map<String, dynamic>? initial]) async {
    final id = (initial?['id'] as num?)?.toInt();
    final name =
        TextEditingController(text: (initial?['name'] ?? '').toString());
    final token =
        TextEditingController(text: (initial?['token'] ?? '').toString());
    final greeting = TextEditingController(
        text: (initial?['greetingMessage'] ?? '').toString());
    final completion = TextEditingController(
        text: (initial?['complationMessage'] ??
                initial?['completionMessage'] ??
                '')
            .toString());
    final out = TextEditingController(
        text: (initial?['outOfHoursMessage'] ?? '').toString());
    final rating = TextEditingController(
        text: (initial?['ratingMessage'] ?? '').toString());
    String provider = (initial?['provider'] ?? 'beta').toString();
    bool isDefault = initial?['isDefault'] == true;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text(id == null ? 'Nova conexão' : 'Editar conexão'),
          content: SizedBox(
            width: 620,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                      controller: name,
                      decoration: const InputDecoration(labelText: 'Nome')),
                  const SizedBox(height: 8),
                  TextField(
                      controller: token,
                      decoration: const InputDecoration(labelText: 'Token')),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: provider,
                    items: const [
                      DropdownMenuItem(value: 'beta', child: Text('beta')),
                      DropdownMenuItem(value: 'stable', child: Text('stable')),
                    ],
                    onChanged: (v) => setLocal(() => provider = v ?? 'beta'),
                    decoration: const InputDecoration(labelText: 'Provider'),
                  ),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    value: isDefault,
                    onChanged: (v) => setLocal(() => isDefault = v),
                    title: const Text('Conexão padrão'),
                  ),
                  TextField(
                      controller: greeting,
                      decoration: const InputDecoration(
                          labelText: 'Mensagem saudação')),
                  const SizedBox(height: 8),
                  TextField(
                      controller: completion,
                      decoration: const InputDecoration(
                          labelText: 'Mensagem conclusão')),
                  const SizedBox(height: 8),
                  TextField(
                      controller: out,
                      decoration: const InputDecoration(
                          labelText: 'Mensagem fora de horário')),
                  const SizedBox(height: 8),
                  TextField(
                      controller: rating,
                      decoration: const InputDecoration(
                          labelText: 'Mensagem avaliação')),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancelar')),
            FilledButton(
              onPressed: () async {
                final payload = <String, dynamic>{
                  'name': name.text.trim(),
                  'token': token.text.trim(),
                  'provider': provider,
                  'isDefault': isDefault,
                  'greetingMessage': greeting.text.trim(),
                  'complationMessage': completion.text.trim(),
                  'outOfHoursMessage': out.text.trim(),
                  'ratingMessage': rating.text.trim(),
                };
                if (id == null) {
                  await dio.post('/whatsapp', data: payload);
                } else {
                  await dio.put('/whatsapp/$id', data: payload);
                }
                if (!mounted) return;
                Navigator.pop(ctx);
                await fetch();
              },
              child: const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
    name.dispose();
    token.dispose();
    greeting.dispose();
    completion.dispose();
    out.dispose();
    rating.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Conexões')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(14),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = rows[i];
                final id = (r['id'] as num?)?.toInt() ?? 0;
                return Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    title: Text((r['name'] ?? '').toString(),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text('Status: ${r['status'] ?? 'DISCONNECTED'}'),
                    trailing: _CrudActionButtons(
                      onEdit: () => openForm(r),
                      onDelete: id <= 0
                          ? null
                          : () async {
                              await safeRun(() async {
                                await dio.delete('/whatsapp/$id');
                                await fetch();
                              });
                            },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openForm(),
        label: const Text('Nova conexão'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class DesktopFilesScreen extends ConsumerStatefulWidget {
  const DesktopFilesScreen({super.key});
  @override
  ConsumerState<DesktopFilesScreen> createState() => _DesktopFilesScreenState();
}

class _DesktopFilesScreenState extends _BaseCrudScreen<DesktopFilesScreen> {
  List<Map<String, dynamic>> rows = const [];
  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final res = await dio.get('/files', queryParameters: {'pageNumber': 1});
      final data = (res.data as Map?)?.cast<String, dynamic>() ?? const {};
      final list = (data['files'] as List? ?? const <dynamic>[]);
      rows =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    });
  }

  Future<void> openForm([Map<String, dynamic>? initial]) async {
    final id = (initial?['id'] as num?)?.toInt();
    final name =
        TextEditingController(text: (initial?['name'] ?? '').toString());
    final message =
        TextEditingController(text: (initial?['message'] ?? '').toString());
    final options = TextEditingController(
      text: ((initial?['options'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => (e['name'] ?? '').toString())
          .where((e) => e.isNotEmpty)
          .join(', '),
    );
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(id == null ? 'Novo arquivo' : 'Editar arquivo'),
        content: SizedBox(
          width: 620,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nome')),
              const SizedBox(height: 8),
              TextField(
                  controller: message,
                  decoration: const InputDecoration(labelText: 'Mensagem'),
                  maxLines: 3),
              const SizedBox(height: 8),
              TextField(
                  controller: options,
                  decoration: const InputDecoration(
                      labelText: 'Opções (separadas por vírgula)')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: () async {
              final payload = {
                'name': name.text.trim(),
                'message': message.text.trim(),
                'options': options.text
                    .split(',')
                    .map((e) => e.trim())
                    .where((e) => e.isNotEmpty)
                    .map((e) => {'name': e})
                    .toList(),
              };
              if (id == null) {
                await dio.post('/files', data: payload);
              } else {
                await dio.put('/files/$id', data: payload);
              }
              if (!mounted) return;
              Navigator.pop(ctx);
              await fetch();
            },
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    name.dispose();
    message.dispose();
    options.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Arquivos')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(14),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = rows[i];
                final id = (r['id'] as num?)?.toInt() ?? 0;
                return Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    title: Text((r['name'] ?? '').toString(),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text((r['message'] ?? '').toString()),
                    trailing: _CrudActionButtons(
                      onEdit: () => openForm(r),
                      onDelete: id <= 0
                          ? null
                          : () async {
                              await safeRun(() async {
                                await dio.delete('/files/$id');
                                await fetch();
                              });
                            },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openForm(),
        label: const Text('Novo arquivo'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class DesktopPlansScreen extends ConsumerStatefulWidget {
  const DesktopPlansScreen({super.key});
  @override
  ConsumerState<DesktopPlansScreen> createState() => _DesktopPlansScreenState();
}

class _DesktopPlansScreenState extends _BaseCrudScreen<DesktopPlansScreen> {
  List<Map<String, dynamic>> rows = const [];
  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final res = await dio.get('/plans/list');
      final list = (res.data as List? ?? const <dynamic>[]);
      rows =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    });
  }

  Future<void> openForm([Map<String, dynamic>? initial]) async {
    final id = (initial?['id'] as num?)?.toInt();
    final name =
        TextEditingController(text: (initial?['name'] ?? '').toString());
    final users =
        TextEditingController(text: (initial?['users'] ?? 0).toString());
    final connections =
        TextEditingController(text: (initial?['connections'] ?? 0).toString());
    final queues =
        TextEditingController(text: (initial?['queues'] ?? 0).toString());
    final price = TextEditingController(
        text: (initial?['price'] ?? initial?['value'] ?? 0).toString());
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(id == null ? 'Novo plano' : 'Editar plano'),
        content: SizedBox(
          width: 600,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nome')),
              const SizedBox(height: 8),
              TextField(
                  controller: users,
                  decoration: const InputDecoration(labelText: 'Usuários')),
              const SizedBox(height: 8),
              TextField(
                  controller: connections,
                  decoration: const InputDecoration(labelText: 'Conexões')),
              const SizedBox(height: 8),
              TextField(
                  controller: queues,
                  decoration: const InputDecoration(labelText: 'Filas')),
              const SizedBox(height: 8),
              TextField(
                  controller: price,
                  decoration: const InputDecoration(labelText: 'Preço')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: () async {
              final payload = {
                'name': name.text.trim(),
                'users': users.text.trim(),
                'connections': connections.text.trim(),
                'queues': queues.text.trim(),
                'price': price.text.trim(),
              };
              if (id == null) {
                await dio.post('/plans', data: payload);
              } else {
                await dio.put('/plans/$id', data: payload);
              }
              if (!mounted) return;
              Navigator.pop(ctx);
              await fetch();
            },
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    name.dispose();
    users.dispose();
    connections.dispose();
    queues.dispose();
    price.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Planos')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(14),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = rows[i];
                final id = (r['id'] as num?)?.toInt() ?? 0;
                return Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    title: Text((r['name'] ?? '').toString(),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(
                        'Usuários: ${r['users'] ?? 0} • Conexões: ${r['connections'] ?? 0} • Valor: ${r['price'] ?? r['value'] ?? 0}'),
                    trailing: _CrudActionButtons(
                      onEdit: () => openForm(r),
                      onDelete: id <= 0
                          ? null
                          : () async {
                              await safeRun(() async {
                                await dio.delete('/plans/$id');
                                await fetch();
                              });
                            },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openForm(),
        label: const Text('Novo plano'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class DesktopHelpsScreen extends ConsumerStatefulWidget {
  const DesktopHelpsScreen({super.key});
  @override
  ConsumerState<DesktopHelpsScreen> createState() => _DesktopHelpsScreenState();
}

class _DesktopHelpsScreenState extends _BaseCrudScreen<DesktopHelpsScreen> {
  List<Map<String, dynamic>> rows = const [];
  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final res = await dio.get('/helps');
      final list = (res.data as List? ?? const <dynamic>[]);
      rows =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    });
  }

  Future<void> openForm([Map<String, dynamic>? initial]) async {
    final id = (initial?['id'] as num?)?.toInt();
    final title =
        TextEditingController(text: (initial?['title'] ?? '').toString());
    final description =
        TextEditingController(text: (initial?['description'] ?? '').toString());
    final video =
        TextEditingController(text: (initial?['video'] ?? '').toString());
    final link =
        TextEditingController(text: (initial?['link'] ?? '').toString());
    final category =
        TextEditingController(text: (initial?['category'] ?? '').toString());
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(id == null ? 'Novo help' : 'Editar help'),
        content: SizedBox(
          width: 620,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: title,
                  decoration: const InputDecoration(labelText: 'Título')),
              const SizedBox(height: 8),
              TextField(
                  controller: description,
                  decoration: const InputDecoration(labelText: 'Descrição'),
                  maxLines: 3),
              const SizedBox(height: 8),
              TextField(
                  controller: video,
                  decoration: const InputDecoration(labelText: 'Vídeo')),
              const SizedBox(height: 8),
              TextField(
                  controller: link,
                  decoration: const InputDecoration(labelText: 'Link')),
              const SizedBox(height: 8),
              TextField(
                  controller: category,
                  decoration: const InputDecoration(labelText: 'Categoria')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: () async {
              final payload = {
                'title': title.text.trim(),
                'description': description.text.trim(),
                'video': video.text.trim(),
                'link': link.text.trim(),
                'category': category.text.trim(),
              };
              if (id == null) {
                await dio.post('/helps', data: payload);
              } else {
                await dio.put('/helps/$id', data: payload);
              }
              if (!mounted) return;
              Navigator.pop(ctx);
              await fetch();
            },
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    title.dispose();
    description.dispose();
    video.dispose();
    link.dispose();
    category.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ajuda')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(14),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = rows[i];
                final id = (r['id'] as num?)?.toInt() ?? 0;
                return Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    title: Text((r['title'] ?? '').toString(),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text((r['description'] ?? '').toString(),
                        maxLines: 2, overflow: TextOverflow.ellipsis),
                    trailing: _CrudActionButtons(
                      onEdit: () => openForm(r),
                      onDelete: id <= 0
                          ? null
                          : () async {
                              await safeRun(() async {
                                await dio.delete('/helps/$id');
                                await fetch();
                              });
                            },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openForm(),
        label: const Text('Novo help'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class DesktopCampaignsScreen extends ConsumerStatefulWidget {
  const DesktopCampaignsScreen({super.key});
  @override
  ConsumerState<DesktopCampaignsScreen> createState() =>
      _DesktopCampaignsScreenState();
}

class _DesktopCampaignsScreenState
    extends _BaseCrudScreen<DesktopCampaignsScreen> {
  List<Map<String, dynamic>> rows = const [];
  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final res =
          await dio.get('/campaigns', queryParameters: {'pageNumber': 1});
      final data = (res.data as Map?)?.cast<String, dynamic>() ?? const {};
      final list = (data['records'] as List? ?? const <dynamic>[]);
      rows =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Campanhas')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: rows.isEmpty
                ? const Center(child: Text('Sem campanhas no momento.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(14),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final r = rows[i];
                      return Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 4),
                          leading: CircleAvatar(
                            radius: 16,
                            child: Icon(Icons.campaign_outlined, size: 16),
                          ),
                          title: Text((r['name'] ?? 'Campanha').toString(),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w800)),
                          subtitle: Text(
                            'Status: ${(r['status'] ?? '-').toString()}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          trailing: SizedBox(
                            width: 110,
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Chip(
                                label: Text((r['status'] ?? '-').toString()),
                              ),
                            ),
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

Color _parseColor(String hex) {
  var c = hex.trim().replaceAll('#', '');
  if (c.length == 6) c = 'FF$c';
  final n = int.tryParse(c, radix: 16);
  if (n == null) return const Color(0xFF0B4C46);
  return Color(n);
}

class _CrudActionButtons extends StatelessWidget {
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const _CrudActionButtons({
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 192,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          SizedBox(
            width: 90,
            child: OutlinedButton.icon(
              onPressed: onEdit,
              style: OutlinedButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              ),
              icon: const Icon(Icons.edit_outlined, size: 14),
              label: const Text('Editar'),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 90,
            child: OutlinedButton.icon(
              onPressed: onDelete,
              style: OutlinedButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              ),
              icon: const Icon(Icons.delete_outline, size: 14),
              label: const Text('Excluir'),
            ),
          ),
        ],
      ),
    );
  }
}
