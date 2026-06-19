export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 13);
  const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;

  if (localDigits.length <= 2) return localDigits;
  if (localDigits.length <= 7) return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2)}`;
  if (localDigits.length <= 10) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
  }

  return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7, 11)}`;
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);

  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  const calculateDigit = (base: string, factor: number) => {
    const total = base
      .split('')
      .reduce((sum, digit) => sum + Number(digit) * factor--, 0);
    const remainder = (total * 10) % 11;

    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calculateDigit(cpf.slice(0, 9), 10);
  const secondDigit = calculateDigit(cpf.slice(0, 10), 11);

  return firstDigit === Number(cpf[9]) && secondDigit === Number(cpf[10]);
}

export function normalizeClientePhone(value: string) {
  const digits = onlyDigits(value);
  const withoutCountryCode = digits.startsWith('55') ? digits.slice(2) : digits;

  if (withoutCountryCode.length < 10 || withoutCountryCode.length > 11) {
    return null;
  }

  const internationalDigits = `55${withoutCountryCode}`;

  return {
    authPhone: `+${internationalDigits}`,
    dbPhone: internationalDigits,
  };
}

export function normalizeOptionalEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? '';

  if (!email) return null;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
