import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/contacts_remote_datasource.dart';
import '../state/contacts_state.dart';

class ContactsController extends StateNotifier<ContactsState> {
  final ContactsRemoteDataSource _remote;
  ContactsController(this._remote) : super(ContactsState.initial()) {
    refresh();
  }

  void setSearch(String v) {
    state = state.copyWith(search: v);
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null, page: 1);
    try {
      final (contacts, hasMore) = await _remote.list(pageNumber: 1, searchParam: state.search);
      state = state.copyWith(loading: false, items: contacts, hasMore: hasMore, page: 1);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao carregar contatos');
    }
  }

  Future<void> loadMore() async {
    if (state.loading || !state.hasMore) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final nextPage = state.page + 1;
      final (contacts, hasMore) = await _remote.list(pageNumber: nextPage, searchParam: state.search);
      state = state.copyWith(
        loading: false,
        items: [...state.items, ...contacts],
        hasMore: hasMore,
        page: nextPage,
      );
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao carregar mais contatos');
    }
  }
}

