class Branding {
  final String? primaryColor;
  final String? secondaryColor;
  final String? headingColor;
  final String? buttonColor;
  final String? textColor;
  final String? logoUrl;
  final String? faviconUrl;
  final String? font;
  final String? sidebarVariant;

  const Branding({
    this.primaryColor,
    this.secondaryColor,
    this.headingColor,
    this.buttonColor,
    this.textColor,
    this.logoUrl,
    this.faviconUrl,
    this.font,
    this.sidebarVariant,
  });

  factory Branding.fromJson(Map<String, dynamic> json) {
    return Branding(
      primaryColor: json['primaryColor']?.toString(),
      secondaryColor: json['secondaryColor']?.toString(),
      headingColor: json['headingColor']?.toString(),
      buttonColor: json['buttonColor']?.toString(),
      textColor: json['textColor']?.toString(),
      logoUrl: json['logoUrl']?.toString(),
      faviconUrl: json['faviconUrl']?.toString(),
      font: json['font']?.toString() ?? json['fontFamily']?.toString(),
      sidebarVariant: json['sidebarVariant']?.toString(),
    );
  }
}

