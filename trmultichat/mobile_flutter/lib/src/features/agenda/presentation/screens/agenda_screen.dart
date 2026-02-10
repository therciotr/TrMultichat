import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/agenda_providers.dart';
import '../controllers/agenda_controller.dart';

class AgendaScreen extends ConsumerStatefulWidget {
  const AgendaScreen({super.key});

  @override
  ConsumerState<AgendaScreen> createState() => _AgendaScreenState();
}

class _AgendaScreenState extends ConsumerState<AgendaScreen> {
  DateTime _selectedDay = DateTime.now();

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  String _fmtDayLabel(DateTime d) {
    final dd = d.day.toString().padLeft(2, '0');
    final mm = d.month.toString().padLeft(2, '0');
    return '$dd/$mm/${d.year}';
  }

  String _fmtTime(DateTime d) {
    final hh = d.hour.toString().padLeft(2, '0');
    final mm = d.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }

  Future<void> _openCreateDialog() async {
    final ctrl = ref.read(agendaControllerProvider.notifier);
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (ctx) =>
          _CreateAgendaEventSheet(initialDay: _selectedDay, controller: ctrl),
    );
    if (ok == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Evento criado com sucesso.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(agendaControllerProvider);
    final ctrl = ref.read(agendaControllerProvider.notifier);

    final selectedEvents = st.items
        .where((e) => _isSameDay(e.startAt, _selectedDay))
        .toList()
      ..sort((a, b) => a.startAt.compareTo(b.startAt));

    return Scaffold(
      appBar: AppBar(title: const Text('Agenda')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateDialog,
        icon: const Icon(Icons.add),
        label: const Text('Novo evento'),
      ),
      body: Column(
        children: [
          if (st.loading) const LinearProgressIndicator(minHeight: 2),
          if (st.error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(st.error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ctrl.refresh(),
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(
                          color: Theme.of(context)
                              .colorScheme
                              .outlineVariant
                              .withOpacity(0.45)),
                    ),
                    child: CalendarDatePicker(
                      initialDate: _selectedDay,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2035),
                      onDateChanged: (d) => setState(() => _selectedDay = d),
                      currentDate: DateTime.now(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Text(
                        'Eventos em ${_fmtDayLabel(_selectedDay)}',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          color: Theme.of(context)
                              .colorScheme
                              .primary
                              .withOpacity(0.12),
                        ),
                        child: Text(
                          '${selectedEvents.length}',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                      )
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (!st.loading && st.items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 30),
                      child: Text(
                        'Nenhum evento na agenda.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color:
                                Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                    ),
                  if (!st.loading &&
                      st.items.isNotEmpty &&
                      selectedEvents.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        'Sem eventos para esta data.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color:
                                Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                    ),
                  ...selectedEvents.map((ev) {
                    final start = ev.startAt;
                    final end = ev.endAt;
                    final timeLabel = ev.allDay
                        ? 'Dia inteiro'
                        : '${_fmtTime(start)} - ${_fmtTime(end)}';
                    return InkWell(
                        onTap: () => context.push('/agenda/event', extra: ev),
                        borderRadius: BorderRadius.circular(16),
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Ink(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .outlineVariant
                                      .withOpacity(0.55)),
                              color: Theme.of(context).colorScheme.surface,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 10,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color:
                                        Theme.of(context).colorScheme.primary,
                                    borderRadius: BorderRadius.circular(99),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(ev.title.toString(),
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w900)),
                                      const SizedBox(height: 2),
                                      Text(timeLabel,
                                          style: TextStyle(
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .onSurfaceVariant)),
                                      if ((ev.location?.toString() ?? '')
                                          .trim()
                                          .isNotEmpty)
                                        Padding(
                                          padding:
                                              const EdgeInsets.only(top: 4),
                                          child: Text(
                                            ev.location.toString(),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                color: Theme.of(context)
                                                    .colorScheme
                                                    .onSurfaceVariant),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                Icon(Icons.chevron_right,
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant),
                              ],
                            ),
                          ),
                        ));
                  }),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CreateAgendaEventSheet extends StatefulWidget {
  final DateTime initialDay;
  final AgendaController controller;
  const _CreateAgendaEventSheet(
      {required this.initialDay, required this.controller});

  @override
  State<_CreateAgendaEventSheet> createState() =>
      _CreateAgendaEventSheetState();
}

class _CreateAgendaEventSheetState extends State<_CreateAgendaEventSheet> {
  final _titleCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  bool _allDay = false;
  bool _saving = false;
  late DateTime _startAt;
  late DateTime _endAt;

  @override
  void initState() {
    super.initState();
    final base = DateTime(widget.initialDay.year, widget.initialDay.month,
        widget.initialDay.day, 9, 0);
    _startAt = base;
    _endAt = base.add(const Duration(hours: 1));
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _locationCtrl.dispose();
    super.dispose();
  }

  String _fmtDate(DateTime d) {
    final dd = d.day.toString().padLeft(2, '0');
    final mm = d.month.toString().padLeft(2, '0');
    return '$dd/$mm/${d.year}';
  }

  String _fmtTime(DateTime d) {
    final hh = d.hour.toString().padLeft(2, '0');
    final mm = d.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }

  Future<void> _pickDate({required bool start}) async {
    final current = start ? _startAt : _endAt;
    final picked = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked == null) return;
    setState(() {
      final old = start ? _startAt : _endAt;
      final updated =
          DateTime(picked.year, picked.month, picked.day, old.hour, old.minute);
      if (start) {
        _startAt = updated;
        if (!_endAt.isAfter(_startAt)) {
          _endAt = _startAt.add(const Duration(hours: 1));
        }
      } else {
        _endAt = updated;
        if (!_endAt.isAfter(_startAt)) {
          _endAt = _startAt.add(const Duration(hours: 1));
        }
      }
    });
  }

  Future<void> _pickTime({required bool start}) async {
    final current = start ? _startAt : _endAt;
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: current.hour, minute: current.minute),
    );
    if (picked == null) return;
    setState(() {
      final old = start ? _startAt : _endAt;
      final updated =
          DateTime(old.year, old.month, old.day, picked.hour, picked.minute);
      if (start) {
        _startAt = updated;
        if (!_endAt.isAfter(_startAt)) {
          _endAt = _startAt.add(const Duration(hours: 1));
        }
      } else {
        _endAt = updated;
        if (!_endAt.isAfter(_startAt)) {
          _endAt = _startAt.add(const Duration(hours: 1));
        }
      }
    });
  }

