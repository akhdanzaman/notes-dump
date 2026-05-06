import { BrainDumpItem, ItemType } from '../types';
import { getShoppingDueDate } from './shoppingDateUtils';

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

type FocusKind = 'focus' | 'shopping';

type SummaryFocusCandidate = {
  item: BrainDumpItem;
  kind: FocusKind;
  dueTime: number;
  sequence: number;
};

const getValidDateTime = (value?: string) => {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Infinity;
};

const getFocusDueTime = (item: BrainDumpItem) => getValidDateTime(item.meta.start || item.meta.date || item.meta.dateTime);
const getShoppingDueTime = (item: BrainDumpItem) => getValidDateTime(getShoppingDueDate(item));
const isRootFocusItem = (item: BrainDumpItem) => !item.meta.parentTodoId;

const compareCandidates = (left: SummaryFocusCandidate, right: SummaryFocusCandidate) => {
  if (left.dueTime !== right.dueTime) return left.dueTime - right.dueTime;

  // Same due date: focus tasks/events are usually more actionable than shopping reminders.
  if (left.kind !== right.kind) return left.kind === 'focus' ? -1 : 1;

  return left.sequence - right.sequence;
};

const addUniqueCandidate = (
  target: SummaryFocusCandidate[],
  seen: Set<string>,
  candidate: SummaryFocusCandidate,
  limit: number
) => {
  if (target.length >= limit || seen.has(candidate.item.id)) return;
  seen.add(candidate.item.id);
  target.push(candidate);
};

const addUniqueCandidates = (
  target: SummaryFocusCandidate[],
  seen: Set<string>,
  candidates: SummaryFocusCandidate[],
  limit: number
) => {
  for (const candidate of candidates) {
    addUniqueCandidate(target, seen, candidate, limit);
    if (target.length >= limit) break;
  }
};

export const buildMixedTodayFocusItems = (
  urgentShoppingItems: BrainDumpItem[],
  todayFocusItems: BrainDumpItem[],
  limit = 5,
  upcomingFocusItems: BrainDumpItem[] = []
): BrainDumpItem[] => {
  if (limit <= 0) return [];

  const pendingUrgentShopping = urgentShoppingItems.filter(item => item.status === 'pending');
  const focusCandidates = [...todayFocusItems, ...upcomingFocusItems].filter(item => item.status === 'pending' && isRootFocusItem(item));

  const focus = focusCandidates.map((item, sequence): SummaryFocusCandidate => ({
    item,
    kind: 'focus',
    dueTime: getFocusDueTime(item),
    sequence,
  })).sort(compareCandidates);

  const shopping = pendingUrgentShopping.map((item, sequence): SummaryFocusCandidate => ({
    item,
    kind: 'shopping',
    dueTime: getShoppingDueTime(item),
    sequence,
  })).sort(compareCandidates);

  if (focus.length === 0) return shopping.slice(0, limit).map(candidate => candidate.item);
  if (shopping.length === 0) return focus.slice(0, limit).map(candidate => candidate.item);

  // Rule for Summary > Today's Focus:
  // 1. Show both worlds when both exist: at least one focus task/event and one urgent shopping item.
  // 2. Fill the rest by nearest due date across focus + urgent shopping.
  // 3. If dates tie, focus tasks/events win before shopping.
  // 4. Undated urgent shopping is allowed, but it sorts after dated focus/shopping.
  const result: SummaryFocusCandidate[] = [];
  const seen = new Set<string>();

  addUniqueCandidate(result, seen, focus[0], limit);
  addUniqueCandidate(result, seen, shopping[0], limit);
  addUniqueCandidates(result, seen, [...focus.slice(1), ...shopping.slice(1)].sort(compareCandidates), limit);

  return result.sort(compareCandidates).map(candidate => candidate.item);
};

export const buildSummaryFocusDisplay = (
  items: BrainDumpItem[],
  pendingGroups: PendingGroups,
  urgentShoppingItems: BrainDumpItem[],
  limit = 5
): SummaryFocusDisplay => {
  const pendingUrgentShopping = urgentShoppingItems.filter(item => item.status === 'pending');
  const pendingTodayFocus = pendingGroups.today.filter(item => item.status === 'pending' && isRootFocusItem(item));
  const shouldBuildTodayFocus = pendingTodayFocus.length > 0 || pendingUrgentShopping.length > 0;

  if (shouldBuildTodayFocus) {
    const todayItems = buildMixedTodayFocusItems(
      pendingUrgentShopping,
      pendingTodayFocus,
      limit,
      [...pendingGroups.tomorrow, ...pendingGroups.later].filter(isRootFocusItem)
    );

    return {
      displayItems: todayItems,
      displayTitle: "Today's Focus",
      displaySubtitle: null,
      isDoneState: false,
    };
  }

  const rootTomorrow = pendingGroups.tomorrow.filter(isRootFocusItem);
  if (rootTomorrow.length > 0) {
    return {
      displayItems: rootTomorrow.slice(0, limit),
      displayTitle: 'Tomorrow',
      displaySubtitle: "Get a head start on tomorrow's tasks.",
      isDoneState: false,
    };
  }

  const pendingRoutines = pendingGroups.routines.filter(routine => routine.status === 'pending' && isRootFocusItem(routine));
  if (pendingRoutines.length > 0) {
    return {
      displayItems: pendingRoutines.slice(0, limit),
      displayTitle: 'Daily Rituals',
      displaySubtitle: 'Keep your momentum going.',
      isDoneState: false,
    };
  }

  const rootLater = pendingGroups.later.filter(isRootFocusItem);
  if (rootLater.length > 0) {
    return {
      displayItems: rootLater.slice(0, limit),
      displayTitle: 'Upcoming',
      displaySubtitle: 'Tasks waiting for your attention.',
      isDoneState: false,
    };
  }

  const recentDone = items
    .filter(item => item.type === ItemType.TODO && item.status === 'done' && item.completed_at)
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
