import 'package:flutter/material.dart';

import 'branding.dart';

class AppTheme {
  static Color _hex(String v) {
    final raw = v.trim();
    var s = raw.replaceAll('#', '').trim();
    if (s.length == 3) {
      // RGB -> RRGGBB
      s = '${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}';
    } else if (s.length == 4) {
      // ARGB -> AARRGGBB
      s = '${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}';
    }
    try {
      if (s.length == 6) return Color(int.parse('FF$s', radix: 16));
      if (s.length == 8) return Color(int.parse(s, radix: 16));
    } catch (_) {
      // fallthrough to default
    }
    return const Color(0xFF2BA9A5);
  }

  static ThemeData light(Branding branding) {
    final primary = _hex(branding.primaryColor);
    final secondary = _hex(branding.secondaryColor);
    final text = _hex(branding.textColor);
    return ThemeData(
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(seedColor: primary, primary: primary, secondary: secondary, brightness: Brightness.light),
      useMaterial3: true,
      textTheme: Typography.blackCupertino.apply(bodyColor: text, displayColor: text),
      appBarTheme: AppBarTheme(backgroundColor: primary, foregroundColor: Colors.white),
    );
  }

  static ThemeData dark(Branding branding) {
    final primary = _hex(branding.primaryColor);
    final secondary = _hex(branding.secondaryColor);
    return ThemeData(
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(seedColor: primary, primary: primary, secondary: secondary, brightness: Brightness.dark),
      useMaterial3: true,
      appBarTheme: AppBarTheme(backgroundColor: primary, foregroundColor: Colors.white),
    );
  }
}

