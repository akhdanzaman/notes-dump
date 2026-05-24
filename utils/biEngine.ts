import { BrainDumpItem, ItemType, BudgetConfig, Wallet, Skill } from '../types';
import { getFinanceItems, getWalletStats } from './selectors/moneySelectors';

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

const fmt = (n: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(n);

const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

// ── helpers ──────────────────────────────────────────────

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysAgo = (n: number) => {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
};

const isExpenseItem = (item: BrainDumpItem) => {
  if (item.type === ItemType.FINANCE && item.meta.financeType === 'expense') return true;
  if ((item.type === ItemType.SHOPPING || item.type === ItemType.TODO) && item.status === 'done' && item.meta.amount && !item.meta.isRoutine) return true;
  return false;
};

const getItemDate = (item: BrainDumpItem) => {
  const raw = item.completed_at || item.meta.date || item.created_at;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? new Date(ts) : null;
};

const sumSpendingInRange = (items: BrainDumpItem[], since: Date, until: Date) => {
  let total = 0;
  for (const item of items) {
    if (!isExpenseItem(item)) continue;
    const d = getItemDate(item);
    if (d && d >= since && d < until) total += item.meta.amount || 0;
  }
  return total;
};

const countTasksInRange = (
  items: BrainDumpItem[],
  since: Date,
  until: Date,
  status: 'pending' | 'done' = 'done'
) => {
  return items.filter(i => {
    if (i.type !== ItemType.TODO) return false;
    if (i.meta.isRoutine) return false;
    if (i.status !== status) return false;
    const d = getItemDate(i);
    return d && d >= since && d < until;
  }).length;
};

const getTopCategory = (items: BrainDumpItem[], budgetConfig: BudgetConfig, since: Date, until: Date) => {
  const byCategory = new Map<string, number>();
  for (const item of items) {
    if (!isExpenseItem(item)) continue;
    const d = getItemDate(item);
    if (!d || d < since || d >= until) continue;
    const catId = item.meta.budgetCategory || 'other';
    byCategory.set(catId, (byCategory.get(catId) || 0) + (item.meta.amount || 0));
  }

  let topId = '';
  let topAmount = 0;
  for (const [id, amt] of byCategory) {
    if (amt > topAmount) { topAmount = amt; topId = id; }
  }
  const rule = budgetConfig.rules.find(r => r.id === topId);
  return { id: topId, name: rule?.name || 'Other', amount: topAmount };
};

// ── delta metrics ────────────────────────────────────────

export interface DeltaMetric {
  label: string;
  current: string;
  comparison: string;
  trend: 'up' | 'down' | 'flat';
  trendColor: 'red' | 'green' | 'neutral';
  /** e.g. "+15% vs last week" */
  subtext: string;
}

export interface NarrativeHeadline {
  /** The single-line story */
  headline: string;
  /** 1-2 sentence explanation */
  detail: string;
  tone: 'good' | 'warning' | 'neutral';
  /** Key metrics to show alongside */
  metrics: DeltaMetric[];
}

export const getNarrativeHeadline = (
  items: BrainDumpItem[],
  budgetConfig: BudgetConfig,
  wallets: Wallet[],
  _skills: Skill[]
): NarrativeHeadline => {
  const now = new Date();
  const today = startOfDay(now);

  const thisWeekStart = daysAgo(7);
  const lastWeekStart = daysAgo(14);
  const lastWeekEnd = daysAgo(7);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── spending ──
  const thisWeekSpend = sumSpendingInRange(items, thisWeekStart, today);
  const lastWeekSpend = sumSpendingInRange(items, lastWeekStart, lastWeekEnd);
  const spendingDelta = lastWeekSpend > 0 ? (thisWeekSpend - lastWeekSpend) / lastWeekSpend : 0;

  const thisMonthFinance = getFinanceItems(items, now, budgetConfig, '', '', '', '', '', '', '', 'newest');
  const totalLimits = budgetConfig.rules.reduce((acc, r) => acc + (r.percentage / 100) * budgetConfig.monthlyIncome, 0);
  const budgetPercent = totalLimits > 0 ? (thisMonthFinance.totalExpense / totalLimits) * 100 : 0;

  // ── tasks ──
  const thisWeekTasks = countTasksInRange(items, thisWeekStart, today);
  const lastWeekTasks = countTasksInRange(items, lastWeekStart, lastWeekEnd);
  const taskDelta = lastWeekTasks > 0 ? (thisWeekTasks - lastWeekTasks) / lastWeekTasks : 0;

  // ── net worth ──
  const { totalNetWorth } = getWalletStats(items, wallets);

  // ── top category ──
  const topCat = getTopCategory(items, budgetConfig, thisWeekStart, today);

  // ── also count pending tasks due today ──
  const todayPending = items.filter(i => {
    if (i.type !== ItemType.TODO) return false;
    if (i.status !== 'pending') return false;
    if (i.meta.isRoutine) return false;
    if (!i.meta.date) return false;
    const d = new Date(i.meta.date);
    return d >= today && d < new Date(today.getTime() + DAY_MS);
  }).length;

  const overdueCount = items.filter(i => {
    if (i.type !== ItemType.TODO) return false;
    if (i.status !== 'pending') return false;
    if (i.meta.isRoutine) return false;
    if (!i.meta.date) return false;
    return new Date(i.meta.date) < today;
  }).length;

  // ── build headline ──
  let headline = '';
  let detail = '';
  let tone: NarrativeHeadline['tone'] = 'neutral';

  if (budgetPercent >= 90) {
    headline = `Budget at ${budgetPercent.toFixed(0)}% — only ${fmt(totalLimits - thisMonthFinance.totalExpense)} left this month`;
    detail = `You've spent ${fmt(thisMonthFinance.totalExpense)} of your ${fmt(totalLimits)} monthly budget. ${totalLimits > 0 ? `That's ${(budgetPercent - 80).toFixed(0)}% over the warning threshold.` : ''}`;
    tone = 'warning';
  } else if (budgetPercent >= 75) {
    headline = `Budget at ${budgetPercent.toFixed(0)}% — pace yourself, ${fmt(totalLimits - thisMonthFinance.totalExpense)} remaining`;
    detail = `You're approaching your monthly limit. ${spendingDelta > 0.1 ? `This week's spending is trending up compared to last week.` : ''}`;
    tone = 'warning';
  } else if (spendingDelta > 0.3) {
    headline = `Spending up ${(spendingDelta * 100).toFixed(0)}% this week — ${fmtCompact(topCat.amount)} on ${topCat.name}`;
    detail = `${topCat.name} is your biggest category this week at ${fmt(topCat.amount)}. Last week you spent ${fmtCompact(lastWeekSpend)} total.`;
    tone = 'warning';
  } else if (spendingDelta < -0.2) {
    headline = `Spending down ${Math.abs(spendingDelta * 100).toFixed(0)}% this week — nice restraint`;
    detail = `You've spent ${fmtCompact(thisWeekSpend)} so far. ${fmtCompact(lastWeekSpend)} this time last week.`;
    tone = 'good';
  } else if (taskDelta > 0.3) {
    headline = `Strong week — ${thisWeekTasks} tasks done, up from ${lastWeekTasks} last week`;
    detail = `Momentum is building. ${todayPending > 0 ? `${todayPending} task${todayPending > 1 ? 's' : ''} due today.` : 'Nothing due today — plan ahead!'}`;
    tone = 'good';
  } else if (overdueCount > 3) {
    headline = `${overdueCount} overdue tasks need attention`;
    detail = `These were due before today and still pending. ${todayPending > 0 ? `Plus ${todayPending} due today.` : ''}`;
    tone = 'warning';
  } else if (todayPending === 0 && overdueCount === 0) {
    headline = `All clear — no tasks due today`;
    detail = `Great time to plan, review, or work ahead.`;
    tone = 'good';
  } else {
    headline = `${thisWeekTasks} tasks done this week · ${fmtCompact(thisWeekSpend)} spent`;
    detail = `${todayPending > 0 ? `${todayPending} due today. ` : ''}Top category: ${topCat.name} at ${fmt(topCat.amount)}.`;
    tone = 'neutral';
  }

  const metrics: DeltaMetric[] = [
    {
      label: 'This Week',
      current: fmt(thisWeekSpend),
      comparison: lastWeekSpend > 0 ? fmt(lastWeekSpend) : '—',
      trend: spendingDelta > 0.05 ? 'up' : spendingDelta < -0.05 ? 'down' : 'flat',
      trendColor: spendingDelta > 0.1 ? 'red' : spendingDelta < -0.05 ? 'green' : 'neutral',
      subtext: lastWeekSpend > 0 ? `${spendingDelta > 0 ? '+' : ''}${(spendingDelta * 100).toFixed(0)}% vs last week` : 'first week tracking',
    },
    {
      label: 'Tasks Done',
      current: String(thisWeekTasks),
      comparison: String(lastWeekTasks),
      trend: taskDelta > 0.05 ? 'up' : taskDelta < -0.05 ? 'down' : 'flat',
      trendColor: taskDelta > 0 ? 'green' : taskDelta < 0 ? 'red' : 'neutral',
      subtext: lastWeekTasks > 0 ? `${taskDelta > 0 ? '+' : ''}${(taskDelta * 100).toFixed(0)}% vs last week` : '',
    },
    {
      label: 'Net Worth',
      current: fmtCompact(totalNetWorth),
      comparison: '',
      trend: 'flat',
      trendColor: 'neutral',
      subtext: totalNetWorth > 0 ? 'across all wallets' : '',
    },
    {
      label: 'Budget Used',
      current: totalLimits > 0 ? `${budgetPercent.toFixed(0)}%` : '—',
      comparison: '',
      trend: budgetPercent > 80 ? 'up' : 'flat',
      trendColor: budgetPercent > 80 ? 'red' : 'neutral',
      subtext: totalLimits > 0 ? `of ${fmtCompact(totalLimits)} limit` : '',
    },
  ];

  return { headline, detail, tone, metrics };
};

// ── spending sparkline ────────────────────────────────────

export const getSpendingSparkline = (
  items: BrainDumpItem[],
  days = 7
): { values: number[]; max: number; total: number } => {
  const values: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = daysAgo(i);
    const dayEnd = daysAgo(i - 1);
    values.push(sumSpendingInRange(items, dayStart, dayEnd));
  }
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  return { values, max, total };
};
