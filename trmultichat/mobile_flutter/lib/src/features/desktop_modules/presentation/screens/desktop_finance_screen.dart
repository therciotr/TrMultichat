import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

class DesktopFinanceScreen extends ConsumerStatefulWidget {
  const DesktopFinanceScreen({super.key});

  @override
  ConsumerState<DesktopFinanceScreen> createState() =>
      _DesktopFinanceScreenState();
}

class _DesktopFinanceScreenState extends ConsumerState<DesktopFinanceScreen> {
  bool _loading = false;
  bool _billingLoading = false;
  bool _billingSaving = false;
  String? _error;
  List<Map<String, dynamic>> _invoices = const <Map<String, dynamic>>[];
  final TextEditingController _searchCtrl = TextEditingController();
  String _statusFilter = 'all';
  String _monthFilter = 'all';
  String _companyFilter = 'all';

  bool _isSuper = false;
  bool _isMasterEmail = false;

  bool _billingEnabled = false;
  bool _billingAutoEnabled = false;
  bool _billingIncludeOverdue = false;
  String _billingAutoTime = '09:00';
  int _billingDaysBefore = 0;
  final TextEditingController _billingSubjectCtrl = TextEditingController();
  final TextEditingController _billingBodyCtrl = TextEditingController();

  Dio get _dio => ref.read(dioProvider);

  @override
  void initState() {
    super.initState();
    final auth = ref.read(authControllerProvider);
    final user = auth.user;
    final email = (user?.email ?? '').toLowerCase().trim();
    _isMasterEmail = email == 'thercio@trtecnologias.com.br';
    _isSuper = user?.isSuper == true || user?.admin == true || _isMasterEmail;
    _fetch();
    if (_isMasterEmail) {
      _loadBillingConfig();
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _billingSubjectCtrl.dispose();
    _billingBodyCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final route = _isSuper ? '/invoices/admin/all' : '/invoices/all';
      final params = <String, dynamic>{'pageNumber': 1};
      if (_isSuper) params['ensureUpcoming'] = 1;
      final res = await _dio.get(route, queryParameters: params);
      final data = res.data;
      final list = (data is List ? data : const <dynamic>[]);
      if (mounted) {
        setState(() {
          _invoices = list
              .whereType<Map>()
              .map((e) => e.cast<String, dynamic>())
              .toList();
        });
      }
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 403 && _isSuper) {
        setState(() => _isSuper = false);
        return _fetch();
      }
      if (mounted) {
        setState(() => _error = 'Falha ao carregar faturas');
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _loadBillingConfig() async {
    setState(() => _billingLoading = true);
    try {
      final res = await _dio.get('/invoices/admin/billing-email-config');
      final raw = res.data;
      final cfg = raw is Map ? raw['config'] : null;
      if (cfg is Map && mounted) {
        final map = cfg.cast<String, dynamic>();
        setState(() {
          _billingEnabled = map['enabled'] == true;
          _billingAutoEnabled = map['autoEnabled'] == true;
          _billingIncludeOverdue = map['includeOverdue'] == true;
          _billingAutoTime = (map['autoTime'] ?? '09:00').toString();
          _billingDaysBefore = (map['daysBefore'] as num?)?.toInt() ?? 0;
          _billingSubjectCtrl.text = (map['subjectTemplate'] ?? '').toString();
          _billingBodyCtrl.text = (map['bodyTemplate'] ?? '').toString();
        });
      }
    } catch (_) {
      // Mantém interface funcional mesmo sem config.
    } finally {
      if (mounted) setState(() => _billingLoading = false);
    }
  }

  Future<void> _saveBillingConfig() async {
    setState(() => _billingSaving = true);
    try {
      await _dio
          .put('/invoices/admin/billing-email-config', data: <String, dynamic>{
        'enabled': _billingEnabled,
        'autoEnabled': _billingAutoEnabled,
        'includeOverdue': _billingIncludeOverdue,
        'autoTime': _billingAutoTime,
        'daysBefore': _billingDaysBefore,
        'subjectTemplate': _billingSubjectCtrl.text.trim(),
        'bodyTemplate': _billingBodyCtrl.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Configurações de cobrança salvas.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Falha ao salvar configurações de cobrança.')),
      );
    } finally {
      if (mounted) setState(() => _billingSaving = false);
    }
  }

  Future<void> _runBillingNow() async {
    try {
      await _dio.post('/invoices/admin/billing-email/run-now');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Disparo manual iniciado.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao iniciar envio manual.')),
      );
    }
  }

  Future<void> _sendInvoiceEmail(int id) async {
    try {
      await _dio.post('/invoices/admin/$id/send-email',
          data: <String, dynamic>{'force': true});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('E-mail da fatura #$id enviado.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha no envio da fatura #$id.')),
      );
    }
  }

