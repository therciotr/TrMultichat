import 'package:dio/dio.dart';

import '../../domain/entities/contact.dart';
import '../dto/contact_dto.dart';

class ContactsRemoteDataSource {
  final Dio _dio;
  ContactsRemoteDataSource(this._dio);

  Future<(List<Contact> contacts, bool hasMore)> list({int pageNumber = 1, String searchParam = ''}) async {
    final res = await _dio.get(
      '/contacts',
      queryParameters: {
        'pageNumber': pageNumber,
        if (searchParam.trim().isNotEmpty) 'searchParam': searchParam.trim(),
      },
    );
    final data = (res.data as Map).cast<String, dynamic>();
    final list = (data['contacts'] as List? ?? const []).cast<dynamic>();
    final contacts = list.map((e) => ContactDto.fromJson((e as Map).cast<String, dynamic>())).toList();
    final hasMore = data['hasMore'] == true;
    return (contacts, hasMore);
  }

  Future<Contact> getById(int id) async {
    final res = await _dio.get('/contacts/$id');
    return ContactDto.fromJson((res.data as Map).cast<String, dynamic>());
  }
}

