import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../data/datasources/contacts_remote_datasource.dart';
import '../controllers/contacts_controller.dart';
import '../state/contacts_state.dart';

final contactsRemoteDataSourceProvider = Provider<ContactsRemoteDataSource>((ref) {
  return ContactsRemoteDataSource(ref.watch(dioProvider));
});

final contactsControllerProvider = StateNotifierProvider<ContactsController, ContactsState>((ref) {
  return ContactsController(ref.watch(contactsRemoteDataSourceProvider));
});

