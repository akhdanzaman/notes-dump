import {
  BrainDumpItem,
  CanonicalField,
  CanonicalReviewSuggestion,
  EnrichmentTask,
  ItemCanonicalMeta,
  ItemMeta,
} from '../types';
import { CanonicalizerContext, HistoricalCanonicalReview, sweepHistoricalCanonicalMeta } from './canonicalizerService';

export const ASYNC_ENRICHMENT_REVIEW_PREFIX = 'canonical-enrichment-';
export const ASYNC_ENRICHMENT_VERSION = 1;

const ENRICHABLE_TYPES = new Set(['FINANCE', 'SHOPPING', 'TODO']);
const MERGE_SAFE_META_FIELDS: (keyof ItemMeta)[] = [
  'paymentMethod',
  'budgetCategory',
  'commodity',
  'subcommodity',
];

const REVIEW_FIELDS: CanonicalField[] = ['merchant', 'paymentMethod', 'commodity', 'subcommodity'];

const clone = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const present = (value: unknown) => value !== undefined && value !== null && value !== '';

const getCanonicalReviewCount = (reviews: HistoricalCanonicalReview[], itemId: string) =>
  reviews.reduce((sum, review) => {
    const targetsItem = review.originalResults.some(result => result.entityRefs?.itemId === itemId)
      || review.results.some(result => result.entityRefs?.itemId === itemId);
    if (!targetsItem) return sum;
    return sum + review.originalResults.reduce((count, result) => count + (result.canonicalReview?.length || 0), 0);
  }, 0);

const normalizeReview = (review: HistoricalCanonicalReview, task: EnrichmentTask): HistoricalCanonicalReview => ({
  ...review,
  id: `${ASYNC_ENRICHMENT_REVIEW_PREFIX}${task.itemId}`,
  text: `Review enriched metadata for ${review.results[0]?.content || task.sourceText || task.itemId}`,
  results: review.results.map(result => ({
    ...result,
    reviewReason: result.reviewReason || 'Background enrichment found ambiguous canonical metadata.',
    canonicalReview: (result.canonicalReview || []).filter(suggestion => REVIEW_FIELDS.includes(suggestion.field)),
  })),
  originalResults: review.originalResults.map(result => ({
    ...result,
    reviewReason: result.reviewReason || 'Background enrichment found ambiguous canonical metadata.',
    canonicalReview: (result.canonicalReview || []).filter(suggestion => REVIEW_FIELDS.includes(suggestion.field)),
  })),
});

export const isEnrichableItem = (item: BrainDumpItem) => {
  if (!ENRICHABLE_TYPES.has(item.type)) return false;
  if (item.meta?.parserNeedsReview) return false;
  return true;
};

export function queueCanonicalEnrichmentTasks(params: {
  items: BrainDumpItem[];
  itemIds: string[];
  parserTaskId?: string;
  sourceText?: string;
  now?: number;
}): EnrichmentTask[] {
  const now = params.now ?? Date.now();
  const seen = new Set<string>();

  return params.itemIds.flatMap(itemId => {
    if (seen.has(itemId)) return [];
    seen.add(itemId);

    const item = params.items.find(candidate => candidate.id === itemId);
    if (!item || !isEnrichableItem(item)) return [];

    return [{
      id: `enrich-${params.parserTaskId || 'manual'}-${item.id}`,
      itemId: item.id,
      parserTaskId: params.parserTaskId,
      sourceText: params.sourceText,
      status: 'pending' as const,
      baseMeta: clone(item.meta || {}),
      attempts: 0,
      createdAt: now,
    }];
  });
}

const mergeCanonicalMeta = (
  currentCanonical: ItemCanonicalMeta | undefined,
  baseCanonical: ItemCanonicalMeta | undefined,
  enrichedCanonical: ItemCanonicalMeta | undefined,
  appliedFields: string[],
): ItemCanonicalMeta | undefined => {
  const merged: ItemCanonicalMeta = { ...(currentCanonical || {}) };

  (['merchant', 'paymentMethod', 'commodity', 'subcommodity', 'label', 'family'] as CanonicalField[]).forEach(field => {
    const nextValue = enrichedCanonical?.[field];
    if (!nextValue || nextValue.needsReview) return;

    const currentValue = currentCanonical?.[field];
    const baseValue = baseCanonical?.[field];

    if (same(currentValue, nextValue)) return;
    if (currentValue?.source === 'manual_review') return;
    if (currentValue && !same(currentValue, baseValue)) return;
    if (!currentValue || same(currentValue, baseValue)) {
      merged[field] = nextValue;
      appliedFields.push(`canonical.${field}`);
    }
  });

  return Object.keys(merged).length > 0 ? merged : undefined;
};

