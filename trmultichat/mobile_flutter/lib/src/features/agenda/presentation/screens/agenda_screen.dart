import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../auth/presentation/providers/auth_providers.dart';
import '../providers/agenda_providers.dart';
import '../controllers/agenda_controller.dart';

class AgendaScreen extends ConsumerStatefulWidget {
  const AgendaScreen({super.key});

  @override
  ConsumerState<AgendaScreen> createState() => _AgendaScreenState();
}

class _AgendaScreenState extends ConsumerState<AgendaScreen> {
  DateTime _selectedDay = DateTime.now();
  bool _canPickUser = false;
  bool _loadingUsers = false;
  int? _selectedUserId;
  List<Map<String, dynamic>> _users = const <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    _initAgendaUserScope();
  }

  Future<void> _initAgendaUserScope() async {
    final auth = ref.read(authControllerProvider).user;
    final profile = (auth?.profile ?? '').toLowerCase();
    final canPick = auth?.admin == true ||
        auth?.isSuper == true ||
        profile == 'admin' ||
        profile == 'super';
    final currentId = auth?.id;
    _selectedUserId = currentId;
    _canPickUser = canPick;

    final ctrl = ref.read(agendaControllerProvider.notifier);
    if (canPick && currentId != null && currentId > 0) {
      ctrl.setUserFilter(currentId);
    } else {
      ctrl.setUserFilter(null);
    }

    if (!canPick) {
      if (mounted) setState(() {});
      return;
    }
    if (mounted) setState(() => _loadingUsers = true);
    try {
      final fetched =
          await ref.read(agendaRemoteDataSourceProvider).listUsers();
      if (!mounted) return;
      setState(() {
        _users = fetched;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _users = const <Map<String, dynamic>>[]);
    } finally {
      if (mounted) setState(() => _loadingUsers = false);
    }
  }

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

  Future<bool> _confirmAndDeleteEvent(
    BuildContext context,
    AgendaController ctrl,
    String eventId,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir evento'),
        content: const Text('Deseja excluir este evento?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (ok != true) return false;

    final deleted = await ctrl.deleteEvent(eventId);
    if (!mounted) return false;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          deleted
              ? 'Evento excluído com sucesso.'
              : 'Não foi possível excluir o evento.',
        ),
      ),
    );
    return deleted;
  }

  bool _isDesktopLayout(BuildContext context) {
    final platform = Theme.of(context).platform;
    return platform == TargetPlatform.macOS ||
        platform == TargetPlatform.windows ||
        platform == TargetPlatform.linux;
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(agendaControllerProvider);
    final ctrl = ref.read(agendaControllerProvider.notifier);
    final cs = Theme.of(context).colorScheme;
    final isDesktop = _isDesktopLayout(context);
    final hasSelectedFilterUser = _selectedUserId != null &&
        _users.any((u) => (u['id'] as num?)?.toInt() == _selectedUserId);

    final selectedEvents = st.items
        .where((e) {
          // Backend may expand recurring occurrences as synthetic ids (baseId__occurrence).
          // For all-day cards in day view, keep only the base event to avoid day+1 bleed.
          final isSyntheticOccurrence = e.id.contains('__');
          if (e.allDay && isSyntheticOccurrence) return false;
          return _isSameDay(e.startAt, _selectedDay);
        })
        .toList()
      ..sort((a, b) => a.startAt.compareTo(b.startAt));

    Widget eventTile(dynamic ev) {
      final start = ev.startAt;
      final end = ev.endAt;
      final timeLabel =
          ev.allDay ? 'Dia inteiro' : '${_fmtTime(start)} - ${_fmtTime(end)}';
      return Dismissible(
        key: ValueKey('agenda-event-${ev.id}-${ev.seriesId}'),
        direction: DismissDirection.endToStart,
        confirmDismiss: (_) async =>
            _confirmAndDeleteEvent(context, ctrl, ev.seriesId),
        background: Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: cs.errorContainer,
            borderRadius: BorderRadius.circular(16),
          ),
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 16),
          child: Icon(Icons.delete_outline, color: cs.onErrorContainer),
        ),
        child: InkWell(
          onTap: () async {
            final deleted = await context.push('/agenda/event', extra: ev);
            if (deleted == true && mounted) {
              await ctrl.refresh();
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Evento excluído com sucesso.')),
              );
            }
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Ink(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: cs.outlineVariant.withOpacity(0.55)),
                color: cs.surface,
              ),
              child: Row(
                children: [
                  Container(
                    width: 10,
                    height: 44,
                    decoration: BoxDecoration(
                      color: cs.primary,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(ev.title.toString(),
                            style:
                                const TextStyle(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 2),
                        Text(timeLabel,
                            style: TextStyle(color: cs.onSurfaceVariant)),
                        if ((ev.location?.toString() ?? '').trim().isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              ev.location.toString(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: cs.onSurfaceVariant),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: cs.onSurfaceVariant),
                ],
              ),
            ),
          ),
        ),
      );
    }

    Widget sectionCard(Widget child) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: cs.surface,
          border: Border.all(color: cs.outlineVariant.withOpacity(0.5)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: child,
      );
    }

    Widget buildDesktopCalendarCard() {
      return sectionCard(
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.calendar_month_outlined, color: cs.primary),
                const SizedBox(width: 8),
                Text(
                  'Calendário',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w900),
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: cs.primary.withOpacity(0.10),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    _fmtDayLabel(_selectedDay),
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: cs.primary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: cs.surfaceContainerHighest.withOpacity(0.35),
                border: Border.all(color: cs.outlineVariant.withOpacity(0.45)),
              ),
              child: CalendarDatePicker(
                initialDate: _selectedDay,
                firstDate: DateTime(2020),
                lastDate: DateTime(2035),
                onDateChanged: (d) => setState(() => _selectedDay = d),
                currentDate: DateTime.now(),
              ),
            ),
          ],
        ),
      );
    }

    Widget buildDesktopEventsCard() {
      return sectionCard(
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.event_note_outlined, color: cs.primary),
                const SizedBox(width: 8),
                Text(
                  'Eventos em ${_fmtDayLabel(_selectedDay)}',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w900),
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: cs.primary.withOpacity(0.12),
                  ),
                  child: Text(
                    '${selectedEvents.length}',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      color: cs.primary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (!st.loading && st.items.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 22),
                  child: Text(
                    'Nenhum evento na agenda.',
                    style: TextStyle(color: cs.onSurfaceVariant),
                  ),
                ),
              ),
            if (!st.loading && st.items.isNotEmpty && selectedEvents.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 22),
                  child: Text(
                    'Sem eventos para esta data.',
                    style: TextStyle(color: cs.onSurfaceVariant),
                  ),
                ),
              ),
            ...selectedEvents.map(eventTile),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: isDesktop
          ? null
          : AppBar(
              title: const Text('Agenda'),
              actions: [
                IconButton(
                  tooltip: 'Sair',
                  icon: const Icon(Icons.logout),
                  onPressed: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Sair'),
                        content: const Text('Deseja sair da sua conta?'),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: const Text('Cancelar'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            child: const Text('Sair'),
                          ),
                        ],
                      ),
                    );
                    if (ok != true) return;
                    await ref.read(authControllerProvider.notifier).logout();
                    if (!mounted) return;
                    context.go('/login');
                  },
                ),
              ],
            ),
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
                padding: EdgeInsets.fromLTRB(
                  isDesktop ? 18 : 14,
                  isDesktop ? 18 : 14,
                  isDesktop ? 18 : 14,
                  90,
                ),
                children: [
                  if (isDesktop)
                    sectionCard(
                      Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: cs.primary.withOpacity(0.14),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(Icons.calendar_month, color: cs.primary),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Agenda',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleLarge
                                      ?.copyWith(fontWeight: FontWeight.w900),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Visual moderno para planejamento diário.',
                                  style:
                                      TextStyle(color: cs.onSurfaceVariant),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (isDesktop) const SizedBox(height: 14),
                  if (_canPickUser) ...[
                    if (_loadingUsers) const LinearProgressIndicator(minHeight: 2),
                    sectionCard(
                      Row(
                        children: [
                          Icon(Icons.person_outline, color: cs.primary),
                          const SizedBox(width: 10),
                          Expanded(
                            child: DropdownButtonFormField<int>(
                              value: hasSelectedFilterUser ? _selectedUserId : null,
                              items: _users
                                  .map(
                                    (u) => DropdownMenuItem<int>(
                                      value: (u['id'] as num?)?.toInt() ?? 0,
                                      child: Text(
                                        (u['name']?.toString().trim().isNotEmpty == true)
                                            ? u['name'].toString()
                                            : (u['email']?.toString() ?? 'Usuário'),
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) {
                                setState(() => _selectedUserId = v);
                                ref.read(agendaControllerProvider.notifier).setUserFilter(v);
                              },
                              decoration: const InputDecoration(
                                labelText: 'Usuário',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],
                  if (isDesktop)
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final twoCols = constraints.maxWidth >= 1180;
                        if (!twoCols) {
                          return Column(
                            children: [
                              buildDesktopCalendarCard(),
                              const SizedBox(height: 14),
                              buildDesktopEventsCard(),
                            ],
                          );
                        }
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 5, child: buildDesktopCalendarCard()),
                            const SizedBox(width: 14),
                            Expanded(flex: 6, child: buildDesktopEventsCard()),
                          ],
                        );
                      },
                    )
                  else ...[
                    Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(color: cs.outlineVariant.withOpacity(0.45)),
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
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            color: cs.primary.withOpacity(0.12),
                          ),
                          child: Text(
                            '${selectedEvents.length}',
                            style: TextStyle(
                              fontWeight: FontWeight.w900,
                              color: cs.primary,
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
                          style: TextStyle(color: cs.onSurfaceVariant),
                        ),
                      ),
                    if (!st.loading && st.items.isNotEmpty && selectedEvents.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(
                          'Sem eventos para esta data.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: cs.onSurfaceVariant),
                        ),
                      ),
                    ...selectedEvents.map(eventTile),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

const _agendaColorOptions = <Map<String, String>>[
  {'label': 'Azul', 'value': '#2563EB'},
  {'label': 'Verde', 'value': '#10B981'},
  {'label': 'Roxo', 'value': '#7C3AED'},
  {'label': 'Laranja', 'value': '#F97316'},
  {'label': 'Vermelho', 'value': '#EF4444'},
  {'label': 'Cinza', 'value': '#334155'},
];

const _agendaReminderOptions = <Map<String, dynamic>>[
  {'label': 'Sem lembrete', 'minutes': 0},
  {'label': '5 minutos antes', 'minutes': 5},
  {'label': '10 minutos antes', 'minutes': 10},
  {'label': '30 minutos antes', 'minutes': 30},
  {'label': '1 hora antes', 'minutes': 60},
  {'label': '1 dia antes', 'minutes': 24 * 60},
];

const _agendaRecurrenceOptions = <Map<String, String>>[
  {'label': 'Não repetir', 'value': 'none'},
  {'label': 'Diário', 'value': 'daily'},
  {'label': 'Semanal', 'value': 'weekly'},
  {'label': 'Mensal', 'value': 'monthly'},
];

class _CreateAgendaEventSheet extends ConsumerStatefulWidget {
  final DateTime initialDay;
  final AgendaController controller;
  const _CreateAgendaEventSheet(
      {required this.initialDay, required this.controller});

  @override
  ConsumerState<_CreateAgendaEventSheet> createState() =>
      _CreateAgendaEventSheetState();
}

class _CreateAgendaEventSheetState
    extends ConsumerState<_CreateAgendaEventSheet> {
  final _titleCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  bool _allDay = false;
  bool _saving = false;
  bool _canPickUser = false;
  bool _loadingUsers = false;
  List<Map<String, dynamic>> _users = const <Map<String, dynamic>>[];
  int? _selectedUserId;
  int _reminderMinutes = 0;
  bool _notifyInChat = true;
  bool _notifyOnCreate = true;
  String _recurrenceType = 'none';
  int _recurrenceInterval = 1;
  DateTime? _recurrenceUntil;
  String _color = '#2563EB';
  late DateTime _startAt;
  late DateTime _endAt;

  @override
  void initState() {
    super.initState();
    final base = DateTime(widget.initialDay.year, widget.initialDay.month,
        widget.initialDay.day, 9, 0);
    _startAt = base;
    _endAt = base.add(const Duration(hours: 1));
    _initUserScope();
  }

  Future<void> _initUserScope() async {
    final auth = ref.read(authControllerProvider).user;
    final profile = (auth?.profile ?? '').toLowerCase();
    final canPick = auth?.admin == true ||
        auth?.isSuper == true ||
        profile == 'admin' ||
        profile == 'super';

    _selectedUserId = auth?.id;
    _canPickUser = canPick;
    if (!canPick) {
      if (mounted) setState(() {});
      return;
    }

    if (mounted) setState(() => _loadingUsers = true);
    try {
      final remote = ref.read(agendaRemoteDataSourceProvider);
      final fetched = await remote.listUsers();
      if (!mounted) return;
      setState(() {
        _users = fetched;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _users = const <Map<String, dynamic>>[];
      });
    } finally {
      if (mounted) setState(() => _loadingUsers = false);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
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

  String _fmtDateTime(DateTime d) {
    return '${_fmtDate(d)} ${_fmtTime(d)}';
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
    final reminders = _reminderMinutes > 0
        ? <Map<String, dynamic>>[
            {
              'minutesBefore': _reminderMinutes,
              'notifyInChat': _notifyInChat,
            }
          ]
        : const <Map<String, dynamic>>[];
    final ok = await widget.controller.createEvent(
      title: _titleCtrl.text,
      description: _descriptionCtrl.text.trim().isEmpty
          ? null
          : _descriptionCtrl.text.trim(),
      startAt: _startAt,
      endAt: _allDay
          ? DateTime(_endAt.year, _endAt.month, _endAt.day, 23, 59)
          : _endAt,
      allDay: _allDay,
      location: _locationCtrl.text,
      color: _color,
      recurrenceType: _recurrenceType,
      recurrenceInterval: _recurrenceInterval,
      recurrenceUntil: _recurrenceType == 'none' ? null : _recurrenceUntil,
      reminders: reminders.isEmpty ? null : reminders,
      userId: _canPickUser ? _selectedUserId : null,
      notify: _notifyOnCreate,
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
    final hasSelectedUser = _selectedUserId != null &&
        _users.any((u) => (u['id'] as num?)?.toInt() == _selectedUserId);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottom),
      child: SingleChildScrollView(
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
            if (_canPickUser) ...[
              if (_loadingUsers) const LinearProgressIndicator(minHeight: 2),
              DropdownButtonFormField<int>(
                value: hasSelectedUser ? _selectedUserId : null,
                items: _users
                    .map(
                      (u) => DropdownMenuItem<int>(
                        value: (u['id'] as num?)?.toInt() ?? 0,
                        child: Text(
                          (u['name']?.toString().trim().isNotEmpty == true)
                              ? u['name'].toString()
                              : (u['email']?.toString() ?? 'Usuário'),
                        ),
                      ),
                    )
                    .toList(),
                onChanged:
                    _saving ? null : (v) => setState(() => _selectedUserId = v),
                decoration: const InputDecoration(
                  labelText: 'Usuário responsável',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
            ],
            TextField(
              controller: _titleCtrl,
              decoration: const InputDecoration(
                labelText: 'Título',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _descriptionCtrl,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Descrição',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _locationCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Local (opcional)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _color,
                    items: _agendaColorOptions
                        .map(
                          (c) => DropdownMenuItem<String>(
                            value: c['value'],
                            child: Row(
                              children: [
                                Container(
                                  width: 10,
                                  height: 10,
                                  decoration: BoxDecoration(
                                    color: Color(int.parse(
                                        c['value']!.replaceFirst('#', '0xff'))),
                                    borderRadius: BorderRadius.circular(99),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(c['label']!),
                              ],
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: _saving
                        ? null
                        : (v) => setState(() => _color = v ?? '#2563EB'),
                    decoration: const InputDecoration(
                      labelText: 'Cor',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text('Recorrência',
                style: Theme.of(context)
                    .textTheme
                    .labelLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _recurrenceType,
                    items: _agendaRecurrenceOptions
                        .map(
                          (r) => DropdownMenuItem<String>(
                            value: r['value'],
                            child: Text(r['label']!),
                          ),
                        )
                        .toList(),
                    onChanged: _saving
                        ? null
                        : (v) => setState(() => _recurrenceType = v ?? 'none'),
                    decoration: const InputDecoration(
                      labelText: 'Repetir',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    key: ValueKey('recurrence-interval-$_recurrenceType'),
                    enabled: _recurrenceType != 'none' && !_saving,
                    keyboardType: TextInputType.number,
                    initialValue: _recurrenceInterval.toString(),
                    onChanged: (v) {
                      final n = int.tryParse(v) ?? 1;
                      setState(() => _recurrenceInterval = n < 1 ? 1 : n);
                    },
                    decoration: const InputDecoration(
                      labelText: 'Intervalo',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: (_saving || _recurrenceType == 'none')
                  ? null
                  : () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _recurrenceUntil ?? _startAt,
                        firstDate: _startAt,
                        lastDate: DateTime(2035),
                      );
                      if (picked == null) return;
                      setState(() {
                        _recurrenceUntil = DateTime(
                            picked.year, picked.month, picked.day, 23, 59);
                      });
                    },
              icon: const Icon(Icons.repeat),
              label: Text(
                _recurrenceType == 'none'
                    ? 'Sem repetição'
                    : (_recurrenceUntil == null
                        ? 'Repetir até (opcional)'
                        : 'Até ${_fmtDate(_recurrenceUntil!)}'),
              ),
            ),
            const SizedBox(height: 12),
            Text('Lembrete',
                style: Theme.of(context)
                    .textTheme
                    .labelLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            DropdownButtonFormField<int>(
              value: _reminderMinutes,
              items: _agendaReminderOptions
                  .map(
                    (r) => DropdownMenuItem<int>(
                      value: r['minutes'] as int,
                      child: Text(r['label'] as String),
                    ),
                  )
                  .toList(),
              onChanged: _saving
                  ? null
                  : (v) => setState(() => _reminderMinutes = v ?? 0),
              decoration: const InputDecoration(
                labelText: 'Avisar',
                border: OutlineInputBorder(),
              ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _notifyInChat,
              onChanged: (_saving || _reminderMinutes <= 0)
                  ? null
                  : (v) => setState(() => _notifyInChat = v),
              title: const Text('Notificar no Chat'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _notifyOnCreate,
              onChanged:
                  _saving ? null : (v) => setState(() => _notifyOnCreate = v),
              title: const Text('Notificar responsável ao criar'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _allDay,
              onChanged: (v) => setState(() => _allDay = v),
              title: const Text('Dia inteiro'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => _pickDate(start: true),
              icon: const Icon(Icons.calendar_today_outlined),
              label: Text('Início ${_fmtDate(_startAt)}'),
            ),
            if (!_allDay) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => _pickTime(start: true),
                icon: const Icon(Icons.schedule_outlined),
                label: Text(_fmtDateTime(_startAt)),
              ),
            ],
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => _pickDate(start: false),
              icon: const Icon(Icons.event_available_outlined),
              label: Text('Fim ${_fmtDate(_endAt)}'),
            ),
            if (!_allDay) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => _pickTime(start: false),
                icon: const Icon(Icons.schedule_outlined),
                label: Text(_fmtDateTime(_endAt)),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _saving ? null : _submit,
              icon: const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Salvando...' : 'Criar evento'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed:
                  _saving ? null : () => Navigator.of(context).pop(false),
              child: const Text('Cancelar'),
            ),
          ],
        ),
      ),
    );
  }
}
