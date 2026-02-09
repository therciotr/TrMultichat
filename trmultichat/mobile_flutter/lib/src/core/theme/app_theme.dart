import 'package:flutter/material.dart';

import 'branding.dart';

class AppTheme {
  static Color _hex(String v) {
    final s = v.replaceAll('#', '').trim();
    if (s.length == 6) return Color(int.parse('FF$s', radix: 16));
    if (s.length == 8) return Color(int.parse(s, radix: 16));
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

