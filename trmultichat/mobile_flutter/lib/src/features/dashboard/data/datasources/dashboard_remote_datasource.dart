import 'package:dio/dio.dart';

import '../../domain/entities/dashboard_counters.dart';

class DashboardRemoteDataSource {
  final Dio _dio;
  DashboardRemoteDataSource(this._dio);

  Future<DashboardCounters> getCounters({String? dateFrom, String? dateTo}) async {
    final res = await _dio.get(
      '/dashboard',
      queryParameters: {
        if (dateFrom != null && dateFrom.trim().isNotEmpty) 'date_from': dateFrom.trim(),
        if (dateTo != null && dateTo.trim().isNotEmpty) 'date_to': dateTo.trim(),
      },
    );
    final data = (res.data as Map).cast<String, dynamic>();
    final counters = (data['counters'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    return DashboardCounters(
      pending: (counters['supportPending'] as num?)?.toInt() ?? 0,
      open: (counters['supportHappening'] as num?)?.toInt() ?? 0,
      closed: (counters['supportFinished'] as num?)?.toInt() ?? 0,
      avgSupportMinutes: (counters['avgSupportTime'] as num?)?.toInt() ?? 0,
      avgWaitMinutes: (counters['avgWaitTime'] as num?)?.toInt() ?? 0,
    );
  }
}

