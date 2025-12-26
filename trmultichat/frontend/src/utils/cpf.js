export function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

// Validação matemática de CPF (11 dígitos)
export function isValidCPF(cpfRaw) {
  const cpf = onlyDigits(cpfRaw);
  if (!cpf || cpf.length !== 11) return false;
  // rejeita sequências iguais (000..., 111..., etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (base, factor) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (factor - i);
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return cpf === cpf.slice(0, 9) + String(d1) + String(d2);
}


