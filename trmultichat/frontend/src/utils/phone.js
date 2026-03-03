const COUNTRY_CALLING_CODES = new Set([
  "1","7","20","27","30","31","32","33","34","36","39","40","41","43","44","45","46","47","48","49",
  "51","52","53","54","55","56","57","58","60","61","62","63","64","65","66","81","82","84","86",
  "90","91","92","93","94","95","98",
  "211","212","213","216","218","220","221","222","223","224","225","226","227","228","229","230",
  "231","232","233","234","235","236","237","238","239","240","241","242","243","244","245","246",
  "248","249","250","251","252","253","254","255","256","257","258","260","261","262","263","264",
  "265","266","267","268","269","290","291","297","298","299","350","351","352","353","354","355",
  "356","357","358","359","370","371","372","373","374","375","376","377","378","380","381","382",
  "383","385","386","387","389","420","421","423","500","501","502","503","504","505","506","507",
  "508","509","590","591","592","593","594","595","596","597","598","599","670","672","673","674",
  "675","676","677","678","679","680","681","682","683","685","686","687","688","689","690","691",
  "692","850","852","853","855","856","880","886","960","961","962","963","964","965","966","967",
  "968","970","971","972","973","974","975","976","977","992","993","994","995","996","998",
]);

const COUNTRY_NATIONAL_MAX = {
  "1": 10,
  "33": 9,
  "34": 9,
  "39": 10,
  "44": 10,
  "49": 11,
  "51": 9,
  "52": 10,
  "54": 10,
  "55": 11,
  "56": 9,
  "57": 10,
  "58": 10,
  "351": 9,
};

const COUNTRY_GROUPS = {
  "1": [3, 3, 4],
  "33": [1, 2, 2, 2, 2],
  "34": [3, 3, 3],
  "39": [3, 3, 4],
  "44": [4, 3, 3],
  "49": [3, 3, 5],
  "51": [3, 3, 3],
  "52": [3, 3, 4],
  "54": [3, 3, 4],
  "55": [2, 5, 4],
  "56": [1, 4, 4],
  "57": [3, 3, 4],
  "58": [3, 3, 4],
  "351": [3, 3, 3],
};

function detectCountryCode(digits) {
  const value = String(digits || "");
  for (let len = 3; len >= 1; len -= 1) {
    const cc = value.slice(0, len);
    if (COUNTRY_CALLING_CODES.has(cc)) return cc;
  }
  return value.slice(0, 2) || value.slice(0, 1) || "";
}

function trimNationalByCountry(cc, national) {
  const max = Number(COUNTRY_NATIONAL_MAX[cc] || 0);
  if (!max || national.length <= max) return national;
  return national.slice(0, max);
}

function groupByPattern(raw, groups) {
  const out = [];
  let idx = 0;
  for (const g of groups || []) {
    if (idx >= raw.length) break;
    out.push(raw.slice(idx, idx + g));
    idx += g;
  }
  if (idx < raw.length) out.push(raw.slice(idx));
  return out.join(" ");
}

function groupNationalNumber(raw, cc) {
  const value = String(raw || "");
  if (!value) return "";
  const pattern = COUNTRY_GROUPS[cc];
  if (Array.isArray(pattern) && pattern.length) {
    return groupByPattern(value, pattern);
  }
  if (value.length <= 4) return value;
  if (value.length <= 7) return `${value.slice(0, value.length - 4)} ${value.slice(-4)}`;
  if (value.length <= 9) return groupByPattern(value, [3, 3, 3]);
  if (value.length === 10) return groupByPattern(value, [3, 3, 4]);
  if (value.length === 11) return groupByPattern(value, [3, 4, 4]);

  const chunks = [];
  let rest = value;
  while (rest.length > 4) {
    chunks.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  if (rest) chunks.push(rest);
  return chunks.join(" ");
}

export function normalizePhoneBr(raw) {
  const rawStr = String(raw || "").trim();
  const explicitIntl = rawStr.startsWith("+") || rawStr.startsWith("00");
  const digits = rawStr.replace(/\D/g, "");
  if (!digits) return "";

  let value = digits;
  if (value.startsWith("00")) value = value.slice(2);

  // Keep BR country code by default for 10/11-digit local numbers.
  if (!explicitIntl && !value.startsWith("55") && (value.length === 10 || value.length === 11)) {
    value = `55${value}`;
  }

  // Keep canonical BR length when possible.
  if (value.startsWith("55") && value.length > 13) {
    value = `55${value.slice(-11)}`;
  }

  // For explicit non-BR country codes, trim to known national max if available.
  const cc = detectCountryCode(value);
  if (cc && cc !== "55") {
    const national = value.slice(cc.length);
    const trimmed = trimNationalByCountry(cc, national);
    value = `${cc}${trimmed}`;
  }

  return value;
}

export function formatPhoneBr(raw) {
  const normalized = normalizePhoneBr(raw);
  if (!normalized) return "";

  if (normalized.startsWith("55") && normalized.length >= 12) {
    const ddd = normalized.slice(2, 4);
    const localRaw = normalized.slice(4);
    const local = localRaw.length > 9 ? localRaw.slice(-9) : localRaw;

    if (local.length === 9) {
      return `+55 (${ddd})${local.slice(0, 1)} ${local.slice(1, 5)}-${local.slice(5)}`;
    }
    if (local.length === 8) {
      return `+55 (${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`;
    }
  }

  const cc = detectCountryCode(normalized);
  const national = trimNationalByCountry(cc, normalized.slice(cc.length));
  if (!cc || !national) return `+${normalized}`;
  return `+${cc} ${groupNationalNumber(national, cc)}`;
}

