import 'package:dio/dio.dart';

import '../core/errors/app_exception.dart';
import '../core/network/api_endpoints.dart';
import 'ticket_models.dart';

class TicketsService {
  final Dio _dio;
  TicketsService(this._dio);

  Future<List<Ticket>> listTickets({required String status, int pageNumber = 1, String? search}) async {
    try {
      final res = await _dio.get(
        ApiEndpoints.tickets,
        queryParameters: {
          'status': status,
          'pageNumber': pageNumber,
          if (search != null && search.trim().isNotEmpty) 'searchParam': search.trim(),
        },
      );
      final list = (res.data as List).cast<dynamic>();
      return list.map((e) => Ticket.fromJson((e as Map).cast<String, dynamic>())).toList();
    } catch (e) {
      if (e is DioException && e.error is AppException) throw e.error as AppException;
      throw AppException('Erro ao carregar tickets', raw: e);
    }
  }

  Future<void> updateTicket(int id, Map<String, dynamic> patch) async {
    try {
      await _dio.put(ApiEndpoints.ticketById(id), data: patch);
    } catch (e) {
      if (e is DioException && e.error is AppException) throw e.error as AppException;
      throw AppException('Erro ao atualizar ticket', raw: e);
    }
  }
}

