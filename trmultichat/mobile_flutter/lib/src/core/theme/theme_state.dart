import 'package:flutter/material.dart';

import 'branding.dart';

class ThemeState {
  final ThemeMode mode;
  final Branding branding;

  const ThemeState({required this.mode, required this.branding});

  factory ThemeState.initial() => ThemeState(mode: ThemeMode.system, branding: Branding.fallback());

  ThemeState copyWith({ThemeMode? mode, Branding? branding}) {
    return ThemeState(mode: mode ?? this.mode, branding: branding ?? this.branding);
  }
}

