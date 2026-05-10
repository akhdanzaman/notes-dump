import { BrainDumpItem, BudgetRule, ItemCanonicalMeta, ItemType, ParsedItemMetaV2, Wallet } from '../types';
import { CANONICAL_OTHER_VALUE, normalizeCanonicalFallback } from '../utils/canonicalization/defaults';

export type BehaviorInferenceField = 'paymentMethod' | 'budgetCategory' | 'commodity' | 'subcommodity';

export interface BehaviorCacheContext {
  existingItems: BrainDumpItem[];
  wallets: Wallet[];
  budgetRules: BudgetRule[];
  maxRecentTransactions?: number;
  minEvidenceForAutoApply?: number;
  minAgreementForAutoApply?: number;
}

export interface BehaviorInference {
  field: BehaviorInferenceField;
  value: string;
  confidence: number;
  evidenceCount: number;
  totalCount: number;
  matchKey: string;
  needsReview: boolean;
  reason: string;
}

type BehaviorVote = { value: string; count: number; latestAt: number };
type FieldVoteMap = Map<string, BehaviorVote>;
type KeyVoteMap = Map<BehaviorInferenceField, FieldVoteMap>;

const BEHAVIOR_FIELDS: BehaviorInferenceField[] = ['paymentMethod', 'budgetCategory', 'commodity', 'subcommodity'];

// Source window: behavior inference only learns from this many most-recent approved
// finance transactions after review/error filters are applied. Keep this bounded so
// older habits cannot silently overrule newer wallet/category behavior.
export const BEHAVIOR_CACHE_DEFAULT_MAX_RECENT_TRANSACTIONS = 120;
export const BEHAVIOR_CACHE_MIN_EVIDENCE_FOR_AUTO_APPLY = 2;
export const BEHAVIOR_CACHE_MIN_AGREEMENT_FOR_AUTO_APPLY = 0.8;

const normalizeKey = (input: string): string => input.toLowerCase().replace(/[^a-z0-9]/g, '');

export const normalizeBehaviorText = (value?: string): string => (value || '')
  .trim()
  .toLowerCase()
  .replace(/rp\s*/g, ' ')
  .replace(/\b(?:idr|rupiah)\b/g, ' ')
  .replace(/\b\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta|mio|m)?\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const isWeakBehaviorValue = (value?: string): boolean => {
  const normalized = normalizeCanonicalFallback(value);
  return !normalized || normalized === CANONICAL_OTHER_VALUE;
};

const meaningfulBehaviorValue = (value?: string): string | undefined => {
  const normalized = normalizeCanonicalFallback(value);
  return normalized && normalized !== CANONICAL_OTHER_VALUE ? normalized : undefined;
};

const exactNamedId = <T extends { id: string; name: string }>(value: string | undefined, items: T[]): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const compact = normalizeKey(normalized);
  return items.find(item => item.id.toLowerCase() === normalized)?.id
    || items.find(item => item.name.toLowerCase() === normalized)?.id
    || items.find(item => normalizeKey(item.name) === compact)?.id;
};

const acceptedCanonicalOrRaw = (meta: ParsedItemMetaV2, field: 'commodity' | 'subcommodity'): string | undefined => {
  const canonical = meta.canonical?.[field];
  if (canonical?.value && !canonical.needsReview) {
    const accepted = meaningfulBehaviorValue(canonical.value);
    if (accepted) return accepted;
  }
  return meaningfulBehaviorValue(meta[field]);
};

const acceptedFieldValue = (meta: ParsedItemMetaV2, field: BehaviorInferenceField, ctx: BehaviorCacheContext): string | undefined => {
  if (field === 'paymentMethod') return exactNamedId(meta.paymentMethod, ctx.wallets);
  if (field === 'budgetCategory') {
    if (!meta.budgetCategory || isWeakBehaviorValue(meta.budgetCategory)) return undefined;
    return ctx.budgetRules.length ? exactNamedId(meta.budgetCategory, ctx.budgetRules) : meta.budgetCategory;
  }
  return acceptedCanonicalOrRaw(meta, field);
};

const fieldIsProtected = (meta: ParsedItemMetaV2, field: BehaviorInferenceField): boolean => {
  if (field !== 'commodity' && field !== 'subcommodity') return false;
  return meta.canonical?.[field]?.source === 'manual_review';
};

const fieldCanAcceptBehavior = (meta: ParsedItemMetaV2, field: BehaviorInferenceField): boolean => {
  if (fieldIsProtected(meta, field)) return false;
  if (field === 'paymentMethod') return !meta.paymentMethod;
  if (field === 'budgetCategory') return !meta.budgetCategory || isWeakBehaviorValue(meta.budgetCategory);
  return !meaningfulBehaviorValue(meta[field]);
};

const behaviorKeysForMeta = (content: string | undefined, meta: ParsedItemMetaV2): string[] => {
  const keys = new Set<string>();
  const merchant = normalizeBehaviorText(meta.merchant);
  const contentKey = normalizeBehaviorText(content);
  const payment = normalizeBehaviorText(meta.paymentMethod);

  if (merchant) keys.add(`merchant:${merchant}`);
  if (contentKey) keys.add(`content:${contentKey}`);
  if (merchant && contentKey) keys.add(`merchant-content:${merchant}:${contentKey}`);
  if (payment && contentKey) keys.add(`payment-content:${payment}:${contentKey}`);
  if (merchant && payment) keys.add(`merchant-payment:${merchant}:${payment}`);

  return Array.from(keys);
};

