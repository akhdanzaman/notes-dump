import { BrainDumpItem, ItemType } from '../types';

export interface SemanticDuplicateReviewCandidate {
  itemIds: string[];
  itemType: ItemType;
  signature: string;
  reason: string;
}

export interface BrainDumpDedupeResult {
  items: BrainDumpItem[];
  removedCount: number;
  duplicateIds: Array<{ id: string; count: number }>;
  reviewCandidates: SemanticDuplicateReviewCandidate[];
}

const normalizeText = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('en-US');

const normalizeItemId = (value: unknown) => normalizeText(value);

const normalizeDateToSecond = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return normalizeText(raw);
  return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

const normalizeTags = (value: unknown) => {
  if (!Array.isArray(value)) return '';
  return Array.from(new Set(value.map(tag => normalizeText(tag)).filter(Boolean))).sort().join('|');
};

const normalizeNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '';
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : '';
};

const normalizedForStableJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizedForStableJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, normalizedForStableJson(nested)])
    );
  }
  return value;
};

const stableItemSignature = (item: BrainDumpItem) => JSON.stringify(normalizedForStableJson(item));

const populatedValueCount = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return 0;
  if (Array.isArray(value)) return value.reduce((sum, nested) => sum + populatedValueCount(nested), 0);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .reduce<number>((sum, nested) => sum + populatedValueCount(nested), 0);
  }
  return 1;
};

const timestamp = (value: unknown): number => {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareCanonicalCandidates = (a: BrainDumpItem, b: BrainDumpItem): number => {
  const completenessDelta = populatedValueCount(b) - populatedValueCount(a);
  if (completenessDelta) return completenessDelta;

  const aDone = a.status === 'done' ? 1 : 0;
  const bDone = b.status === 'done' ? 1 : 0;
  if (aDone !== bDone) return bDone - aDone;

  const completionDelta = timestamp(b.completed_at) - timestamp(a.completed_at);
  if (completionDelta) return completionDelta;

  const createdDelta = timestamp(b.created_at) - timestamp(a.created_at);
  if (createdDelta) return createdDelta;

  return stableItemSignature(a).localeCompare(stableItemSignature(b));
};

const eventReviewKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  normalizeDateToSecond(item.meta.date),
  normalizeDateToSecond(item.meta.start),
  normalizeDateToSecond(item.meta.end),
  normalizeTags(item.meta.tags),
].join('::');

const shoppingReviewKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  normalizeText(item.meta.shoppingCategory),
  item.status,
  normalizeDateToSecond(item.meta.date),
  normalizeNumber(item.meta.amount),
  normalizeNumber(item.meta.quantity),
  normalizeTags(item.meta.tags),
].join('::');

const financeReviewKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  item.status,
  normalizeText(item.meta.financeType),
  normalizeDateToSecond(item.meta.date || item.completed_at),
  normalizeNumber(item.meta.amount),
  normalizeText(item.meta.paymentMethod),
  normalizeText(item.meta.toWallet),
  normalizeText(item.meta.budgetCategory),
  normalizeText(item.meta.merchant),
].join('::');

const noteReviewKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  item.status,
  normalizeDateToSecond(item.meta.date || item.created_at),
  normalizeText(item.meta.title),
  normalizeTags(item.meta.tags),
].join('::');

const todoReviewKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  item.status,
  normalizeDateToSecond(item.meta.date),
  normalizeText(item.meta.priority),
  normalizeTags(item.meta.tags),
].join('::');

const isSemanticReviewCandidate = (item: BrainDumpItem) => {
  if (!normalizeText(item.content)) return false;
  if (item.type === ItemType.EVENT) return Boolean(normalizeDateToSecond(item.meta.date) || normalizeDateToSecond(item.meta.start));
  if (item.type === ItemType.SHOPPING) return Boolean(normalizeText(item.meta.shoppingCategory) || normalizeDateToSecond(item.meta.date) || item.meta.amount !== undefined);
  if (item.type === ItemType.FINANCE) return Boolean(item.meta.amount !== undefined && (item.meta.date || item.completed_at));
  if (item.type === ItemType.NOTE || item.type === ItemType.JOURNAL) return Boolean(normalizeDateToSecond(item.meta.date || item.created_at));
  if (item.type === ItemType.TODO) return Boolean(normalizeDateToSecond(item.meta.date));
  return false;
};

const semanticReviewKey = (item: BrainDumpItem) => {
  if (item.type === ItemType.EVENT) return eventReviewKey(item);
  if (item.type === ItemType.SHOPPING) return shoppingReviewKey(item);
  if (item.type === ItemType.FINANCE) return financeReviewKey(item);
  if (item.type === ItemType.NOTE || item.type === ItemType.JOURNAL) return noteReviewKey(item);
  if (item.type === ItemType.TODO) return todoReviewKey(item);
  return '';
};

export const findSemanticDuplicateReviewCandidates = (
  items: BrainDumpItem[],
): SemanticDuplicateReviewCandidate[] => {
  const groups = new Map<string, BrainDumpItem[]>();

  items.forEach(item => {
    if (!isSemanticReviewCandidate(item)) return;
    const signature = semanticReviewKey(item);
    const group = groups.get(signature) || [];
    group.push(item);
    groups.set(signature, group);
  });

  return Array.from(groups.entries())
    .filter(([, group]) => new Set(group.map(item => normalizeItemId(item.id))).size > 1)
    .map(([signature, group]) => ({
      signature,
      itemType: group[0].type,
      itemIds: Array.from(new Set(group.map(item => item.id))).sort((a, b) => a.localeCompare(b)),
      reason: 'Different item IDs share the same normalized business fields; keep all rows until a user reviews them.',
    }))
    .sort((a, b) => a.itemType.localeCompare(b.itemType) || a.itemIds.join('|').localeCompare(b.itemIds.join('|')));
};

export const dedupeBrainDumpItems = (items: BrainDumpItem[]): BrainDumpDedupeResult => {
  const groupsById = new Map<string, BrainDumpItem[]>();
  const idOrder: string[] = [];
  const idlessItems = new Map<number, BrainDumpItem>();

  items.forEach((item, index) => {
    const id = normalizeItemId(item.id);
    if (!id) {
      idlessItems.set(index, item);
      return;
    }
    if (!groupsById.has(id)) idOrder.push(id);
    const group = groupsById.get(id) || [];
    group.push(item);
    groupsById.set(id, group);
  });

  const canonicalById = new Map<string, BrainDumpItem>();
  const duplicateIds: Array<{ id: string; count: number }> = [];
  groupsById.forEach((group, id) => {
    canonicalById.set(id, [...group].sort(compareCanonicalCandidates)[0]);
    if (group.length > 1) duplicateIds.push({ id: group[0].id, count: group.length });
  });

  const emittedIds = new Set<string>();
  const dedupedItems: BrainDumpItem[] = [];
  items.forEach((item, index) => {
    const id = normalizeItemId(item.id);
    if (!id) {
      dedupedItems.push(idlessItems.get(index)!);
      return;
    }
    if (emittedIds.has(id)) return;
    emittedIds.add(id);
    dedupedItems.push(canonicalById.get(id)!);
  });

  duplicateIds.sort((a, b) => normalizeItemId(a.id).localeCompare(normalizeItemId(b.id)));

  return {
    items: dedupedItems,
    removedCount: duplicateIds.reduce((sum, duplicate) => sum + duplicate.count - 1, 0),
    duplicateIds,
    reviewCandidates: findSemanticDuplicateReviewCandidates(dedupedItems),
  };
};

