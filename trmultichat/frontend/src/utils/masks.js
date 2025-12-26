export function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function maskCPF(value) {
  const v = onlyDigits(value).slice(0, 11);
  return v
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function maskCNPJ(value) {
  const v = onlyDigits(value).slice(0, 14);
  return v
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

export function maskCEP(value) {
  const v = onlyDigits(value).slice(0, 8);
  return v.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function maskPhoneBR(value) {
  const v = onlyDigits(value).slice(0, 11);
  if (v.length <= 10) {
    // (11) 9999-9999
    return v
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  // (11) 99999-9999
  return v
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}


