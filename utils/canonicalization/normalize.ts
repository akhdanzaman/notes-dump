const normalizeUnicode = (input: string) => input.normalize('NFKC');

export function normalizeCanonicalText(input?: string): string {
  if (!input) return '';

  return normalizeUnicode(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMerchantText(input?: string): string {
  return normalizeCanonicalText(input)
    .replace(/\b(pt|cv|toko|store|official|shop)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeWalletText(input?: string): string {
  return normalizeCanonicalText(input)
    .replace(/\b(bank|debit|credit|kartu|atm|rekening)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeCanonicalText(input?: string): string[] {
  const normalized = normalizeCanonicalText(input);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}
