import { BrainDumpItem } from '../types';

type PendingGroups = {
  today: BrainDumpItem[];
  tomorrow: BrainDumpItem[];
  later: BrainDumpItem[];
  routines: BrainDumpItem[];
};

export type SummaryFocusDisplay = {
  displayItems: BrainDumpItem[];
  displayTitle: string;
  displaySubtitle: string | null;
  isDoneState: boolean;
};

const addUnique = (target: BrainDumpItem[], seen: Set<string>, items: BrainDumpItem[], limit: number) => {
  for (const item of items) {
    if (target.length >= limit) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    target.push(item);
  }
};

export const buildMixedTodayFocusItems = (
  urgentShoppingItems: BrainDumpItem[],
  todayFocusItems: BrainDumpItem[],
  limit = 5
): BrainDumpItem[] => {
  if (limit <= 0) return [];
  if (urgentShoppingItems.length === 0) return todayFocusItems.slice(0, limit);
  if (todayFocusItems.length === 0) return urgentShoppingItems.slice(0, limit);

  const result: BrainDumpItem[] = [];
  const seen = new Set<string>();
  const initialShoppingSlots = Math.min(urgentShoppingItems.length, Math.ceil(limit / 2));

  addUnique(result, seen, urgentShoppingItems.slice(0, initialShoppingSlots), limit);
  addUnique(result, seen, todayFocusItems, limit);
  addUnique(result, seen, urgentShoppingItems.slice(initialShoppingSlots), limit);

  return result;
};

export const buildSummaryFocusDisplay = (
  items: BrainDumpItem[],
  pendingGroups: PendingGroups,
  urgentShoppingItems: BrainDumpItem[],
  limit = 5
): SummaryFocusDisplay => {
  const todayItems = buildMixedTodayFocusItems(urgentShoppingItems, pendingGroups.today, limit);

  if (todayItems.length > 0) {
    return {
      displayItems: todayItems,
      displayTitle: "Today's Focus",
      displaySubtitle: null,
      isDoneState: false,
    };
  }

  if (pendingGroups.tomorrow.length > 0) {
    return {
      displayItems: pendingGroups.tomorrow.slice(0, limit),
      displayTitle: 'Tomorrow',
      displaySubtitle: "Get a head start on tomorrow's tasks.",
      isDoneState: false,
    };
  }

  const pendingRoutines = pendingGroups.routines.filter(routine => routine.status === 'pending');
  if (pendingRoutines.length > 0) {
    return {
      displayItems: pendingRoutines.slice(0, limit),
      displayTitle: 'Daily Rituals',
      displaySubtitle: 'Keep your momentum going.',
      isDoneState: false,
    };
  }

  if (pendingGroups.later.length > 0) {
    return {
      displayItems: pendingGroups.later.slice(0, limit),
      displayTitle: 'Upcoming',
      displaySubtitle: 'Tasks waiting for your attention.',
      isDoneState: false,
    };
  }

  const recentDone = items
    .filter(item => item.type === 'TODO' && item.status === 'done' && item.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 3);

  if (recentDone.length > 0) {
    return {
      displayItems: recentDone,
      displayTitle: 'Recently Completed',
      displaySubtitle: "Great job! You're all caught up.",
      isDoneState: true,
    };
  }

  return {
    displayItems: [],
    displayTitle: 'All Clear',
    displaySubtitle: 'Take a break or plan ahead.',
    isDoneState: false,
  };
};
