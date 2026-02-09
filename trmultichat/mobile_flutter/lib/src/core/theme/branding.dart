class Branding {
  final String primaryColor;
  final String secondaryColor;
  final String headingColor;
  final String buttonColor;
  final String textColor;
  final String? logoUrl;
  final String? fontFamily;

  const Branding({
    required this.primaryColor,
    required this.secondaryColor,
    required this.headingColor,
    required this.buttonColor,
    required this.textColor,
    this.logoUrl,
    this.fontFamily,
  });

  factory Branding.fallback() => const Branding(
        primaryColor: '#2BA9A5',
        secondaryColor: '#2563EB',
        headingColor: '#0B4C46',
        buttonColor: '#2BA9A5',
        textColor: '#111827',
        logoUrl: null,
        fontFamily: null,
      );

  factory Branding.fromJson(Map<String, dynamic> json) {
    String s(String k, String fb) => (json[k] as String?)?.trim().isNotEmpty == true ? (json[k] as String).trim() : fb;
    return Branding(
      primaryColor: s('primaryColor', Branding.fallback().primaryColor),
      secondaryColor: s('secondaryColor', Branding.fallback().secondaryColor),
      headingColor: s('headingColor', Branding.fallback().headingColor),
      buttonColor: s('buttonColor', Branding.fallback().buttonColor),
      textColor: s('textColor', Branding.fallback().textColor),
      logoUrl: (json['logoUrl'] as String?)?.trim(),
      fontFamily: (json['fontFamily'] as String?)?.trim(),
    );
  }

  Map<String, dynamic> toJson() => {
        'primaryColor': primaryColor,
        'secondaryColor': secondaryColor,
        'headingColor': headingColor,
        'buttonColor': buttonColor,
        'textColor': textColor,
        'logoUrl': logoUrl,
        'fontFamily': fontFamily,
      };
}

