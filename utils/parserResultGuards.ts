import { ParserResultV2, CreateItemPayload } from '../types';

const normalizeText = (value: unknown): string => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const stableStringify = (value: unknown): string => {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${k}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const parserResultSignature = (result: ParserResultV2): string => stableStringify({
  action: result.action,
  entityType: result.entityType,
  content: normalizeText(result.content),
  targetText: normalizeText(result.targetText),
  payload: result.payload,
  entityRefs: result.entityRefs,
});

const isCreateFinanceResult = (result: ParserResultV2): boolean => {
  if (result.action !== 'create_item') return false;
  const payload = result.payload as Partial<CreateItemPayload> | undefined;
  return result.entityType === 'finance' || payload?.itemType === 'FINANCE';
};

const financeCoreSignature = (result: ParserResultV2): string => {
  const payload = result.payload as Partial<CreateItemPayload> | undefined;
  const meta = payload?.meta || {};
  return stableStringify({
    itemType: payload?.itemType || 'FINANCE',
    financeType: meta.financeType || 'expense',
    amount: meta.amount,
    paymentMethod: meta.paymentMethod,
    toWallet: meta.toWallet,
    budgetCategory: meta.budgetCategory,
    content: normalizeText(payload?.content || result.content),
  });
};

const financeLooseSingleInputSignature = (result: ParserResultV2): string => {
  const payload = result.payload as Partial<CreateItemPayload> | undefined;
  const meta = payload?.meta || {};
  return stableStringify({
    itemType: payload?.itemType || 'FINANCE',
    financeType: meta.financeType || 'expense',
    amount: meta.amount,
    paymentMethod: meta.paymentMethod,
    content: normalizeText(payload?.content || result.content),
  });
};

const scoreFinanceResult = (result: ParserResultV2): number => {
  const payload = result.payload as Partial<CreateItemPayload> | undefined;
  const meta = payload?.meta || {};
  const financeType = meta.financeType || 'expense';
  const toWallet = normalizeText(meta.toWallet);

  let score = 0;
  score += result.confidence === 'high' ? 6 : result.confidence === 'medium' ? 3 : 0;
  if (!result.needsReview) score += 2;
  if (meta.date) score += 1;
  if (meta.budgetCategory) score += 1;
  if (meta.commodity) score += 1;
  if (meta.subcommodity) score += 1;
  if ((financeType === 'expense' || financeType === 'income') && toWallet) score -= 3;
  if (/\b(usually|should|because|based on|source|destination|not needed|tidak perlu)\b/.test(toWallet)) score -= 5;

  return score;
};

const looksLikeSingleFinanceInput = (sourceText: string): boolean => {
  const text = normalizeText(sourceText);
  if (!text) return false;
  if (/\n|\r|;|\s(?:dan|and)\s+.*\b\d/.test(text)) return false;
  return /\b(expense|pengeluaran|keluar|spent|spend|bayar|beli|makan|sarapan|lunch|dinner|parkir|bensin|kopi|jajan|income|transfer|topup|tabung)\b/.test(text)
    && /\d/.test(text);
};

export interface ParserMultiplicityGuardResult {
  results: ParserResultV2[];
  removedCount: number;
  reason?: string;
}

export function guardParserResultMultiplicity(results: ParserResultV2[], sourceText: string): ParserMultiplicityGuardResult {
  const seen = new Set<string>();
  const deduped: ParserResultV2[] = [];
  let removedCount = 0;

  for (const result of results) {
    const signature = parserResultSignature(result);
    if (seen.has(signature)) {
      removedCount += 1;
      continue;
    }
    seen.add(signature);
    deduped.push(result);
  }

  if (!looksLikeSingleFinanceInput(sourceText)) {
    return { results: deduped, removedCount, reason: removedCount > 0 ? 'exact_duplicate_parser_results' : undefined };
  }

  const financeResults = deduped.filter(isCreateFinanceResult);
  if (financeResults.length <= 1) {
    return { results: deduped, removedCount, reason: removedCount > 0 ? 'single_finance_duplicate_guard' : undefined };
  }

  const coreSignatures = new Set(financeResults.map(financeCoreSignature));
  const looseSignatures = new Set(financeResults.map(financeLooseSingleInputSignature));
  if (coreSignatures.size !== 1 && looseSignatures.size !== 1) {
    return { results: deduped, removedCount, reason: removedCount > 0 ? 'exact_duplicate_parser_results' : undefined };
  }

  const bestFinance = financeResults.slice().sort((a, b) => scoreFinanceResult(b) - scoreFinanceResult(a))[0];
  let keptFinance = false;
  const collapsed = deduped.filter((result) => {
    if (!isCreateFinanceResult(result)) return true;
    if (!keptFinance && result === bestFinance) {
      keptFinance = true;
      return true;
    }
    removedCount += 1;
    return false;
  });

  return {
    results: collapsed,
    removedCount,
    reason: removedCount > 0 ? 'single_finance_duplicate_guard' : undefined,
  };
}
