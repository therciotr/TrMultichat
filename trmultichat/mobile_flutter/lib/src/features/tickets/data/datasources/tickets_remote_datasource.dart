import 'package:dio/dio.dart';

import '../dto/ticket_dto.dart';
import '../../domain/entities/ticket.dart';

class TicketsRemoteDataSource {
  final Dio _dio;
  TicketsRemoteDataSource(this._dio);

  Future<List<Ticket>> list({
    required String status,
    int pageNumber = 1,
    String searchParam = '',
  }) async {
    final res = await _dio.get(
      '/tickets',
      queryParameters: {
        'status': status,
        'pageNumber': pageNumber,
        if (searchParam.trim().isNotEmpty) 'searchParam': searchParam.trim(),
      },
    );
    final data = res.data;
    if (data is List) {
      return data.map((e) => TicketDto.fromJson((e as Map).cast<String, dynamic>())).toList();
    }
    return [];
  }
}

