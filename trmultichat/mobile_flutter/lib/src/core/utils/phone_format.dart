const Set<String> _countryCallingCodes = {
  '1','7','20','27','30','31','32','33','34','36','39','40','41','43','44','45','46','47','48','49',
  '51','52','53','54','55','56','57','58','60','61','62','63','64','65','66','81','82','84','86',
  '90','91','92','93','94','95','98',
  '211','212','213','216','218','220','221','222','223','224','225','226','227','228','229','230',
  '231','232','233','234','235','236','237','238','239','240','241','242','243','244','245','246',
  '248','249','250','251','252','253','254','255','256','257','258','260','261','262','263','264',
  '265','266','267','268','269','290','291','297','298','299','350','351','352','353','354','355',
  '356','357','358','359','370','371','372','373','374','375','376','377','378','380','381','382',
  '383','385','386','387','389','420','421','423','500','501','502','503','504','505','506','507',
  '508','509','590','591','592','593','594','595','596','597','598','599','670','672','673','674',
  '675','676','677','678','679','680','681','682','683','685','686','687','688','689','690','691',
  '692','850','852','853','855','856','880','886','960','961','962','963','964','965','966','967',
  '968','970','971','972','973','974','975','976','977','992','993','994','995','996','998',
};

String _detectCountryCode(String digits) {
  final value = digits;
  for (var len = 3; len >= 1; len--) {
    if (value.length < len) continue;
    final cc = value.substring(0, len);
    if (_countryCallingCodes.contains(cc)) return cc;
  }
  if (value.isEmpty) return '';
  if (value.length == 1) return value;
  return value.substring(0, 2);
}

String _groupNationalNumber(String raw) {
  final value = raw;
  if (value.isEmpty) return '';
  if (value.length <= 4) return value;
  if (value.length <= 7) {
    final split = value.length - 4;
    return '${value.substring(0, split)} ${value.substring(split)}';
  }
  if (value.length == 8) return '${value.substring(0, 4)}-${value.substring(4)}';
  if (value.length == 9) return '${value.substring(0, 5)}-${value.substring(5)}';
  if (value.length == 10) {
    return '${value.substring(0, 3)} ${value.substring(3, 6)}-${value.substring(6)}';
  }
  if (value.length == 11) {
    return '${value.substring(0, 3)} ${value.substring(3, 7)}-${value.substring(7)}';
  }

  final chunks = <String>[];
  var rest = value;
  while (rest.length > 4) {
    chunks.add(rest.substring(0, 3));
    rest = rest.substring(3);
  }
  if (rest.isNotEmpty) chunks.add(rest);
  return chunks.join(' ');
}

String formatPhoneBr(String? raw) {
  final digits = (raw ?? '').replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return '';
  var withCountry = digits;
  if (withCountry.startsWith('00')) withCountry = withCountry.substring(2);
  if (!withCountry.startsWith('55') &&
      (withCountry.length == 10 || withCountry.length == 11)) {
    withCountry = '55$withCountry';
  }
  if (withCountry.startsWith('55') && withCountry.length > 13) {
    withCountry = '55${withCountry.substring(withCountry.length - 11)}';
  }
  if (withCountry.length < 4) return '+$withCountry';

  if (withCountry.startsWith('55') && withCountry.length >= 12) {
    final ddd = withCountry.substring(2, 4);
    final local = withCountry.substring(4);
    if (local.length >= 9) {
      final n = local.substring(local.length - 9);
      return '+55 ($ddd)${n.substring(0, 1)} ${n.substring(1, 5)}-${n.substring(5)}';
    }
    if (local.length >= 8) {
      final n = local.substring(local.length - 8);
      return '+55 ($ddd) ${n.substring(0, 4)}-${n.substring(4)}';
    }
  }

  final cc = _detectCountryCode(withCountry);
  final national = withCountry.substring(cc.length);
  if (cc.isEmpty || national.isEmpty) return '+$withCountry';
  return '+$cc ${_groupNationalNumber(national)}';
}
