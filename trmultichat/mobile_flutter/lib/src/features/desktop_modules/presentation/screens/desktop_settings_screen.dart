import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/theme/branding.dart';
import '../../../../core/theme/theme_controller.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../branding/presentation/providers/branding_providers.dart';

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
  List<Map<String, dynamic>> _emailProfiles = const <Map<String, dynamic>>[];
  Map<String, dynamic> _branding = const <String, dynamic>{};
  List<Map<String, dynamic>> _schedules = const <Map<String, dynamic>>[];

  Dio get _dio => ref.read(dioProvider);

  int? get _companyId {
    final user = ref.read(authControllerProvider).user;
    final id = user?.companyId;
    if (id == null || id <= 0) return null;
    return id;
  }

  String _settingValue(String key, [String fallback = '']) {
    for (final item in _settings) {
      if ((item['key'] ?? '').toString() == key) {
        return (item['value'] ?? fallback).toString();
      }
    }
    return fallback;
  }

  bool _settingEnabled(String key) =>
      _settingValue(key).trim().toLowerCase() == 'enabled';

  String _safeDropdownValue(
    String? raw,
    List<String> allowed, {
    required String fallback,
  }) {
    final value = (raw ?? '').trim();
    if (allowed.contains(value)) return value;
    return fallback;
  }

  String _normalizeHex(String value, {required String fallback}) {
    final raw = value.trim();
    if (raw.isEmpty) return fallback;
    final normalized = raw.startsWith('#') ? raw : '#$raw';
    final body = normalized.substring(1);
    if (body.length == 3 || body.length == 6 || body.length == 8) {
      return normalized.toUpperCase();
    }
    return fallback;
  }

  String _absoluteUrl(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    final base = _dio.options.baseUrl.replaceAll(RegExp(r'/+$'), '');
    final path = value.startsWith('/') ? value : '/$value';
    return '$base$path';
  }

  Future<String?> _pickColor(String current) async {
    final presets = <String>[
      '#0B4C46', '#2BA9A5', '#2563EB', '#3B82F6', '#10B981', '#22C55E',
      '#84CC16', '#EAB308', '#F59E0B', '#F97316', '#EF4444', '#DC2626',
      '#EC4899', '#DB2777', '#8B5CF6', '#7C3AED', '#6366F1', '#4F46E5',
      '#06B6D4', '#0891B2', '#14B8A6', '#0F766E', '#65A30D', '#4D7C0F',
      '#92400E', '#7C2D12', '#6B7280', '#374151', '#1F2937', '#111827',
      '#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B',
      '#D4AF37', '#FFD166', '#FFFBEB', '#FFFFFF',
    ];
    final ctrl = TextEditingController(text: current);
    var color = _colorFromHex(
      _normalizeHex(current, fallback: '#2BA9A5'),
      const Color(0xFF2BA9A5),
    );

    void syncTextFromColor(StateSetter setLocal) {
      final hex = '#${color.toARGB32().toRadixString(16).substring(2).toUpperCase()}';
      setLocal(() => ctrl.text = hex);
    }

    final selected = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Selecionar cor'),
          content: SizedBox(
            width: 520,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  height: 54,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.black12),
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: presets.map((hex) {
                    final swatchColor =
                        _colorFromHex(hex, const Color(0xFF2BA9A5));
                    final isSelected =
                        _normalizeHex(ctrl.text, fallback: hex) == hex;
                    return InkWell(
                      onTap: () => setLocal(() {
                        ctrl.text = hex;
                        color = swatchColor;
                      }),
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: swatchColor,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected
                                ? Theme.of(context).colorScheme.primary
                                : Colors.black12,
                            width: isSelected ? 3 : 1,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: ctrl,
                  onChanged: (value) {
                    final normalized =
                        _normalizeHex(value, fallback: ctrl.text.trim());
                    color = _colorFromHex(normalized, color);
                    setLocal(() {});
                  },
                  decoration: const InputDecoration(
                    labelText: 'Cor em HEX',
                    hintText: '#2BA9A5',
                  ),
                ),
                const SizedBox(height: 12),
                Text('Vermelho: ${color.red}'),
                Slider(
                  value: color.red.toDouble(),
                  min: 0,
                  max: 255,
                  onChanged: (v) {
                    color = Color.fromARGB(
                      color.alpha,
                      v.round(),
                      color.green,
                      color.blue,
                    );
                    syncTextFromColor(setLocal);
                  },
                ),
                Text('Verde: ${color.green}'),
                Slider(
                  value: color.green.toDouble(),
                  min: 0,
                  max: 255,
                  onChanged: (v) {
                    color = Color.fromARGB(
                      color.alpha,
                      color.red,
                      v.round(),
                      color.blue,
                    );
                    syncTextFromColor(setLocal);
                  },
                ),
                Text('Azul: ${color.blue}'),
                Slider(
                  value: color.blue.toDouble(),
                  min: 0,
                  max: 255,
                  onChanged: (v) {
                    color = Color.fromARGB(
                      color.alpha,
                      color.red,
                      color.green,
                      v.round(),
                    );
                    syncTextFromColor(setLocal);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
              child: const Text('Usar cor'),
            ),
          ],
        ),
      ),
    );
    ctrl.dispose();
    return selected;
  }

  Future<String?> _uploadBrandingAsset({
    required List<String> allowedExtensions,
  }) async {
    final picked = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: allowedExtensions,
    );
    final file = picked?.files.isNotEmpty == true ? picked!.files.first : null;
    if (file == null) return null;
    try {
      MultipartFile multipart;
      if (file.bytes != null && file.bytes!.isNotEmpty) {
        multipart = MultipartFile.fromBytes(file.bytes!, filename: file.name);
      } else if ((file.path ?? '').trim().isNotEmpty) {
        multipart = await MultipartFile.fromFile(file.path!, filename: file.name);
      } else {
        return null;
      }
      final form = FormData.fromMap({'file': multipart});
      final res = await _dio.post(
        '/branding/upload',
        data: form,
        queryParameters: _companyId == null ? null : {'companyId': _companyId},
      );
      final data = (res.data as Map?)?.cast<String, dynamic>() ?? const {};
      final url = (data['url'] ?? '').toString().trim();
      return url.isEmpty ? null : url;
    } catch (_) {
      if (!mounted) return null;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao enviar arquivo de identidade visual.')),
      );
      return null;
    }
  }

  List<Map<String, dynamic>> _defaultSchedules() {
    return const [
      {
        'weekday': 'Segunda-feira',
        'weekdayEn': 'monday',
        'startTime': '',
        'endTime': '',
      },
      {
        'weekday': 'Terça-feira',
        'weekdayEn': 'tuesday',
        'startTime': '',
        'endTime': '',
      },
      {
        'weekday': 'Quarta-feira',
        'weekdayEn': 'wednesday',
        'startTime': '',
        'endTime': '',
      },
      {
        'weekday': 'Quinta-feira',
        'weekdayEn': 'thursday',
        'startTime': '',
        'endTime': '',
      },
      {
        'weekday': 'Sexta-feira',
        'weekdayEn': 'friday',
        'startTime': '',
        'endTime': '',
      },
      {
        'weekday': 'Sábado',
        'weekdayEn': 'saturday',
        'startTime': '',
        'endTime': '',
      },
      {
        'weekday': 'Domingo',
        'weekdayEn': 'sunday',
        'startTime': '',
        'endTime': '',
      },
    ];
  }

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final futures = await Future.wait([
        _dio.get('/settings'),
        _dio.get(
          '/branding',
          queryParameters: _companyId == null ? null : {'companyId': _companyId},
        ),
        _dio.get('/settings/email/profiles'),
        if (_companyId != null) _dio.get('/companies/$_companyId'),
      ]);

      final settingsData = (futures[0].data as List?) ?? const <dynamic>[];
      _settings = settingsData
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList();

      _branding = (futures[1].data as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{};

      final emailData = futures[2].data;
      final emailProfiles = emailData is List
          ? emailData
          : (emailData is Map ? emailData['profiles'] : null);
      _emailProfiles = (emailProfiles as List? ?? const <dynamic>[])
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList();

      if (_companyId != null && futures.length > 3) {
        final company = (futures[3].data as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
        final schedules = (company['schedules'] as List? ?? const <dynamic>[])
            .whereType<Map>()
            .map((e) => e.cast<String, dynamic>())
            .toList();
        _schedules = schedules.isEmpty ? _defaultSchedules() : schedules;
      } else {
        _schedules = _defaultSchedules();
      }
    } catch (_) {
      _error = 'Falha ao carregar configurações';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveSetting(String key, String value) async {
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

  Future<void> _saveSettingsBatch(Map<String, String> entries) async {
    if (entries.isEmpty) return;
    try {
      for (final entry in entries.entries) {
        await _dio.put(
          '/settings/${entry.key}',
          data: <String, dynamic>{'value': entry.value},
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Opções salvas com sucesso.')),
      );
      await _fetch();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao salvar opções.')),
      );
    }
  }

  Future<void> _saveSchedules(List<Map<String, dynamic>> schedules) async {
    if (_companyId == null) return;
    try {
      await _dio.put(
        '/companies/$_companyId/schedules',
        data: <String, dynamic>{'id': _companyId, 'schedules': schedules},
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Horários salvos com sucesso.')),
      );
      await _fetch();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao salvar horários.')),
      );
    }
  }

  Future<void> _saveBranding(Map<String, dynamic> form) async {
    try {
      await _dio.put(
        '/branding',
        data: form,
        queryParameters: _companyId == null ? null : {'companyId': _companyId},
      );
      final res = await _dio.get(
        '/branding',
        queryParameters: _companyId == null ? null : {'companyId': _companyId},
      );
      final fresh = Branding.fromJson(
        (res.data as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{},
      );
      ref.read(appThemeProvider.notifier).setBranding(fresh);
      await ref.read(brandingControllerProvider.notifier).load(companyId: _companyId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Identidade visual salva.')),
      );
      await _fetch();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao salvar identidade visual.')),
      );
    }
  }

  Future<void> _setDefaultEmailProfile(int id) async {
    try {
      await _dio.post('/settings/email/profiles/$id/default');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Perfil SMTP definido como padrão.')),
      );
      await _fetch();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao definir perfil padrão.')),
      );
    }
  }

  Future<void> _deleteEmailProfile(int id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir perfil SMTP?'),
        content: const Text('Esta ação remove o perfil selecionado.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _dio.delete('/settings/email/profiles/$id');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Perfil SMTP removido.')),
      );
      await _fetch();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao remover perfil SMTP.')),
      );
    }
  }

  Future<void> _openEmailProfileDialog([Map<String, dynamic>? initial]) async {
    final nameCtrl =
        TextEditingController(text: (initial?['name'] ?? '').toString());
    final hostCtrl =
        TextEditingController(text: (initial?['mail_host'] ?? '').toString());
    final portCtrl =
        TextEditingController(text: (initial?['mail_port'] ?? '').toString());
    final userCtrl =
        TextEditingController(text: (initial?['mail_user'] ?? '').toString());
    final passCtrl =
        TextEditingController(text: (initial?['mail_pass'] ?? '').toString());
    final fromCtrl =
        TextEditingController(text: (initial?['mail_from'] ?? '').toString());
    bool secure = initial?['mail_secure'] == true;
    bool isDefault = initial?['isDefault'] == true;
    final profileId = (initial?['id'] as num?)?.toInt();

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text(profileId == null ? 'Novo perfil SMTP' : 'Editar perfil SMTP'),
          content: SizedBox(
            width: 640,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Nome do perfil'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: hostCtrl,
                    decoration: const InputDecoration(labelText: 'Servidor SMTP'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: portCtrl,
                    decoration: const InputDecoration(labelText: 'Porta'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: userCtrl,
                    decoration: const InputDecoration(labelText: 'Usuário SMTP'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: passCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Senha SMTP'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: fromCtrl,
                    decoration: const InputDecoration(labelText: 'E-mail remetente'),
                  ),
                  const SizedBox(height: 10),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Usar conexão segura'),
                    value: secure,
                    onChanged: (v) => setLocal(() => secure = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Definir como padrão'),
                    value: isDefault,
                    onChanged: (v) => setLocal(() => isDefault = v),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () async {
                final payload = <String, dynamic>{
                  'name': nameCtrl.text.trim(),
                  'mail_host': hostCtrl.text.trim(),
                  'mail_port': portCtrl.text.trim(),
                  'mail_user': userCtrl.text.trim(),
                  if (passCtrl.text.trim().isNotEmpty)
                    'mail_pass': passCtrl.text.trim(),
                  'mail_from': fromCtrl.text.trim(),
                  'mail_secure': secure,
                  'isDefault': isDefault,
                };
                try {
                  if (profileId == null) {
                    await _dio.post('/settings/email/profiles', data: payload);
                  } else {
                    await _dio.put('/settings/email/profiles/$profileId',
                        data: payload);
                  }
                  if (!mounted) return;
                  Navigator.of(ctx).pop();
                  await _fetch();
                } catch (_) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Falha ao salvar perfil SMTP.')),
                  );
                }
              },
              child: const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
    nameCtrl.dispose();
    hostCtrl.dispose();
    portCtrl.dispose();
    userCtrl.dispose();
    passCtrl.dispose();
    fromCtrl.dispose();
  }

  Widget _buildOptionsTab() {
    final userRating = ValueNotifier<bool>(_settingEnabled('userRating'));
    final scheduleType = ValueNotifier<String>(
      _safeDropdownValue(
        _settingValue('scheduleType', 'disabled'),
        const ['disabled', 'company', 'queue'],
        fallback: 'disabled',
      ),
    );
    final callType = ValueNotifier<bool>(_settingEnabled('call'));
    final checkMsgIsGroup =
        ValueNotifier<bool>(_settingEnabled('CheckMsgIsGroup'));
    final sendGreetingAccepted =
        ValueNotifier<bool>(_settingEnabled('sendGreetingAccepted'));
    final sendMsgTransfTicket =
        ValueNotifier<bool>(_settingEnabled('sendMsgTransfTicket'));
    final idleLogoutEnabled =
        ValueNotifier<bool>(_settingEnabled('idleLogoutEnabled'));
    final idleLogoutMinutesCtrl = TextEditingController(
      text: _settingValue('idleLogoutMinutes', '30'),
    );
    final chatbotTypeCtrl =
        TextEditingController(text: _settingValue('chatBotType'));

    return StatefulBuilder(
      builder: (context, setLocal) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Opções gerais',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 14),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Permitir avaliação do atendimento'),
                    value: userRating.value,
                    onChanged: (v) => setLocal(() => userRating.value = v),
                  ),
                  DropdownButtonFormField<String>(
                    value: scheduleType.value,
                    decoration:
                        const InputDecoration(labelText: 'Tipo de horário'),
                    items: const [
                      DropdownMenuItem(
                          value: 'disabled', child: Text('Desabilitado')),
                      DropdownMenuItem(
                          value: 'company', child: Text('Empresa')),
                      DropdownMenuItem(value: 'queue', child: Text('Fila')),
                    ],
                    onChanged: (v) =>
                        setLocal(() => scheduleType.value = v ?? 'disabled'),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Habilitar chamadas'),
                    value: callType.value,
                    onChanged: (v) => setLocal(() => callType.value = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Validar mensagens em grupos'),
                    value: checkMsgIsGroup.value,
                    onChanged: (v) =>
                        setLocal(() => checkMsgIsGroup.value = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Enviar saudação ao aceitar'),
                    value: sendGreetingAccepted.value,
                    onChanged: (v) =>
                        setLocal(() => sendGreetingAccepted.value = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Enviar mensagem na transferência'),
                    value: sendMsgTransfTicket.value,
                    onChanged: (v) =>
                        setLocal(() => sendMsgTransfTicket.value = v),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: chatbotTypeCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Tipo do chatbot',
                    ),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Logout por inatividade'),
                    value: idleLogoutEnabled.value,
                    onChanged: (v) =>
                        setLocal(() => idleLogoutEnabled.value = v),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: idleLogoutMinutesCtrl,
                    enabled: idleLogoutEnabled.value,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Minutos para logout automático',
                    ),
                  ),
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton.icon(
                      onPressed: () => _saveSettingsBatch({
                        'userRating':
                            userRating.value ? 'enabled' : 'disabled',
                        'scheduleType': scheduleType.value,
                        'call': callType.value ? 'enabled' : 'disabled',
                        'CheckMsgIsGroup':
                            checkMsgIsGroup.value ? 'enabled' : 'disabled',
                        'sendGreetingAccepted':
                            sendGreetingAccepted.value ? 'enabled' : 'disabled',
                        'sendMsgTransfTicket':
                            sendMsgTransfTicket.value ? 'enabled' : 'disabled',
                        'chatBotType': chatbotTypeCtrl.text.trim(),
                        'idleLogoutEnabled':
                            idleLogoutEnabled.value ? 'enabled' : 'disabled',
                        'idleLogoutMinutes': idleLogoutMinutesCtrl.text.trim(),
                      }),
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('Salvar opções'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmailTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Perfis SMTP',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w900),
              ),
            ),
            FilledButton.icon(
              onPressed: () => _openEmailProfileDialog(),
              icon: const Icon(Icons.add),
              label: const Text('Novo perfil'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_emailProfiles.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('Nenhum perfil SMTP configurado.'),
            ),
          ),
        ..._emailProfiles.map((profile) {
          final id = (profile['id'] as num?)?.toInt() ?? 0;
          final isDefault = profile['isDefault'] == true;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          (profile['name'] ?? profile['mail_user'] ?? 'Perfil SMTP')
                              .toString(),
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                      if (isDefault)
                        const Chip(label: Text('Padrão')),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Host: ${(profile['mail_host'] ?? '—').toString()}'),
                  Text('Porta: ${(profile['mail_port'] ?? '—').toString()}'),
                  Text('Usuário: ${(profile['mail_user'] ?? '—').toString()}'),
                  Text('Remetente: ${(profile['mail_from'] ?? '—').toString()}'),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _openEmailProfileDialog(profile),
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Editar'),
                      ),
                      OutlinedButton.icon(
                        onPressed: isDefault || id <= 0
                            ? null
                            : () => _setDefaultEmailProfile(id),
                        icon: const Icon(Icons.star_outline),
                        label: const Text('Definir padrão'),
                      ),
                      OutlinedButton.icon(
                        onPressed:
                            id <= 0 ? null : () => _deleteEmailProfile(id),
                        icon: const Icon(Icons.delete_outline),
                        label: const Text('Excluir'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildBrandingTab() {
    final appTitleCtrl = TextEditingController(
      text: (_branding['appTitle'] ?? 'TR Multichat').toString(),
    );
    final primaryColorCtrl = TextEditingController(
      text: (_branding['primaryColor'] ?? '#0B4C46').toString(),
    );
    final secondaryColorCtrl = TextEditingController(
      text: (_branding['secondaryColor'] ?? '#2BA9A5').toString(),
    );
    final headingColorCtrl = TextEditingController(
      text: (_branding['headingColor'] ?? _branding['primaryColor'] ?? '#0B4C46')
          .toString(),
    );
    final buttonColorCtrl = TextEditingController(
      text:
          (_branding['buttonColor'] ?? _branding['secondaryColor'] ?? '#2BA9A5')
              .toString(),
    );
    final textColorCtrl = TextEditingController(
      text: (_branding['textColor'] ?? '#1F2937').toString(),
    );
    final backgroundColorCtrl = TextEditingController(
      text: (_branding['backgroundColor'] ?? '#F4F7F7').toString(),
    );
    final appLogoUrlCtrl = TextEditingController(
      text: (_branding['appLogoUrl'] ?? '').toString(),
    );
    final logoUrlCtrl = TextEditingController(
      text: (_branding['logoUrl'] ?? '').toString(),
    );
    final faviconUrlCtrl = TextEditingController(
      text: (_branding['faviconUrl'] ?? '').toString(),
    );
    final fontFamilyCtrl = TextEditingController(
      text: (_branding['fontFamily'] ?? 'Inter, sans-serif').toString(),
    );
    final borderRadiusCtrl = TextEditingController(
      text: (_branding['borderRadius'] ?? 12).toString(),
    );
    String sidebarVariant = _safeDropdownValue(
      (_branding['sidebarVariant'] ?? 'gradient').toString(),
      const ['gradient', 'solid'],
      fallback: 'gradient',
    );

    return StatefulBuilder(
      builder: (context, setLocal) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: LinearGradient(
                        colors: [
                          _colorFromHex(primaryColorCtrl.text, const Color(0xFF0B4C46)),
                          _colorFromHex(secondaryColorCtrl.text, const Color(0xFF2BA9A5)),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          appTitleCtrl.text.trim().isEmpty
                              ? 'TR Multichat'
                              : appTitleCtrl.text.trim(),
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                            fontFamily: fontFamilyCtrl.text.trim().isEmpty
                                ? null
                                : fontFamilyCtrl.text.trim(),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: _colorFromHex(
                              backgroundColorCtrl.text,
                              const Color(0xFFF5F7FA),
                            ),
                            borderRadius: BorderRadius.circular(
                              double.tryParse(borderRadiusCtrl.text.trim()) ?? 12,
                            ),
                          ),
                          child: Text(
                            'Prévia do app com suas cores',
                            style: TextStyle(
                              color: _colorFromHex(
                                textColorCtrl.text,
                                const Color(0xFF1F2937),
                              ),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: appLogoUrlCtrl.text.trim().isEmpty
                                  ? const Icon(Icons.image_outlined,
                                      color: Colors.white)
                                  : Image.network(
                                      _absoluteUrl(appLogoUrlCtrl.text),
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) =>
                                          const Icon(Icons.broken_image_outlined,
                                              color: Colors.white),
                                    ),
                            ),
                            const SizedBox(width: 12),
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: faviconUrlCtrl.text.trim().isEmpty
                                  ? const Icon(Icons.blur_circular,
                                      color: Colors.white, size: 18)
                                  : Image.network(
                                      _absoluteUrl(faviconUrlCtrl.text),
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) =>
                                          const Icon(Icons.broken_image_outlined,
                                              color: Colors.white, size: 18),
                                    ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: appTitleCtrl,
                    onChanged: (_) => setLocal(() {}),
                    decoration:
                        const InputDecoration(labelText: 'Título do app'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: primaryColorCtrl,
                          onChanged: (_) => setLocal(() {}),
                          decoration: InputDecoration(
                            labelText: 'Cor primária',
                            suffixIcon: IconButton(
                              tooltip: 'Selecionar cor',
                              icon: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: _colorFromHex(
                                    primaryColorCtrl.text,
                                    const Color(0xFF0B4C46),
                                  ),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.black12),
                                ),
                              ),
                              onPressed: () async {
                                final next = await _pickColor(primaryColorCtrl.text);
                                if (next == null) return;
                                setLocal(() => primaryColorCtrl.text = next);
                              },
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: secondaryColorCtrl,
                          onChanged: (_) => setLocal(() {}),
                          decoration: InputDecoration(
                            labelText: 'Cor secundária',
                            suffixIcon: IconButton(
                              tooltip: 'Selecionar cor',
                              icon: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: _colorFromHex(
                                    secondaryColorCtrl.text,
                                    const Color(0xFF2BA9A5),
                                  ),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.black12),
                                ),
                              ),
                              onPressed: () async {
                                final next =
                                    await _pickColor(secondaryColorCtrl.text);
                                if (next == null) return;
                                setLocal(() => secondaryColorCtrl.text = next);
                              },
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: headingColorCtrl,
                          onChanged: (_) => setLocal(() {}),
                          decoration: InputDecoration(
                            labelText: 'Cor dos títulos',
                            suffixIcon: IconButton(
                              tooltip: 'Selecionar cor',
                              icon: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: _colorFromHex(
                                    headingColorCtrl.text,
                                    const Color(0xFF0B4C46),
                                  ),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.black12),
                                ),
                              ),
                              onPressed: () async {
                                final next = await _pickColor(headingColorCtrl.text);
                                if (next == null) return;
                                setLocal(() => headingColorCtrl.text = next);
                              },
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: buttonColorCtrl,
                          onChanged: (_) => setLocal(() {}),
                          decoration: InputDecoration(
                            labelText: 'Cor dos botões',
                            suffixIcon: IconButton(
                              tooltip: 'Selecionar cor',
                              icon: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: _colorFromHex(
                                    buttonColorCtrl.text,
                                    const Color(0xFF2BA9A5),
                                  ),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.black12),
                                ),
                              ),
                              onPressed: () async {
                                final next = await _pickColor(buttonColorCtrl.text);
                                if (next == null) return;
                                setLocal(() => buttonColorCtrl.text = next);
                              },
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: textColorCtrl,
                          onChanged: (_) => setLocal(() {}),
                          decoration: InputDecoration(
                            labelText: 'Cor do texto',
                            suffixIcon: IconButton(
                              tooltip: 'Selecionar cor',
                              icon: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: _colorFromHex(
                                    textColorCtrl.text,
                                    const Color(0xFF1F2937),
                                  ),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.black12),
                                ),
                              ),
                              onPressed: () async {
                                final next = await _pickColor(textColorCtrl.text);
                                if (next == null) return;
                                setLocal(() => textColorCtrl.text = next);
                              },
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: backgroundColorCtrl,
                          onChanged: (_) => setLocal(() {}),
                          decoration: InputDecoration(
                            labelText: 'Cor de fundo',
                            suffixIcon: IconButton(
                              tooltip: 'Selecionar cor',
                              icon: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: _colorFromHex(
                                    backgroundColorCtrl.text,
                                    const Color(0xFFF5F7FA),
                                  ),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.black12),
                                ),
                              ),
                              onPressed: () async {
                                final next =
                                    await _pickColor(backgroundColorCtrl.text);
                                if (next == null) return;
                                setLocal(() => backgroundColorCtrl.text = next);
                              },
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: appLogoUrlCtrl,
                    onChanged: (_) => setLocal(() {}),
                    decoration: InputDecoration(
                      labelText: 'Logo do app',
                      suffixIcon: IconButton(
                        tooltip: 'Selecionar logo do app',
                        onPressed: () async {
                          final url = await _uploadBrandingAsset(
                            allowedExtensions: const ['png', 'jpg', 'jpeg', 'svg'],
                          );
                          if (url == null) return;
                          setLocal(() => appLogoUrlCtrl.text = url);
                        },
                        icon: const Icon(Icons.upload_file_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (appLogoUrlCtrl.text.trim().isNotEmpty)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        width: 120,
                        height: 60,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.black12),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Image.network(
                          _absoluteUrl(appLogoUrlCtrl.text),
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Text('Falha ao carregar logo'),
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: logoUrlCtrl,
                    onChanged: (_) => setLocal(() {}),
                    decoration: InputDecoration(
                      labelText: 'Logo do sistema web',
                      suffixIcon: IconButton(
                        tooltip: 'Selecionar logo do sistema',
                        onPressed: () async {
                          final url = await _uploadBrandingAsset(
                            allowedExtensions: const ['png', 'jpg', 'jpeg', 'svg'],
                          );
                          if (url == null) return;
                          setLocal(() => logoUrlCtrl.text = url);
                        },
                        icon: const Icon(Icons.upload_file_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (logoUrlCtrl.text.trim().isNotEmpty)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        width: 120,
                        height: 60,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.black12),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Image.network(
                          _absoluteUrl(logoUrlCtrl.text),
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Text('Falha ao carregar logo web'),
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: faviconUrlCtrl,
                    onChanged: (_) => setLocal(() {}),
                    decoration: InputDecoration(
                      labelText: 'Favicon URL',
                      suffixIcon: IconButton(
                        tooltip: 'Selecionar ícone',
                        onPressed: () async {
                          final url = await _uploadBrandingAsset(
                            allowedExtensions: const ['ico', 'png'],
                          );
                          if (url == null) return;
                          setLocal(() => faviconUrlCtrl.text = url);
                        },
                        icon: const Icon(Icons.upload_file_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (faviconUrlCtrl.text.trim().isNotEmpty)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.black12),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Image.network(
                          _absoluteUrl(faviconUrlCtrl.text),
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Icon(Icons.broken_image_outlined, size: 16),
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: fontFamilyCtrl,
                    onChanged: (_) => setLocal(() {}),
                    decoration: const InputDecoration(labelText: 'Fonte do app'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: borderRadiusCtrl,
                          onChanged: (_) => setLocal(() {}),
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Border radius'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: sidebarVariant,
                          decoration: const InputDecoration(
                            labelText: 'Variação da sidebar',
                          ),
                          items: const [
                            DropdownMenuItem(
                                value: 'gradient', child: Text('Gradient')),
                            DropdownMenuItem(
                                value: 'solid', child: Text('Solid')),
                          ],
                          onChanged: (v) => setLocal(
                            () => sidebarVariant = v ?? 'gradient',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton.icon(
                      onPressed: () => _saveBranding({
                        'appTitle': appTitleCtrl.text.trim(),
                        'primaryColor': primaryColorCtrl.text.trim(),
                        'secondaryColor': secondaryColorCtrl.text.trim(),
                        'headingColor': headingColorCtrl.text.trim(),
                        'buttonColor': buttonColorCtrl.text.trim(),
                        'textColor': textColorCtrl.text.trim(),
                        'backgroundColor': backgroundColorCtrl.text.trim(),
                        'appLogoUrl': appLogoUrlCtrl.text.trim(),
                        'logoUrl': logoUrlCtrl.text.trim(),
                        'faviconUrl': faviconUrlCtrl.text.trim(),
                        'fontFamily': fontFamilyCtrl.text.trim(),
                        'borderRadius':
                            int.tryParse(borderRadiusCtrl.text.trim()) ?? 12,
                        'sidebarVariant': sidebarVariant,
                      }),
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('Salvar identidade visual'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSchedulesTab() {
    final rows = _schedules
        .map((e) => <String, dynamic>{
              'weekday': (e['weekday'] ?? '').toString(),
              'weekdayEn': (e['weekdayEn'] ?? '').toString(),
              'startTime': (e['startTime'] ?? '').toString(),
              'endTime': (e['endTime'] ?? '').toString(),
            })
        .toList();
    return StatefulBuilder(
      builder: (context, setLocal) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  ...rows.asMap().entries.map((entry) {
                    final index = entry.key;
                    final item = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 4,
                            child: TextField(
                              controller:
                                  TextEditingController(text: item['weekday']),
                              enabled: false,
                              decoration: const InputDecoration(
                                labelText: 'Dia da semana',
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            flex: 3,
                            child: TextField(
                              controller: TextEditingController(
                                  text: item['startTime']),
                              onChanged: (v) => rows[index]['startTime'] = v,
                              decoration: const InputDecoration(
                                labelText: 'Hora inicial',
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            flex: 3,
                            child: TextField(
                              controller:
                                  TextEditingController(text: item['endTime']),
                              onChanged: (v) => rows[index]['endTime'] = v,
                              decoration: const InputDecoration(
                                labelText: 'Hora final',
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton.icon(
                      onPressed: () => _saveSchedules(rows),
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('Salvar horários'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final schedulesEnabled = _settingValue('scheduleType') == 'company';
    final tabs = <Tab>[
      const Tab(text: 'Opções'),
      const Tab(text: 'E-mail / SMTP'),
      const Tab(text: 'Identidade visual'),
      if (schedulesEnabled) const Tab(text: 'Horários'),
    ];
    final views = <Widget>[
      _buildOptionsTab(),
      _buildEmailTab(),
      _buildBrandingTab(),
      if (schedulesEnabled) _buildSchedulesTab(),
    ];

    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Configurações'),
          bottom: TabBar(
            isScrollable: true,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: Colors.white,
            indicatorWeight: 3,
            labelStyle: const TextStyle(fontWeight: FontWeight.w800),
            tabs: tabs,
          ),
        ),
        body: Column(
          children: [
            if (_loading) const LinearProgressIndicator(minHeight: 2),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.all(10),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Ajuste as opções do sistema, e-mail, identidade visual e horários.',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: _fetch,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Atualizar'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(children: views),
            ),
          ],
        ),
      ),
    );
  }

  Color _colorFromHex(String value, Color fallback) {
    final raw = value.trim().replaceAll('#', '');
    try {
      if (raw.length == 6) return Color(int.parse('FF$raw', radix: 16));
      if (raw.length == 8) return Color(int.parse(raw, radix: 16));
    } catch (_) {}
    return fallback;
  }
}
