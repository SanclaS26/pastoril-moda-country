const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseAdminCurrency(input: string | number | null | undefined) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (!input?.trim()) return null;

  const cleaned = input
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/[^\d,.-]/g, '');
  const negative = cleaned.startsWith('-');
  const unsigned = cleaned.replace(/-/g, '');
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');
  let decimalIndex = -1;

  if (lastComma >= 0 && lastDot >= 0) {
    decimalIndex = Math.max(lastComma, lastDot);
  } else if (lastComma >= 0) {
    decimalIndex = lastComma;
  } else if (lastDot >= 0) {
    const decimalLength = unsigned.length - lastDot - 1;
    decimalIndex = decimalLength === 1 || decimalLength === 2 ? lastDot : -1;
  }

  const integerPart = (decimalIndex >= 0 ? unsigned.slice(0, decimalIndex) : unsigned).replace(/\D/g, '') || '0';
  const decimalPart = decimalIndex >= 0 ? unsigned.slice(decimalIndex + 1).replace(/\D/g, '') : '';
  const parsed = Number(`${negative ? '-' : ''}${integerPart}.${decimalPart || '0'}`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatAdminCurrency(input: string | number | null | undefined) {
  const parsed = parseAdminCurrency(input);
  return parsed === null ? '' : brlFormatter.format(parsed);
}

export function normalizeAdminCurrency(input: string | number | null | undefined) {
  const parsed = parseAdminCurrency(input);
  return parsed === null ? '' : parsed.toFixed(2);
}