  Future<void> _manualSettlement(Map<String, dynamic> inv) async {
    final discountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    String method = 'dinheiro';
    bool markPaid = true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Baixa manual / desconto'),
          content: SizedBox(
            width: 440,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Fatura #${inv['id']} - ${(inv['companyName'] ?? 'Cliente').toString()}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: discountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Desconto (R\$)',
                    hintText: 'Ex.: 10',
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: method,
                  decoration: const InputDecoration(labelText: 'Método'),
                  items: const [
                    DropdownMenuItem(
                        value: 'dinheiro', child: Text('Dinheiro')),
                    DropdownMenuItem(value: 'pix', child: Text('PIX')),
                    DropdownMenuItem(
                        value: 'transferencia', child: Text('Transferência')),
                    DropdownMenuItem(value: 'cartao', child: Text('Cartão')),
                    DropdownMenuItem(value: 'boleto', child: Text('Boleto')),
                    DropdownMenuItem(value: 'outro', child: Text('Outro')),
                  ],
                  onChanged: (v) => setLocal(() => method = v ?? 'dinheiro'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: noteCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Observação',
                    hintText: 'Ex.: Pagou no balcão',
                  ),
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  value: markPaid,
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Marcar como pago'),
                  onChanged: (v) => setLocal(() => markPaid = v ?? true),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancelar')),
            FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Salvar')),
          ],
        ),
      ),
    );
    if (ok != true) return;
    final raw = discountCtrl.text.trim().replaceAll(',', '.');
    final discount = raw.isEmpty ? null : double.tryParse(raw);
    try {
      await _dio.patch('/invoices/admin/${inv['id']}/manual-settlement',
          data: <String, dynamic>{
            'markPaid': markPaid,
            'paidMethod': method,
            'paidNote': noteCtrl.text.trim(),
            'discountValue': discount,
          });
      await _fetch();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Baixa manual aplicada com sucesso.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao aplicar baixa manual.')),
      );
    }
  }

  bool _isOverdue(Map<String, dynamic> inv) {
    final status = (inv['status'] ?? '').toString().toLowerCase();
    if (status == 'paid') return false;
    final due = DateTime.tryParse((inv['dueDate'] ?? '').toString());
    if (due == null) return false;
    final today = DateTime.now();
    final todayStart = DateTime(today.year, today.month, today.day);
    return due.isBefore(todayStart);
  }

  String _classify(Map<String, dynamic> inv) {
    final status = (inv['status'] ?? '').toString().toLowerCase();
    if (status == 'paid') return 'paid';
    return _isOverdue(inv) ? 'overdue' : 'open';
  }

  String _money(num? v) {
    final n = (v ?? 0).toDouble();
    final fixed = n.toStringAsFixed(2);
    final parts = fixed.split('.');
    final inteiro = parts.first.replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (match) => '.',
    );
    return 'R\$ $inteiro,${parts.last}';
  }

  String _date(String? raw) {
    final dt = DateTime.tryParse(raw ?? '');
    if (dt == null) return '-';
    final d = dt.day.toString().padLeft(2, '0');
    final m = dt.month.toString().padLeft(2, '0');
    return '$d/$m/${dt.year}';
  }

  List<String> _monthOptions(List<Map<String, dynamic>> list) {
    final set = <String>{};
    for (final inv in list) {
      final due = DateTime.tryParse((inv['dueDate'] ?? '').toString());
      if (due == null) continue;
      final key = '${due.year}-${due.month.toString().padLeft(2, '0')}';
      set.add(key);
    }
    final sorted = set.toList()..sort();
    return <String>['all', ...sorted];
  }

  List<Map<String, dynamic>> _companyOptions(List<Map<String, dynamic>> list) {
    final map = <String, String>{};
    for (final inv in list) {
      final id = (inv['companyId'] ?? '').toString();
      if (id.isEmpty) continue;
      map[id] = (inv['companyName'] ?? 'Empresa $id').toString();
    }
    final entries = map.entries.toList()
      ..sort((a, b) => a.value.compareTo(b.value));
    return entries
        .map((e) => <String, dynamic>{'id': e.key, 'name': e.value})
        .toList();
  }

  List<Map<String, dynamic>> _applyFilters(List<Map<String, dynamic>> list) {
    final q = _searchCtrl.text.trim().toLowerCase();
    return list.where((inv) {
      final cls = _classify(inv);
      if (_statusFilter != 'all' && cls != _statusFilter) return false;
      if (_monthFilter != 'all') {
        final due = DateTime.tryParse((inv['dueDate'] ?? '').toString());
        final key = due == null
            ? ''
            : '${due.year}-${due.month.toString().padLeft(2, '0')}';
        if (key != _monthFilter) return false;
      }
      if (_isSuper && _companyFilter != 'all') {
        final cid = (inv['companyId'] ?? '').toString();
        if (cid != _companyFilter) return false;
      }
      if (q.isEmpty) return true;
      final text =
          '${inv['id']} ${inv['detail']} ${inv['companyName']} ${inv['companyEmail']}'
              .toLowerCase();
      return text.contains(q);
    }).toList();
  }

  _FinanceSummary _buildSummary(List<Map<String, dynamic>> list) {
    var paid = 0.0;
    var open = 0.0;
    var overdue = 0.0;
    for (final inv in list) {
      final v = (inv['value'] as num?)?.toDouble() ?? 0;
      final cls = _classify(inv);
      if (cls == 'paid') paid += v;
      if (cls == 'open') open += v;
      if (cls == 'overdue') overdue += v;
    }
    return _FinanceSummary(
      totalInvoices: list.length,
      totalPaid: paid,
      totalOpen: open,
      totalOverdue: overdue,
    );
  }

  Map<String, int> _statusCount(List<Map<String, dynamic>> list) {
    final out = <String, int>{'paid': 0, 'open': 0, 'overdue': 0};
    for (final inv in list) {
      out[_classify(inv)] = (out[_classify(inv)] ?? 0) + 1;
    }
    return out;
  }

  List<_MonthValue> _monthlyPaid(List<Map<String, dynamic>> list) {
    final map = <String, double>{};
    for (final inv in list) {
      if (_classify(inv) != 'paid') continue;
      final due = DateTime.tryParse((inv['dueDate'] ?? '').toString());
      if (due == null) continue;
      final key = '${due.year}-${due.month.toString().padLeft(2, '0')}';
      map[key] = (map[key] ?? 0) + ((inv['value'] as num?)?.toDouble() ?? 0);
    }
    final keys = map.keys.toList()..sort();
    return keys.map((k) => _MonthValue(month: k, value: map[k] ?? 0)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final monthOptions = _monthOptions(_invoices);
    final companyOptions = _companyOptions(_invoices);
    final filtered = _applyFilters(_invoices);
    final summary = _buildSummary(filtered);
    final statusCount = _statusCount(filtered);
    final monthly = _monthlyPaid(filtered);

    return Scaffold(
      appBar: AppBar(title: const Text('Financeiro')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: TextStyle(color: cs.error)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          color: cs.primary,
                          boxShadow: [
                            BoxShadow(
                              color: cs.primary.withOpacity(0.20),
                              blurRadius: 16,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _isSuper
                                  ? 'Painel Financeiro (Admin)'
                                  : 'Painel Financeiro',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(
                                    color: cs.onPrimary,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _isSuper
                                  ? 'Gerencie e acompanhe faturas multi-tenant.'
                                  : 'Acompanhe suas faturas e pagamentos em tempo real.',
                              style: TextStyle(
                                  color: cs.onPrimary.withOpacity(0.92)),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: [
                          _SummaryCard(
                              title: 'Total de Faturas',
                              value: '${summary.totalInvoices}'),
                          _SummaryCard(
                              title: 'Total Pago',
                              value: _money(summary.totalPaid)),
                          _SummaryCard(
                              title: 'Em Aberto',
                              value: _money(summary.totalOpen)),
                          _SummaryCard(
                              title: 'Vencido',
                              value: _money(summary.totalOverdue)),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _SectionCard(
                        title: 'Filtros',
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final w = constraints.maxWidth;
                            final searchW =
                                (w >= 1200 ? 420.0 : w >= 900 ? 340.0 : (w - 12))
                                    .clamp(220.0, 460.0);
                            final compactW =
                                (w >= 1200 ? 220.0 : w >= 900 ? 190.0 : (w - 12))
                                    .clamp(170.0, 260.0);
                            final companyW =
                                (w >= 1200 ? 280.0 : w >= 900 ? 240.0 : (w - 12))
                                    .clamp(190.0, 340.0);

                            return Wrap(
                              spacing: 10,
                              runSpacing: 10,
                              children: [
                                SizedBox(
                                  width: searchW,
                                  child: TextField(
                                    controller: _searchCtrl,
                                    onChanged: (_) => setState(() {}),
                                    decoration: const InputDecoration(
                                      labelText: 'Buscar por ID ou detalhes',
                                      prefixIcon: Icon(Icons.search),
                                    ),
                                  ),
                                ),
                                SizedBox(
                                  width: compactW,
                                  child: DropdownButtonFormField<String>(
                                    isExpanded: true,
                                    value: _statusFilter,
                                    decoration: const InputDecoration(
                                        labelText: 'Status'),
                                    items: const [
                                      DropdownMenuItem(
                                          value: 'all', child: Text('Todos')),
                                      DropdownMenuItem(
                                          value: 'paid', child: Text('Pago')),
                                      DropdownMenuItem(
                                          value: 'open',
                                          child: Text('Em Aberto')),
                                      DropdownMenuItem(
                                          value: 'overdue',
                                          child: Text('Vencido')),
                                    ],
                                    onChanged: (v) => setState(
                                        () => _statusFilter = v ?? 'all'),
                                  ),
                                ),
                                SizedBox(
                                  width: compactW,
                                  child: DropdownButtonFormField<String>(
                                    isExpanded: true,
                                    value: _monthFilter,
                                    decoration:
                                        const InputDecoration(labelText: 'Mês'),
                                    items: monthOptions
                                        .map(
                                          (m) => DropdownMenuItem(
                                            value: m,
                                            child:
                                                Text(m == 'all' ? 'Todos' : m),
                                          ),
                                        )
                                        .toList(),
                                    onChanged: (v) => setState(
                                        () => _monthFilter = v ?? 'all'),
                                  ),
                                ),
                                if (_isSuper)
                                  SizedBox(
                                    width: companyW,
                                    child: DropdownButtonFormField<String>(
                                      isExpanded: true,
                                      value: _companyFilter,
                                      decoration: const InputDecoration(
                                          labelText: 'Cliente'),
                                      items: [
                                        const DropdownMenuItem(
                                            value: 'all',
                                            child: Text('Todos')),
                                        ...companyOptions.map(
                                          (c) => DropdownMenuItem(
                                            value: c['id'].toString(),
                                            child: Text(
                                              c['name'].toString(),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ),
                                      ],
                                      onChanged: (v) => setState(
                                          () => _companyFilter = v ?? 'all'),
                                    ),
                                  ),
                                FilledButton.icon(
                                  onPressed: _fetch,
                                  icon: const Icon(Icons.refresh),
                                  label: const Text('Atualizar'),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: [
                          _SectionCard(
                            title: 'Evolução Mensal (Pagos)',
                            width: 680,
                            child: monthly.isEmpty
                                ? const Text(
                                    'Sem dados de pagamento no período.')
                                : Column(
                                    children: monthly
                                        .map(
                                          (m) => Padding(
                                            padding: const EdgeInsets.only(
                                                bottom: 8),
                                            child: Row(
                                              children: [
                                                SizedBox(
                                                    width: 90,
                                                    child: Text(m.month)),
                                                Expanded(
                                                  child:
                                                      LinearProgressIndicator(
                                                    value:
                                                        monthly.last.value <= 0
                                                            ? 0
                                                            : (m.value /
                                                                    monthly.last
                                                                        .value)
                                                                .clamp(0, 1),
                                                    minHeight: 8,
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                SizedBox(
                                                  width: 130,
                                                  child: Text(
                                                    _money(m.value),
                                                    textAlign: TextAlign.end,
                                                    style: const TextStyle(
                                                        fontWeight:
                                                            FontWeight.w700),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        )
                                        .toList(),
                                  ),
                          ),
                          _SectionCard(
                            title: 'Distribuição por Status',
                            width: 360,
                            child: _StatusDistribution(
                              paid: statusCount['paid'] ?? 0,
                              open: statusCount['open'] ?? 0,
                              overdue: statusCount['overdue'] ?? 0,
                            ),
                          ),
                        ],
                      ),
                      if (_isMasterEmail) ...[
                        const SizedBox(height: 14),
                        ExpansionTile(
                          initiallyExpanded: false,
                          title:
                              const Text('Cobranças por e-mail (Admin Master)'),
                          subtitle:
                              Text(_billingEnabled ? 'Ativado' : 'Desativado'),
                          childrenPadding:
                              const EdgeInsets.fromLTRB(14, 0, 14, 14),
                          children: [
                            if (_billingLoading)
                              const LinearProgressIndicator(minHeight: 2),
                            SwitchListTile(
                              value: _billingEnabled,
                              onChanged: (v) =>
                                  setState(() => _billingEnabled = v),
                              title: const Text('Ativar cobranças por e-mail'),
                            ),
                            SwitchListTile(
                              value: _billingAutoEnabled,
                              onChanged: _billingEnabled
                                  ? (v) =>
                                      setState(() => _billingAutoEnabled = v)
                                  : null,
                              title: const Text('Envio automático'),
                            ),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    enabled: _billingEnabled,
                                    controller: TextEditingController(
                                        text: _billingAutoTime),
                                    onChanged: (v) => _billingAutoTime = v,
                                    decoration: const InputDecoration(
                                        labelText: 'Horário (HH:MM)'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: TextField(
                                    enabled: _billingEnabled,
                                    keyboardType: TextInputType.number,
                                    controller: TextEditingController(
                                        text: '$_billingDaysBefore'),
                                    onChanged: (v) => _billingDaysBefore =
                                        int.tryParse(v) ?? 0,
                                    decoration: const InputDecoration(
                                        labelText: 'Dias antes'),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            SwitchListTile(
                              value: _billingIncludeOverdue,
                              onChanged: _billingEnabled
                                  ? (v) =>
                                      setState(() => _billingIncludeOverdue = v)
                                  : null,
                              title:
                                  const Text('Incluir vencidas no automático'),
                            ),
                            TextField(
                              enabled: _billingEnabled,
                              controller: _billingSubjectCtrl,
                              decoration: const InputDecoration(
                                  labelText: 'Assunto (template)'),
                            ),
                            const SizedBox(height: 10),
                            TextField(
                              enabled: _billingEnabled,
                              controller: _billingBodyCtrl,
                              minLines: 4,
                              maxLines: 6,
                              decoration: const InputDecoration(
                                  labelText: 'Mensagem (template)'),
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              alignment: WrapAlignment.end,
                              children: [
                                OutlinedButton(
                                    onPressed: _loadBillingConfig,
                                    child: const Text('Recarregar')),
                                OutlinedButton.icon(
                                  onPressed:
                                      _billingEnabled ? _runBillingNow : null,
                                  icon: const Icon(Icons.send_outlined),
                                  label: const Text('Enviar agora'),
                                ),
                                FilledButton(
                                  onPressed: _billingSaving
                                      ? null
                                      : _saveBillingConfig,
                                  child: Text(_billingSaving
                                      ? 'Salvando...'
                                      : 'Salvar configurações'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 14),
                      _SectionCard(
                        title: 'Faturas',
                        child: _isSuper
                            ? _AdminInvoicesList(
                                invoices: filtered,
                                money: _money,
                                date: _date,
                                classify: _classify,
                                onSendEmail: _sendInvoiceEmail,
                                onManualSettlement: _manualSettlement,
                                billingEnabled:
                                    _billingEnabled || !_isMasterEmail,
                              )
                            : _ClientInvoicesList(
                                invoices: filtered,
                                money: _money,
                                date: _date,
                                classify: _classify,
                              ),
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _FinanceSummary {
  final int totalInvoices;
  final double totalPaid;
  final double totalOpen;
  final double totalOverdue;
  const _FinanceSummary({
    required this.totalInvoices,
    required this.totalPaid,
    required this.totalOpen,
    required this.totalOverdue,
  });
}

class _MonthValue {
  final String month;
  final double value;
  const _MonthValue({required this.month, required this.value});
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  const _SummaryCard({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      width: 280,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: cs.surface,
        border: Border.all(color: cs.outlineVariant.withOpacity(0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  color: cs.onSurfaceVariant, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value,
              style:
                  const TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  final double? width;
  const _SectionCard({required this.title, required this.child, this.width});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final content = Container(
      width: width,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: cs.surface,
        border: Border.all(color: cs.outlineVariant.withOpacity(0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
    return content;
  }
}

class _StatusDistribution extends StatelessWidget {
  final int paid;
  final int open;
  final int overdue;
  const _StatusDistribution(
      {required this.paid, required this.open, required this.overdue});

  @override
  Widget build(BuildContext context) {
    final total = paid + open + overdue;
    double p(int v) => total == 0 ? 0 : v / total;
    return Column(
      children: [
        _StatusLine(
            label: 'Pago', count: paid, progress: p(paid), color: Colors.green),
        const SizedBox(height: 8),
        _StatusLine(
            label: 'Em Aberto',
            count: open,
            progress: p(open),
            color: Colors.blue),
        const SizedBox(height: 8),
        _StatusLine(
            label: 'Vencido',
            count: overdue,
            progress: p(overdue),
            color: Colors.red),
      ],
    );
  }
}

class _StatusLine extends StatelessWidget {
  final String label;
  final int count;
  final double progress;
  final Color color;
  const _StatusLine({
    required this.label,
    required this.count,
    required this.progress,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
            width: 90,
            child: Text(label,
                style: const TextStyle(fontWeight: FontWeight.w700))),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
                value: progress,
                minHeight: 8,
                valueColor: AlwaysStoppedAnimation<Color>(color)),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(width: 28, child: Text('$count', textAlign: TextAlign.end)),
      ],
    );
  }
}

class _AdminInvoicesList extends StatelessWidget {
  final List<Map<String, dynamic>> invoices;
  final String Function(num?) money;
  final String Function(String?) date;
  final String Function(Map<String, dynamic>) classify;
  final Future<void> Function(int) onSendEmail;
  final Future<void> Function(Map<String, dynamic>) onManualSettlement;
  final bool billingEnabled;
  const _AdminInvoicesList({
    required this.invoices,
    required this.money,
    required this.date,
    required this.classify,
    required this.onSendEmail,
    required this.onManualSettlement,
    required this.billingEnabled,
  });

  @override
  Widget build(BuildContext context) {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final inv in invoices) {
      final id = (inv['companyId'] ?? '').toString();
      grouped.putIfAbsent(id, () => <Map<String, dynamic>>[]).add(inv);
    }
    final keys = grouped.keys.toList()
      ..sort((a, b) {
        final an = (grouped[a]?.first['companyName'] ?? '').toString();
        final bn = (grouped[b]?.first['companyName'] ?? '').toString();
        return an.compareTo(bn);
      });

    if (keys.isEmpty) return const Text('Nenhuma fatura encontrada.');

    return Column(
      children: keys.map((k) {
        final list = grouped[k] ?? const <Map<String, dynamic>>[];
        final name =
            (list.isNotEmpty ? list.first['companyName'] : 'Empresa $k')
                .toString();
        final counts = {'paid': 0, 'open': 0, 'overdue': 0};
        for (final inv in list) {
          counts[classify(inv)] = (counts[classify(inv)] ?? 0) + 1;
        }
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: ExpansionTile(
            title:
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text(
                'Pago: ${counts['paid']} | Em aberto: ${counts['open']} | Vencido: ${counts['overdue']}'),
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columnSpacing: 18,
                  dataRowMinHeight: 52,
                  dataRowMaxHeight: 60,
                  columns: const [
                    DataColumn(label: Text('Id')),
                    DataColumn(label: Text('Detalhes')),
                    DataColumn(label: Text('Valor')),
                    DataColumn(label: Text('Vencimento')),
                    DataColumn(label: Text('Status')),
                    DataColumn(label: Text('Ações')),
                  ],
                  rows: list.map((inv) {
                    final s = classify(inv);
                    final statusText = s == 'paid'
                        ? 'Pago'
                        : s == 'overdue'
                            ? 'Vencido'
                            : 'Em Aberto';
                    return DataRow(
                      cells: [
                        DataCell(Text((inv['id'] ?? '-').toString())),
                        DataCell(SizedBox(
                            width: 300,
                            child: Text((inv['detail'] ?? '-').toString(),
                                maxLines: 1, overflow: TextOverflow.ellipsis))),
                        DataCell(Text(money(inv['value'] as num?))),
                        DataCell(Text(date((inv['dueDate'] ?? '').toString()))),
                        DataCell(Chip(label: Text(statusText))),
                        DataCell(
                          SizedBox(
                            width: 190,
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 90,
                                  child: OutlinedButton.icon(
                                    style: OutlinedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 10),
                                    ),
                                    onPressed: billingEnabled
                                        ? () => onSendEmail(
                                            (inv['id'] as num?)?.toInt() ?? 0)
                                        : null,
                                    icon: const Icon(Icons.email_outlined,
                                        size: 14),
                                    label: const Text('E-mail'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                SizedBox(
                                  width: 90,
                                  child: OutlinedButton.icon(
                                    style: OutlinedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 10),
                                    ),
                                    onPressed: () => onManualSettlement(inv),
                                    icon: const Icon(Icons.edit_outlined,
                                        size: 14),
                                    label: const Text('Baixar'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _ClientInvoicesList extends StatelessWidget {
  final List<Map<String, dynamic>> invoices;
  final String Function(num?) money;
  final String Function(String?) date;
  final String Function(Map<String, dynamic>) classify;
  const _ClientInvoicesList({
    required this.invoices,
    required this.money,
    required this.date,
    required this.classify,
  });

  @override
  Widget build(BuildContext context) {
    if (invoices.isEmpty) return const Text('Nenhuma fatura encontrada.');
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns: const [
          DataColumn(label: Text('Id')),
          DataColumn(label: Text('Detalhes')),
          DataColumn(label: Text('Valor')),
          DataColumn(label: Text('Vencimento')),
          DataColumn(label: Text('Status')),
          DataColumn(label: Text('Ação')),
        ],
        rows: invoices.map((inv) {
          final s = classify(inv);
          final statusText = s == 'paid'
              ? 'Pago'
              : s == 'overdue'
                  ? 'Vencido'
                  : 'Em Aberto';
          return DataRow(
            cells: [
              DataCell(Text((inv['id'] ?? '-').toString())),
              DataCell(SizedBox(
                  width: 320,
                  child: Text((inv['detail'] ?? '-').toString(),
                      maxLines: 1, overflow: TextOverflow.ellipsis))),
              DataCell(Text(money(inv['value'] as num?))),
              DataCell(Text(date((inv['dueDate'] ?? '').toString()))),
              DataCell(Chip(label: Text(statusText))),
              DataCell(
                s == 'paid'
                    ? const OutlinedButton(onPressed: null, child: Text('Pago'))
                    : OutlinedButton(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text(
                                    'Fluxo de pagamento nativo em implementação.')),
                          );
                        },
                        child: const Text('Pagar'),
                      ),
              ),
            ],
          );
        }).toList(),
      ),
    );
  }
}