  Future<void> _submit() async {
    if (_saving) return;
    setState(() => _saving = true);
    final ok = await widget.controller.createEvent(
      title: _titleCtrl.text,
      startAt: _startAt,
      endAt: _allDay
          ? DateTime(_endAt.year, _endAt.month, _endAt.day, 23, 59)
          : _endAt,
      allDay: _allDay,
      location: _locationCtrl.text,
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (ok == true) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Novo evento',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(
              labelText: 'Título',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _locationCtrl,
            decoration: const InputDecoration(
              labelText: 'Local (opcional)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _allDay,
            onChanged: (v) => setState(() => _allDay = v),
            title: const Text('Dia inteiro'),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickDate(start: true),
                  icon: const Icon(Icons.calendar_today_outlined),
                  label: Text('Início ${_fmtDate(_startAt)}'),
                ),
              ),
              const SizedBox(width: 8),
              if (!_allDay)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pickTime(start: true),
                    icon: const Icon(Icons.schedule_outlined),
                    label: Text(_fmtTime(_startAt)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickDate(start: false),
                  icon: const Icon(Icons.event_available_outlined),
                  label: Text('Fim ${_fmtDate(_endAt)}'),
                ),
              ),
              const SizedBox(width: 8),
              if (!_allDay)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pickTime(start: false),
                    icon: const Icon(Icons.schedule_outlined),
                    label: Text(_fmtTime(_endAt)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _saving ? null : _submit,
            icon: const Icon(Icons.save_outlined),
            label: Text(_saving ? 'Salvando...' : 'Criar evento'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _saving ? null : () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
        ],
      ),
    );
  }
}
