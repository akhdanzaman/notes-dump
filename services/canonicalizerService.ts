import {
  BrainDumpItem,
  BudgetRule,
  CanonicalField,
  CanonicalReviewSuggestion,
  CanonicalRule,
  CanonicalizationResult,
  ItemCanonicalMeta,
  ParsedItemMetaV2,
  ParserResultV2,
  Wallet,
  ItemType,
  ParserEntityType,
  UpdateItemPayload,
} from '../types';
import { findBestCanonicalCandidate } from '../utils/canonicalization/ruleMatcher';
import { shouldAutoApply, shouldSuggestReview } from '../utils/canonicalization/scoring';
import { consolidateCanonicalRules, incrementCanonicalRuleRejection, mergeLearnedRule } from '../utils/canonicalization/learnedRules';
import { CANONICAL_OTHER_VALUE, ensureFinanceCanonicalDefaults, normalizeCanonicalFallback } from '../utils/canonicalization/defaults';
import { inferTransactionCommodity } from '../utils/canonicalization/transactionInference';
import { enrichFinanceMetaFromText } from './parserSignalService';

export interface CanonicalizerContext {
  existingItems: BrainDumpItem[];
  wallets: Wallet[];
  budgetRules: BudgetRule[];
  rules: CanonicalRule[];
  autoApplyHighConfidence?: boolean;
}

const CANONICAL_FIELDS: CanonicalField[] = ['commodity', 'paymentMethod', 'subcommodity'];
const LEARNABLE_CANONICAL_FIELDS: CanonicalField[] = ['merchant', 'commodity', 'paymentMethod', 'subcommodity'];
const HISTORICAL_REVIEW_ID_PREFIX = 'canonical-backfill';

type BehaviorCommodityPair = {
  commodity: string;
  subcommodity?: string;
  count: number;
  evidence: string;
};

export interface HistoricalCanonicalReview {
  id: string;
  text: string;
  results: ParserResultV2[];
  originalResults: ParserResultV2[];
}

export interface HistoricalCanonicalSweepResult {
  items: BrainDumpItem[];
  reviews: HistoricalCanonicalReview[];
  changedItemIds: string[];
  autoAppliedCount: number;
  reviewSuggestionCount: number;
}

const getPayloadMeta = (result: ParserResultV2): ParsedItemMetaV2 | undefined => {
  const payload = result.payload;
  if (!payload) return undefined;
  if ("meta" in payload) return payload.meta as ParsedItemMetaV2;
  if ("changes" in payload) return payload.changes as ParsedItemMetaV2;
  return undefined;
};

const mergeReviewReason = (currentReason: string | undefined, nextReason: string) => {
  if (!currentReason) return nextReason;
  if (currentReason.includes(nextReason)) return currentReason;
  return `${currentReason} ${nextReason}`.trim();
};

const buildCanonicalValue = (
  field: CanonicalField,
  rawValue: string,
  candidate: NonNullable<ReturnType<typeof findBestCanonicalCandidate>>,
  needsReview: boolean
): NonNullable<ItemCanonicalMeta[typeof field]> => ({
  rawValue,
  value: candidate.canonicalValue,
  confidence: candidate.score,
  source: candidate.source,
  ruleId: candidate.ruleId,
  needsReview,
  reason: candidate.reason,
});

const itemTypeToEntityType = (type: ItemType): ParserEntityType => {
  switch (type) {
    case ItemType.TODO: return 'todo';
    case ItemType.SHOPPING: return 'shopping';
    case ItemType.EVENT: return 'event';
    case ItemType.FINANCE: return 'finance';
    case ItemType.JOURNAL: return 'journal';
    case ItemType.NOTE:
    default:
      return 'note';
  }
};

const pickCanonicalFields = (
  meta: ParsedItemMetaV2,
  fields: CanonicalField[]
): ItemCanonicalMeta => fields.reduce<ItemCanonicalMeta>((acc, field) => {
  const canonicalValue = meta.canonical?.[field];
  if (canonicalValue) acc[field] = canonicalValue;
  return acc;
}, {});

const hasCanonicalFields = (canonical?: ItemCanonicalMeta) => !!canonical && Object.keys(canonical).length > 0;

const normalizeBehaviorText = (value?: string): string => (value || '')
  .trim()
  .toLowerCase()
  .replace(/rp\s*/g, ' ')
  .replace(/\b\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta|m)?\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const meaningfulCanonicalValue = (value?: string): string | undefined => {
  const normalized = normalizeCanonicalFallback(value);
  return normalized && normalized !== CANONICAL_OTHER_VALUE ? normalized : undefined;
};

