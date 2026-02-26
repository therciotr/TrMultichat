import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';

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
  List<Map<String, dynamic>> _queueOptions = const [];
  List<Map<String, dynamic>> _whatsappOptions = const [];
  List<Map<String, dynamic>> _companies = const [];
  Map<int, String> _companyNameById = const {};

  @override
  void initState() {
    super.initState();
    fetch();
  }

  int? _asInt(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString().trim());
  }

  List<Map<String, dynamic>> _asMapList(dynamic raw) {
    if (raw is List) {
      final out = <Map<String, dynamic>>[];
      for (final item in raw) {
        if (item is Map) {
          out.add(item.map((k, v) => MapEntry(k.toString(), v)));
        } else if (item is List) {
          out.addAll(_asMapList(item));
        }
      }
      return out;
    }
    if (raw is Map) {
      const keys = ['users', 'records', 'items', 'rows', 'data', 'result'];
      for (final key in keys) {
        if (raw[key] is List || raw[key] is Map) {
          return _asMapList(raw[key]);
        }
      }
    }
    return const [];
  }

  Future<List<Map<String, dynamic>>> _safeGetList(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final res = await dio.get(path, queryParameters: queryParameters);
      return _asMapList(res.data);
    } catch (_) {
      return const [];
    }
  }

  Future<void> _loadUserFormSources({required bool loadCompanies}) async {
    final futures = <Future<void>>[
      _safeGetList('/queue').then((v) => _queueOptions = v),
      _safeGetList('/whatsapp').then((v) => _whatsappOptions = v),
    ];
    if (loadCompanies) {
      futures.add(
        _safeGetList('/companies').then((v) => _companies = v),
      );
    }
    await Future.wait(futures);
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final auth = ref.read(authControllerProvider);
      final user = auth.user;
      final profile = (user?.profile ?? '').toLowerCase();
      final isSuperLike = user?.isSuper == true ||
          user?.admin == true ||
          profile == 'super' ||
          profile == 'admin' ||
          _asInt(user?.companyId) == 1;

      final companies = await _safeGetList('/companies');
      _companies = companies;
      _companyNameById = {
        for (final c in companies)
          if (_asInt(c['id']) != null)
            _asInt(c['id'])!: (c['name'] ?? 'Empresa').toString(),
      };

      if (isSuperLike && companies.isNotEmpty) {
        final all = <Map<String, dynamic>>[];
        final seen = <int>{};
        for (final c in companies) {
          final cid = _asInt(c['id']);
          if (cid == null || cid <= 0) continue;
          final perCompany = await _safeGetList('/users/list',
              queryParameters: {'companyId': cid});
          for (final u in perCompany) {
            final uid = _asInt(u['id']);
            if (uid != null && seen.add(uid)) all.add(u);
          }
        }
        rows = all;
      } else {
        final res =
            await dio.get('/users/list', queryParameters: {'pageNumber': 1});
        rows = _asMapList(res.data);
      }
    });
  }

  Future<void> openForm([Map<String, dynamic>? initial]) async {
    final auth = ref.read(authControllerProvider);
    final logged = auth.user;
    final loggedProfile = (logged?.profile ?? '').toLowerCase();
    final isSuperLike = logged?.isSuper == true ||
        logged?.admin == true ||
        loggedProfile == 'super' ||
        loggedProfile == 'admin' ||
        _asInt(logged?.companyId) == 1;

    await _loadUserFormSources(loadCompanies: isSuperLike);

    final name =
        TextEditingController(text: (initial?['name'] ?? '').toString());
    final email =
        TextEditingController(text: (initial?['email'] ?? '').toString());
    final password = TextEditingController();
    String profile = (initial?['profile'] ?? 'user').toString().toLowerCase();
    if (profile != 'admin' && profile != 'super') profile = 'user';
    final id = _asInt(initial?['id']);
    int? companyId = _asInt(initial?['companyId']) ?? _asInt(logged?.companyId);
    int? whatsappId = _asInt(initial?['whatsappId']);
    final selectedQueueIds = <int>{};

    if (initial?['queues'] is List) {
      for (final q in (initial?['queues'] as List)) {
        if (q is Map) {
          final qid = _asInt(q['id']);
          if (qid != null && qid > 0) selectedQueueIds.add(qid);
        }
      }
    }

    if (id != null) {
      try {
        final res = await dio.get('/users/$id');
        final data = res.data is Map
            ? (res.data as Map).map((k, v) => MapEntry(k.toString(), v))
            : <String, dynamic>{};
        name.text = (data['name'] ?? name.text).toString();
        email.text = (data['email'] ?? email.text).toString();
        final p = (data['profile'] ?? profile).toString().toLowerCase();
        if (p == 'admin' || p == 'super' || p == 'user') profile = p;
        companyId = _asInt(data['companyId']) ?? companyId;
        whatsappId = _asInt(data['whatsappId']) ?? whatsappId;

        final queuesRaw = data['queues'];
        if (queuesRaw is List) {
          selectedQueueIds.clear();
          for (final q in queuesRaw) {
            if (q is Map) {
              final qid = _asInt(q['id']);
              if (qid != null && qid > 0) selectedQueueIds.add(qid);
            }
          }
        }
      } catch (_) {}
    }

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
                if (isSuperLike)
                  DropdownButtonFormField<int?>(
                    value: companyId,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Empresa'),
                    items: [
                      const DropdownMenuItem<int?>(
                          value: null, child: Text('Selecionar empresa')),
                      ..._companies.map(
                        (c) => DropdownMenuItem<int?>(
                          value: _asInt(c['id']),
                          child: Text(
                            (c['name'] ?? 'Empresa').toString(),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        ),
                      ),
                    ],
                    onChanged: (v) => setLocal(() => companyId = v),
                  )
                else
                  TextField(
                    readOnly: true,
                    controller: TextEditingController(
                      text: _companies
                              .firstWhere(
                                (c) => _asInt(c['id']) == companyId,
                                orElse: () => const <String, dynamic>{},
                              )['name']
                              ?.toString() ??
                          (companyId == null ? '-' : 'Empresa #$companyId'),
                    ),
                    decoration: const InputDecoration(labelText: 'Empresa'),
                  ),
                const SizedBox(height: 8),
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
                  isExpanded: true,
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
                DropdownButtonFormField<int?>(
                  value: whatsappId,
                  isExpanded: true,
                  decoration:
                      const InputDecoration(labelText: 'Conexão (WhatsApp)'),
                  items: [
                    const DropdownMenuItem<int?>(
                        value: null, child: Text('Nenhuma')),
                    ..._whatsappOptions.map(
                      (w) => DropdownMenuItem<int?>(
                        value: _asInt(w['id']),
                        child: Text((w['name'] ?? 'Conexão').toString()),
                      ),
                    ),
                  ],
                  onChanged: (v) => setLocal(() => whatsappId = v),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Filas vinculadas',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _queueOptions.map((q) {
                    final qid = _asInt(q['id']) ?? 0;
                    final selected = qid > 0 && selectedQueueIds.contains(qid);
                    return FilterChip(
                      label: Text((q['name'] ?? 'Fila').toString()),
                      selected: selected,
                      onSelected: qid <= 0
                          ? null
                          : (v) {
                              setLocal(() {
                                if (v) {
                                  selectedQueueIds.add(qid);
                                } else {
                                  selectedQueueIds.remove(qid);
                                }
                              });
                            },
                    );
                  }).toList(),
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
                if (id == null && password.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content:
                            Text('Informe uma senha para o novo usuário.')),
                  );
                  return;
                }
                final payload = <String, dynamic>{
                  'name': name.text.trim(),
                  'email': email.text.trim(),
                  'profile': profile,
                  'admin': profile == 'admin' || profile == 'super',
                  'whatsappId': whatsappId,
                  'queueIds': selectedQueueIds.toList(),
                  if (companyId != null) 'companyId': companyId,
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
    final auth = ref.watch(authControllerProvider);
    final user = auth.user;
    final profile = (user?.profile ?? '').toLowerCase();
    final isSuperLike = user?.isSuper == true ||
        user?.admin == true ||
        profile == 'super' ||
        profile == 'admin' ||
        _asInt(user?.companyId) == 1;

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
            child: rows.isEmpty
                ? const Center(child: Text('Nenhum usuário encontrado.'))
                : isSuperLike
                    ? _buildUsersByCompanyList()
                    : _buildFlatUsersList(rows),
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

  Widget _buildFlatUsersList(List<Map<String, dynamic>> items) {
    return ListView.separated(
      padding: const EdgeInsets.all(14),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) => _buildUserTile(items[i]),
    );
  }

  Widget _buildUsersByCompanyList() {
    final grouped = <int, List<Map<String, dynamic>>>{};
    for (final r in rows) {
      final cid = _asInt(r['companyId']) ?? 0;
      grouped.putIfAbsent(cid, () => <Map<String, dynamic>>[]).add(r);
    }
    final companyIds = grouped.keys.toList()..sort();
    return ListView.separated(
      padding: const EdgeInsets.all(14),
      itemCount: companyIds.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) {
        final cid = companyIds[i];
        final users = grouped[cid] ?? const <Map<String, dynamic>>[];
        final companyName = _companyNameById[cid] ?? 'Empresa #$cid';
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  companyName,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 14),
                ),
                const SizedBox(height: 8),
                ...users.map(_buildUserTile),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildUserTile(Map<String, dynamic> r) {
    final id = _asInt(r['id']) ?? 0;
    final profile = (r['profile'] ?? 'user').toString();
    final companyId = _asInt(r['companyId']);
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      leading: CircleAvatar(
        radius: 16,
        child: Text(
          ((r['name'] ?? 'U').toString().trim().isEmpty
                  ? 'U'
                  : (r['name'] ?? 'U').toString().trim().substring(0, 1))
              .toUpperCase(),
        ),
      ),
      title: Text((r['name'] ?? '').toString(),
          style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Text(
        '${r['email'] ?? ''} • perfil: $profile • empresa: ${_companyNameById[companyId ?? 0] ?? (companyId ?? '-')}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: _CrudActionButtons(
        onEdit: () => openForm(r),
        onDelete: id <= 0 ? null : () => deleteRow(id),
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
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _QueueFormDialog(
        dio: dio,
        initial: initial,
        onSaved: fetch,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Filas')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: rows.isEmpty
                ? const Center(child: Text('Nenhuma fila cadastrada.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(14),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (_, i) {
                      final r = rows[i];
                      final id = (r['id'] as num?)?.toInt() ?? 0;
                      final queueColor =
                          _parseColor((r['color'] ?? '#0B4C46').toString());
                      final greeting =
                          (r['greetingMessage'] ?? '').toString().trim();
                      return Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          color: cs.surface,
                          border: Border.all(
                              color: cs.outlineVariant.withValues(alpha: 0.55)),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          leading: Container(
                            width: 12,
                            height: 44,
                            decoration: BoxDecoration(
                              color: queueColor,
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                          title: Text(
                            (r['name'] ?? '').toString(),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 4),
                              Text('Cor: ${r['color'] ?? '#0B4C46'}'),
                              if (greeting.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  greeting,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ],
                          ),
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

  String _txt(dynamic value) => (value ?? '').toString().trim();

  String _resolveUrl(String raw) {
    final v = _txt(raw);
    if (v.isEmpty) return '';
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    final base = dio.options.baseUrl.trim();
    final uri = Uri.tryParse(base);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) return v;
    final root =
        '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';
    return v.startsWith('/') ? '$root$v' : '$root/$v';
  }

  String? _youtubeId(String value) {
    final v = _txt(value);
    if (v.isEmpty) return null;
    final asId = RegExp(r'^[a-zA-Z0-9_-]{11}$');
    if (asId.hasMatch(v)) return v;
    Uri? uri;
    try {
      uri = Uri.parse(v);
    } catch (_) {
      uri = null;
    }
    if (uri == null) return null;
    final host = uri.host.toLowerCase().replaceFirst('www.', '');
    if (host == 'youtu.be') {
      final id = uri.pathSegments.isNotEmpty ? uri.pathSegments.first : '';
      return asId.hasMatch(id) ? id : null;
    }
    if (host == 'youtube.com' || host == 'm.youtube.com') {
      final id = uri.queryParameters['v'] ?? '';
      if (asId.hasMatch(id)) return id;
      if (uri.pathSegments.length >= 2 && uri.pathSegments.first == 'shorts') {
        final sid = uri.pathSegments[1];
        return asId.hasMatch(sid) ? sid : null;
      }
      if (uri.pathSegments.length >= 2 && uri.pathSegments.first == 'embed') {
        final eid = uri.pathSegments[1];
        return asId.hasMatch(eid) ? eid : null;
      }
    }
    return null;
  }

  bool _isInstagramUrl(String value) {
    final v = _txt(value);
    if (v.isEmpty) return false;
    final uri = Uri.tryParse(v);
    if (uri == null) return false;
    final host = uri.host.toLowerCase();
    return host.contains('instagram.com');
  }
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
    PlatformFile? pickedAttachment;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => AlertDialog(
          title: Text(
              id == null ? 'Novo help (cadastro)' : 'Editar help (cadastro)'),
          content: SizedBox(
            width: 640,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: title,
                    decoration: const InputDecoration(labelText: 'Título'),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: description,
                    decoration: const InputDecoration(labelText: 'Descrição'),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: video,
                    decoration: const InputDecoration(
                      labelText: 'Vídeo (YouTube/Instagram/link)',
                    ),
                    onChanged: (_) => setModalState(() {}),
                  ),
                  const SizedBox(height: 10),
                  Builder(
                    builder: (_) {
                      final rawVideo = _txt(video.text);
                      final ytId = _youtubeId(rawVideo);
                      if (rawVideo.isEmpty) return const SizedBox.shrink();
                      if (ytId != null) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                'Pré-visualização do vídeo',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(
                                'https://img.youtube.com/vi/$ytId/mqdefault.jpg',
                                height: 170,
                                width: double.infinity,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ],
                        );
                      }
                      return Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: Theme.of(context).colorScheme.outlineVariant,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _isInstagramUrl(rawVideo)
                                  ? Icons.video_collection_outlined
                                  : Icons.link_outlined,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text(
                                'Link de vídeo detectado (pré-visualização por miniatura disponível para YouTube).',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: link,
                    decoration: const InputDecoration(
                      labelText: 'Link do anexo (opcional)',
                    ),
                    onChanged: (_) => setModalState(() {}),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: category,
                    decoration: const InputDecoration(labelText: 'Categoria'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: () async {
                          final picked = await FilePicker.platform.pickFiles(
                            allowMultiple: false,
                            withData: false,
                            lockParentWindow: true,
                          );
                          if (picked == null || picked.files.isEmpty) return;
                          setModalState(
                              () => pickedAttachment = picked.files.first);
                        },
                        icon: const Icon(Icons.attach_file),
                        label: const Text('Anexar arquivo'),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          pickedAttachment?.name ??
                              (link.text.trim().isNotEmpty
                                  ? 'Anexo atual por link'
                                  : 'Nenhum anexo selecionado'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (pickedAttachment != null)
                        IconButton(
                          tooltip: 'Remover anexo selecionado',
                          onPressed: () =>
                              setModalState(() => pickedAttachment = null),
                          icon: const Icon(Icons.close),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () async {
                final payload = {
                  'title': title.text.trim(),
                  'description': description.text.trim(),
                  'video': video.text.trim(),
                  'link': link.text.trim(),
                  'category': category.text.trim(),
                };
                if (pickedAttachment?.path != null &&
                    pickedAttachment!.path!.trim().isNotEmpty) {
                  final form = FormData.fromMap({
                    ...payload,
                    'attachment': await MultipartFile.fromFile(
                      pickedAttachment!.path!,
                      filename: pickedAttachment!.name,
                    ),
                  });
                  if (id == null) {
                    await dio.post('/helps', data: form);
                  } else {
                    await dio.put('/helps/$id', data: form);
                  }
                } else {
                  if (id == null) {
                    await dio.post('/helps', data: payload);
                  } else {
                    await dio.put('/helps/$id', data: payload);
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
    title.dispose();
    description.dispose();
    video.dispose();
    link.dispose();
    category.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ajuda (cadastro)')),
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
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (r['description'] ?? '').toString(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if ((r['video'] ?? '').toString().trim().isNotEmpty)
                              const Chip(label: Text('Vídeo')),
                            if ((r['link'] ?? '').toString().trim().isNotEmpty)
                              const Chip(label: Text('Anexo')),
                          ],
                        ),
                      ],
                    ),
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
        label: const Text('Novo cadastro'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class DesktopHelpCenterScreen extends ConsumerStatefulWidget {
  const DesktopHelpCenterScreen({super.key});

  @override
  ConsumerState<DesktopHelpCenterScreen> createState() =>
      _DesktopHelpCenterScreenState();
}

class _DesktopHelpCenterScreenState
    extends _BaseCrudScreen<DesktopHelpCenterScreen> {
  List<Map<String, dynamic>> rows = const [];

  @override
  void initState() {
    super.initState();
    fetch();
  }

  String _txt(dynamic value) => (value ?? '').toString().trim();

  String _resolveUrl(String raw) {
    final v = _txt(raw);
    if (v.isEmpty) return '';
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    final base = dio.options.baseUrl.trim();
    final uri = Uri.tryParse(base);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) return v;
    final root =
        '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';
    return v.startsWith('/') ? '$root$v' : '$root/$v';
  }

  String? _youtubeId(String value) {
    final v = _txt(value);
    if (v.isEmpty) return null;
    final asId = RegExp(r'^[a-zA-Z0-9_-]{11}$');
    if (asId.hasMatch(v)) return v;
    Uri? uri;
    try {
      uri = Uri.parse(v);
    } catch (_) {
      uri = null;
    }
    if (uri == null) return null;
    final host = uri.host.toLowerCase().replaceFirst('www.', '');
    if (host == 'youtu.be') {
      final id = uri.pathSegments.isNotEmpty ? uri.pathSegments.first : '';
      return asId.hasMatch(id) ? id : null;
    }
    if (host == 'youtube.com' || host == 'm.youtube.com') {
      final id = uri.queryParameters['v'] ?? '';
      if (asId.hasMatch(id)) return id;
      if (uri.pathSegments.length >= 2 && uri.pathSegments.first == 'shorts') {
        final sid = uri.pathSegments[1];
        return asId.hasMatch(sid) ? sid : null;
      }
      if (uri.pathSegments.length >= 2 && uri.pathSegments.first == 'embed') {
        final eid = uri.pathSegments[1];
        return asId.hasMatch(eid) ? eid : null;
      }
    }
    return null;
  }

  String _normalizeHttpUrl(String raw) {
    final value = _txt(raw);
    if (value.isEmpty) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    return 'https://$value';
  }

  bool _isInstagramUrl(String value) {
    final normalized = _normalizeHttpUrl(value);
    final uri = Uri.tryParse(normalized);
    if (uri == null) return false;
    final host = uri.host.toLowerCase().replaceFirst('www.', '');
    return host == 'instagram.com' || host.endsWith('.instagram.com');
  }

  String _embedUrlForVideo(String rawVideo) {
    final youtubeId = _youtubeId(rawVideo);
    if (youtubeId != null) {
      return 'https://www.youtube.com/embed/$youtubeId?rel=0';
    }

    final normalized = _normalizeHttpUrl(rawVideo);
    final uri = Uri.tryParse(normalized);
    if (uri == null) return '';

    if (_isInstagramUrl(rawVideo)) {
      final seg = uri.pathSegments;
      for (var i = 0; i < seg.length - 1; i++) {
        final section = seg[i].toLowerCase();
        if (section == 'reel' || section == 'p' || section == 'tv') {
          final id = seg[i + 1].trim();
          if (id.isNotEmpty) {
            return 'https://www.instagram.com/$section/$id/embed/captioned/';
          }
        }
      }
      return normalized;
    }

    return normalized;
  }

  Widget _inAppVideoPlayer(String rawVideo) {
    final videoUrl = _embedUrlForVideo(rawVideo);
    final uri = Uri.tryParse(videoUrl);
    if (videoUrl.isEmpty || uri == null) {
      return Text(
        'Nao foi possivel carregar este video no app.',
        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
      );
    }

    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..loadRequest(uri);

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: 260,
        width: double.infinity,
        child: WebViewWidget(controller: controller),
      ),
    );
  }

  bool _isImageUrl(String url) {
    final u = url.toLowerCase();
    return u.endsWith('.png') ||
        u.endsWith('.jpg') ||
        u.endsWith('.jpeg') ||
        u.endsWith('.gif') ||
        u.endsWith('.webp') ||
        u.endsWith('.bmp') ||
        u.contains('/uploads/helps/');
  }

  String _videoThumbnailFor(Map<String, dynamic> row) {
    final ytId = _youtubeId(_txt(row['video']));
    if (ytId != null) return 'https://img.youtube.com/vi/$ytId/mqdefault.jpg';
    return '';
  }

  String _attachmentThumbnailFor(Map<String, dynamic> row) {
    final attachment = _resolveUrl(_txt(row['link']));
    if (attachment.isNotEmpty && _isImageUrl(attachment)) return attachment;
    return '';
  }

  Future<void> fetch() async {
    await safeRun(() async {
      final res = await dio.get('/helps');
      final list = (res.data as List? ?? const <dynamic>[]);
      rows =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    });
  }

  Future<void> _openExternal(String rawUrl) async {
    final url = _resolveUrl(rawUrl);
    if (url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  String _fileNameFromUrl(String rawUrl) {
    final uri = Uri.tryParse(rawUrl);
    if (uri == null) return 'anexo';
    final path = uri.pathSegments.isEmpty ? '' : uri.pathSegments.last;
    if (path.trim().isEmpty) return 'anexo';
    return path;
  }

  Future<String> _fallbackDownloadPath(String fileName) async {
    final baseDir = Platform.isMacOS
        ? (await getApplicationDocumentsDirectory()).path
        : (await getDownloadsDirectory())?.path ?? (await getTemporaryDirectory()).path;
    final safeName = fileName.trim().isEmpty ? 'anexo' : fileName.trim();
    final extIndex = safeName.lastIndexOf('.');
    final hasExt = extIndex > 0 && extIndex < safeName.length - 1;
    final nameOnly = hasExt ? safeName.substring(0, extIndex) : safeName;
    final ext = hasExt ? safeName.substring(extIndex) : '';
    var candidate = '$baseDir/$safeName';
    var index = 1;
    while (File(candidate).existsSync()) {
      candidate = '$baseDir/${nameOnly}_$index$ext';
      index++;
    }
    return candidate;
  }

  String _normalizeSavePath(String rawPath) {
    final value = rawPath.trim();
    if (value.isEmpty) return value;
    if (value.startsWith('file://')) {
      final uri = Uri.tryParse(value);
      if (uri != null) {
        return uri.toFilePath(windows: Platform.isWindows);
      }
    }
    return value;
  }

  Future<void> _downloadAttachment(String rawUrl) async {
    final resolvedUrl = _resolveUrl(rawUrl);
    if (resolvedUrl.isEmpty) return;
    final suggestedName = _fileNameFromUrl(resolvedUrl);

    String? savePath;
    try {
      savePath = await FilePicker.platform.saveFile(
        dialogTitle: 'Salvar anexo',
        fileName: suggestedName,
      );
    } catch (_) {
      savePath = null;
    }

    if (savePath == null || savePath.trim().isEmpty) {
      try {
        savePath = await _fallbackDownloadPath(suggestedName);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              Platform.isMacOS
                  ? 'Nao foi possivel abrir "Salvar como". Baixando na pasta Documentos do app.'
                  : 'Nao foi possivel abrir "Salvar como". Baixando na pasta Downloads.',
            ),
          ),
        );
      } catch (_) {
        savePath = null;
      }
    }

    if (savePath == null || savePath.trim().isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nao foi possivel iniciar o download do anexo.'),
        ),
      );
      return;
    }

    final targetPath = _normalizeSavePath(savePath);
    if (targetPath.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Caminho de destino invalido.')),
      );
      return;
    }

    try {
      await File(targetPath).parent.create(recursive: true);
      await dio.download(resolvedUrl, targetPath);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Download concluido: ${targetPath.split('/').last}'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao baixar anexo no app: $e')),
      );
    }
  }

  Future<void> _openHelp(Map<String, dynamic> row) async {
    final title = _txt(row['title']).isEmpty ? 'Ajuda' : _txt(row['title']);
    final description = _txt(row['description']);
    final rawVideo = _txt(row['video']);
    final attachment = _resolveUrl(_txt(row['link']));
    final hasVideo = rawVideo.isNotEmpty;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: SizedBox(
          width: 640,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (description.isNotEmpty) Text(description),
                if (description.isNotEmpty) const SizedBox(height: 12),
                if (hasVideo) ...[
                  _inAppVideoPlayer(rawVideo),
                  const SizedBox(height: 8),
                  Text(
                    'O vídeo está sendo reproduzido dentro do app.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
                if (attachment.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  if (!hasVideo && _isImageUrl(attachment))
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        attachment,
                        height: 180,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
                    ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => _downloadAttachment(attachment),
                    icon: const Icon(Icons.download_outlined),
                    label: const Text('Baixar anexo'),
                  ),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Fechar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Central de Ajuda (${rows.length})')),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: rows.isEmpty
                ? const Center(
                    child: Text('Nenhum conteúdo de ajuda disponível.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(14),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final r = rows[i];
                      final title = _txt(r['title']);
                      final desc = _txt(r['description']);
                      final hasVideo = _txt(r['video']).isNotEmpty;
                      final hasAttachment = _txt(r['link']).isNotEmpty;
                      final videoThumb = _videoThumbnailFor(r);
                      final attachmentThumb =
                          hasVideo ? '' : _attachmentThumbnailFor(r);

                      return Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 860),
                          child: Card(
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(
                                color: Theme.of(context)
                                    .colorScheme
                                    .outlineVariant
                                    .withValues(alpha: 0.7),
                              ),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                              onTap: () => _openHelp(r),
                              child: Padding(
                                padding: const EdgeInsets.all(10),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: SizedBox(
                                        width: 170,
                                        height: 96,
                                        child: videoThumb.isNotEmpty
                                            ? Image.network(
                                                videoThumb,
                                                fit: BoxFit.cover,
                                              )
                                            : attachmentThumb.isNotEmpty
                                                ? Image.network(
                                                    attachmentThumb,
                                                    fit: BoxFit.cover,
                                                  )
                                                : Container(
                                                    color: Theme.of(context)
                                                        .colorScheme
                                                        .surfaceContainerHighest,
                                                    child: Column(
                                                      mainAxisAlignment:
                                                          MainAxisAlignment.center,
                                                      children: [
                                                        Icon(
                                                          hasVideo
                                                              ? Icons
                                                                  .play_circle_filled_rounded
                                                              : Icons
                                                                  .help_outline_rounded,
                                                          size: 34,
                                                          color:
                                                              Theme.of(context)
                                                                  .colorScheme
                                                                  .onSurfaceVariant,
                                                        ),
                                                        const SizedBox(height: 4),
                                                        Text(
                                                          hasVideo
                                                              ? 'Vídeo'
                                                              : 'Ajuda',
                                                          style: TextStyle(
                                                            fontSize: 11,
                                                            fontWeight:
                                                                FontWeight.w700,
                                                            color: Theme.of(
                                                                    context)
                                                                .colorScheme
                                                                .onSurfaceVariant,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  title.isEmpty
                                                      ? 'Ajuda'
                                                      : title,
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.w800,
                                                    fontSize: 15,
                                                  ),
                                                ),
                                              ),
                                              const Icon(Icons.chevron_right),
                                            ],
                                          ),
                                          if (desc.isNotEmpty) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              desc,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                color: Theme.of(context)
                                                    .colorScheme
                                                    .onSurfaceVariant,
                                              ),
                                            ),
                                          ],
                                          const SizedBox(height: 8),
                                          Wrap(
                                            spacing: 6,
                                            runSpacing: 6,
                                            children: [
                                              if (hasVideo)
                                                const Chip(
                                                  label: Text('Vídeo'),
                                                  materialTapTargetSize:
                                                      MaterialTapTargetSize
                                                          .shrinkWrap,
                                                ),
                                              if (hasAttachment)
                                                const Chip(
                                                  label: Text('Anexo'),
                                                  materialTapTargetSize:
                                                      MaterialTapTargetSize
                                                          .shrinkWrap,
                                                ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
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

class _QueueFormDialog extends StatefulWidget {
  final Dio dio;
  final Map<String, dynamic>? initial;
  final Future<void> Function() onSaved;

  const _QueueFormDialog({
    required this.dio,
    required this.initial,
    required this.onSaved,
  });

  @override
  State<_QueueFormDialog> createState() => _QueueFormDialogState();
}

class _QueueFormDialogState extends State<_QueueFormDialog>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  late final TextEditingController _nameCtrl;
  late final TextEditingController _colorCtrl;
  late final TextEditingController _orderCtrl;
  late final TextEditingController _greetingCtrl;
  late final TextEditingController _outOfHoursCtrl;

  bool _loading = false;
  bool _saving = false;
  int? _queueId;
  int? _integrationId;
  int? _promptId;
  PlatformFile? _pickedAttachment;
  String? _existingMediaName;
  bool _removeExistingMedia = false;

  List<Map<String, dynamic>> _integrations = const [];
  List<Map<String, dynamic>> _prompts = const [];
  List<_QueueSchedule> _schedules = _QueueSchedule.defaults();
  List<_QueueOptionNode> _options = const [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    final initial = widget.initial ?? const <String, dynamic>{};
    _queueId = _asInt(initial['id']);
    _nameCtrl = TextEditingController(text: (initial['name'] ?? '').toString());
    _colorCtrl =
        TextEditingController(text: (initial['color'] ?? '#006b76').toString());
    _orderCtrl =
        TextEditingController(text: (initial['orderQueue'] ?? '').toString());
    _greetingCtrl = TextEditingController(
        text: (initial['greetingMessage'] ?? '').toString());
    _outOfHoursCtrl = TextEditingController(
        text: (initial['outOfHoursMessage'] ?? '').toString());
    _integrationId = _asInt(initial['integrationId']);
    _promptId = _asInt(initial['promptId']);
    _existingMediaName = (initial['mediaName'] ?? '').toString().trim().isEmpty
        ? null
        : (initial['mediaName'] ?? '').toString();
    _bootstrap();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _nameCtrl.dispose();
    _colorCtrl.dispose();
    _orderCtrl.dispose();
    _greetingCtrl.dispose();
    _outOfHoursCtrl.dispose();
    super.dispose();
  }

  int? _asInt(dynamic value) {
    if (value == null) return null;
    final v = value.toString().trim();
    if (v.isEmpty) return null;
    return int.tryParse(v);
  }

  Future<void> _bootstrap() async {
    setState(() => _loading = true);
    try {
      await Future.wait([
        _loadIntegrations(),
        _loadPrompts(),
        _loadQueueDetails(),
      ]);
      if (_queueId != null) {
        await _loadOptions();
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadIntegrations() async {
    try {
      final res = await widget.dio.get('/queueIntegration');
      final data = (res.data as Map?)?.cast<String, dynamic>() ?? const {};
      final list = (data['queueIntegrations'] as List? ?? const <dynamic>[]);
      _integrations =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    } catch (_) {
      _integrations = const [];
    }
  }

  Future<void> _loadPrompts() async {
    try {
      final res = await widget.dio.get('/prompt');
      final data = (res.data as Map?)?.cast<String, dynamic>() ?? const {};
      final list = (data['prompts'] as List? ?? const <dynamic>[]);
      _prompts =
          list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    } catch (_) {
      _prompts = const [];
    }
  }

  Future<void> _loadQueueDetails() async {
    if (_queueId == null) return;
    try {
      final res = await widget.dio.get('/queue/$_queueId');
      final q = (res.data as Map?)?.cast<String, dynamic>() ?? const {};
      _nameCtrl.text = (q['name'] ?? _nameCtrl.text).toString();
      _colorCtrl.text = (q['color'] ?? _colorCtrl.text).toString();
      _orderCtrl.text = (q['orderQueue'] ?? _orderCtrl.text).toString();
      _greetingCtrl.text =
          (q['greetingMessage'] ?? _greetingCtrl.text).toString();
      _outOfHoursCtrl.text =
          (q['outOfHoursMessage'] ?? _outOfHoursCtrl.text).toString();
      _integrationId = _asInt(q['integrationId']);
      _promptId = _asInt(q['promptId']);
      _existingMediaName = (q['mediaName'] ?? '').toString().trim().isEmpty
          ? _existingMediaName
          : q['mediaName'].toString();

      final rawSchedules = q['schedules'];
      if (rawSchedules is List) {
        _schedules = rawSchedules
            .whereType<Map>()
            .map((e) => _QueueSchedule.fromMap(e.cast<String, dynamic>()))
            .toList();
      }
      if (_schedules.isEmpty) _schedules = _QueueSchedule.defaults();
    } catch (_) {}
  }

  Future<void> _loadOptions() async {
    if (_queueId == null) return;
    final tree = await _loadOptionTree(parentId: null, depth: 0);
    if (mounted) {
      setState(() => _options = tree);
    }
  }

  Future<List<_QueueOptionNode>> _loadOptionTree({
    required int? parentId,
    required int depth,
  }) async {
    if (depth > 6) return const [];
    final current = await _fetchOptionsByParent(parentId);
    final result = <_QueueOptionNode>[];
    for (final item in current) {
      final children =
          await _loadOptionTree(parentId: item.id, depth: depth + 1);
      result.add(item.copyWith(children: children));
    }
    return result;
  }

  Future<List<_QueueOptionNode>> _fetchOptionsByParent(int? parentId) async {
    if (_queueId == null) return const [];
    final candidates = <Map<String, dynamic>>[
      {
        'queueId': _queueId,
        if (parentId != null) 'parentId': parentId else 'parentId': -1,
      },
      {
        'queueId': _queueId,
        if (parentId != null) 'parentId': parentId else 'parentId': null,
      },
      {
        'queueId': _queueId,
        if (parentId != null) 'parentId': parentId,
      },
    ];

    for (final params in candidates) {
      try {
        final res =
            await widget.dio.get('/queue-options', queryParameters: params);
        final data = res.data;
        final list = data is List
            ? data
            : (data is Map && data['records'] is List
                ? data['records'] as List
                : const <dynamic>[]);
        return list
            .whereType<Map>()
            .map((e) => _QueueOptionNode.fromMap(e.cast<String, dynamic>()))
            .toList();
      } catch (_) {}
    }
    return const [];
  }

  Future<void> _openOptionDialog(
      {int? parentId, _QueueOptionNode? editing}) async {
    if (_queueId == null) return;
    final titleCtrl = TextEditingController(text: editing?.title ?? '');
    final messageCtrl = TextEditingController(text: editing?.message ?? '');
    final optionCtrl = TextEditingController(
        text: (editing?.option ?? _nextOption(parentId)).toString());

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(editing == null ? 'Adicionar opção' : 'Editar opção'),
        content: SizedBox(
          width: 560,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(labelText: 'Título'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: messageCtrl,
                minLines: 2,
                maxLines: 5,
                decoration: const InputDecoration(labelText: 'Mensagem'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: optionCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Ordem'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    final titleValue = titleCtrl.text.trim();
    final messageValue = messageCtrl.text.trim();
    final optionValue =
        int.tryParse(optionCtrl.text.trim()) ?? _nextOption(parentId);
    titleCtrl.dispose();
    messageCtrl.dispose();
    optionCtrl.dispose();
    if (ok != true) return;

    final payload = <String, dynamic>{
      'queueId': _queueId,
      'parentId': parentId ?? -1,
      'title': titleValue,
      'message': messageValue,
      'option': optionValue,
    };

    try {
      if (editing == null) {
        await widget.dio.post('/queue-options', data: payload);
      } else {
        await widget.dio.put('/queue-options/${editing.id}', data: payload);
      }
      await _loadOptions();
    } catch (e) {
      if (!mounted) return;
      String message = 'Falha ao salvar opção da fila.';
      if (e is DioException) {
        final data = e.response?.data;
        if (data is Map && data['message'] != null) {
          final apiMessage = data['message'].toString().trim();
          if (apiMessage.isNotEmpty) message = apiMessage;
        }
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }

  int _nextOption(int? parentId) {
    if (parentId == null) return _options.length + 1;
    final parent = _findOptionById(_options, parentId);
    return (parent?.children.length ?? 0) + 1;
  }

  _QueueOptionNode? _findOptionById(List<_QueueOptionNode> nodes, int id) {
    for (final node in nodes) {
      if (node.id == id) return node;
      final hit = _findOptionById(node.children, id);
      if (hit != null) return hit;
    }
    return null;
  }

  Future<void> _deleteOption(_QueueOptionNode node) async {
    try {
      await widget.dio.delete('/queue-options/${node.id}');
      await _loadOptions();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao excluir opção da fila.')),
      );
    }
  }

  Future<void> _pickQueueAttachment() async {
    try {
      final picked = await FilePicker.platform.pickFiles(
        withData: false,
        allowMultiple: false,
        lockParentWindow: true,
      );
      if (picked == null || picked.files.isEmpty) return;
      setState(() {
        _pickedAttachment = picked.files.first;
        _removeExistingMedia = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao abrir seletor de arquivo: $e')),
      );
    }
  }

  Future<void> _saveQueue() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Informe o nome da fila.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final payload = <String, dynamic>{
        'name': _nameCtrl.text.trim(),
        'color':
            _colorCtrl.text.trim().isEmpty ? '#006b76' : _colorCtrl.text.trim(),
        'greetingMessage': _greetingCtrl.text.trim(),
        'outOfHoursMessage': _outOfHoursCtrl.text.trim(),
        'orderQueue': _orderCtrl.text.trim(),
        'integrationId': _integrationId,
        'promptId': _promptId,
        'schedules': _schedules.map((s) => s.toMap()).toList(),
      };

      final Response response;
      if (_queueId == null) {
        response = await widget.dio.post('/queue', data: payload);
        _queueId = _asInt((response.data as Map?)?['id']);
      } else {
        response = await widget.dio.put('/queue/$_queueId', data: payload);
        _queueId ??= _asInt((response.data as Map?)?['id']);
      }

      if (_removeExistingMedia && _queueId != null) {
        await widget.dio.delete('/queue/$_queueId/media-upload');
      }

      if (_pickedAttachment?.path != null && _queueId != null) {
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(
            _pickedAttachment!.path!,
            filename: _pickedAttachment!.name,
          ),
        });
        await widget.dio.post('/queue/$_queueId/media-upload', data: form);
      }

      if (!mounted) return;
      await widget.onSaved();
      Navigator.pop(context);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao salvar fila.')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final dialogWidth = size.width > 1120 ? 980.0 : size.width * 0.92;
    double dialogHeight = size.height * 0.68;
    if (dialogHeight < 380) dialogHeight = 380;
    if (dialogHeight > 640) dialogHeight = 640;

    return AlertDialog(
      title: Text(_queueId == null ? 'Nova fila' : 'Edite Filas'),
      content: SizedBox(
        width: dialogWidth,
        child: _loading
            ? SizedBox(
                height: dialogHeight * 0.55,
                child: const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                ),
              )
            : SizedBox(
                height: dialogHeight,
                child: Column(
                  children: [
                    TabBar(
                      controller: _tabController,
                      tabs: const [
                        Tab(text: 'DADOS DA FILA'),
                        Tab(text: 'HORÁRIOS DE ATENDIMENTO'),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildQueueDataTab(),
                          _buildSchedulesTab(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
      ),
      actions: [
        OutlinedButton.icon(
          onPressed: _pickQueueAttachment,
          icon: const Icon(Icons.attach_file),
          label: Text(_pickedAttachment == null
              ? 'Anexar Arquivo'
              : _pickedAttachment!.name),
        ),
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving ? null : _saveQueue,
          child: Text(_saving ? 'Salvando...' : 'Save'),
        ),
      ],
    );
  }

  Widget _buildQueueDataTab() {
    return SingleChildScrollView(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _colorCtrl,
                  decoration: const InputDecoration(labelText: 'Color'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _orderCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Ordem da fila (Bot)'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<int?>(
            value: _integrationId,
            decoration: const InputDecoration(labelText: 'Integração'),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('Nenhum')),
              ..._integrations.map(
                (i) => DropdownMenuItem<int?>(
                  value: (i['id'] as num?)?.toInt(),
                  child: Text((i['name'] ?? 'Integração').toString()),
                ),
              ),
            ],
            onChanged: (v) => setState(() => _integrationId = v),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<int?>(
            value: _promptId,
            decoration: const InputDecoration(labelText: 'Prompt'),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('Nenhum')),
              ..._prompts.map(
                (p) => DropdownMenuItem<int?>(
                  value: (p['id'] as num?)?.toInt(),
                  child: Text((p['name'] ?? 'Prompt').toString()),
                ),
              ),
            ],
            onChanged: (v) => setState(() => _promptId = v),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _greetingCtrl,
            minLines: 3,
            maxLines: 5,
            decoration: const InputDecoration(labelText: 'Greeting Message'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _outOfHoursCtrl,
            minLines: 3,
            maxLines: 5,
            decoration: const InputDecoration(
                labelText: 'Mensagem de fora de expediente'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Opções',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
              FilledButton.icon(
                onPressed: _queueId == null
                    ? null
                    : () => _openOptionDialog(parentId: null),
                icon: const Icon(Icons.add),
                label: const Text('Adicionar'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_queueId == null)
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Salve a fila para habilitar o cadastro de opções.'),
            )
          else if (_options.isEmpty)
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Nenhuma opção cadastrada.'),
            )
          else
            Column(
              children: _options.map((o) => _buildOptionNode(o)).toList(),
            ),
          if (_existingMediaName != null && !_removeExistingMedia)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => setState(() => _removeExistingMedia = true),
                icon: const Icon(Icons.delete_outline),
                label: Text('Remover anexo atual ($_existingMediaName)'),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOptionNode(_QueueOptionNode node) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(radius: 12, child: Text('${node.option}')),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  node.title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                onPressed: () =>
                    _openOptionDialog(parentId: node.parentId, editing: node),
                icon: const Icon(Icons.edit_outlined),
              ),
              IconButton(
                onPressed: () => _deleteOption(node),
                icon: const Icon(Icons.delete_outline),
              ),
            ],
          ),
          if (node.message.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 32, right: 8, bottom: 6),
              child: Text(node.message),
            ),
          Padding(
            padding: const EdgeInsets.only(left: 32, bottom: 6),
            child: OutlinedButton.icon(
              onPressed: () => _openOptionDialog(parentId: node.id),
              icon: const Icon(Icons.add),
              label: const Text('Adicionar'),
            ),
          ),
          if (node.children.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 32),
              child: Column(
                children: node.children.map(_buildOptionNode).toList(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSchedulesTab() {
    return Column(
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: _schedules.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final s = _schedules[i];
              return Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      readOnly: true,
                      initialValue: s.weekday,
                      decoration:
                          const InputDecoration(labelText: 'Dia da Semana'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextFormField(
                      initialValue: s.startTime,
                      decoration:
                          const InputDecoration(labelText: 'Hora de Inicial'),
                      onChanged: (v) => s.startTime = v,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextFormField(
                      initialValue: s.endTime,
                      decoration:
                          const InputDecoration(labelText: 'Hora de Final'),
                      onChanged: (v) => s.endTime = v,
                    ),
                  ),
                ],
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: () => _tabController.animateTo(0),
          child: const Text('Adicionar'),
        ),
      ],
    );
  }
}

class _QueueSchedule {
  String weekday;
  String weekdayEn;
  String startTime;
  String endTime;

  _QueueSchedule({
    required this.weekday,
    required this.weekdayEn,
    required this.startTime,
    required this.endTime,
  });

  factory _QueueSchedule.fromMap(Map<String, dynamic> map) {
    return _QueueSchedule(
      weekday: (map['weekday'] ?? '').toString(),
      weekdayEn: (map['weekdayEn'] ?? '').toString(),
      startTime: (map['startTime'] ?? '08:00').toString(),
      endTime: (map['endTime'] ?? '17:30').toString(),
    );
  }

  Map<String, dynamic> toMap() => <String, dynamic>{
        'weekday': weekday,
        'weekdayEn': weekdayEn,
        'startTime': startTime,
        'endTime': endTime,
      };

  static List<_QueueSchedule> defaults() => <_QueueSchedule>[
        _QueueSchedule(
            weekday: 'Segunda-feira',
            weekdayEn: 'monday',
            startTime: '08:00',
            endTime: '17:30'),
        _QueueSchedule(
            weekday: 'Terça-feira',
            weekdayEn: 'tuesday',
            startTime: '08:00',
            endTime: '17:30'),
        _QueueSchedule(
            weekday: 'Quarta-feira',
            weekdayEn: 'wednesday',
            startTime: '08:00',
            endTime: '17:30'),
        _QueueSchedule(
            weekday: 'Quinta-feira',
            weekdayEn: 'thursday',
            startTime: '08:00',
            endTime: '17:30'),
        _QueueSchedule(
            weekday: 'Sexta-feira',
            weekdayEn: 'friday',
            startTime: '08:00',
            endTime: '17:30'),
        _QueueSchedule(
            weekday: 'Sábado',
            weekdayEn: 'saturday',
            startTime: '00:00',
            endTime: '00:00'),
        _QueueSchedule(
            weekday: 'Domingo',
            weekdayEn: 'sunday',
            startTime: '00:00',
            endTime: '00:00'),
      ];
}

class _QueueOptionNode {
  final int id;
  final String title;
  final String message;
  final int option;
  final int? parentId;
  final List<_QueueOptionNode> children;

  const _QueueOptionNode({
    required this.id,
    required this.title,
    required this.message,
    required this.option,
    required this.parentId,
    required this.children,
  });

  factory _QueueOptionNode.fromMap(Map<String, dynamic> map) {
    int? parseInt(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString().trim());
    }

    return _QueueOptionNode(
      id: parseInt(map['id']) ?? 0,
      title: (map['title'] ?? map['name'] ?? '').toString(),
      message: (map['message'] ?? '').toString(),
      option: parseInt(map['option'] ?? map['order'] ?? map['position']) ?? 0,
      parentId:
          parseInt(map['parentId'] ?? map['parent_id'] ?? map['parentid']),
      children: const [],
    );
  }

  _QueueOptionNode copyWith({
    List<_QueueOptionNode>? children,
  }) {
    return _QueueOptionNode(
      id: id,
      title: title,
      message: message,
      option: option,
      parentId: parentId,
      children: children ?? this.children,
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
