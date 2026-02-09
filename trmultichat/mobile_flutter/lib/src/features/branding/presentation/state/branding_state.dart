import '../../../../core/theme/branding.dart';

class BrandingState {
  final bool loading;
  final Branding branding;

  const BrandingState({required this.loading, required this.branding});

  factory BrandingState.initial() => BrandingState(loading: false, branding: Branding.fallback());

  BrandingState copyWith({bool? loading, Branding? branding}) {
    return BrandingState(
      loading: loading ?? this.loading,
      branding: branding ?? this.branding,
    );
  }
}

