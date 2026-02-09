import 'package:dio/dio.dart';

import '../core/errors/app_exception.dart';
import '../core/network/api_endpoints.dart';
import 'message_models.dart';

class ChatService {
  final Dio _dio;
  ChatService(this._dio);

  Future<MessagesPage> getMessages({required int ticketId, int pageNumber = 1}) async {
    try {
      final res = await _dio.get(
        ApiEndpoints.messagesByTicket(ticketId),
        queryParameters: {'pageNumber': pageNumber},
      );
      final data = (res.data as Map).cast<String, dynamic>();
      final list = (data['messages'] as List).cast<dynamic>();
      final messages = list.map((e) => ChatMessage.fromJson((e as Map).cast<String, dynamic>())).toList();
      final hasMore = data['hasMore'] == true;
      return MessagesPage(messages: messages, hasMore: hasMore);
    } catch (e) {
      if (e is DioException && e.error is AppException) throw e.error as AppException;
      throw AppException('Erro ao carregar mensagens', raw: e);
    }
  }

  Future<void> sendText({required int ticketId, required String body}) async {
    try {
      await _dio.post(ApiEndpoints.messagesByTicket(ticketId), data: {'body': body});
    } catch (e) {
      if (e is DioException && e.error is AppException) throw e.error as AppException;
      throw AppException('Erro ao enviar mensagem', raw: e);
    }
  }
}