const acceptedCanonicalOrRaw = (meta: ParsedItemMetaV2, field: 'commodity' | 'subcommodity'): string | undefined => {
  const canonical = meta.canonical?.[field];
  if (canonical?.value && !canonical.needsReview) {
    const accepted = meaningfulCanonicalValue(canonical.value);
    if (accepted) return accepted;
  }
  return meaningfulCanonicalValue(meta[field]);
};

const behaviorKeysForMeta = (content: string | undefined, meta: ParsedItemMetaV2): string[] => {
  const keys = new Set<string>();
  const merchant = normalizeBehaviorText(meta.merchant);
  const contentKey = normalizeBehaviorText(content);
  const tagsKey = (meta.tags || []).map(normalizeBehaviorText).filter(Boolean).sort().join(' ');

  if (merchant) keys.add(`merchant:${merchant}`);
  if (contentKey) keys.add(`content:${contentKey}`);
  if (tagsKey && contentKey) keys.add(`tags-content:${tagsKey}:${contentKey}`);

  return Array.from(keys);
};

const buildBehaviorCommodityIndex = (items: BrainDumpItem[]): Map<string, BehaviorCommodityPair[]> => {
  const grouped = new Map<string, Map<string, BehaviorCommodityPair>>();

  items.forEach(item => {
    const commodity = acceptedCanonicalOrRaw(item.meta, 'commodity');
    if (!commodity) return;
    const subcommodity = acceptedCanonicalOrRaw(item.meta, 'subcommodity');
    const keys = behaviorKeysForMeta(item.content, item.meta);
    if (keys.length === 0) return;

    keys.forEach(key => {
      if (!grouped.has(key)) grouped.set(key, new Map());
      const pairKey = `${commodity}::${subcommodity || ''}`;
      const current = grouped.get(key)!.get(pairKey) || {
        commodity,
        subcommodity,
        count: 0,
        evidence: key,
      };
      current.count += 1;
      grouped.get(key)!.set(pairKey, current);
    });
  });

  const index = new Map<string, BehaviorCommodityPair[]>();
  grouped.forEach((pairs, key) => {
    index.set(key, Array.from(pairs.values()).sort((a, b) => b.count - a.count));
  });
  return index;
};

const inferCommodityFromUserBehavior = (
  content: string | undefined,
  meta: ParsedItemMetaV2,
  ctx: CanonicalizerContext
): BehaviorCommodityPair | undefined => {
  const index = buildBehaviorCommodityIndex(ctx.existingItems);
  const keys = behaviorKeysForMeta(content, meta);
  for (const key of keys) {
    const pair = index.get(key)?.[0];
    if (pair) return pair;
  }
  return undefined;
};

const fillCommodityFromContext = (
  content: string | undefined,
  itemType: string | undefined,
  meta: ParsedItemMetaV2,
  ctx: CanonicalizerContext
): ParsedItemMetaV2 => {
  const next: ParsedItemMetaV2 = { ...meta };
  const hasCommodity = meaningfulCanonicalValue(next.commodity);
  const hasSubcommodity = meaningfulCanonicalValue(next.subcommodity);
  if (hasCommodity && hasSubcommodity) return next;

  const behavior = inferCommodityFromUserBehavior(content, next, ctx);
  if (behavior) {
    if (!hasCommodity) next.commodity = behavior.commodity;
    if (!hasSubcommodity && behavior.subcommodity) next.subcommodity = behavior.subcommodity;
  }

  const stillMissingCommodity = !meaningfulCanonicalValue(next.commodity);
  const stillMissingSubcommodity = !meaningfulCanonicalValue(next.subcommodity);
  if (stillMissingCommodity || stillMissingSubcommodity) {
    const inferred = inferTransactionCommodity({
      id: 'canonical-context-inference',
      type: itemType === 'SHOPPING' ? ItemType.SHOPPING : ItemType.FINANCE,
      content: content || '',
      status: 'done',
      created_at: new Date(0).toISOString(),
      meta: next,
    });
    if (stillMissingCommodity && meaningfulCanonicalValue(inferred.commodity)) next.commodity = inferred.commodity;
    if (stillMissingSubcommodity && meaningfulCanonicalValue(inferred.subcommodity)) next.subcommodity = inferred.subcommodity;
  }

  return next;
};

