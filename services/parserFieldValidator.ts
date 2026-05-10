import { BudgetRule, FinanceType, ParserResultV2, Wallet } from '../types';
import { resolveBudgetCategoryIdFromRules } from './budgetCategoryService';

export type ParserValidationContext = {
  availableWallets: Wallet[];
  availableBudgetRules: BudgetRule[];
};

const FINANCE_TYPES: FinanceType[] = ['expense', 'income', 'transfer', 'saving'];
const normalizeWhitespace = (input: string) => input.replace(/\s+/g, ' ').trim();
const lower = (input: string) => normalizeWhitespace(input).toLowerCase();

const strictReferenceMatch = <T extends { id: string; name: string }>(query: unknown, items: T[]): string | undefined => {
  if (typeof query !== 'string') return undefined;
  const normalized = lower(query);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  const exactId = items.find(item => lower(item.id) === normalized);
  if (exactId) return exactId.id;
  const exactName = items.find(item => lower(item.name) === normalized);
  if (exactName) return exactName.id;
  return items.find(item => lower(item.name).replace(/[^a-z0-9]/g, '') === compact)?.id;
};

const appendReviewReason = (result: ParserResultV2, reason: string) => {
  const reasons = result.reviewReason ? result.reviewReason.split(/\s*;\s*/).map(value => value.trim()).filter(Boolean) : [];
  if (!reasons.includes(reason)) reasons.push(reason);
  result.reviewReason = reasons.join('; ');
  result.needsReview = true;
  if (result.confidence === 'high') result.confidence = 'medium';
};

const validDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const normalizeDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = normalizeWhitespace(value);
  if (validDateOnly(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return undefined;
};

const looksLikeExplanation = (value: string) => {
  const cleaned = normalizeWhitespace(value);
  return /\b(because|since|probably|maybe|likely|confidence|unsure|not sure|i think|should be|explanation|reason|use this|pilih|mungkin|kayaknya|sepertinya|karena)\b/i.test(cleaned)
    || /[{}\[\]\n]/.test(value)
    || cleaned.split(/\s+/).length > 6;
};

const cleanTaxonomy = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = normalizeWhitespace(value);
  if (!cleaned || looksLikeExplanation(cleaned)) return undefined;
  return cleaned;
};

const sanitizeMeta = (result: ParserResultV2, meta: any, ctx: ParserValidationContext, itemType?: string) => {
  if (!meta || typeof meta !== 'object') return meta;
  const next = { ...meta };

  if (next.financeType !== undefined && !FINANCE_TYPES.includes(next.financeType)) {
    delete next.financeType;
    appendReviewReason(result, 'Invalid financeType was omitted from structured fields.');
  }

  if (next.date !== undefined) {
    const date = normalizeDate(next.date);
    if (date) next.date = date;
    else {
      delete next.date;
      appendReviewReason(result, 'Invalid date was omitted from structured fields.');
    }
  }

  if (next.paymentMethod) {
    const walletId = strictReferenceMatch(next.paymentMethod, ctx.availableWallets);
    if (walletId) next.paymentMethod = walletId;
    else {
      delete next.paymentMethod;
      appendReviewReason(result, 'Unmatched payment wallet was omitted from structured fields.');
    }
  }

  if (next.budgetCategory) {
    if (looksLikeExplanation(next.budgetCategory)) {
      delete next.budgetCategory;
      appendReviewReason(result, 'Unmatched budget category was omitted from structured fields.');
    } else {
      const budgetId = resolveBudgetCategoryIdFromRules(next.budgetCategory, ctx.availableBudgetRules);
      if (budgetId) next.budgetCategory = budgetId;
      else {
        delete next.budgetCategory;
        appendReviewReason(result, 'Unmatched budget category was omitted from structured fields.');
      }
    }
  }

  if (next.toWallet) {
    if (itemType === 'FINANCE' && next.financeType !== 'transfer' && next.financeType !== 'saving') {
      delete next.toWallet;
      appendReviewReason(result, 'Destination wallet is only valid for transfer or saving transactions.');
    } else {
      const toWalletId = strictReferenceMatch(next.toWallet, ctx.availableWallets);
      if (toWalletId) next.toWallet = toWalletId;
      else {
        delete next.toWallet;
        appendReviewReason(result, 'Unmatched destination wallet was omitted from structured fields.');
      }
    }
  }

  for (const field of ['commodity', 'subcommodity'] as const) {
    if (next[field] !== undefined) {
      const cleaned = cleanTaxonomy(next[field]);
      if (cleaned) next[field] = cleaned;
      else {
        delete next[field];
        appendReviewReason(result, `Ambiguous ${field} was omitted from structured fields.`);
      }
    }
    const canonical = next.canonical?.[field];
    if (canonical && typeof canonical === 'object') {
      const confidence = typeof canonical.confidence === 'number' ? canonical.confidence : undefined;
      if (canonical.needsReview === true || (confidence !== undefined && confidence < 0.75)) {
        delete next[field];
        appendReviewReason(result, `Low-confidence ${field} classification needs review.`);
      }
    }
  }

  delete next.canonical;
  return next;
};

export function sanitizeParserResultsBeforeResolve(results: ParserResultV2[], ctx: ParserValidationContext): ParserResultV2[] {
  return results.map(result => {
    const next: ParserResultV2 = {
      ...result,
      payload: result.payload && typeof result.payload === 'object' ? { ...(result.payload as any) } : result.payload,
    };
    const payload = next.payload as any;

    if (next.action === 'create_item' && payload?.meta) {
      payload.meta = sanitizeMeta(next, payload.meta, ctx, payload.itemType);
    }

    if (next.action === 'update_item' && payload?.changes) {
      payload.changes = sanitizeMeta(next, payload.changes, ctx, next.entityType === 'finance' ? 'FINANCE' : undefined);
    }

    if ((next.action === 'transfer_money' || next.action === 'add_saving_funds') && payload?.date !== undefined) {
      const date = normalizeDate(payload.date);
      if (date) payload.date = date;
      else {
        delete payload.date;
        appendReviewReason(next, 'Invalid date was omitted from structured fields.');
      }
    }

    return next;
  });
}
