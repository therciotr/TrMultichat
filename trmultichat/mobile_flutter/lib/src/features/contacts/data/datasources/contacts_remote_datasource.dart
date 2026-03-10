import 'package:dio/dio.dart';

import '../../domain/entities/contact.dart';
import '../dto/contact_dto.dart';

class ContactsRemoteDataSource {
  final Dio _dio;
  ContactsRemoteDataSource(this._dio);

  List<dynamic> _extractContactList(dynamic data) {
    if (data is List) return data.cast<dynamic>();
    if (data is Map) {
      final map = data.cast<dynamic, dynamic>();
      final direct = map['contacts'];
      if (direct is List) return direct.cast<dynamic>();
      final nestedData = map['data'];
      if (nestedData is List) return nestedData.cast<dynamic>();
      if (nestedData is Map) {
        final nestedContacts = nestedData.cast<dynamic, dynamic>()['contacts'];
        if (nestedContacts is List) return nestedContacts.cast<dynamic>();
      }
    }
    return const <dynamic>[];
  }

  bool _extractHasMore(dynamic data, int parsedLen) {
    if (data is Map) {
      final map = data.cast<dynamic, dynamic>();
      if (map['hasMore'] is bool) return map['hasMore'] == true;
      final pagination = map['pagination'];
      if (pagination is Map && pagination['hasMore'] is bool) {
        return pagination['hasMore'] == true;
      }
    }
    return parsedLen >= 50;
  }

  Future<(List<Contact> contacts, bool hasMore)> list(
      {int pageNumber = 1, String searchParam = ''}) async {
    final res = await _dio.get(
      '/contacts',
      queryParameters: {
        'pageNumber': pageNumber,
        if (searchParam.trim().isNotEmpty) 'searchParam': searchParam.trim(),
      },
    );
    final list = _extractContactList(res.data);
    final contacts = list
        .whereType<Map>()
        .map((e) => ContactDto.fromJson(e.cast<String, dynamic>()))
        .toList();
    final hasMore = _extractHasMore(res.data, contacts.length);
    return (contacts, hasMore);
  }

  Future<Contact> getById(int id) async {
    final res = await _dio.get('/contacts/$id');
    return ContactDto.fromJson((res.data as Map).cast<String, dynamic>());
  }

  Future<void> delete(int id) async {
    await _dio.delete('/contacts/$id');
  }

  Future<int> deleteAll() async {
    final res = await _dio.delete('/contacts');
    final data = res.data;
    if (data is Map) {
      return (data['deleted'] as num?)?.toInt() ?? 0;
    }
    return 0;
  }

  Future<int> bulkDelete(List<int> ids) async {
    final clean = ids.where((e) => e > 0).toSet().toList();
    if (clean.isEmpty) return 0;
    final res = await _dio.post('/contacts/bulk-delete', data: {'ids': clean});
    final data = res.data;
    if (data is Map) {
      return (data['deleted'] as num?)?.toInt() ?? clean.length;
    }
    return clean.length;
  }
}
