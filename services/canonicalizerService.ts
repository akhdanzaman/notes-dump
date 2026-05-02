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

export interface CanonicalizerContext {
  existingItems: BrainDumpItem[];
  wallets: Wallet[];
  budgetRules: BudgetRule[];
  rules: CanonicalRule[];
  autoApplyHighConfidence?: boolean;
}

const CANONICAL_FIELDS: CanonicalField[] = ['merchant', 'paymentMethod', 'subcommodity'];
const HISTORICAL_REVIEW_ID_PREFIX = 'canonical-backfill';

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

  return {
    meta: nextMeta,
    suggestions,
    autoApplied,
  };
}

export function canonicalizeParserResults(
  results: ParserResultV2[],
  ctx: CanonicalizerContext
): ParserResultV2[] {
  return results.map((result) => {
    if (result.action === 'create_item') {
      const payload = result.payload;
      if (!payload || !("meta" in payload) || !payload.meta) return result;

      const canonicalized = canonicalizeMeta(payload.meta as ParsedItemMetaV2, ctx);
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
      const canonicalized = canonicalizeMeta(partialMeta, ctx);
      const nextResult: ParserResultV2 = {
        ...result,
        payload: {
          ...payload,
          changes: {
            ...(payload.changes as ParsedItemMetaV2),
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
  const reviews: HistoricalCanonicalReview[] = [];
  const changedItemIds: string[] = [];
  let autoAppliedCount = 0;
  let reviewSuggestionCount = 0;

  const nextItems = items.map((item) => {
    const canonicalized = canonicalizeMeta(item.meta as ParsedItemMetaV2, ctx);

    if (canonicalized.suggestions.length > 0) {
      reviews.push(buildHistoricalReview(item, canonicalized.suggestions, canonicalized.meta));
      reviewSuggestionCount += canonicalized.suggestions.length;
    }

    if (canonicalized.autoApplied.length === 0) return item;

    const nextCanonical = {
      ...(item.meta.canonical || {}),
      ...pickCanonicalFields(canonicalized.meta, canonicalized.autoApplied),
    };

    const nextMeta = {
      ...item.meta,
      canonical: nextCanonical,
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

    for (const field of CANONICAL_FIELDS) {
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
