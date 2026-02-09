import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../data/datasources/dashboard_remote_datasource.dart';
import '../../domain/entities/dashboard_counters.dart';

final dashboardRemoteDataSourceProvider = Provider<DashboardRemoteDataSource>((ref) {
  return DashboardRemoteDataSource(ref.watch(dioProvider));
});

String _todayDateOnly() {
  final now = DateTime.now();
  final y = now.year.toString().padLeft(4, '0');
  final m = now.month.toString().padLeft(2, '0');
  final d = now.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

final dashboardCountersProvider = FutureProvider<DashboardCounters>((ref) async {
  return ref.watch(dashboardRemoteDataSourceProvider).getCounters();
});

/// For "Fechados hoje": backend counters are filtered by ticket createdAt range.
final dashboardCountersTodayProvider = FutureProvider<DashboardCounters>((ref) async {
  final today = _todayDateOnly();
  return ref.watch(dashboardRemoteDataSourceProvider).getCounters(dateFrom: today, dateTo: today);
});

