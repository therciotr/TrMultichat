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
    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      secondary: secondary,
      brightness: Brightness.light,
    );
    return ThemeData(
      brightness: Brightness.light,
      colorScheme: scheme,
      useMaterial3: true,
      textTheme: Typography.blackCupertino.apply(bodyColor: text, displayColor: text),
      appBarTheme: AppBarTheme(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      scaffoldBackgroundColor: const Color(0xFFF5F7FA),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: scheme.outlineVariant.withOpacity(0.45)),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: Colors.transparent,
        selectedIconTheme: IconThemeData(color: scheme.primary),
        selectedLabelTextStyle: TextStyle(
          color: scheme.primary,
          fontWeight: FontWeight.w800,
        ),
        indicatorColor: scheme.primary.withOpacity(0.14),
      ),
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: scheme.primary.withOpacity(0.14),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return TextStyle(color: scheme.primary, fontWeight: FontWeight.w800);
          }
          return TextStyle(color: scheme.onSurfaceVariant);
        }),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
      ),
    );
  }

  static ThemeData dark(Branding branding) {
    final primary = _hex(branding.primaryColor);
    final secondary = _hex(branding.secondaryColor);
    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      secondary: secondary,
      brightness: Brightness.dark,
    );
    return ThemeData(
      brightness: Brightness.dark,
      colorScheme: scheme,
      useMaterial3: true,
      appBarTheme: AppBarTheme(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      scaffoldBackgroundColor: const Color(0xFF0E1116),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: scheme.outlineVariant.withOpacity(0.45)),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: Colors.transparent,
        selectedIconTheme: IconThemeData(color: scheme.primary),
        selectedLabelTextStyle: TextStyle(
          color: scheme.primary,
          fontWeight: FontWeight.w800,
        ),
        indicatorColor: scheme.primary.withOpacity(0.2),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
      ),
    );
  }
}

