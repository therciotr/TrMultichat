import 'dart:typed_data';

import 'package:share_plus/share_plus.dart';

class ShareService {
  const ShareService();

  Future<void> shareFiles({
    required List<({String name, String? mimeType, String? path, List<int>? bytes})> files,
    String? subject,
    String? text,
  }) async {
    if (files.isEmpty) return;
    final xfiles = <XFile>[];
    for (final f in files) {
      if (f.path != null && f.path!.trim().isNotEmpty) {
        xfiles.add(XFile(f.path!, name: f.name, mimeType: f.mimeType));
      } else if (f.bytes != null && f.bytes!.isNotEmpty) {
        xfiles.add(
          XFile.fromData(
            Uint8List.fromList(f.bytes!),
            name: f.name,
            mimeType: f.mimeType,
          ),
        );
      }
    }
    if (xfiles.isEmpty) return;
    await Share.shareXFiles(xfiles, subject: subject, text: text);
  }
}

