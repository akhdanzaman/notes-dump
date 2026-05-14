import { BrainDumpItem, ItemType, Priority } from '../types';

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeDate = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
};

const normalizeTags = (value: unknown) => {
  if (!Array.isArray(value)) return '';
  return Array.from(new Set(value.map(tag => normalizeText(tag)).filter(Boolean))).sort().join('|');
};

const normalizeNumber = (value: unknown) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? String(num) : '';
};

const priorityRank: Record<Priority, number> = { low: 0, normal: 1, high: 2 };

const maxPriority = (items: BrainDumpItem[]): Priority | undefined => {
  return items.reduce<Priority | undefined>((best, item) => {
    const candidate = item.meta.priority;
    if (!candidate) return best;
    if (!best) return candidate;
    return priorityRank[candidate] > priorityRank[best] ? candidate : best;
  }, undefined);
};

const eventDedupeKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  normalizeDate(item.meta.date),
  normalizeDate(item.meta.start),
  normalizeDate(item.meta.end),
  normalizeTags(item.meta.tags),
].join('::');

const shoppingDedupeKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  normalizeText(item.meta.shoppingCategory),
  item.meta.shoppingCategory === 'routine' ? 'routine-parent' : `${item.status}::${normalizeDate(item.meta.date)}`,
  normalizeNumber(item.meta.amount),
  normalizeNumber(item.meta.quantity),
  normalizeTags(item.meta.tags),
].join('::');

const financeDedupeKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  item.status,
  normalizeText(item.meta.financeType),
  normalizeDate(item.meta.date || item.completed_at),
  normalizeNumber(item.meta.amount),
  normalizeText(item.meta.paymentMethod),
  normalizeText(item.meta.toWallet),
].join('::');

const noteDedupeKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  item.status,
  normalizeDate(item.meta.date || item.created_at),
  normalizeText(item.meta.title),
  normalizeTags(item.meta.tags),
].join('::');

const todoDedupeKey = (item: BrainDumpItem) => [
  item.type,
  normalizeText(item.content),
  item.status,
  normalizeDate(item.meta.date),
  normalizeText(item.meta.priority),
  normalizeTags(item.meta.tags),
].join('::');

const isObviousSemanticDuplicateCandidate = (item: BrainDumpItem) => {
  if (!normalizeText(item.content)) return false;
  if (item.type === ItemType.EVENT) return Boolean(normalizeDate(item.meta.date) || normalizeDate(item.meta.start));
  if (item.type === ItemType.SHOPPING) return Boolean(normalizeText(item.meta.shoppingCategory) || normalizeDate(item.meta.date) || item.meta.amount !== undefined);
  if (item.type === ItemType.FINANCE) return Boolean(item.meta.amount !== undefined && (item.meta.date || item.completed_at));
  if (item.type === ItemType.NOTE || item.type === ItemType.JOURNAL) return Boolean(normalizeDate(item.meta.date || item.created_at));
  if (item.type === ItemType.TODO) return Boolean(normalizeText(item.content) && normalizeDate(item.meta.date));
  return false;
};

const semanticDedupeKey = (item: BrainDumpItem) => {
  if (item.type === ItemType.EVENT) return eventDedupeKey(item);
  if (item.type === ItemType.SHOPPING) return shoppingDedupeKey(item);
  if (item.type === ItemType.FINANCE) return financeDedupeKey(item);
  if (item.type === ItemType.NOTE || item.type === ItemType.JOURNAL) return noteDedupeKey(item);
  if (item.type === ItemType.TODO) return todoDedupeKey(item);
  return `${item.type}::${item.id}`;
};

const pickPrimaryEvent = (items: BrainDumpItem[]) => {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? -1 : 1;
    const aCompleted = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bCompleted = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    if (aCompleted !== bCompleted) return bCompleted - aCompleted;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
};

const mergeDuplicateEvents = (items: BrainDumpItem[]) => {
  const primary = pickPrimaryEvent(items);
  const allTags = Array.from(new Set(items.flatMap(item => item.meta.tags || [])));
  const completedAt = items
    .map(item => item.completed_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const createdAt = items
    .map(item => item.created_at)
    .filter(Boolean)
    .sort()[0] || primary.created_at;

  return {
    ...primary,
    status: items.some(item => item.status === 'done') ? 'done' as const : 'pending' as const,
    created_at: createdAt,
    completed_at: completedAt,
    meta: {
      ...primary.meta,
      priority: maxPriority(items) || primary.meta.priority,
      tags: allTags,
    },
  };
};

const pickPrimaryItem = (items: BrainDumpItem[]) => {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    const aCompleted = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bCompleted = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    if (aCompleted !== bCompleted) return bCompleted - aCompleted;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
};

const mergeDuplicateItems = (items: BrainDumpItem[]) => {
  if (items[0]?.type === ItemType.EVENT) return mergeDuplicateEvents(items);
  const primary = pickPrimaryItem(items);
  const allTags = Array.from(new Set(items.flatMap(item => item.meta.tags || [])));
  const completedAt = items.map(item => item.completed_at).filter(Boolean).sort().at(-1);
  const createdAt = items.map(item => item.created_at).filter(Boolean).sort()[0] || primary.created_at;
  const routineSource = items.find(item =>
    (item.meta.shoppingCategory === 'routine' || item.meta.isRoutine)
    && (item.meta.routineInterval
      || item.meta.routineDaysOfWeek?.length
      || item.meta.routineDaysOfMonth?.length
      || item.meta.routineMonthsOfYear?.length
      || item.meta.recurrenceDays
      || item.meta.lastGeneratedHistoryId)
  );

  return {
    ...primary,
    status: items.some(item => item.status === 'pending') ? 'pending' as const : 'done' as const,
    created_at: createdAt,
    completed_at: completedAt || primary.completed_at,
    meta: {
      ...primary.meta,
      ...(routineSource ? {
        isRoutine: routineSource.meta.isRoutine ?? primary.meta.isRoutine,
        routineInterval: routineSource.meta.routineInterval ?? primary.meta.routineInterval,
        routineDaysOfWeek: routineSource.meta.routineDaysOfWeek ?? primary.meta.routineDaysOfWeek,
        routineDaysOfMonth: routineSource.meta.routineDaysOfMonth ?? primary.meta.routineDaysOfMonth,
        routineMonthsOfYear: routineSource.meta.routineMonthsOfYear ?? primary.meta.routineMonthsOfYear,
        recurrenceDays: routineSource.meta.recurrenceDays ?? primary.meta.recurrenceDays,
        lastGeneratedHistoryId: routineSource.meta.lastGeneratedHistoryId ?? primary.meta.lastGeneratedHistoryId,
      } : {}),
      priority: maxPriority(items) || primary.meta.priority,
      tags: allTags,
    },
  };
};

export const dedupeBrainDumpItems = (items: BrainDumpItem[]) => {
  const passthrough: BrainDumpItem[] = [];
  const groups = new Map<string, BrainDumpItem[]>();

  items.forEach(item => {
    if (!isObviousSemanticDuplicateCandidate(item)) {
      passthrough.push(item);
      return;
    }

    const key = semanticDedupeKey(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  });

  let removedCount = 0;
  const dedupedGroups = Array.from(groups.values()).map(group => {
    if (group.length === 1) return group[0];
    removedCount += group.length - 1;
    return mergeDuplicateItems(group);
  });

  return {
    items: [...passthrough, ...dedupedGroups],
    removedCount,
  };
};
