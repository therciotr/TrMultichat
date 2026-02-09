import 'package:flutter/material.dart';

class ColorUtils {
  static Color? fromHex(String? hex) {
    final raw = (hex ?? '').trim();
    if (raw.isEmpty) return null;
    var h = raw.replaceAll('#', '');
    if (h.length == 3) {
      // RGB -> RRGGBB
      h = '${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}';
    }
    if (h.length == 6) {
      return Color(int.parse('FF$h', radix: 16));
    }
    if (h.length == 8) {
      return Color(int.parse(h, radix: 16));
    }
    return null;
  }
}

