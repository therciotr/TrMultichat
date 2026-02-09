import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'branding.dart';
import 'theme_state.dart';

class ThemeController extends StateNotifier<ThemeState> {
  ThemeController() : super(ThemeState.initial());

  void setBranding(Branding branding) {
    state = state.copyWith(branding: branding);
  }

  void setMode(ThemeMode mode) {
    state = state.copyWith(mode: mode);
  }
}

final appThemeProvider = StateNotifierProvider<ThemeController, ThemeState>((ref) {
  return ThemeController();
});

