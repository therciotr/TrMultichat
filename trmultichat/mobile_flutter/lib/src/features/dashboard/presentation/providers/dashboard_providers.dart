import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../data/datasources/dashboard_remote_datasource.dart';
import '../../domain/entities/dashboard_counters.dart';

final dashboardRemoteDataSourceProvider = Provider<DashboardRemoteDataSource>((ref) {
  return DashboardRemoteDataSource(ref.watch(dioProvider));
});

final dashboardCountersProvider = FutureProvider<DashboardCounters>((ref) async {
  return ref.watch(dashboardRemoteDataSourceProvider).getCounters();
});

final dashboardCountersTodayProvider = FutureProvider<DashboardCounters>((ref) async {
  final ds = ref.watch(dashboardRemoteDataSourceProvider);
  final closedToday = await ds.getClosedTodayCountFromTickets();
  return DashboardCounters(
    pending: 0,
    open: 0,
    closed: closedToday,
    avgSupportMinutes: 0,
    avgWaitMinutes: 0,
  );
});

