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

const isObviousSemanticDuplicateCandidate = (item: BrainDumpItem) => {
  if (item.type !== ItemType.EVENT) return false;
  return Boolean(normalizeText(item.content) && normalizeDate(item.meta.date));
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

export const dedupeBrainDumpItems = (items: BrainDumpItem[]) => {
  const passthrough: BrainDumpItem[] = [];
  const groups = new Map<string, BrainDumpItem[]>();

  items.forEach(item => {
    if (!isObviousSemanticDuplicateCandidate(item)) {
      passthrough.push(item);
      return;
    }

    const key = eventDedupeKey(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  });

  let removedCount = 0;
  const dedupedGroups = Array.from(groups.values()).map(group => {
    if (group.length === 1) return group[0];
    removedCount += group.length - 1;
    return mergeDuplicateEvents(group);
  });

  return {
    items: [...passthrough, ...dedupedGroups],
    removedCount,
  };
};
