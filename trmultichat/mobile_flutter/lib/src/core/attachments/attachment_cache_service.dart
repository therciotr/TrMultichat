import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

class AttachmentCacheService {
  final Dio _dio;
  AttachmentCacheService(this._dio);

  Future<Directory> _baseDir() async {
    final dir = await getApplicationSupportDirectory();
    final base = Directory(p.join(dir.path, 'attachments-cache'));
    if (!base.existsSync()) base.createSync(recursive: true);
    return base;
  }

  String _extFromUrlOrMime(String url, String? mimeType) {
    final uri = Uri.tryParse(url);
    final path = uri?.path ?? url;
    final ext = p.extension(path).toLowerCase();
    if (ext.isNotEmpty && ext.length <= 8) return ext;
    final mt = (mimeType ?? '').toLowerCase();
    if (mt.contains('pdf')) return '.pdf';
    if (mt.startsWith('image/')) return '.jpg';
    return '';
  }

  Future<File?> getCachedFile(String url, {String? mimeType}) async {
    final base = await _baseDir();
    final key = sha1.convert(url.codeUnits).toString();
    final ext = _extFromUrlOrMime(url, mimeType);
    final f = File(p.join(base.path, '$key$ext'));
    if (await f.exists()) return f;
    return null;
  }

  Future<File> downloadToCache(
    String url, {
    String? mimeType,
    ProgressCallback? onReceiveProgress,
    CancelToken? cancelToken,
  }) async {
    final base = await _baseDir();
    final key = sha1.convert(url.codeUnits).toString();
    final ext = _extFromUrlOrMime(url, mimeType);
    final target = File(p.join(base.path, '$key$ext'));
    if (await target.exists()) return target;

    await _dio.download(
      url,
      target.path,
      cancelToken: cancelToken,
      onReceiveProgress: onReceiveProgress,
      options: Options(
        // keep Authorization header from Dio interceptors
        responseType: ResponseType.bytes,
        followRedirects: true,
        receiveTimeout: const Duration(seconds: 60),
      ),
    );
    return target;
  }
}

