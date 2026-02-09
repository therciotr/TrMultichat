import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/storage/secure_store.dart';
import '../../../../core/theme/branding.dart';
import '../../data/datasources/branding_remote_datasource.dart';
import '../state/branding_state.dart';

class BrandingController extends StateNotifier<BrandingState> {
  final BrandingRemoteDataSource _remote;
  final SecureStore _store;
  static const _kBrandingCache = 'brandingJson';

  BrandingController(this._remote, this._store) : super(BrandingState.initial()) {
    _loadCached();
  }

  Future<void> _loadCached() async {
    try {
      final raw = await _store.readString(_kBrandingCache);
      if (raw == null || raw.trim().isEmpty) return;
      final map = (jsonDecode(raw) as Map).cast<String, dynamic>();
      final b = Branding.fromJson(map);
      state = state.copyWith(branding: b);
    } catch (_) {
      // ignore cache errors
    }
  }

  Future<void> load({int? companyId}) async {
    state = state.copyWith(loading: true);
    try {
      final b = await _remote.getBranding(companyId: companyId);
      state = state.copyWith(loading: false, branding: b);
      try {
        await _store.writeString(_kBrandingCache, jsonEncode(b.toJson()));
      } catch (_) {}
    } catch (_) {
      state = state.copyWith(loading: false);
    }
  }
}

