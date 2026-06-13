import { BrainDumpItem, Skill, Wallet, BudgetConfig, AppSettings, ItemType, ChatMessage, CanonicalRule } from '../types';
import { getCanonicalOrRawItemValue, getCanonicalMetaValue } from './canonicalization/accessors';
import { getCommodityForItemAnalytics, getSubcommodityForItemAnalytics } from './canonicalization/transactionInference';
import { encodeSubtasksForSheet, getDeepWorkChildren } from './deepWorkTodoModel';
import { ACHIEVED_GOAL_FINANCE_TYPE } from './financeTypeUtils';
import { getShoppingDueDate, getShoppingTimelineDate, getShoppingTransactionDate } from './shoppingDateUtils';
import {
  buildDailyMoneyDriverSummary,
  buildDataQualityIssues,
  buildDataQualitySheetData,
  buildSpreadsheetHealthSummary,
} from './spreadsheetDiagnostics';

export interface SheetData {
  name: string;
  data: (string | number | boolean | null)[][];
  inputOption?: 'RAW' | 'USER_ENTERED';
}

export const DASHBOARD_SHEET_NAME = 'Sheet1';
export const DATA_QUALITY_SHEET_NAME = 'Data Quality';
export const SAVING_GOALS_INVESTMENTS_SHEET_NAME = 'Saving Goals & Investments';
export const DASHBOARD_HELPER_START_COLUMN_INDEX = 7; // Column H
export const DASHBOARD_HELPER_END_COLUMN_INDEX = 31; // Up to AE (exclusive)

// Helper to format date
const fmtDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString() + ' ' + new Date(dateStr).toLocaleTimeString();
};

const encodeNumberListForSheet = (values?: number[]) => {
    if (!values?.length) return '';
    return values.join(', ');
};

// Helper to resolve wallet name
const getWalletName = (id: string | undefined, wallets: Wallet[]) => {
    if (!id) return '';
    const w = wallets.find(w => w.id === id);
    return w ? w.name : id;
};

// Helper to resolve budget category
const getCategoryName = (id: string | undefined, budgetConfig: BudgetConfig) => {
    if (!id) return '';
    const r = budgetConfig.rules.find(r => r.id === id);
    return r ? r.name : id;
};

