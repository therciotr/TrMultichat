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

function detectCountryCode(digits) {
  const value = String(digits || "");
  for (let len = 3; len >= 1; len -= 1) {
    const cc = value.slice(0, len);
    if (COUNTRY_CALLING_CODES.has(cc)) return cc;
  }
  return value.slice(0, 2) || value.slice(0, 1) || "";
}

function groupNationalNumber(raw) {
  const value = String(raw || "");
  if (!value) return "";
  if (value.length <= 4) return value;
  if (value.length <= 7) return `${value.slice(0, value.length - 4)} ${value.slice(-4)}`;
  if (value.length === 8) return `${value.slice(0, 4)}-${value.slice(4)}`;
  if (value.length === 9) return `${value.slice(0, 5)}-${value.slice(5)}`;
  if (value.length === 10) return `${value.slice(0, 3)} ${value.slice(3, 6)}-${value.slice(6)}`;
  if (value.length === 11) return `${value.slice(0, 3)} ${value.slice(3, 7)}-${value.slice(7)}`;

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
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";

  let value = digits;
  if (value.startsWith("00")) value = value.slice(2);

  // Keep BR country code by default for 10/11-digit local numbers.
  if (!value.startsWith("55") && (value.length === 10 || value.length === 11)) {
    value = `55${value}`;
  }

  // Keep canonical BR length when possible.
  if (value.startsWith("55") && value.length > 13) {
    value = `55${value.slice(-11)}`;
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
  const national = normalized.slice(cc.length);
  if (!cc || !national) return `+${normalized}`;
  return `+${cc} ${groupNationalNumber(national)}`;
}

