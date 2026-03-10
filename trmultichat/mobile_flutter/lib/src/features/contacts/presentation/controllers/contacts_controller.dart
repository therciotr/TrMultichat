import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/contacts_remote_datasource.dart';
import '../state/contacts_state.dart';

class ContactsController extends StateNotifier<ContactsState> {
  final ContactsRemoteDataSource _remote;
  Timer? _searchDebounce;
  ContactsController(this._remote) : super(ContactsState.initial()) {
    refresh();
  }

  void setSearch(String v) {
    state = state.copyWith(search: v);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      refresh();
    });
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null, page: 1);
    try {
      final (contacts, hasMore) =
          await _remote.list(pageNumber: 1, searchParam: state.search);
      state = state.copyWith(
          loading: false, items: contacts, hasMore: hasMore, page: 1);
    } catch (_) {
      state =
          state.copyWith(loading: false, error: 'Falha ao carregar contatos');
    }
  }

  Future<void> loadMore() async {
    if (state.loading || !state.hasMore) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final nextPage = state.page + 1;
      final (contacts, hasMore) =
          await _remote.list(pageNumber: nextPage, searchParam: state.search);
      state = state.copyWith(
        loading: false,
        items: [...state.items, ...contacts],
        hasMore: hasMore,
        page: nextPage,
      );
    } catch (_) {
      state = state.copyWith(
          loading: false, error: 'Falha ao carregar mais contatos');
    }
  }

  Future<bool> deleteOne(int id) async {
    if (id <= 0) return false;
    try {
      await _remote.delete(id);
      final next = state.items.where((c) => c.id != id).toList();
      state = state.copyWith(items: next, error: null);
      return true;
    } catch (_) {
      state = state.copyWith(error: 'Falha ao excluir contato');
      return false;
    }
  }

  Future<int> deleteMany(List<int> ids) async {
    try {
      final deleted = await _remote.bulkDelete(ids);
      await refresh();
      return deleted;
    } catch (_) {
      state = state.copyWith(error: 'Falha ao excluir contatos');
      return 0;
    }
  }

  Future<int> deleteAll() async {
    try {
      final deleted = await _remote.deleteAll();
      await refresh();
      return deleted;
    } catch (_) {
      state = state.copyWith(error: 'Falha ao excluir todos os contatos');
      return 0;
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }
}
