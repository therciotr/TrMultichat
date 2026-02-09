import '../../domain/entities/ticket.dart';

class TicketsState {
  final bool loading;
  final String status; // pending | open | closed
  final String search;
  final List<Ticket> items;
  final String? error;

  const TicketsState({
    required this.loading,
    required this.status,
    required this.search,
    required this.items,
    required this.error,
  });

  factory TicketsState.initial() => const TicketsState(
        loading: false,
        status: 'open',
        search: '',
        items: [],
        error: null,
      );

  TicketsState copyWith({
    bool? loading,
    String? status,
    String? search,
    List<Ticket>? items,
    String? error,
  }) {
    return TicketsState(
      loading: loading ?? this.loading,
      status: status ?? this.status,
      search: search ?? this.search,
      items: items ?? this.items,
      error: error,
    );
  }
}

