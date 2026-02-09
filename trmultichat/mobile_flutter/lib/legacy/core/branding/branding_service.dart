import 'package:dio/dio.dart';

import '../errors/app_exception.dart';
import '../network/api_endpoints.dart';
import 'branding_model.dart';

class BrandingService {
  final Dio _dio;
  BrandingService(this._dio);

  Future<Branding> getBranding({int? companyId}) async {
    try {
      final res = await _dio.get(
        ApiEndpoints.branding,
        queryParameters: companyId != null && companyId > 0 ? {'companyId': companyId} : null,
      );
      return Branding.fromJson((res.data as Map).cast<String, dynamic>());
    } catch (e) {
      if (e is DioException && e.error is AppException) throw e.error as AppException;
      throw AppException('Erro ao carregar identidade visual', raw: e);
    }
  }
}

