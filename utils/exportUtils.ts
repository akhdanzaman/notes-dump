import { BrainDumpItem, Skill, Wallet, BudgetConfig, AppSettings, ItemType } from '../types';
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
export const DASHBOARD_HELPER_START_COLUMN_INDEX = 7; // Column H
export const DASHBOARD_HELPER_END_COLUMN_INDEX = 31; // Up to AE (exclusive)

// Helper to format date
const fmtDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString() + ' ' + new Date(dateStr).toLocaleTimeString();
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
  now = new Date()
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
        Date: fmtDate(date),
        Type: isShopping ? 'expense' : (item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE ? 'Achieved Goals' : (item.meta.financeType || 'expense')),
        Category: getCategoryName(item.meta.budgetCategory, budgetConfig),
        Description: item.content,
        Amount: item.meta.amount || 0,
        Wallet: getWalletName(getCanonicalOrRawItemValue(item, 'paymentMethod') || item.meta.paymentMethod, wallets),
        To_Wallet: getWalletName(item.meta.toWallet, wallets),
        Tags: item.meta.tags?.join(', ') || '',
        Canonical_Commodity: getCommodityForItemAnalytics(item),
        Canonical_Subcommodity: getSubcommodityForItemAnalytics(item),
        ID: item.id
      };
    });

  if (transactions.length > 0) {
    sheets.push({
      name: "Transactions",
      data: [
        ["Date", "Type", "Category", "Description", "Amount", "Wallet", "To_Wallet", "Tags", "Canonical_Commodity", "Canonical_Subcommodity", "ID"],
        ...transactions.map(t => [t.Date, t.Type, t.Category, t.Description, t.Amount, t.Wallet, t.To_Wallet, t.Tags, t.Canonical_Commodity, t.Canonical_Subcommodity, t.ID])
      ]
    });
  }

  // --- Sheet 2: Todos ---
  const todos = items.filter(i => i.type === ItemType.TODO).map(item => {
    const children = getDeepWorkChildren(items, item.id);
    const childIds = item.meta.childTodoIds?.length
      ? item.meta.childTodoIds
      : children.map(child => child.id);

    return {
      Type: item.type,
      Status: item.status,
      Priority: item.meta.priority || 'normal',
      Content: item.content,
      Due_Date: fmtDate(item.meta.date || item.meta.dateTime),
      Start_Date: fmtDate(item.meta.start),
      End_Date: fmtDate(item.meta.end),
      Tags: item.meta.tags?.join(', ') || '',
      Created_At: fmtDate(item.created_at),
      Completed_At: fmtDate(item.completed_at),
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
      Next_Action: item.meta.deepWorkNextAction || '',
      Final_Output: item.meta.deepWorkFinalOutput || '',
      Session_Estimate_Min: item.meta.deepWorkSessionEstimateMinutes || '',
      Blocker_Status: item.meta.deepWorkBlockerStatus || '',
      Blocker_Check: item.meta.deepWorkBlockerCheck || '',
      Subtasks: encodeSubtasksForSheet(item.meta.subtasks),
    };
  });
  if (todos.length > 0) {
    sheets.push({
      name: "Todos",
      data: [
        ["Type", "Status", "Priority", "Content", "Due_Date", "Start_Date", "End_Date", "Tags", "Created_At", "Completed_At", "Progress", "Progress_Notes", "ID", "Parent_ID", "Deep_Work_Role", "Step_Order", "Step_Count", "Child_IDs", "Child_Count", "Completion_Mode", "Deep_Work_Status", "Next_Action", "Final_Output", "Session_Estimate_Min", "Blocker_Status", "Blocker_Check", "Subtasks"],
        ...todos.map(t => [t.Type, t.Status, t.Priority, t.Content, t.Due_Date, t.Start_Date, t.End_Date, t.Tags, t.Created_At, t.Completed_At, t.Progress, t.Progress_Notes, t.ID, t.Parent_ID, t.Deep_Work_Role, t.Step_Order, t.Step_Count, t.Child_IDs, t.Child_Count, t.Completion_Mode, t.Deep_Work_Status, t.Next_Action, t.Final_Output, t.Session_Estimate_Min, t.Blocker_Status, t.Blocker_Check, t.Subtasks])
      ]
    });
  }

  // --- Sheet 3: Shopping ---
  const shopping = items.filter(i => i.type === ItemType.SHOPPING).map(item => ({
      Status: item.status,
      Item: item.content,
      Amount: item.meta.amount || 0,
      Category: item.meta.shoppingCategory || '',
      Quantity: item.meta.quantity || '',
      Due_Date: fmtDate(getShoppingDueDate(item)),
      Created_At: fmtDate(item.created_at),
      Tags: item.meta.tags?.join(', ') || '',
      Completed_At: fmtDate(item.completed_at),
      Investment_Type: item.meta.investmentAssetType || '',
      Investment_Code: item.meta.investmentSymbol || '',
      Investment_Units: item.meta.investmentUnits || '',
      Investment_Avg_Buy: item.meta.investmentAveragePrice || '',
      Investment_Current_Price: item.meta.investmentCurrentPrice || '',
      Investment_Platform: item.meta.investmentPlatform || '',
      ID: item.id
  }));
  if (shopping.length > 0) {
    sheets.push({
      name: "Shopping",
      data: [
        ["Status", "Item", "Amount", "Category", "Quantity", "Due_Date", "Created_At", "Tags", "Completed_At", "Investment_Type", "Investment_Code", "Investment_Units", "Investment_Avg_Buy", "Investment_Current_Price", "Investment_Platform", "ID"],
        ...shopping.map(s => [s.Status, s.Item, s.Amount, s.Category, s.Quantity, s.Due_Date, s.Created_At, s.Tags, s.Completed_At, s.Investment_Type, s.Investment_Code, s.Investment_Units, s.Investment_Avg_Buy, s.Investment_Current_Price, s.Investment_Platform, s.ID])
      ]
    });
  }

  // --- Sheet 4: Events ---
  const events = items.filter(i => i.type === ItemType.EVENT).map(item => ({
      Type: item.type,
      Date: fmtDate(item.meta.date),
      Start_Date: fmtDate(item.meta.start),
      End_Date: fmtDate(item.meta.end),
      Priority: item.meta.priority || 'normal',
      Event: item.content,
      Tags: item.meta.tags?.join(', ') || '',
      ID: item.id
  }));
  if (events.length > 0) {
    sheets.push({
      name: "Events",
      data: [
        ["Type", "Date", "Start_Date", "End_Date", "Priority", "Event", "Tags", "ID"],
        ...events.map(e => [e.Type, e.Date, e.Start_Date, e.End_Date, e.Priority, e.Event, e.Tags, e.ID])
      ]
    });
  }

  // --- Sheet 5: Notes & Journals ---
  const notes = items.filter(i => i.type === ItemType.NOTE || i.type === ItemType.JOURNAL).map(item => ({
      Date: fmtDate(item.created_at),
      Type: item.type,
      Title: item.meta.title || '',
      Content: item.content,
      Tags: item.meta.tags?.join(', ') || '',
      ID: item.id
  }));
  if (notes.length > 0) {
    sheets.push({
      name: "Notes & Journals",
      data: [
        ["Date", "Type", "Title", "Content", "Tags", "ID"],
        ...notes.map(n => [n.Date, n.Type, n.Title, n.Content, n.Tags, n.ID])
      ]
    });
  }

  // --- Sheet 7: All Items (Backup) ---
  const itemsData = items.map(item => ({
    ID: item.id,
    Type: item.type,
    Title: item.meta.title || '',
    Content: item.content,
    Status: item.status,
    Created_At: item.created_at,
    Completed_At: item.completed_at || '',
    Date: item.meta.date || '',
    Amount: item.meta.amount || 0,
    Tags: item.meta.tags?.join(', ') || '',
    Payment_Method: item.meta.paymentMethod || '',
    Canonical_Payment_Method: getCanonicalMetaValue(item.meta, 'paymentMethod'),
    Merchant: item.meta.merchant || '',
    Canonical_Merchant: getCanonicalMetaValue(item.meta, 'merchant'),
    Commodity: item.meta.commodity || '',
    Canonical_Commodity: getCommodityForItemAnalytics(item),
    Subcommodity: item.meta.subcommodity || '',
    Canonical_Subcommodity: getSubcommodityForItemAnalytics(item),
    To_Wallet: item.meta.toWallet || '',
    Finance_Type: item.meta.financeType || '',
    Budget_Category: item.meta.budgetCategory || '',
    Skill_Name: item.meta.skillName || '',
    Skill_ID: item.meta.skillId || '',
    Duration_Minutes: item.meta.durationMinutes || 0,
    Shopping_Category: item.meta.shoppingCategory || '',
    Investment_Type: item.meta.investmentAssetType || '',
    Investment_Code: item.meta.investmentSymbol || '',
    Investment_Units: item.meta.investmentUnits || '',
    Investment_Avg_Buy: item.meta.investmentAveragePrice || '',
    Investment_Current_Price: item.meta.investmentCurrentPrice || '',
    Investment_Platform: item.meta.investmentPlatform || '',
    Recurrence_Days: item.meta.recurrenceDays || '',
    Priority: item.meta.priority || 'normal',
    Parent_Todo_ID: item.meta.parentTodoId || '',
    Child_Todo_IDs: item.meta.childTodoIds?.join(', ') || '',
    Deep_Work_Role: item.meta.deepWorkParent ? 'parent' : (item.meta.parentTodoId ? 'step' : ''),
    Deep_Work_Status: item.meta.deepWorkStatus || '',
    Deep_Work_Completion_Mode: item.meta.deepWorkCompletionMode || '',
    Deep_Work_Next_Action: item.meta.deepWorkNextAction || '',
    Deep_Work_Final_Output: item.meta.deepWorkFinalOutput || '',
    Deep_Work_Session_Estimate_Min: item.meta.deepWorkSessionEstimateMinutes || '',
    Deep_Work_Blocker_Status: item.meta.deepWorkBlockerStatus || '',
    Deep_Work_Blocker_Check: item.meta.deepWorkBlockerCheck || '',
    Deep_Work_Step_Index: item.meta.deepWorkStepIndex || '',
    Deep_Work_Step_Count: item.meta.deepWorkStepCount || '',
    Deep_Work_Subtasks: encodeSubtasksForSheet(item.meta.subtasks),
  }));
  
  sheets.push({
    name: "All Items (Raw)",
    data: [
      ["ID", "Type", "Title", "Content", "Status", "Created_At", "Completed_At", "Date", "Amount", "Tags", "Payment_Method", "Canonical_Payment_Method", "Merchant", "Canonical_Merchant", "Commodity", "Canonical_Commodity", "Subcommodity", "Canonical_Subcommodity", "To_Wallet", "Finance_Type", "Budget_Category", "Skill_Name", "Skill_ID", "Duration_Minutes", "Shopping_Category", "Investment_Type", "Investment_Code", "Investment_Units", "Investment_Avg_Buy", "Investment_Current_Price", "Investment_Platform", "Recurrence_Days", "Priority", "Parent_Todo_ID", "Child_Todo_IDs", "Deep_Work_Role", "Deep_Work_Status", "Deep_Work_Completion_Mode", "Deep_Work_Next_Action", "Deep_Work_Final_Output", "Deep_Work_Session_Estimate_Min", "Deep_Work_Blocker_Status", "Deep_Work_Blocker_Check", "Deep_Work_Step_Index", "Deep_Work_Step_Count", "Deep_Work_Subtasks"],
      ...itemsData.map(i => [i.ID, i.Type, i.Title, i.Content, i.Status, i.Created_At, i.Completed_At, i.Date, i.Amount, i.Tags, i.Payment_Method, i.Canonical_Payment_Method, i.Merchant, i.Canonical_Merchant, i.Commodity, i.Canonical_Commodity, i.Subcommodity, i.Canonical_Subcommodity, i.To_Wallet, i.Finance_Type, i.Budget_Category, i.Skill_Name, i.Skill_ID, i.Duration_Minutes, i.Shopping_Category, i.Investment_Type, i.Investment_Code, i.Investment_Units, i.Investment_Avg_Buy, i.Investment_Current_Price, i.Investment_Platform, i.Recurrence_Days, i.Priority, i.Parent_Todo_ID, i.Child_Todo_IDs, i.Deep_Work_Role, i.Deep_Work_Status, i.Deep_Work_Completion_Mode, i.Deep_Work_Next_Action, i.Deep_Work_Final_Output, i.Deep_Work_Session_Estimate_Min, i.Deep_Work_Blocker_Status, i.Deep_Work_Blocker_Check, i.Deep_Work_Step_Index, i.Deep_Work_Step_Count, i.Deep_Work_Subtasks])
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
  const skillsData = skills.map(s => ({
    ID: s.id,
    Name: s.name,
    Weekly_Target_Minutes: s.weeklyTargetMinutes || 0,
    Created_At: s.created_at,
    Color: s.color
  }));
  sheets.push({
    name: "Skills Config",
    data: [
      ["ID", "Name", "Weekly_Target_Minutes", "Created_At", "Color"],
      ...skillsData.map(s => [s.ID, s.Name, s.Weekly_Target_Minutes, s.Created_At, s.Color])
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
  const themesData = Object.entries(monthlyThemes).map(([key, value]) => ({
    Type: 'Theme',
    Key: key,
    Value: value
  }));
  
  const settingsData = [
    { Type: 'Setting', Key: 'Default Collapsed', Value: appSettings.defaultCollapsed ? 'TRUE' : 'FALSE' },
    { Type: 'Setting', Key: 'Hide Money', Value: appSettings.hideMoney ? 'TRUE' : 'FALSE' }
  ];

  sheets.push({
    name: "Themes & Settings",
    data: [
      ["Type", "Key", "Value"],
      ...[...themesData, ...settingsData].map(d => [d.Type, d.Key, d.Value])
    ]
  });

  return sheets;
};
