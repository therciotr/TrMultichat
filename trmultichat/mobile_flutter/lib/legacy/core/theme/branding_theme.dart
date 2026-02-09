import 'package:flutter/material.dart';

import '../branding/branding_model.dart';
import '../utils/color_utils.dart';

class BrandingTheme {
  static ThemeData build({
    required Brightness brightness,
    Branding? branding,
  }) {
    final primary = ColorUtils.fromHex(branding?.primaryColor) ?? const Color(0xFF2BA9A5);
    final secondary = ColorUtils.fromHex(branding?.secondaryColor) ?? const Color(0xFF0B4C46);
    final heading = ColorUtils.fromHex(branding?.headingColor);
    final text = ColorUtils.fromHex(branding?.textColor);

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        brightness: brightness,
        primary: primary,
        secondary: secondary,
      ),
    );

    return base.copyWith(
      textTheme: base.textTheme.apply(
        bodyColor: text,
        displayColor: heading ?? text,
      ),
    );
  }
}

