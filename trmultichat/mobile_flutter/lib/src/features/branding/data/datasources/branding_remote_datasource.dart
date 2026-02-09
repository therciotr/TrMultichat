import 'package:dio/dio.dart';

import '../../../../core/theme/branding.dart';

class BrandingRemoteDataSource {
  final Dio _dio;
  BrandingRemoteDataSource(this._dio);

  Future<Branding> getBranding({int? companyId}) async {
    final res = await _dio.get('/branding', queryParameters: companyId != null && companyId > 0 ? {'companyId': companyId} : null);
    return Branding.fromJson((res.data as Map).cast<String, dynamic>());
  }
}

