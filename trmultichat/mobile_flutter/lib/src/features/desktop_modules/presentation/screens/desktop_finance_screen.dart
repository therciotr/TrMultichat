import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';

class DesktopFinanceScreen extends ConsumerStatefulWidget {
  const DesktopFinanceScreen({super.key});

  @override
  ConsumerState<DesktopFinanceScreen> createState() => _DesktopFinanceScreenState();
}

class _DesktopFinanceScreenState extends ConsumerState<DesktopFinanceScreen> {
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _invoices = const <Map<String, dynamic>>[];
  String _status = 'all';

  Dio get _dio => ref.read(dioProvider);

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
      final res = await _dio.get('/invoices/all', queryParameters: <String, dynamic>{'pageNumber': 1});
      final data = res.data;
      final list = (data is List ? data : const <dynamic>[]);
      _invoices = list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    } catch (_) {
      _error = 'Falha ao carregar faturas';
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
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
    return 'R\$ ${n.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _invoices.where((inv) {
      if (_status == 'all') return true;
      return _classify(inv) == _status;
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Financeiro')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Expanded(
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'all', label: Text('Todos')),
                      ButtonSegment(value: 'open', label: Text('Em aberto')),
                      ButtonSegment(value: 'overdue', label: Text('Vencidos')),
                      ButtonSegment(value: 'paid', label: Text('Pagos')),
                    ],
                    selected: <String>{_status},
                    onSelectionChanged: (s) => setState(() => _status = s.first),
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
                final inv = filtered[i];
                final id = (inv['id'] ?? '').toString();
                final detail = (inv['detail'] ?? '-').toString();
                final value = (inv['value'] as num?) ?? 0;
                final dueDate = (inv['dueDate'] ?? '').toString();
                final status = _classify(inv);
                final chip = switch (status) {
                  'paid' => const Chip(label: Text('Pago')),
                  'overdue' => const Chip(label: Text('Vencido')),
                  _ => const Chip(label: Text('Em aberto')),
                };
                return Card(
                  child: ListTile(
                    title: Text('Fatura #$id', style: const TextStyle(fontWeight: FontWeight.w900)),
                    subtitle: Text('$detail\nVencimento: $dueDate\nValor: ${_money(value)}'),
                    isThreeLine: true,
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        chip,
                        const SizedBox(height: 4),
                        if (status != 'paid')
                          TextButton(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Fluxo de pagamento nativo em implementação. '
                                    'Esta tela já é 100% nativa e sem WebView.',
                                  ),
                                ),
                              );
                            },
                            child: const Text('Pagar'),
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
