import '../../domain/entities/agenda_event.dart';

class AgendaState {
  final bool loading;
  final List<AgendaEvent> items;
  final String? error;

  const AgendaState({required this.loading, required this.items, required this.error});

  factory AgendaState.initial() => const AgendaState(loading: false, items: [], error: null);

  AgendaState copyWith({bool? loading, List<AgendaEvent>? items, String? error}) {
    return AgendaState(loading: loading ?? this.loading, items: items ?? this.items, error: error);
  }
}

