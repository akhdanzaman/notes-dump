import { BrainDumpItem, Skill } from '../types';

export interface BehaviorDriftInsight {
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  iconType: 'finance' | 'task' | 'shopping' | 'skill';
}

type ScoredBehaviorDriftInsight = BehaviorDriftInsight & { score: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const FOOD_TAGS = new Set(['food', 'breakfast', 'lunch', 'dinner', 'snack']);

const fmt = (n: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(n);

const getItemTimestamp = (item: BrainDumpItem) => {
  const raw = item.completed_at || item.meta.date || item.created_at;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const getCreatedTimestamp = (item: BrainDumpItem) => {
  const ts = new Date(item.created_at).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const getCompletedTimestamp = (item: BrainDumpItem) => {
  if (!item.completed_at) return null;
  const ts = new Date(item.completed_at).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const inRange = (ts: number | null, start: number, end: number) => ts !== null && ts >= start && ts < end;

const getExpenseItems = (items: BrainDumpItem[]) => items.filter(item => {
  const amount = item.meta.amount || 0;
  return item.type === 'FINANCE' && item.meta.financeType === 'expense' && amount > 0;
});

const getTasks = (items: BrainDumpItem[]) => items.filter(item =>
  (item.type === 'TODO' || item.type === 'EVENT') && !item.meta.isRoutine
);

const getSkillLogs = (items: BrainDumpItem[]) => items.filter(item => {
  const duration = item.meta.durationMinutes || 0;
  return duration > 0 && (item.type === 'SKILL_LOG' || !!item.meta.skillId || !!item.meta.skillName);
});

export const generateBehaviorDriftInsights = (
  items: BrainDumpItem[],
  skills: Skill[],
  maxInsights = 3
): BehaviorDriftInsight[] => {
  const drifts: ScoredBehaviorDriftInsight[] = [];
  const now = new Date();
  const todayStart = startOfDay(now.getTime());
  const last3Start = todayStart - (3 * DAY_MS);
  const last7Start = todayStart - (7 * DAY_MS);
  const previous7Start = todayStart - (14 * DAY_MS);
  const last14Start = todayStart - (14 * DAY_MS);

  const expenseItems = getExpenseItems(items);

  // 1) Food spend stayed elevated for 3 straight days.
  const foodSpendByDay = new Map<number, number>();
  expenseItems.forEach(item => {
    const tags = (item.meta.tags || []).map(tag => tag.toLowerCase());
    if (!tags.some(tag => FOOD_TAGS.has(tag))) return;
    const ts = getItemTimestamp(item);
    if (ts === null || ts >= todayStart || ts < previous7Start) return;
    const day = startOfDay(ts);
    foodSpendByDay.set(day, (foodSpendByDay.get(day) || 0) + (item.meta.amount || 0));
  });

  const recentFoodDaily = [0, 1, 2].map(offset => foodSpendByDay.get(last3Start + (offset * DAY_MS)) || 0);
  const previousFoodTotal = Array.from({ length: 7 }, (_, idx) => foodSpendByDay.get(previous7Start + (idx * DAY_MS)) || 0)
    .reduce((sum, value) => sum + value, 0);
  const previousFoodAverage = previousFoodTotal / 7;
  const recentFoodTotal = recentFoodDaily.reduce((sum, value) => sum + value, 0);
  const recentFoodAverage = recentFoodTotal / 3;

  const foodThreshold = Math.max(20000, previousFoodAverage * 1.5);
  if (
    recentFoodTotal >= 75000 &&
    recentFoodDaily.every(value => value >= foodThreshold) &&
    recentFoodDaily.some(value => value > 0)
  ) {
    drifts.push({
      type: 'warning',
      title: 'Food Spend Drift',
      message: previousFoodAverage > 0
        ? `Food spend stayed hot for 3 straight days: ${fmt(recentFoodTotal)} total vs your usual ${fmt(previousFoodAverage)}/day.`
        : `Food spend stayed hot for 3 straight days: ${fmt(recentFoodTotal)} total over the last 72 hours.`,
      iconType: 'finance',
      score: recentFoodAverage + (previousFoodAverage > 0 ? (recentFoodAverage / previousFoodAverage) * 10000 : 25000),
    });
  }

  // 2) Wants spending woke up again.
  const wantsLast7 = expenseItems.filter(item =>
    item.meta.budgetCategory === 'wants' && inRange(getItemTimestamp(item), last7Start, todayStart)
  );
  const wantsPrevious7 = expenseItems.filter(item =>
    item.meta.budgetCategory === 'wants' && inRange(getItemTimestamp(item), previous7Start, last7Start)
  );

  const wantsLast7Total = wantsLast7.reduce((sum, item) => sum + (item.meta.amount || 0), 0);
  const wantsPrevious7Total = wantsPrevious7.reduce((sum, item) => sum + (item.meta.amount || 0), 0);

  if (
    wantsLast7.length >= 2 &&
    wantsLast7Total >= 100000 &&
    (wantsPrevious7.length === 0 || wantsLast7Total >= Math.max(100000, wantsPrevious7Total * 2))
  ) {
    drifts.push({
      type: 'warning',
      title: 'Wants Reactivated',
      message: wantsPrevious7Total > 0
        ? `Wants spending woke back up: ${fmt(wantsLast7Total)} across ${wantsLast7.length} buys in the last 7 days vs ${fmt(wantsPrevious7Total)} the week before.`
        : `Wants spending woke back up: ${fmt(wantsLast7Total)} across ${wantsLast7.length} buys in the last 7 days after a quiet week before.`,
      iconType: 'finance',
      score: wantsLast7Total + (wantsPrevious7Total > 0 ? (wantsLast7Total / wantsPrevious7Total) * 5000 : 15000),
    });
  }

  // 3) Task intake rose while throughput slipped.
  const tasks = getTasks(items);
  const createdLast7 = tasks.filter(item => inRange(getCreatedTimestamp(item), last7Start, todayStart));
  const createdPrevious7 = tasks.filter(item => inRange(getCreatedTimestamp(item), previous7Start, last7Start));
  const completedLast7 = tasks.filter(item => item.status === 'done' && inRange(getCompletedTimestamp(item), last7Start, todayStart));
  const completedPrevious7 = tasks.filter(item => item.status === 'done' && inRange(getCompletedTimestamp(item), previous7Start, last7Start));

  const createdLast7Count = createdLast7.length;
  const createdPrevious7Count = createdPrevious7.length;
  const completedLast7Count = completedLast7.length;
  const completedPrevious7Count = completedPrevious7.length;
  const completionRateLast7 = createdLast7Count > 0 ? completedLast7Count / createdLast7Count : 1;
  const completionRatePrevious7 = createdPrevious7Count > 0 ? completedPrevious7Count / createdPrevious7Count : 1;

  if (
    createdLast7Count >= Math.max(4, createdPrevious7Count + 2) &&
    completionRateLast7 <= Math.max(0.25, completionRatePrevious7 - 0.25) &&
    completedLast7Count <= completedPrevious7Count
  ) {
    drifts.push({
      type: 'warning',
      title: 'Task Throughput Drift',
      message: `Tasks added jumped to ${createdLast7Count} this week, but only ${completedLast7Count} were closed. Last week was ${createdPrevious7Count} in and ${completedPrevious7Count} done.`,
      iconType: 'task',
      score: (createdLast7Count - completedLast7Count) * 1000 + (completionRatePrevious7 - completionRateLast7) * 1000,
    });
  }

  // 4) Skill practice went quiet for 2 weeks.
  const skillLogs = getSkillLogs(items);
  const neglectedSkills = skills.filter(skill => {
    if (!skill.weeklyTargetMinutes || skill.weeklyTargetMinutes <= 0) return false;

    const recentMinutes = skillLogs
      .filter(item => {
        const ts = getItemTimestamp(item);
        if (!inRange(ts, last14Start, todayStart + DAY_MS)) return false;
        return item.meta.skillId === skill.id || item.meta.skillName === skill.name;
      })
      .reduce((sum, item) => sum + (item.meta.durationMinutes || 0), 0);

    return recentMinutes === 0;
  });

  if (neglectedSkills.length > 0) {
    const preview = neglectedSkills.slice(0, 2).map(skill => skill.name).join(', ');
    drifts.push({
      type: 'info',
      title: 'Skill Stagnation',
      message: neglectedSkills.length === 1
        ? `${preview} has had no practice logged in the last 14 days.`
        : `${preview}${neglectedSkills.length > 2 ? ' and more' : ''} have had no practice logged in the last 14 days.`,
      iconType: 'skill',
      score: neglectedSkills.length * 3000,
    });
  }

  return drifts
    .sort((a, b) => b.score - a.score)
    .slice(0, maxInsights)
    .map(({ score, ...insight }) => insight);
};
