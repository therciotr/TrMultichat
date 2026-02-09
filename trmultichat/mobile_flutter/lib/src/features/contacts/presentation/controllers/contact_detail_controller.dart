import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/contacts_remote_datasource.dart';
import '../state/contact_detail_state.dart';

class ContactDetailController extends StateNotifier<ContactDetailState> {
  final ContactsRemoteDataSource _remote;
  final int id;
  ContactDetailController(this._remote, this.id) : super(ContactDetailState.initial()) {
    refresh();
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final c = await _remote.getById(id);
      state = state.copyWith(loading: false, contact: c, error: null);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao carregar contato');
    }
  }
}