const transactionTimestamp = (item: BrainDumpItem): number => {
  const raw = item.completed_at || item.created_at;
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const isApprovedFinanceSource = (item: BrainDumpItem): boolean => {
  if (item.type !== ItemType.FINANCE || item.status !== 'done') return false;
  const meta = item.meta as ParsedItemMetaV2 & { parserNeedsReview?: boolean; parsingError?: string };
  if (meta.parserNeedsReview || meta.parsingError) return false;
  return true;
};

const scoreVote = (vote: BehaviorVote, totalCount: number): number => {
  const agreement = totalCount > 0 ? vote.count / totalCount : 0;
  const evidenceFactor = Math.min(vote.count, 5) / 5;
  return Number((0.55 + agreement * 0.3 + evidenceFactor * 0.15).toFixed(2));
};

export class BehaviorCache {
  private readonly votesByKey = new Map<string, KeyVoteMap>();
  private readonly minEvidenceForAutoApply: number;
  private readonly minAgreementForAutoApply: number;
  private readonly ctx: BehaviorCacheContext;

  constructor(ctx: BehaviorCacheContext) {
    this.ctx = ctx;
    this.minEvidenceForAutoApply = ctx.minEvidenceForAutoApply ?? BEHAVIOR_CACHE_MIN_EVIDENCE_FOR_AUTO_APPLY;
    this.minAgreementForAutoApply = ctx.minAgreementForAutoApply ?? BEHAVIOR_CACHE_MIN_AGREEMENT_FOR_AUTO_APPLY;
    this.indexRecentTransactions();
  }

  private indexRecentTransactions() {
    [...this.ctx.existingItems]
      .filter(isApprovedFinanceSource)
      .sort((a, b) => transactionTimestamp(b) - transactionTimestamp(a))
      .slice(0, this.ctx.maxRecentTransactions ?? BEHAVIOR_CACHE_DEFAULT_MAX_RECENT_TRANSACTIONS)
      .forEach(item => {
        const meta = item.meta as ParsedItemMetaV2;
        const keys = behaviorKeysForMeta(item.content, meta);
        if (!keys.length) return;
        for (const field of BEHAVIOR_FIELDS) {
          const value = acceptedFieldValue(meta, field, this.ctx);
          if (!value) continue;
          keys.forEach(key => this.addVote(key, field, value, transactionTimestamp(item)));
        }
      });
  }

  private addVote(key: string, field: BehaviorInferenceField, value: string, latestAt: number) {
    if (!this.votesByKey.has(key)) this.votesByKey.set(key, new Map());
    const fieldMap = this.votesByKey.get(key)!;
    if (!fieldMap.has(field)) fieldMap.set(field, new Map());
    const valueMap = fieldMap.get(field)!;
    const current = valueMap.get(value) || { value, count: 0, latestAt: 0 };
    current.count += 1;
    current.latestAt = Math.max(current.latestAt, latestAt);
    valueMap.set(value, current);
  }

  infer(content: string | undefined, meta: ParsedItemMetaV2): BehaviorInference[] {
    const keys = behaviorKeysForMeta(content, meta);
    const bestByField = new Map<BehaviorInferenceField, BehaviorInference>();

    for (const key of keys) {
      const fieldVotes = this.votesByKey.get(key);
      if (!fieldVotes) continue;
      for (const field of BEHAVIOR_FIELDS) {
        if (!fieldCanAcceptBehavior(meta, field)) continue;
        const valueMap = fieldVotes.get(field);
        if (!valueMap) continue;
        const votes = Array.from(valueMap.values()).sort((a, b) => b.count - a.count || b.latestAt - a.latestAt);
        const top = votes[0];
        if (!top) continue;
        const totalCount = votes.reduce((sum, vote) => sum + vote.count, 0);
        const agreement = totalCount > 0 ? top.count / totalCount : 0;
        const confidence = scoreVote(top, totalCount);
        const needsReview = top.count < this.minEvidenceForAutoApply || agreement < this.minAgreementForAutoApply;
        const inference: BehaviorInference = {
          field,
          value: top.value,
          confidence,
          evidenceCount: top.count,
          totalCount,
          matchKey: key,
          needsReview,
          reason: needsReview
            ? `Behavior match ${key} had ${top.count}/${totalCount} agreeing recent transactions; review/AI required.`
            : `Behavior match ${key} had ${top.count}/${totalCount} agreeing recent approved transactions.`,
        };
        const current = bestByField.get(field);
        if (!current || inference.confidence > current.confidence || (inference.confidence === current.confidence && inference.evidenceCount > current.evidenceCount)) {
          bestByField.set(field, inference);
        }
      }
    }

    return Array.from(bestByField.values());
  }
}

export const buildBehaviorCache = (ctx: BehaviorCacheContext): BehaviorCache => new BehaviorCache(ctx);

const behaviorCanonicalValue = (inference: BehaviorInference): NonNullable<ItemCanonicalMeta['commodity']> => ({
  rawValue: inference.value,
  value: inference.value,
  confidence: inference.confidence,
  source: 'context_inference',
  needsReview: false,
  reason: inference.reason,
});

export const applyBehaviorInference = (
  content: string | undefined,
  meta: ParsedItemMetaV2,
  ctx: BehaviorCacheContext,
  cache = buildBehaviorCache(ctx)
): ParsedItemMetaV2 => {
  const next: ParsedItemMetaV2 = { ...meta, canonical: meta.canonical ? { ...meta.canonical } : meta.canonical };
  cache.infer(content, next)
    .filter(inference => !inference.needsReview)
    .forEach(inference => {
      if (!fieldCanAcceptBehavior(next, inference.field)) return;
      next[inference.field] = inference.value;
      if (inference.field === 'commodity' || inference.field === 'subcommodity') {
        next.canonical = next.canonical || {};
        if (next.canonical[inference.field]?.source !== 'manual_review') {
          next.canonical[inference.field] = behaviorCanonicalValue(inference);
        }
      }
    });
  return next;
};
