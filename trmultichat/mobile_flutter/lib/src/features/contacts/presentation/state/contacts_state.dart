import '../../domain/entities/contact.dart';

class ContactsState {
  final bool loading;
  final String search;
  final List<Contact> items;
  final bool hasMore;
  final int page;
  final String? error;

  const ContactsState({
    required this.loading,
    required this.search,
    required this.items,
    required this.hasMore,
    required this.page,
    required this.error,
  });

  factory ContactsState.initial() => const ContactsState(
        loading: false,
        search: '',
        items: [],
        hasMore: true,
        page: 1,
        error: null,
      );

  ContactsState copyWith({
    bool? loading,
    String? search,
    List<Contact>? items,
    bool? hasMore,
    int? page,
    String? error,
  }) {
    return ContactsState(
      loading: loading ?? this.loading,
      search: search ?? this.search,
      items: items ?? this.items,
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      error: error,
    );
  }
}