const getSkillName = (id: string | undefined, fallbackName: string | undefined, skills: Skill[]) => {
    if (!id) return fallbackName || '';
    const skill = skills.find(s => s.id === id);
    return skill ? skill.name : (fallbackName || id);
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getItemTimestamp = (item: BrainDumpItem) => {
  if (item.type === ItemType.SHOPPING) {
    const shoppingRaw = getShoppingTimelineDate(item) || item.created_at;
    const shoppingTs = new Date(shoppingRaw).getTime();
    return Number.isFinite(shoppingTs) ? shoppingTs : new Date(item.created_at).getTime();
  }

  const raw = item.completed_at || item.meta.date || item.meta.dateTime || item.meta.start || item.created_at;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : new Date(item.created_at).getTime();
};

const getCurrentMonthTheme = (monthlyThemes: Record<string, string>, now: Date) => {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return monthlyThemes[key] || '';
};

const isSavingOrInvestmentItem = (item: BrainDumpItem) =>
  item.type === ItemType.SHOPPING
  && (item.meta.shoppingCategory === 'saving' || item.meta.shoppingCategory === 'investment');

const fmtCurrency = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(value || 0);

const getDaySeries = (days: number, now: Date, computeValue: (dayStart: Date, dayEnd: Date) => number) => {
  const today = startOfDay(now);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  const values: number[] = [];
  const labels: string[] = [];

  for (let i = 0; i < days; i++) {
    const dayStart = new Date(start);
    dayStart.setDate(start.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    labels.push(dayStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    values.push(computeValue(dayStart, dayEnd));
  }

  return { labels, values };
};

const buildDashboardSheet = (
  items: BrainDumpItem[],
  skills: Skill[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  monthlyThemes: Record<string, string>,
  now = new Date()
): SheetData => {
  const dataQualityIssues = buildDataQualityIssues(items, wallets, budgetConfig);
  const healthSummary = buildSpreadsheetHealthSummary(items, wallets, budgetConfig, dataQualityIssues, now);
  const moneyDrivers = buildDailyMoneyDriverSummary(items, wallets, budgetConfig, now);
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const next7Days = new Date(now);
  next7Days.setDate(next7Days.getDate() + 7);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, now.getDate());

  const isInCurrentMonth = (item: BrainDumpItem) => {
    const ts = getItemTimestamp(item);
    return ts >= monthStart.getTime() && ts < nextMonthStart.getTime();
  };

  const expenseLikeItems = items.filter(item => {
    if (item.type === ItemType.SHOPPING && item.status === 'done' && item.meta.shoppingCategory !== 'saving' && item.meta.shoppingCategory !== 'investment') {
      return true;
    }
    return item.type === ItemType.FINANCE && item.status === 'done';
  });

  const currentMonthExpenseItems = expenseLikeItems.filter(item => {
    if (!isInCurrentMonth(item)) return false;
    if (item.type === ItemType.SHOPPING) return (item.meta.amount || 0) > 0;
    return item.meta.financeType !== 'income' && item.meta.financeType !== 'transfer' && item.meta.financeType !== 'saving' && item.meta.financeType !== ACHIEVED_GOAL_FINANCE_TYPE;
  });

  const currentMonthIncomeItems = items.filter(item =>
    item.type === ItemType.FINANCE
    && item.status === 'done'
    && item.meta.financeType === 'income'
    && isInCurrentMonth(item)
  );

  const currentMonthSavingItems = items.filter(item =>
    item.type === ItemType.FINANCE
    && item.status === 'done'
    && item.meta.financeType === 'saving'
    && isInCurrentMonth(item)
  );

  const totalExpenses = currentMonthExpenseItems.reduce((sum, item) => sum + (item.meta.amount || 0), 0);
  const totalIncome = currentMonthIncomeItems.reduce((sum, item) => sum + (item.meta.amount || 0), 0);
  const totalSavings = currentMonthSavingItems.reduce((sum, item) => sum + (item.meta.amount || 0), 0);
  const netCashFlow = totalIncome - totalExpenses - totalSavings;
  const budgetUsed = budgetConfig.monthlyIncome > 0 ? totalExpenses / budgetConfig.monthlyIncome : 0;
  const avgDailyExpense = totalExpenses / daysElapsed;
  const projectedExpense = avgDailyExpense * daysInMonth;

  const openTodos = items.filter(item => item.type === ItemType.TODO && item.status === 'pending').length;
  const doneThisMonth = items.filter(item =>
    (item.type === ItemType.TODO || item.type === ItemType.EVENT)
    && item.status === 'done'
    && item.completed_at
    && new Date(item.completed_at).getTime() >= monthStart.getTime()
    && new Date(item.completed_at).getTime() < nextMonthStart.getTime()
  ).length;
  const upcomingWeek = items.filter(item => {
    if (item.status === 'done') return false;
    if (item.type !== ItemType.TODO && item.type !== ItemType.EVENT && item.type !== ItemType.SHOPPING) return false;
    const raw = item.meta.start || item.meta.date || item.meta.dateTime;
    if (!raw) return false;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && ts >= now.getTime() && ts <= next7Days.getTime();
  }).length;
  const journalEntries = items.filter(item => item.type === ItemType.JOURNAL && isInCurrentMonth(item)).length;
  const activeSavingGoals = items.filter(item => item.type === ItemType.SHOPPING && item.meta.shoppingCategory === 'saving' && item.status !== 'done').length;

  const expenseCategoryTotals = currentMonthExpenseItems.reduce<Record<string, number>>((acc, item) => {
    const key = getCategoryName(item.meta.budgetCategory, budgetConfig) || 'Uncategorised';
    acc[key] = (acc[key] || 0) + (item.meta.amount || 0);
    return acc;
  }, {});

  const topCategories = Object.entries(expenseCategoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const spendDriverTotals = currentMonthExpenseItems.reduce<Record<string, number>>((acc, item) => {
    const category = getCategoryName(item.meta.budgetCategory, budgetConfig) || 'Uncategorised';
    const commodity = getCommodityForItemAnalytics(item);
    const subcommodity = getSubcommodityForItemAnalytics(item);
    const key = [category, commodity, subcommodity]
      .filter(Boolean)
      .join(' › ');
    acc[key] = (acc[key] || 0) + (item.meta.amount || 0);
    return acc;
  }, {});

  const topSpendDrivers = Object.entries(spendDriverTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const merchantDrilldownTotals = currentMonthExpenseItems.reduce<Record<string, number>>((acc, item) => {
    const key = getCanonicalMetaValue(item.meta, 'merchant') || item.meta.merchant;
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + (item.meta.amount || 0);
    return acc;
  }, {});

  const topMerchantDrilldowns = Object.entries(merchantDrilldownTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const upcomingHighlights = items
    .filter(item => {
      if (item.status === 'done') return false;
      if (item.type !== ItemType.TODO && item.type !== ItemType.EVENT && item.type !== ItemType.SHOPPING) return false;
      const raw = item.meta.start || item.meta.date || item.meta.dateTime;
      if (!raw) return false;
      const ts = new Date(raw).getTime();
      return Number.isFinite(ts) && ts >= now.getTime();
    })
    .sort((a, b) => {
      const left = new Date(a.meta.start || a.meta.date || a.meta.dateTime || a.created_at).getTime();
      const right = new Date(b.meta.start || b.meta.date || b.meta.dateTime || b.created_at).getTime();
      return left - right;
    })
    .slice(0, 5)
    .map(item => {
      const raw = item.meta.start || item.meta.date || item.meta.dateTime || item.created_at;
      const label = new Date(raw).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `${label} • ${item.content}`;
    });

  const expenseSeries = getDaySeries(14, now, (dayStart, dayEnd) =>
    expenseLikeItems
      .filter(item => {
        const ts = getItemTimestamp(item);
        if (ts < dayStart.getTime() || ts >= dayEnd.getTime()) return false;
        if (item.type === ItemType.SHOPPING) return (item.meta.amount || 0) > 0 && item.status === 'done' && item.meta.shoppingCategory !== 'saving' && item.meta.shoppingCategory !== 'investment';
        return item.status === 'done' && item.meta.financeType !== 'income' && item.meta.financeType !== 'transfer' && item.meta.financeType !== 'saving' && item.meta.financeType !== ACHIEVED_GOAL_FINANCE_TYPE;
      })
      .reduce((sum, item) => sum + (item.meta.amount || 0), 0)
  );

  const incomeSeries = getDaySeries(14, now, (dayStart, dayEnd) =>
    items
      .filter(item => item.type === ItemType.FINANCE && item.status === 'done' && item.meta.financeType === 'income')
      .filter(item => {
        const ts = getItemTimestamp(item);
        return ts >= dayStart.getTime() && ts < dayEnd.getTime();
      })
      .reduce((sum, item) => sum + (item.meta.amount || 0), 0)
  );

  const completedTaskSeries = getDaySeries(14, now, (dayStart, dayEnd) =>
    items.filter(item =>
      (item.type === ItemType.TODO || item.type === ItemType.EVENT)
      && item.status === 'done'
      && item.completed_at
      && new Date(item.completed_at).getTime() >= dayStart.getTime()
      && new Date(item.completed_at).getTime() < dayEnd.getTime()
    ).length
  );

  const captureSeries = getDaySeries(14, now, (dayStart, dayEnd) =>
    items.filter(item => {
      const createdAt = new Date(item.created_at).getTime();
      return createdAt >= dayStart.getTime() && createdAt < dayEnd.getTime();
    }).length
  );

  const totalSkillMinutes = items
    .filter(item => item.type === ItemType.SKILL_LOG || !!item.meta.skillId || !!item.meta.skillName)
    .filter(isInCurrentMonth)
    .reduce((sum, item) => sum + (item.meta.durationMinutes || 0), 0);

  const activeWallets = wallets.length;
  const activeSkills = skills.length;
  const getTasksDone = (start: Date, end: Date) => items.filter(item =>
    (item.type === ItemType.TODO || item.type === ItemType.EVENT)
    && item.status === 'done'
    && item.completed_at
    && new Date(item.completed_at).getTime() >= start.getTime()
    && new Date(item.completed_at).getTime() < end.getTime()
  ).length;

  const getCaptures = (start: Date, end: Date) => items.filter(item => {
    const ts = new Date(item.created_at).getTime();
    return ts >= start.getTime() && ts < end.getTime();
  }).length;

  const todayExpense = moneyDrivers.todayExpense;
  const yesterdayExpense = moneyDrivers.yesterdayExpense;
  const todayIncome = moneyDrivers.todayIncome;
  const yesterdayIncome = moneyDrivers.yesterdayIncome;
  const todayTasksDone = getTasksDone(todayStart, tomorrowStart);
  const yesterdayTasksDone = getTasksDone(yesterdayStart, todayStart);
  const todayCaptured = getCaptures(todayStart, tomorrowStart);
  const yesterdayCaptured = getCaptures(yesterdayStart, todayStart);

  const topCategorySummary = topCategories[0]
    ? `${topCategories[0][0]} · ${fmtCurrency(topCategories[0][1])}`
    : 'Belum ada pengeluaran bulan ini';

  const topSpendDriverSummary = topSpendDrivers[0]
    ? `${topSpendDrivers[0][0]} · ${fmtCurrency(topSpendDrivers[0][1])}`
    : 'Belum ada pola belanja dominan';

  const topMerchantDrilldownSummary = topMerchantDrilldowns[0]
    ? `${topMerchantDrilldowns[0][0]} · ${fmtCurrency(topMerchantDrilldowns[0][1])}`
    : 'Belum ada vendor dominan';

  const budgetHealth = budgetConfig.monthlyIncome <= 0
    ? 'Budget baseline belum diset'
    : budgetUsed < 0.45
      ? 'Masih adem, pace pengeluaran sehat'
      : budgetUsed < 0.75
        ? 'Masih aman, tapi mulai jagain burn rate'
        : 'Budget lagi panas, perlu lebih ketat';

  const visibleColumnCount = 7;
  const totalColumnCount = DASHBOARD_HELPER_END_COLUMN_INDEX;
  const buildRow = (
    visible: (string | number | boolean | null)[],
    helpers: Record<number, string | number | boolean | null> = {}
  ) => {
    const row = Array.from({ length: totalColumnCount }, () => '') as (string | number | boolean | null)[];
    visible.slice(0, visibleColumnCount).forEach((value, index) => {
      row[index] = value;
    });
    Object.entries(helpers).forEach(([index, value]) => {
      row[Number(index)] = value;
    });
    return row;
  };

  const fallbackRows = (entries: string[], count = 5) => Array.from({ length: count }, (_, i) => entries[i] || '—');
  const categoryRows = fallbackRows(topCategories.map(([name, amount]) => `${name} — ${amount}`));
  const upcomingRows = fallbackRows(upcomingHighlights);

  const categoryChartRows = Array.from({ length: 5 }, (_, index) => ({
    label: topCategories[index]?.[0] || `Category ${index + 1}`,
    value: topCategories[index]?.[1] || 0,
  }));

  const spendDriverChartRows = Array.from({ length: 5 }, (_, index) => ({
    label: topSpendDrivers[index]?.[0] || `Spend Driver ${index + 1}`,
    value: topSpendDrivers[index]?.[1] || 0,
  }));

  const rows = [
    buildRow(['BRAINDUMP HQ'], Object.fromEntries(expenseSeries.labels.map((label, index) => [DASHBOARD_HELPER_START_COLUMN_INDEX + index, label]))),
    buildRow(['Auto-generated finance + life tracker command center'], Object.fromEntries(expenseSeries.values.map((value, index) => [DASHBOARD_HELPER_START_COLUMN_INDEX + index, value]))),
    buildRow([healthSummary.guideLine], Object.fromEntries(incomeSeries.values.map((value, index) => [DASHBOARD_HELPER_START_COLUMN_INDEX + index, value]))),
    buildRow([healthSummary.syncHealthLine], Object.fromEntries(completedTaskSeries.values.map((value, index) => [DASHBOARD_HELPER_START_COLUMN_INDEX + index, value]))),
    buildRow(['FINANCE PULSE', '', '', 'LIFE TRACKER'], Object.fromEntries(captureSeries.values.map((value, index) => [DASHBOARD_HELPER_START_COLUMN_INDEX + index, value]))),
    buildRow(['Net Cash Flow', netCashFlow, '', 'Open Todos', openTodos]),
    buildRow(['Income MTD', totalIncome, '', 'Done This Month', doneThisMonth]),
    buildRow(['Expense MTD', totalExpenses, '', 'Upcoming 7d', upcomingWeek]),
    buildRow(['Savings Added', totalSavings, '', 'Journal Entries', journalEntries]),
    buildRow(['Budget Used', budgetUsed, '', 'Goals / Skills / Wallets', `${activeSavingGoals} / ${activeSkills} / ${activeWallets}`]),
    buildRow(['SYNC HEALTH', healthSummary.dataHealthLine, '', 'GUIDE', healthSummary.itemCountLine]),
    buildRow(['TODAY VS YESTERDAY', '', '', 'BUDGET RADAR']),
    buildRow(['Today Spend Driver', moneyDrivers.spendLine, '', 'Top Category', topCategorySummary], { 22: categoryChartRows[0].label, 23: categoryChartRows[0].value }),
    buildRow(['Main Driver', moneyDrivers.mainDriverLine, '', 'Budget Health', budgetHealth], { 22: categoryChartRows[1].label, 23: categoryChartRows[1].value }),
    buildRow(['Wallet Movement', moneyDrivers.walletMovementLine, '', 'Top Spend Driver', topSpendDriverSummary], { 22: categoryChartRows[2].label, 23: categoryChartRows[2].value }),
    buildRow(['Pattern Check', moneyDrivers.patternLine, '', 'Top Vendor Drilldown', topMerchantDrilldownSummary], { 22: categoryChartRows[3].label, 23: categoryChartRows[3].value }),
    buildRow(['Income / Tasks / Captures', `Income ${fmtCurrency(todayIncome)} vs yesterday ${fmtCurrency(yesterdayIncome)} (${todayTasksDone} tasks, ${todayCaptured} captures today)`, `Yesterday tasks/captures: ${yesterdayTasksDone}/${yesterdayCaptured}`, 'Avg Daily Burn', fmtCurrency(avgDailyExpense)], { 22: categoryChartRows[4].label, 23: categoryChartRows[4].value }),
    buildRow(['']),
    buildRow(['UPCOMING RADAR', '', '', 'TOP SPEND DRIVERS']),
    buildRow([upcomingRows[0], '', '', spendDriverChartRows[0].label, fmtCurrency(spendDriverChartRows[0].value)], { 25: spendDriverChartRows[0].label, 26: spendDriverChartRows[0].value, 28: 'Today Expense', 29: todayExpense }),
    buildRow([upcomingRows[1], '', '', spendDriverChartRows[1].label, fmtCurrency(spendDriverChartRows[1].value)], { 25: spendDriverChartRows[1].label, 26: spendDriverChartRows[1].value, 28: 'Yesterday Expense', 29: yesterdayExpense }),
    buildRow([upcomingRows[2], '', '', spendDriverChartRows[2].label, fmtCurrency(spendDriverChartRows[2].value)], { 25: spendDriverChartRows[2].label, 26: spendDriverChartRows[2].value }),
    buildRow([upcomingRows[3], '', '', spendDriverChartRows[3].label, fmtCurrency(spendDriverChartRows[3].value)], { 25: spendDriverChartRows[3].label, 26: spendDriverChartRows[3].value }),
    buildRow([upcomingRows[4], '', '', spendDriverChartRows[4].label, fmtCurrency(spendDriverChartRows[4].value)], { 25: spendDriverChartRows[4].label, 26: spendDriverChartRows[4].value }),
    buildRow(['']),
    buildRow(['ANALYTICS DECK']),
    buildRow(['Charts below auto-refresh on every sync.']),
  ];

  while (rows.length < 52) {
    rows.push(buildRow(['']));
  }

  return {
    name: DASHBOARD_SHEET_NAME,
    inputOption: 'USER_ENTERED',
    data: rows
  };
};

export const generateExportData = (
  items: BrainDumpItem[],
  skills: Skill[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  monthlyThemes: Record<string, string>,
  appSettings: AppSettings,
  now = new Date(),
  extras: { customPrompt?: string; chatHistory?: ChatMessage[]; canonicalRules?: CanonicalRule[]; monthlyThemeImages?: Record<string, string> } = {}
): SheetData[] => {
  const dataQualityIssues = buildDataQualityIssues(items, wallets, budgetConfig);
  const sheets: SheetData[] = [
    buildDashboardSheet(items, skills, wallets, budgetConfig, monthlyThemes, now),
    {
      name: DATA_QUALITY_SHEET_NAME,
      inputOption: 'RAW',
      data: buildDataQualitySheetData(dataQualityIssues),
    },
  ];

  // --- Sheet 1: Transactions (Money Tab) ---
  const transactions = items
    .filter(i => i.type === ItemType.FINANCE || (i.type === ItemType.SHOPPING && i.status === 'done' && i.meta.shoppingCategory !== 'saving' && i.meta.shoppingCategory !== 'investment'))
    .map(item => {
      const isShopping = item.type === ItemType.SHOPPING;
      const date = isShopping ? getShoppingTransactionDate(item) : (item.meta.date || item.created_at);
      
      return {
        Date: date || '',
        Type: isShopping ? 'expense' : (item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE ? 'Achieved Goals' : (item.meta.financeType || 'expense')),
        Category: getCategoryName(item.meta.budgetCategory, budgetConfig),
        Description: item.content,
        Amount: item.meta.amount || 0,
        Wallet: getWalletName(
          getCanonicalOrRawItemValue(item, 'paymentMethod') ||
          item.meta.paymentMethod ||
          (isShopping ? item.meta.dedicatedWalletId : ''),
          wallets
        ),
        To_Wallet: getWalletName(item.meta.toWallet, wallets),
        Payment_Method: item.meta.paymentMethod || '',
        Canonical_Payment_Method: getCanonicalMetaValue(item.meta, 'paymentMethod'),
        Merchant: item.meta.merchant || '',
        Canonical_Merchant: getCanonicalMetaValue(item.meta, 'merchant'),
        Commodity: item.meta.commodity || '',
        Canonical_Commodity: getCommodityForItemAnalytics(item),
        Subcommodity: item.meta.subcommodity || '',
        Canonical_Subcommodity: getSubcommodityForItemAnalytics(item),
        Tags: item.meta.tags?.join(', ') || '',
        Created_At: item.created_at,
        Completed_At: item.completed_at || '',
        ID: item.id,
        Saving_Goal_ID: item.meta.savingGoalId || '',
        Investment_Units: item.meta.investmentUnits || '',
        Investment_Avg_Buy: item.meta.investmentAveragePrice || '',
      };
    });

  sheets.push({
      name: "Transactions",
      data: [
        ["Date", "Type", "Category", "Description", "Amount", "Wallet", "To_Wallet", "Payment_Method", "Canonical_Payment_Method", "Merchant", "Canonical_Merchant", "Commodity", "Canonical_Commodity", "Subcommodity", "Canonical_Subcommodity", "Tags", "Created_At", "Completed_At", "ID", "Saving_Goal_ID", "Investment_Units", "Investment_Avg_Buy"],
        ...transactions.map(t => [t.Date, t.Type, t.Category, t.Description, t.Amount, t.Wallet, t.To_Wallet, t.Payment_Method, t.Canonical_Payment_Method, t.Merchant, t.Canonical_Merchant, t.Commodity, t.Canonical_Commodity, t.Subcommodity, t.Canonical_Subcommodity, t.Tags, t.Created_At, t.Completed_At, t.ID, t.Saving_Goal_ID, t.Investment_Units, t.Investment_Avg_Buy])
      ]
    });

  // --- Sheet 2: Todos ---
  const todos = items.filter(i => i.type === ItemType.TODO || i.type === ItemType.SKILLS).map(item => {
    const children = getDeepWorkChildren(items, item.id);
    const childIds = item.meta.childTodoIds?.length
      ? item.meta.childTodoIds
      : children.map(child => child.id);

    return {
      Type: item.type,
      Status: item.status,
      Priority: item.meta.priority || 'normal',
      Content: item.content,
      Due_Date: item.meta.date || item.meta.dateTime || '',
      Start_Date: item.meta.start || '',
      End_Date: item.meta.end || '',
      Tags: item.meta.tags?.join(', ') || '',
      Created_At: item.created_at,
      Completed_At: item.completed_at || '',
      Progress: item.meta.progress ? `${item.meta.progress}%` : '',
      Progress_Notes: item.meta.progressNotes || '',
      ID: item.id,
      Parent_ID: item.meta.parentTodoId || '',
      Deep_Work_Role: item.meta.deepWorkParent ? 'parent' : (item.meta.parentTodoId ? 'step' : ''),
      Step_Order: item.meta.deepWorkStepIndex || '',
      Step_Count: item.meta.deepWorkStepCount || '',
      Child_IDs: childIds.join(', '),
      Child_Count: children.length || childIds.length || '',
      Completion_Mode: item.meta.deepWorkCompletionMode || '',
      Deep_Work_Status: item.meta.deepWorkStatus || (item.meta.deepWorkParent ? 'suggested' : ''),
      Deep_Work_Trigger_Pattern: item.meta.deepWorkTriggerPattern || '',
      Deep_Work_Trigger_Evidence: item.meta.deepWorkTriggerEvidence?.join('; ') || '',
      Deep_Work_Confidence: item.meta.deepWorkConfidence || '',
      Next_Action: item.meta.deepWorkNextAction || '',
      Next_Action_Duration_Min: item.meta.deepWorkNextActionDurationMinutes || '',
      Next_Action_Acceptance_Check: item.meta.deepWorkNextActionAcceptanceCheck || '',
      Final_Output: item.meta.deepWorkFinalOutput || '',
      Final_Output_Format: item.meta.deepWorkFinalOutputFormat || '',
      Session_Estimate_Min: item.meta.deepWorkSessionEstimateMinutes || '',
      Session_Estimate_Confidence: item.meta.deepWorkSessionEstimateConfidence || '',
      Session_Estimate_Reason: item.meta.deepWorkSessionEstimateReason || '',
      Blocker_Status: item.meta.deepWorkBlockerStatus || '',
      Blocker_Check: item.meta.deepWorkBlockerCheck || '',
      Missing_Inputs: item.meta.deepWorkMissingInputs?.join('; ') || '',
      Deep_Work_Generated_At: item.meta.deepWorkGeneratedAt || '',
      Deep_Work_Accepted_At: item.meta.deepWorkAcceptedAt || '',
      Deep_Work_Dismissed_At: item.meta.deepWorkDismissedAt || '',
      Deep_Work_Reason: item.meta.deepWorkReason || '',
      Subtasks: encodeSubtasksForSheet(item.meta.subtasks),
      Hide_From_Calendar: item.meta.hideFromCalendar ? 'TRUE' : '',
      Is_Routine: item.meta.isRoutine ? 'TRUE' : '',
      Routine_Interval: item.meta.routineInterval || '',
      Routine_Days_Of_Week: encodeNumberListForSheet(item.meta.routineDaysOfWeek),
      Routine_Days_Of_Month: encodeNumberListForSheet(item.meta.routineDaysOfMonth),
      Routine_Months_Of_Year: encodeNumberListForSheet(item.meta.routineMonthsOfYear),
      Recurrence_Days: item.meta.recurrenceDays || '',
      Last_Generated_History_ID: item.meta.lastGeneratedHistoryId || '',
      Skill_ID: item.meta.skillId || '',
      Skill_Name: item.meta.skillName || '',
      Skill_Routine_ID: item.meta.skillRoutineId || '',
      Duration_Minutes: item.meta.durationMinutes || '',
    };
  });
  sheets.push({
      name: "Todos",
      data: [
        ["Type", "Status", "Priority", "Content", "Due_Date", "Start_Date", "End_Date", "Tags", "Created_At", "Completed_At", "Progress", "Progress_Notes", "ID", "Parent_ID", "Deep_Work_Role", "Step_Order", "Step_Count", "Child_IDs", "Child_Count", "Completion_Mode", "Deep_Work_Status", "Deep_Work_Trigger_Pattern", "Deep_Work_Trigger_Evidence", "Deep_Work_Confidence", "Next_Action", "Next_Action_Duration_Min", "Next_Action_Acceptance_Check", "Final_Output", "Final_Output_Format", "Session_Estimate_Min", "Session_Estimate_Confidence", "Session_Estimate_Reason", "Blocker_Status", "Blocker_Check", "Missing_Inputs", "Deep_Work_Generated_At", "Deep_Work_Accepted_At", "Deep_Work_Dismissed_At", "Deep_Work_Reason", "Subtasks", "Hide_From_Calendar", "Is_Routine", "Routine_Interval", "Routine_Days_Of_Week", "Routine_Days_Of_Month", "Routine_Months_Of_Year", "Recurrence_Days", "Last_Generated_History_ID", "Skill_ID", "Skill_Name", "Skill_Routine_ID", "Duration_Minutes"],
        ...todos.map(t => [t.Type, t.Status, t.Priority, t.Content, t.Due_Date, t.Start_Date, t.End_Date, t.Tags, t.Created_At, t.Completed_At, t.Progress, t.Progress_Notes, t.ID, t.Parent_ID, t.Deep_Work_Role, t.Step_Order, t.Step_Count, t.Child_IDs, t.Child_Count, t.Completion_Mode, t.Deep_Work_Status, t.Deep_Work_Trigger_Pattern, t.Deep_Work_Trigger_Evidence, t.Deep_Work_Confidence, t.Next_Action, t.Next_Action_Duration_Min, t.Next_Action_Acceptance_Check, t.Final_Output, t.Final_Output_Format, t.Session_Estimate_Min, t.Session_Estimate_Confidence, t.Session_Estimate_Reason, t.Blocker_Status, t.Blocker_Check, t.Missing_Inputs, t.Deep_Work_Generated_At, t.Deep_Work_Accepted_At, t.Deep_Work_Dismissed_At, t.Deep_Work_Reason, t.Subtasks, t.Hide_From_Calendar, t.Is_Routine, t.Routine_Interval, t.Routine_Days_Of_Week, t.Routine_Days_Of_Month, t.Routine_Months_Of_Year, t.Recurrence_Days, t.Last_Generated_History_ID, t.Skill_ID, t.Skill_Name, t.Skill_Routine_ID, t.Duration_Minutes])
      ]
    });

  // --- Sheet 3: Shopping ---
  const shopping = items.filter(i => i.type === ItemType.SHOPPING && !isSavingOrInvestmentItem(i)).map(item => ({
      Status: item.status,
      Item: item.content,
      Amount: item.meta.amount || 0,
      Category: item.meta.shoppingCategory || '',
      Quantity: item.meta.quantity || '',
      Due_Date: getShoppingDueDate(item) || '',
      Created_At: item.created_at,
      Tags: item.meta.tags?.join(', ') || '',
      Completed_At: item.completed_at || '',
      Budget_Category: item.meta.budgetCategory || '',
      Payment_Method: item.meta.paymentMethod || '',
      Dedicated_Wallet_ID: item.meta.dedicatedWalletId || '',
      Hide_From_Calendar: item.meta.hideFromCalendar ? 'TRUE' : '',
      Routine_Interval: item.meta.routineInterval || '',
      Routine_Days_Of_Week: encodeNumberListForSheet(item.meta.routineDaysOfWeek),
      Routine_Days_Of_Month: encodeNumberListForSheet(item.meta.routineDaysOfMonth),
      Routine_Months_Of_Year: encodeNumberListForSheet(item.meta.routineMonthsOfYear),
      Recurrence_Days: item.meta.recurrenceDays || '',
      Last_Generated_History_ID: item.meta.lastGeneratedHistoryId || '',
      Investment_Type: item.meta.investmentAssetType || '',
      Investment_Code: item.meta.investmentSymbol || '',
      Investment_Units: item.meta.investmentUnits || '',
      Investment_Avg_Buy: item.meta.investmentAveragePrice || '',
      Investment_Current_Price: item.meta.investmentCurrentPrice || '',
      Investment_Platform: item.meta.investmentPlatform || '',
      ID: item.id
  }));
  sheets.push({
      name: "Shopping",
      data: [
        ["Status", "Item", "Amount", "Category", "Quantity", "Due_Date", "Created_At", "Tags", "Completed_At", "Investment_Type", "Investment_Code", "Investment_Units", "Investment_Avg_Buy", "Investment_Current_Price", "Investment_Platform", "ID", "Budget_Category", "Payment_Method", "Dedicated_Wallet_ID", "Hide_From_Calendar", "Routine_Interval", "Routine_Days_Of_Week", "Routine_Days_Of_Month", "Routine_Months_Of_Year", "Recurrence_Days", "Last_Generated_History_ID"],
        ...shopping.map(s => [s.Status, s.Item, s.Amount, s.Category, s.Quantity, s.Due_Date, s.Created_At, s.Tags, s.Completed_At, s.Investment_Type, s.Investment_Code, s.Investment_Units, s.Investment_Avg_Buy, s.Investment_Current_Price, s.Investment_Platform, s.ID, s.Budget_Category, s.Payment_Method, s.Dedicated_Wallet_ID, s.Hide_From_Calendar, s.Routine_Interval, s.Routine_Days_Of_Week, s.Routine_Days_Of_Month, s.Routine_Months_Of_Year, s.Recurrence_Days, s.Last_Generated_History_ID])
      ]
    });

  // --- Dedicated Sheet: Saving Goals & Investments ---
  const savingGoalInvestmentRows = items
    .filter(isSavingOrInvestmentItem)
    .map(item => ({
      Kind: item.meta.shoppingCategory || '',
      Status: item.status,
      Name: item.content,
      Target_Amount: item.meta.amount || 0,
      Saved_Amount: item.meta.savedAmount || '',
      Dedicated_Wallet_ID: item.meta.dedicatedWalletId || '',
      Due_Date: getShoppingDueDate(item) || '',
      Created_At: item.created_at,
      Completed_At: item.completed_at || '',
      Tags: item.meta.tags?.join(', ') || '',
      Image_URL: item.meta.imageUrl || '',
      Hide_From_Calendar: item.meta.hideFromCalendar ? 'TRUE' : '',
      Investment_Type: item.meta.investmentAssetType || '',
      Investment_Code: item.meta.investmentSymbol || '',
      Investment_Units: item.meta.investmentUnits || '',
      Investment_Avg_Buy: item.meta.investmentAveragePrice || '',
      Investment_Current_Price: item.meta.investmentCurrentPrice || '',
      Investment_Platform: item.meta.investmentPlatform || '',
      ID: item.id,
    }));

  sheets.push({
    name: SAVING_GOALS_INVESTMENTS_SHEET_NAME,
    data: [
      ["Kind", "Status", "Name", "Target_Amount", "Saved_Amount", "Dedicated_Wallet_ID", "Due_Date", "Created_At", "Completed_At", "Tags", "Image_URL", "Hide_From_Calendar", "Investment_Type", "Investment_Code", "Investment_Units", "Investment_Avg_Buy", "Investment_Current_Price", "Investment_Platform", "ID"],
      ...savingGoalInvestmentRows.map(row => [row.Kind, row.Status, row.Name, row.Target_Amount, row.Saved_Amount, row.Dedicated_Wallet_ID, row.Due_Date, row.Created_At, row.Completed_At, row.Tags, row.Image_URL, row.Hide_From_Calendar, row.Investment_Type, row.Investment_Code, row.Investment_Units, row.Investment_Avg_Buy, row.Investment_Current_Price, row.Investment_Platform, row.ID])
    ]
  });

  // --- Sheet 4: Events ---
  const events = items.filter(i => i.type === ItemType.EVENT).map(item => ({
      Type: item.type,
      Status: item.status,
      Date: item.meta.date || item.meta.dateTime || '',
      Start_Date: item.meta.start || '',
      End_Date: item.meta.end || '',
      Priority: item.meta.priority || 'normal',
      Event: item.content,
      Tags: item.meta.tags?.join(', ') || '',
      ID: item.id,
      Hide_From_Calendar: item.meta.hideFromCalendar ? 'TRUE' : '',
  }));
  sheets.push({
      name: "Events",
      data: [
        ["Type", "Date", "Start_Date", "End_Date", "Priority", "Event", "Tags", "Status", "ID", "Hide_From_Calendar"],
        ...events.map(e => [e.Type, e.Date, e.Start_Date, e.End_Date, e.Priority, e.Event, e.Tags, e.Status, e.ID, e.Hide_From_Calendar])
      ]
    });

  // --- Sheet 5: Notes & Journals ---
  const notes = items.filter(i => i.type === ItemType.NOTE || i.type === ItemType.JOURNAL).map(item => ({
      Date: item.created_at,
      Status: item.status,
      Type: item.type,
      Title: item.meta.title || '',
      Content: item.content,
      Tags: item.meta.tags?.join(', ') || '',
      ID: item.id
  }));
  sheets.push({
      name: "Notes & Journals",
      data: [
        ["Date", "Type", "Title", "Content", "Tags", "Status", "ID"],
        ...notes.map(n => [n.Date, n.Type, n.Title, n.Content, n.Tags, n.Status, n.ID])
      ]
    });

  // --- Sheet 6: Skill Logs ---
  const skillLogs = items.filter(i => i.type === ItemType.SKILL_LOG).map(item => ({
      Date: item.meta.date || item.completed_at || item.created_at,
      Skill_Name: getSkillName(item.meta.skillId, item.meta.skillName, skills),
      Skill_ID: item.meta.skillId || '',
      Duration_Minutes: item.meta.durationMinutes || 0,
      Content: item.content,
      Tags: item.meta.tags?.join(', ') || '',
      Created_At: item.created_at,
      Completed_At: item.completed_at || '',
      ID: item.id,
      Skill_Routine_ID: item.meta.skillRoutineId || '',
      Skill_Scheduled_Date: item.meta.skillScheduledDate || item.meta.plannedStart || item.meta.date || '',
      Planned_Start: item.meta.plannedStart || '',
      Planned_End: item.meta.plannedEnd || '',
      Actual_Start: item.meta.actualStart || '',
      Actual_End: item.meta.actualEnd || '',
      Actual_Time_Edited: item.meta.actualTimeEdited ? 'TRUE' : ''
  }));
  sheets.push({
      name: "Skill Logs",
      data: [
        ["Date", "Skill_Name", "Skill_ID", "Duration_Minutes", "Content", "Tags", "Created_At", "Completed_At", "ID", "Skill_Routine_ID", "Skill_Scheduled_Date", "Planned_Start", "Planned_End", "Actual_Start", "Actual_End", "Actual_Time_Edited"],
        ...skillLogs.map(s => [s.Date, s.Skill_Name, s.Skill_ID, s.Duration_Minutes, s.Content, s.Tags, s.Created_At, s.Completed_At, s.ID, s.Skill_Routine_ID, s.Skill_Scheduled_Date, s.Planned_Start, s.Planned_End, s.Actual_Start, s.Actual_End, s.Actual_Time_Edited])
      ]
    });

  // --- Sheet 8: Wallets ---
  const walletsData = wallets.map(w => ({
    ID: w.id,
    Name: w.name,
    Type: w.type,
    Initial_Balance: w.initialBalance,
    Color: w.color
  }));
  sheets.push({
    name: "Wallets Config",
    data: [
      ["ID", "Name", "Type", "Initial_Balance", "Color"],
      ...walletsData.map(w => [w.ID, w.Name, w.Type, w.Initial_Balance, w.Color])
    ]
  });

  // --- Sheet 9: Skills ---
  const encodeSkillNumberList = (values?: number[]) => (values && values.length ? values.join(', ') : '');
  const skillsData = skills.map(s => ({
    ID: s.id,
    Name: s.name,
    Description: s.description || '',
    Image_URL: s.imageUrl || '',
    Weekly_Target_Minutes: s.weeklyTargetMinutes || 0,
    Schedule_Enabled: s.schedule?.enabled ? 'TRUE' : '',
    Schedule_Interval: s.schedule?.interval || '',
    Schedule_Days_Of_Week: encodeSkillNumberList(s.schedule?.daysOfWeek),
    Schedule_Days_Of_Month: encodeSkillNumberList(s.schedule?.daysOfMonth),
    Schedule_Months_Of_Year: encodeSkillNumberList(s.schedule?.monthsOfYear),
    Schedule_Start_Time: s.schedule?.startTime || '',
    Schedule_End_Time: s.schedule?.endTime || '',
    Created_At: s.created_at,
    Color: s.color
  }));
  sheets.push({
    name: "Skills Config",
    data: [
      ["ID", "Name", "Description", "Image_URL", "Weekly_Target_Minutes", "Schedule_Enabled", "Schedule_Interval", "Schedule_Days_Of_Week", "Schedule_Days_Of_Month", "Schedule_Months_Of_Year", "Schedule_Start_Time", "Schedule_End_Time", "Created_At", "Color"],
      ...skillsData.map(s => [s.ID, s.Name, s.Description, s.Image_URL, s.Weekly_Target_Minutes, s.Schedule_Enabled, s.Schedule_Interval, s.Schedule_Days_Of_Week, s.Schedule_Days_Of_Month, s.Schedule_Months_Of_Year, s.Schedule_Start_Time, s.Schedule_End_Time, s.Created_At, s.Color])
    ]
  });

  // --- Sheet 10: Budget Config ---
  const budgetData = [
    { Property: 'Monthly Income', Value: budgetConfig.monthlyIncome, Color: '' },
    ...budgetConfig.rules.map(r => ({
      Property: `Rule: ${r.name}`,
      Value: `${r.percentage}% (ID: ${r.id})`,
      Color: r.color || 'bg-gray-500'
    }))
  ];
  sheets.push({
    name: "Budget Rules",
    data: [
      ["Property", "Value", "Color"],
      ...budgetData.map(b => [b.Property, b.Value, b.Color])
    ]
  });

  // --- Sheet 11: Themes & Settings ---
  const themeKeys = Array.from(new Set([
    ...Object.keys(monthlyThemes || {}),
    ...Object.keys(extras.monthlyThemeImages || {}),
  ])).sort();

  const themesData = themeKeys.map((key) => ({
    Type: 'Theme',
    Key: key,
    Value: monthlyThemes[key] || '',
    Hero_Image_URL: extras.monthlyThemeImages?.[key] || ''
  }));
  
  const settingsData = [
    { Type: 'Setting', Key: 'Default Collapsed', Value: appSettings.defaultCollapsed ? 'TRUE' : 'FALSE' },
    { Type: 'Setting', Key: 'Hide Money', Value: appSettings.hideMoney ? 'TRUE' : 'FALSE' },
    { Type: 'Setting', Key: 'Theme', Value: appSettings.theme || 'dark' },
    { Type: 'Setting', Key: 'Google Calendar Sync', Value: appSettings.googleCalendarSyncEnabled ? 'TRUE' : 'FALSE' },
    { Type: 'Setting', Key: 'Google Calendar ID', Value: appSettings.googleCalendarId || 'primary' }
  ];

  if (extras.customPrompt) {
    settingsData.push({ Type: 'Setting', Key: 'Custom Prompt', Value: extras.customPrompt });
  }

  sheets.push({
    name: "Themes & Settings",
    data: [
      ["Type", "Key", "Value", "Hero_Image_URL"],
      ...themesData.map(d => [d.Type, d.Key, d.Value, d.Hero_Image_URL]),
      ...settingsData.map(d => [d.Type, d.Key, d.Value, ''])
    ]
  });

  sheets.push({
    name: "Chat History",
    data: [
      ["Index", "Role", "Text"],
      ...(extras.chatHistory || []).map((message, index) => [index + 1, message.role, message.text])
    ]
  });

  sheets.push({
    name: "Canonical Rules",
    data: [
      ["ID", "Field", "Canonical_Value", "Aliases", "Source", "Confidence_Boost", "Approval_Count", "Rejection_Count", "Condition_Finance_Types", "Condition_Budget_Categories", "Condition_Commodities", "Condition_Payment_Methods", "Condition_Amount_Min", "Condition_Amount_Max", "Created_At", "Updated_At", "Last_Approved_At", "Last_Rejected_At", "Auto_Apply_Disabled", "Disabled", "Disabled_Reason"],
      ...(extras.canonicalRules || []).map(rule => [
        rule.id,
        rule.field,
        rule.canonicalValue,
        rule.aliases.join('; '),
        rule.source,
        rule.confidenceBoost || '',
        rule.approvalCount,
        rule.rejectionCount,
        rule.conditions?.financeType?.join('; ') || '',
        rule.conditions?.budgetCategory?.join('; ') || '',
        rule.conditions?.commodity?.join('; ') || '',
        rule.conditions?.paymentMethod?.join('; ') || '',
        rule.conditions?.amountMin ?? '',
        rule.conditions?.amountMax ?? '',
        rule.createdAt,
        rule.updatedAt,
        rule.lastApprovedAt || '',
        rule.lastRejectedAt || '',
        rule.autoApplyDisabled ? 'TRUE' : 'FALSE',
        rule.disabled ? 'TRUE' : 'FALSE',
        rule.disabledReason || '',
      ])
    ]
  });

  return sheets;
};
