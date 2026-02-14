String formatPhoneBr(String? raw) {
  final digits = (raw ?? '').replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return '';
  final withCountry = digits.startsWith('55') ? digits : '55$digits';
  if (withCountry.length < 4) return '+$withCountry';

  final ddd = withCountry.substring(2, 4);
  final local = withCountry.substring(4);
  if (local.length >= 9) {
    final n = local.substring(local.length - 9);
    return '+55 $ddd ${n.substring(0, 5)}-${n.substring(5)}';
  }
  if (local.length >= 8) {
    final n = local.substring(local.length - 8);
    return '+55 $ddd ${n.substring(0, 4)}-${n.substring(4)}';
  }
  return '+$withCountry';
}
