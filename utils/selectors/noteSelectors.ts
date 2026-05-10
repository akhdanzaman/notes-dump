import { BrainDumpItem, ItemType, NotesSubTab, SortOrder } from '../../types';
import { getJournalDateKey, getJournalTimelineTimestamp } from '../journalUtils';

export interface JournalDayGroup {
  dateKey: string;
  journalEntries: BrainDumpItem[];
  todos: BrainDumpItem[];
  shopping: BrainDumpItem[];
  events: BrainDumpItem[];
  transactions: BrainDumpItem[];
}

const matchesTag = (item: BrainDumpItem, selectedTag: string) => !selectedTag || !!item.meta?.tags?.includes(selectedTag);

const matchesSearch = (item: BrainDumpItem, searchQuery: string) => {
  if (!searchQuery) return true;
  const lowerQ = searchQuery.toLowerCase();
  const searchable = [
    item.meta.title || '',
    item.content,
    ...(item.meta.tags || []),
    item.meta.paymentMethod || '',
    item.meta.budgetCategory || '',
    item.meta.financeType || '',
    item.meta.shoppingCategory || '',
    item.meta.skillName || '',
    item.meta.merchant || '',
    item.meta.commodity || '',
    item.meta.subcommodity || '',
  ].join(' ').toLowerCase();

  return searchable.includes(lowerQ);
};

const isWithinDateRange = (item: BrainDumpItem, filterDate: string, filterDateTo: string) => {
  if (!filterDate) return true;
  const timestamp = getJournalTimelineTimestamp(item);
  if (timestamp === null) return false;

  const startDate = new Date(filterDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = filterDateTo ? new Date(filterDateTo) : new Date(filterDate);
  endDate.setHours(23, 59, 59, 999);

  return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
};

const sortItemsByTimeline = (items: BrainDumpItem[], sortOrder: SortOrder) => {
  return [...items].sort((a, b) => {
    const left = getJournalTimelineTimestamp(a) || 0;
    const right = getJournalTimelineTimestamp(b) || 0;
    return sortOrder === 'newest' ? right - left : left - right;
  });
};

export const getNoteItems = (
  items: BrainDumpItem[],
  notesSubTab: NotesSubTab,
  selectedTag: string,
  filterDate: string,
  filterDateTo: string,
  searchQuery: string,
  sortOrder: SortOrder
) => {
  let relevantItems: BrainDumpItem[] = [];

  if (notesSubTab === 'general') {
    relevantItems = items.filter(i => i.type === ItemType.NOTE && i.status !== 'done');
  } else if (notesSubTab === 'skills') {
    relevantItems = items.filter(i => i.type === ItemType.SKILL_LOG || !!i.meta.skillId || !!i.meta.skillName);
  } else {
    relevantItems = items.filter(i => i.type === ItemType.JOURNAL);
  }

  relevantItems = relevantItems
    .filter(item => matchesTag(item, selectedTag))
    .filter(item => isWithinDateRange(item, filterDate, filterDateTo))
    .filter(item => matchesSearch(item, searchQuery));

  return relevantItems.sort((a, b) => {
    const da = a.meta.date ? new Date(a.meta.date).getTime() : new Date(a.created_at).getTime();
    const db = b.meta.date ? new Date(b.meta.date).getTime() : new Date(b.created_at).getTime();
    return sortOrder === 'newest' ? db - da : da - db;
  });
};

export const getJournalDayGroups = (
  items: BrainDumpItem[],
  selectedTag: string,
  filterDate: string,
  filterDateTo: string,
  searchQuery: string,
  sortOrder: SortOrder
): JournalDayGroup[] => {
  const sourceItems = items.filter(item => {
    if (item.type === ItemType.JOURNAL) return true;
    if (item.type === ItemType.TODO) return item.status === 'done';
    if (item.type === ItemType.SHOPPING) return item.status === 'done' && item.meta.shoppingCategory !== 'saving' && item.meta.shoppingCategory !== 'investment';
    if (item.type === ItemType.EVENT) return true;
    if (item.type === ItemType.FINANCE) return item.status === 'done';
    return false;
  });

  const groups = new Map<string, JournalDayGroup>();

  sourceItems.forEach(item => {
    const dateKey = getJournalDateKey(item);
    if (!dateKey) return;
    if (!matchesTag(item, selectedTag)) return;
    if (!isWithinDateRange(item, filterDate, filterDateTo)) return;

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        dateKey,
        journalEntries: [],
        todos: [],
        shopping: [],
        events: [],
        transactions: [],
      });
    }

    const group = groups.get(dateKey)!;

    if (item.type === ItemType.JOURNAL) group.journalEntries.push(item);
    else if (item.type === ItemType.TODO) group.todos.push(item);
    else if (item.type === ItemType.SHOPPING) group.shopping.push(item);
    else if (item.type === ItemType.EVENT) group.events.push(item);
    else if (item.type === ItemType.FINANCE) group.transactions.push(item);
  });

  let sortedGroups = Array.from(groups.values()).map(group => ({
    ...group,
    journalEntries: sortItemsByTimeline(group.journalEntries, sortOrder),
    todos: sortItemsByTimeline(group.todos, sortOrder),
    shopping: sortItemsByTimeline(group.shopping, sortOrder),
    events: sortItemsByTimeline(group.events, sortOrder),
    transactions: sortItemsByTimeline(group.transactions, sortOrder),
  }));

  if (searchQuery) {
    sortedGroups = sortedGroups.filter(group => {
      const pool = [
        ...group.journalEntries,
        ...group.todos,
        ...group.shopping,
        ...group.events,
        ...group.transactions,
      ];
      return pool.some(item => matchesSearch(item, searchQuery));
    });
  }

  sortedGroups.sort((a, b) => {
    const left = new Date(a.dateKey).getTime();
    const right = new Date(b.dateKey).getTime();
    return sortOrder === 'newest' ? right - left : left - right;
  });

  return sortedGroups;
};

export const getJournalGroups = (journalItems: BrainDumpItem[], sortOrder: SortOrder) => {
  const groups: Record<string, BrainDumpItem[]> = {};

  journalItems.forEach(item => {
    const key = getJournalDateKey(item);
    if (!key) return;

    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  Object.keys(groups).forEach(key => {
    groups[key] = sortItemsByTimeline(groups[key], sortOrder);
  });

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    return sortOrder === 'newest' ? new Date(b).getTime() - new Date(a).getTime() : new Date(a).getTime() - new Date(b).getTime();
  });

  const sortedGroups: Record<string, BrainDumpItem[]> = {};
  sortedKeys.forEach(key => sortedGroups[key] = groups[key]);

  return sortedGroups;
};
