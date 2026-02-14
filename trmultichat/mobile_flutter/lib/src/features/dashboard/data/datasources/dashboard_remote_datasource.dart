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

  Future<int> getClosedTodayCountFromTickets() async {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day);
    final end = start.add(const Duration(days: 1));

    var page = 1;
    var total = 0;
    const maxPages = 40;
    var shouldStop = false;

    while (!shouldStop && page <= maxPages) {
      final res = await _dio.get(
        '/tickets',
        queryParameters: {
          'status': 'closed',
          'pageNumber': page,
        },
      );
      final data = res.data;
      if (data is! List || data.isEmpty) break;

      for (final raw in data) {
        if (raw is! Map) continue;
        final row = raw.cast<String, dynamic>();
        final updatedRaw = row['updatedAt']?.toString() ?? '';
        final dt = DateTime.tryParse(updatedRaw);
        if (dt == null) continue;
        final local = dt.isUtc ? dt.toLocal() : dt;
        if (local.isBefore(start)) {
          // API is sorted by updatedAt DESC. Once we pass start of day,
          // next pages will also be older.
          shouldStop = true;
          continue;
        }
        if (!local.isBefore(start) && local.isBefore(end)) {
          total++;
        }
      }

      if (data.length < 50) break;
      page++;
    }

    return total;
  }
}