const mergeEnrichedItem = (
  current: BrainDumpItem,
  baseMeta: ItemMeta,
  enriched: BrainDumpItem,
  task: EnrichmentTask,
  reviewCount: number,
): { item: BrainDumpItem; appliedFields: string[] } => {
  const appliedFields: string[] = [];
  const nextMeta: ItemMeta = { ...current.meta };

  MERGE_SAFE_META_FIELDS.forEach(field => {
    const enrichedValue = enriched.meta?.[field];
    if (!present(enrichedValue)) return;

    const currentValue = current.meta?.[field];
    const baseValue = baseMeta?.[field];
    if (same(currentValue, enrichedValue)) return;

    if (!present(currentValue) || same(currentValue, baseValue)) {
      (nextMeta as Record<string, unknown>)[field] = enrichedValue;
      appliedFields.push(String(field));
    }
  });

  const canonical = mergeCanonicalMeta(
    current.meta?.canonical,
    baseMeta?.canonical,
    enriched.meta?.canonical,
    appliedFields,
  );

  if (canonical) nextMeta.canonical = canonical;

  if (appliedFields.length > 0 || reviewCount > 0) {
    nextMeta.enrichment = {
      status: appliedFields.length > 0 ? 'applied' : 'review',
      version: ASYNC_ENRICHMENT_VERSION,
      taskId: task.id,
      parserTaskId: task.parserTaskId,
      updatedAt: new Date(task.completedAt || Date.now()).toISOString(),
      appliedFields,
      reviewCount,
    };
  }

  return {
    item: {
      ...current,
      meta: nextMeta,
    },
    appliedFields,
  };
};

export function runCanonicalEnrichmentTasks(params: {
  items: BrainDumpItem[];
  tasks: EnrichmentTask[];
  ctx: CanonicalizerContext;
  now?: number;
}): {
  items: BrainDumpItem[];
  reviews: HistoricalCanonicalReview[];
  taskResults: EnrichmentTask[];
  changedItemIds: string[];
} {
  let nextItems: BrainDumpItem[] = params.items.map(item => ({ ...item, meta: { ...item.meta, canonical: item.meta?.canonical ? { ...item.meta.canonical } : item.meta?.canonical } }));
  const reviews: HistoricalCanonicalReview[] = [];
  const changedItemIds: string[] = [];
  const completedAt = params.now ?? Date.now();

  const taskResults = params.tasks.map(task => {
    const current = nextItems.find(item => item.id === task.itemId);
    if (!current) {
      return { ...task, status: 'skipped' as const, attempts: task.attempts + 1, completedAt, error: 'Item no longer exists' };
    }

    if (!isEnrichableItem(current)) {
      return { ...task, status: 'skipped' as const, attempts: task.attempts + 1, completedAt, error: 'Item is not eligible for enrichment' };
    }

    const sweep = sweepHistoricalCanonicalMeta([current], {
      ...params.ctx,
      existingItems: params.ctx.existingItems.length > 0 ? params.ctx.existingItems : nextItems,
    });

    const reviewCount = getCanonicalReviewCount(sweep.reviews, current.id);
    sweep.reviews.map(review => normalizeReview(review, task)).forEach(review => {
      if (!reviews.some(existing => existing.id === review.id)) reviews.push(review);
    });

    const enriched = sweep.items[0];
    const merged = mergeEnrichedItem(current, task.baseMeta || {}, enriched, { ...task, completedAt }, reviewCount);

    if (!same(merged.item.meta, current.meta)) {
      nextItems = nextItems.map(item => item.id === current.id ? merged.item : item);
      changedItemIds.push(current.id);
    }

    const status: EnrichmentTask['status'] = reviewCount > 0 ? 'review' : 'success';
    return {
      ...task,
      status,
      attempts: task.attempts + 1,
      completedAt,
      appliedFields: merged.appliedFields,
      reviewCount,
    };
  });

  return { items: nextItems, reviews, taskResults, changedItemIds };
}

export function collectCanonicalReviewSuggestions(reviews: HistoricalCanonicalReview[]): CanonicalReviewSuggestion[] {
  return reviews.flatMap(review => review.originalResults.flatMap(result => result.canonicalReview || []));
}
