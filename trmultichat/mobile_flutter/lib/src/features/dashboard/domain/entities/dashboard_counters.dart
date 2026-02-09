import 'package:equatable/equatable.dart';

class DashboardCounters extends Equatable {
  final int pending;
  final int open;
  final int closed;
  final int avgSupportMinutes;
  final int avgWaitMinutes;

  const DashboardCounters({
    required this.pending,
    required this.open,
    required this.closed,
    required this.avgSupportMinutes,
    required this.avgWaitMinutes,
  });

  @override
  List<Object?> get props => [pending, open, closed, avgSupportMinutes, avgWaitMinutes];
}

