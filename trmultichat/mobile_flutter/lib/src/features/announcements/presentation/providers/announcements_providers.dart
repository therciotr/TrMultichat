import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../data/datasources/announcements_remote_datasource.dart';
import '../controllers/announcements_controller.dart';
import '../state/announcements_state.dart';

final announcementsRemoteDataSourceProvider = Provider<AnnouncementsRemoteDataSource>((ref) {
  return AnnouncementsRemoteDataSource(ref.watch(dioProvider));
});

final announcementsControllerProvider = StateNotifierProvider<AnnouncementsController, AnnouncementsState>((ref) {
  return AnnouncementsController(ref, ref.watch(announcementsRemoteDataSourceProvider), ref.watch(secureStoreProvider));
});