const buildHistoricalReview = (
  item: BrainDumpItem,
  suggestions: CanonicalReviewSuggestion[],
  suggestedMeta: ParsedItemMetaV2
): HistoricalCanonicalReview => {
  const entityType = itemTypeToEntityType(item.type);
  const reviewId = `${HISTORICAL_REVIEW_ID_PREFIX}-${item.id}`;
  const suggestedCanonical = pickCanonicalFields(suggestedMeta, suggestions.map(suggestion => suggestion.field));
  const basePayload: UpdateItemPayload = {
    match: { itemId: item.id, itemName: item.content },
    changes: {},
  };
  const originalPayload: UpdateItemPayload = {
    match: { itemId: item.id, itemName: item.content },
    changes: hasCanonicalFields(suggestedCanonical) ? { canonical: suggestedCanonical } : {},
  };

  const resultBase: Omit<ParserResultV2, 'payload'> = {
    action: 'update_item',
    entityType,
    content: item.content,
    targetText: item.content,
    confidence: 'medium',
    needsReview: true,
    reviewReason: 'Historical canonical suggestion needs review before applying.',
    entityRefs: { itemId: item.id, itemName: item.content },
    canonicalReview: suggestions,
  };

  return {
    id: reviewId,
    text: `Review canonical metadata for ${item.content}`,
    results: [{ ...resultBase, payload: basePayload }],
    originalResults: [{ ...resultBase, payload: originalPayload }],
  };
};

export function canonicalizeMeta(
  meta: ParsedItemMetaV2,
  ctx: CanonicalizerContext
): CanonicalizationResult {
  const nextMeta: ParsedItemMetaV2 = {
    ...meta,
    canonical: meta.canonical ? { ...meta.canonical } : {},
  };

  const suggestions: CanonicalReviewSuggestion[] = [];
  const autoApplied: CanonicalField[] = [];

  for (const field of CANONICAL_FIELDS) {
    const rawValue = nextMeta[field];
    if (!rawValue || typeof rawValue !== 'string') continue;

    // Precedence rule #1: a value explicitly applied in manual review is final for this pass.
    // We do not rematch it against system/learned rules or contextual boosts, because review
    // is the human correction signal that may later train learned rules.
    const existingCanonical = nextMeta.canonical?.[field];
    if (existingCanonical?.value && existingCanonical.source === 'manual_review') continue;

    const candidate = findBestCanonicalCandidate(field, rawValue, nextMeta, ctx.rules);
    if (!candidate) continue;

    const autoApplyEnabled = ctx.autoApplyHighConfidence !== false;

    if (autoApplyEnabled && candidate.autoApplyEligible !== false && shouldAutoApply(candidate.score)) {
      nextMeta.canonical = nextMeta.canonical || {};
      nextMeta.canonical[field] = buildCanonicalValue(field, rawValue, candidate, false);
      autoApplied.push(field);
      continue;
    }

    const needsReview = shouldSuggestReview(candidate.score) || !autoApplyEnabled || candidate.autoApplyEligible === false;

    if (needsReview) {
      nextMeta.canonical = nextMeta.canonical || {};
      nextMeta.canonical[field] = buildCanonicalValue(field, rawValue, candidate, true);
      suggestions.push({
        field,
        rawValue,
        suggestedValue: candidate.canonicalValue,
        confidence: candidate.score,
        reason: candidate.reason,
        source: candidate.source,
        ruleId: candidate.ruleId,
      });
    }
  }

  const metaWithCoverage = ensureFinanceCanonicalDefaults(nextMeta);

  (['commodity', 'subcommodity'] as CanonicalField[]).forEach(field => {
    if (metaWithCoverage.canonical?.[field] && !nextMeta.canonical?.[field]) {
      autoApplied.push(field);
    }
  });

  return {
    meta: metaWithCoverage,
    suggestions,
    autoApplied,
  };
}

const enrichMetaWithContext = (result: ParserResultV2, meta: ParsedItemMetaV2, ctx: CanonicalizerContext): ParsedItemMetaV2 => {
  const itemType = String(result.entityType || '').toUpperCase();
  const content = result.targetText || result.content || '';
  const signalEnriched = enrichFinanceMetaFromText({
    rawText: content,
    content: result.content || '',
    itemType,
    meta,
    availableWallets: ctx.wallets,
    availableBudgetRules: ctx.budgetRules,
  });

  return fillCommodityFromContext(content, itemType, signalEnriched, ctx);
};

