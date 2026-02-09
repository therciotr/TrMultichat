import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../di/core_providers.dart';
import 'attachment_cache_service.dart';

final attachmentCacheProvider = Provider<AttachmentCacheService>((ref) {
  return AttachmentCacheService(ref.watch(dioProvider));
});

