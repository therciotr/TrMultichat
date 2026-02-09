import 'package:dio/dio.dart';

import '../core/errors/app_exception.dart';
import '../core/network/api_endpoints.dart';

class HomeMetrics {
  final int pending;
  final int open;
  final int closed;
  const HomeMetrics({required this.pending, required this.open, required this.closed});
}

class HomeService {
  final Dio _dio;
  HomeService(this._dio);

  Future<HomeMetrics> getMetrics() async {
    try {
      final res = await _dio.get(ApiEndpoints.dashboard, queryParameters: {'scope': 'user'});
      final data = (res.data as Map).cast<String, dynamic>();

      // O dashboard retorna vários campos; aqui pegamos os mais úteis para MVP.
      int pick(String key) {
        final v = data[key];
        if (v is num) return v.toInt();
        if (v is Map && v['count'] is num) return (v['count'] as num).toInt();
        return 0;
      }

      return HomeMetrics(
        pending: pick('ticketsPending') + pick('pendingTickets') + pick('pending'),
        open: pick('ticketsOpen') + pick('openTickets') + pick('open'),
        closed: pick('ticketsClosed') + pick('closedTickets') + pick('closed'),
      );
    } catch (e) {
      if (e is DioException && e.error is AppException) throw e.error as AppException;
      throw AppException('Erro ao carregar métricas', raw: e);
    }
  }
}

