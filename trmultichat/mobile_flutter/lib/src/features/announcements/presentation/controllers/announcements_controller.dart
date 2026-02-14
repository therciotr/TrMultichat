import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/storage/secure_store.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/announcements_remote_datasource.dart';
import '../state/announcements_state.dart';

class AnnouncementsController extends StateNotifier<AnnouncementsState> {
  final Ref _ref;
  final AnnouncementsRemoteDataSource _remote;
  final SecureStore _store;

  AnnouncementsController(this._ref, this._remote, this._store) : super(AnnouncementsState.initial()) {
    _loadReadIds();
    refresh();
  }

  String _key() {
    final auth = _ref.read(authControllerProvider);
    final cid = auth.user?.companyId ?? 0;
    final uid = auth.user?.id ?? 0;
    return 'ann-read:$cid:$uid';
  }

  Future<void> _loadReadIds() async {
    try {
      final raw = await _store.readString(_key());
      if (raw == null || raw.trim().isEmpty) return;
      final list = (jsonDecode(raw) as List).cast<dynamic>();
      final ids = list.map((e) => int.tryParse(e.toString()) ?? 0).where((i) => i > 0).toSet();
      state = state.copyWith(readIds: ids);
    } catch (_) {}
  }

  Future<void> _persistReadIds(Set<int> ids) async {
    try {
      await _store.writeString(_key(), jsonEncode(ids.toList()));
    } catch (_) {}
  }

  void setSearch(String v) {
    state = state.copyWith(search: v);
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final (items, _) = await _remote.list(pageNumber: 1, searchParam: state.search);
      state = state.copyWith(loading: false, items: items, error: null);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao carregar comunicados');
    }
  }

  Future<bool> create({
    required String title,
    required String text,
    int priority = 3,
    bool sendToAll = true,
    bool allowReply = true,
  }) async {
    final t = title.trim();
    final body = text.trim();
    if (t.isEmpty || body.isEmpty) {
      state = state.copyWith(error: 'Informe título e mensagem');
      return false;
    }
    state = state.copyWith(loading: true, error: null);
    try {
      await _remote.create(
        title: t,
        text: body,
        priority: priority,
        sendToAll: sendToAll,
        allowReply: allowReply,
      );
      final (items, _) = await _remote.list(pageNumber: 1, searchParam: state.search);
      state = state.copyWith(loading: false, items: items, error: null);
      return true;
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Falha ao criar chat interno');
      return false;
    }
  }

  Future<void> markRead(int id) async {
    if (id <= 0) return;
    if (state.readIds.contains(id)) return;
    final next = {...state.readIds, id};
    state = state.copyWith(readIds: next);
    await _persistReadIds(next);
  }
}