export function canonicalizeParserResults(
  results: ParserResultV2[],
  ctx: CanonicalizerContext
): ParserResultV2[] {
  return results.map((result) => {
    if (result.action === 'create_item') {
      const payload = result.payload;
      if (!payload || !("meta" in payload) || !payload.meta) return result;

      const enrichedMeta = enrichMetaWithContext(result, payload.meta as ParsedItemMetaV2, ctx);
      const canonicalized = canonicalizeMeta(enrichedMeta, ctx);
      const nextResult: ParserResultV2 = {
        ...result,
        payload: {
          ...payload,
          meta: canonicalized.meta,
        },
        canonicalReview: canonicalized.suggestions,
      };

      if (canonicalized.suggestions.length > 0) {
        nextResult.needsReview = true;
        nextResult.reviewReason = mergeReviewReason(
          result.reviewReason,
          `Canonical review suggested for ${canonicalized.suggestions.map(s => s.field).join(', ')}.`
        );
      }

      return nextResult;
    }

    if (result.action === 'update_item') {
      const payload = result.payload;
      if (!payload || !("changes" in payload) || !payload.changes) return result;

      const partialMeta = payload.changes as ParsedItemMetaV2;
      const enrichedMeta = enrichMetaWithContext(result, partialMeta, ctx);
      const canonicalized = canonicalizeMeta(enrichedMeta, ctx);
      const nextResult: ParserResultV2 = {
        ...result,
        payload: {
          ...payload,
          changes: {
            ...enrichedMeta,
            canonical: canonicalized.meta.canonical,
          } as ParsedItemMetaV2,
        },
        canonicalReview: canonicalized.suggestions,
      };

      if (canonicalized.suggestions.length > 0) {
        nextResult.needsReview = true;
        nextResult.reviewReason = mergeReviewReason(
          result.reviewReason,
          `Canonical review suggested for ${canonicalized.suggestions.map(s => s.field).join(', ')}.`
        );
      }

      return nextResult;
    }

    return result;
  });
}

export function sweepHistoricalCanonicalMeta(
  items: BrainDumpItem[],
  ctx: CanonicalizerContext
): HistoricalCanonicalSweepResult {
  const sweepContext = { ...ctx, existingItems: ctx.existingItems.length > 0 ? ctx.existingItems : items };
  const reviews: HistoricalCanonicalReview[] = [];
  const changedItemIds: string[] = [];
  let autoAppliedCount = 0;
  let reviewSuggestionCount = 0;

  const nextItems = items.map((item) => {
    const signalEnriched = enrichFinanceMetaFromText({
      rawText: item.content,
      content: item.content,
      itemType: item.type,
      meta: item.meta as ParsedItemMetaV2,
      availableWallets: ctx.wallets,
      availableBudgetRules: ctx.budgetRules,
    });
    const enrichedMeta = fillCommodityFromContext(item.content, item.type, signalEnriched, sweepContext);
    const canonicalized = canonicalizeMeta(enrichedMeta, sweepContext);

    if (canonicalized.suggestions.length > 0) {
      reviews.push(buildHistoricalReview(item, canonicalized.suggestions, canonicalized.meta));
      reviewSuggestionCount += canonicalized.suggestions.length;
    }

    const nextCanonical = {
      ...(item.meta.canonical || {}),
      ...pickCanonicalFields(canonicalized.meta, canonicalized.autoApplied),
    };

    const nextMeta = {
      ...item.meta,
      commodity: canonicalized.meta.commodity,
      subcommodity: canonicalized.meta.subcommodity,
      paymentMethod: canonicalized.meta.paymentMethod,
      budgetCategory: canonicalized.meta.budgetCategory,
      merchant: canonicalized.meta.merchant,
      ...(Object.keys(nextCanonical).length > 0 || item.meta.canonical ? { canonical: nextCanonical } : {}),
    };

    if (JSON.stringify(nextMeta) === JSON.stringify(item.meta)) return item;

    changedItemIds.push(item.id);
    autoAppliedCount += canonicalized.autoApplied.length;

    return {
      ...item,
      meta: nextMeta,
    };
  });

  return {
    items: nextItems,
    reviews,
    changedItemIds,
    autoAppliedCount,
    reviewSuggestionCount,
  };
}

export function learnCanonicalRulesFromReview(params: {
  originalResults: ParserResultV2[];
  approvedResults: ParserResultV2[];
  existingRules: CanonicalRule[];
}): CanonicalRule[] {
  let rules = params.existingRules;

  params.approvedResults.forEach((approvedResult, index) => {
    const originalResult = params.originalResults[index];
    const approvedMeta = getPayloadMeta(approvedResult);
    const originalMeta = originalResult ? getPayloadMeta(originalResult) : undefined;

    if (!approvedMeta) return;

    for (const field of LEARNABLE_CANONICAL_FIELDS) {
      const approvedCanonical = approvedMeta.canonical?.[field];
      const originalCanonical = originalMeta?.canonical?.[field];
      const rawValue = approvedCanonical?.rawValue || originalCanonical?.rawValue || approvedMeta[field] || originalMeta?.[field];
      const canonicalValue = approvedCanonical?.value;

      if (rawValue && canonicalValue) {
        rules = mergeLearnedRule(rules, field, rawValue, canonicalValue);
        continue;
      }

      if (originalCanonical?.ruleId && !approvedCanonical?.value) {
        rules = incrementCanonicalRuleRejection(rules, originalCanonical.ruleId);
      }
    }
  });

  return consolidateCanonicalRules(rules);
}
