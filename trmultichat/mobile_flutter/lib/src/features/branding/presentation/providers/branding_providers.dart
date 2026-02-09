import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../data/datasources/branding_remote_datasource.dart';
import '../controllers/branding_controller.dart';
import '../state/branding_state.dart';

final brandingRemoteDataSourceProvider = Provider<BrandingRemoteDataSource>((ref) {
  return BrandingRemoteDataSource(ref.watch(dioProvider));
});

final brandingControllerProvider = StateNotifierProvider<BrandingController, BrandingState>((ref) {
  return BrandingController(ref.watch(brandingRemoteDataSourceProvider), ref.watch(secureStoreProvider));
});

