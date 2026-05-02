import { BrainDumpItem, ItemType } from '../types';

const getValidTime = (value?: string) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

export const getJournalTimelineTimestamp = (item: BrainDumpItem): number | null => {
  switch (item.type) {
    case ItemType.JOURNAL:
      return getValidTime(item.meta.date || item.completed_at || item.created_at);
    case ItemType.TODO:
    case ItemType.SHOPPING:
    case ItemType.FINANCE:
      return getValidTime(item.completed_at || item.meta.date || item.created_at);
    case ItemType.EVENT:
      return getValidTime(item.meta.start || item.meta.date || item.created_at);
    default:
      return getValidTime(item.meta.date || item.created_at);
  }
};

export const getLocalDateKeyFromTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getJournalDateKey = (item: BrainDumpItem): string | null => {
  const timestamp = getJournalTimelineTimestamp(item);
  return timestamp === null ? null : getLocalDateKeyFromTimestamp(timestamp);
};

const mergeTags = (left: string[] = [], right: string[] = []) => Array.from(new Set([...left, ...right].filter(Boolean)));

const appendContent = (existing: string, incoming: string) => {
  const next = incoming.trim();
  if (!next) return existing;
  const prev = existing.trim();
  return prev ? `${prev}\n\n${next}` : next;
};

export const upsertDailyJournalEntry = (items: BrainDumpItem[], newEntry: BrainDumpItem): BrainDumpItem[] => {
  if (newEntry.type !== ItemType.JOURNAL) {
    return [newEntry, ...items];
  }

  const targetDateKey = getJournalDateKey(newEntry);
  if (!targetDateKey) {
    return [newEntry, ...items];
  }

  const existingIndex = items.findIndex(item => item.type === ItemType.JOURNAL && getJournalDateKey(item) === targetDateKey);
  if (existingIndex === -1) {
    return [newEntry, ...items];
  }

  return items.map((item, index) => {
    if (index !== existingIndex) return item;

    return {
      ...item,
      status: 'done',
      completed_at: newEntry.completed_at || item.completed_at,
      content: appendContent(item.content, newEntry.content),
      meta: {
        ...item.meta,
        ...newEntry.meta,
        date: item.meta.date || newEntry.meta.date || newEntry.created_at,
        tags: mergeTags(item.meta.tags, newEntry.meta.tags),
      }
    };
  });
};
