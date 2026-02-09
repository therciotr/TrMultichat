import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/socket/socket_providers.dart';
import '../../data/datasources/chat_remote_datasource.dart';
import '../../data/repositories/chat_repository_impl.dart';
import '../../domain/repositories/chat_repository.dart';
import '../controllers/chat_controller.dart';
import '../state/chat_state.dart';

final chatRemoteDataSourceProvider = Provider<ChatRemoteDataSource>((ref) {
  return ChatRemoteDataSource(ref.watch(dioProvider));
});

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  return ChatRepositoryImpl(ref.watch(chatRemoteDataSourceProvider));
});

final chatControllerProvider = StateNotifierProvider.family<ChatController, ChatState, int>((ref, ticketId) {
  // bootstrap socket (lazy connect)
  ref.watch(socketBootstrapProvider);
  return ChatController(ref, ref.watch(chatRepositoryProvider), ref.watch(socketClientProvider), ticketId: ticketId);
});

