String? guessMimeType(String fileName) {
  final n = fileName.trim().toLowerCase();
  final dot = n.lastIndexOf('.');
  if (dot < 0 || dot == n.length - 1) return null;
  final ext = n.substring(dot + 1);
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'mp3':
      return 'audio/mpeg';
    case 'aac':
      return 'audio/aac';
    case 'amr':
      return 'audio/amr';
    case 'opus':
      return 'audio/opus';
    case 'm4a':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    default:
      return null;
  }
}

