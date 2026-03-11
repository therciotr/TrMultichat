class Branding {
  final String appTitle;
  final String primaryColor;
  final String secondaryColor;
  final String headingColor;
  final String buttonColor;
  final String textColor;
  final String backgroundColor;
  final String? appLogoUrl;
  final String? logoUrl;
  final String? fontFamily;

  const Branding({
    required this.appTitle,
    required this.primaryColor,
    required this.secondaryColor,
    required this.headingColor,
    required this.buttonColor,
    required this.textColor,
    required this.backgroundColor,
    this.appLogoUrl,
    this.logoUrl,
    this.fontFamily,
  });

  factory Branding.fallback() => const Branding(
        appTitle: 'TR Multichat',
        primaryColor: '#2BA9A5',
        secondaryColor: '#2563EB',
        headingColor: '#0B4C46',
        buttonColor: '#2BA9A5',
        textColor: '#111827',
        backgroundColor: '#F5F7FA',
        appLogoUrl: null,
        logoUrl: null,
        fontFamily: null,
      );

  factory Branding.fromJson(Map<String, dynamic> json) {
    String s(String k, String fb) => (json[k] as String?)?.trim().isNotEmpty == true ? (json[k] as String).trim() : fb;
    return Branding(
      appTitle: s('appTitle', Branding.fallback().appTitle),
      primaryColor: s('primaryColor', Branding.fallback().primaryColor),
      secondaryColor: s('secondaryColor', Branding.fallback().secondaryColor),
      headingColor: s('headingColor', Branding.fallback().headingColor),
      buttonColor: s('buttonColor', Branding.fallback().buttonColor),
      textColor: s('textColor', Branding.fallback().textColor),
      backgroundColor: s('backgroundColor', Branding.fallback().backgroundColor),
      appLogoUrl: (json['appLogoUrl'] as String?)?.trim(),
      logoUrl: (json['logoUrl'] as String?)?.trim(),
      fontFamily: (json['fontFamily'] as String?)?.trim(),
    );
  }

  Map<String, dynamic> toJson() => {
        'appTitle': appTitle,
        'primaryColor': primaryColor,
        'secondaryColor': secondaryColor,
        'headingColor': headingColor,
        'buttonColor': buttonColor,
        'textColor': textColor,
        'backgroundColor': backgroundColor,
        'appLogoUrl': appLogoUrl,
        'logoUrl': logoUrl,
        'fontFamily': fontFamily,
      };
}

