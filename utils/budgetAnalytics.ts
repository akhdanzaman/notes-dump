import { BrainDumpItem, BudgetConfig, ItemType } from "../types";
import { getCanonicalMetaValue } from "./canonicalization/accessors";
import {
  getCommodityForItemAnalytics,
  getSubcommodityForItemAnalytics,
} from "./canonicalization/transactionInference";
import { ACHIEVED_GOAL_FINANCE_TYPE } from "./financeTypeUtils";
import { getShoppingTransactionDate } from "./shoppingDateUtils";

export interface BudgetSubcommodityBreakdown {
  name: string;
  total: number;
  count: number;
}

export interface BudgetCommodityTransaction {
  id: string;
  content: string;
  amount: number;
  date?: string;
  categoryName: string;
  subcommodity: string;
}

export interface BudgetCommodityBreakdown {
  name: string;
  total: number;
  count: number;
  percentage: number;
  subcommodities: BudgetSubcommodityBreakdown[];
  merchants: BudgetSubcommodityBreakdown[];
  transactions: BudgetCommodityTransaction[];
}

export interface BudgetCategoryInsight {
  categoryId: string;
  categoryName: string;
  color?: string;
  total: number;
  commodities: BudgetCommodityBreakdown[];
}

export type BudgetAnalyticsViewMode = "weekly" | "monthly" | "yearly";

export interface BudgetTrendPoint {
  label: string;
  total: number;
  income: number;
  previousTotal?: number;
  previousIncome?: number;
  percentage: number;
  previousPercentage?: number;
  categories: BudgetSubcommodityBreakdown[];
}

export const getWeekBounds = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
};

const isInPeriod = (
  item: BrainDumpItem,
  financeDate: Date,
  viewMode: BudgetAnalyticsViewMode,
) => {
  const dateStr =
    item.type === ItemType.FINANCE
      ? item.meta.date || item.created_at
      : getShoppingTransactionDate(item);
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (viewMode === "yearly")
    return d.getFullYear() === financeDate.getFullYear();
  if (viewMode === "weekly") {
    const { start, end } = getWeekBounds(financeDate);
    return d.getTime() >= start.getTime() && d.getTime() < end.getTime();
  }
  return (
    d.getFullYear() === financeDate.getFullYear() &&
    d.getMonth() === financeDate.getMonth()
  );
};

const isBudgetUsageLike = (item: BrainDumpItem) => {
  if ((item.meta.amount || 0) <= 0) return false;

  if (item.type === ItemType.FINANCE) {
    if (item.status !== "done") return false;

    const financeType = item.meta.financeType || "expense";

    if (
      financeType === "income" ||
      financeType === "transfer" ||
      financeType === ACHIEVED_GOAL_FINANCE_TYPE
    ) {
      return false;
    }

    // Saving only affects budget analytics when assigned to a budget category.
    if (financeType === "saving") {
      return !!item.meta.budgetCategory;
    }

    return financeType === "expense";
  }

  return (
    (item.type === ItemType.SHOPPING || item.type === ItemType.TODO) &&
    item.status === "done" &&
    item.meta.shoppingCategory !== "saving" &&
    item.meta.shoppingCategory !== "investment" &&
    item.meta.shoppingCategory !== "routine"
  );
};

const increment = (
  map: Map<string, { total: number; count: number }>,
  key: string,
  amount: number,
) => {
  const current = map.get(key) || { total: 0, count: 0 };
  current.total += amount;
  current.count += 1;
  map.set(key, current);
};

const sortedBreakdown = (
  map: Map<string, { total: number; count: number }>,
  limit = 4,
): BudgetSubcommodityBreakdown[] =>
  Array.from(map.entries())
    .map(([name, stats]) => ({ name, total: stats.total, count: stats.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

const getExpenseDate = (item: BrainDumpItem): Date | null => {
  const dateStr =
    item.type === ItemType.FINANCE
      ? item.meta.date || item.completed_at || item.created_at
      : getShoppingTransactionDate(item);
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isIncomeItem = (item: BrainDumpItem) =>
  item.type === ItemType.FINANCE &&
  item.status === "done" &&
  item.meta.financeType === "income" &&
  (item.meta.amount || 0) > 0;

const resolveBudgetCategoryLabel = (
  item: BrainDumpItem,
  budgetConfig?: BudgetConfig,
) => {
  const raw = item.meta.budgetCategory;
  const rule = budgetConfig?.rules.find(
    (candidate) =>
      candidate.id === raw ||
      candidate.name.toLowerCase() === (raw || "").toLowerCase(),
  );
  return rule?.name || raw || "Other";
};

const buildTrendPoint = (
  label: string,
  total: number,
  income: number,
  maxTotal: number,
  categories: Map<string, { total: number; count: number }>,
  previousTotal?: number,
  previousIncome?: number,
): BudgetTrendPoint => ({
  label,
  total,
  income,
  previousTotal,
  previousIncome,
  percentage: maxTotal > 0 ? (total / maxTotal) * 100 : 0,
  previousPercentage:
    previousTotal !== undefined && maxTotal > 0
      ? (previousTotal / maxTotal) * 100
      : undefined,
  categories: sortedBreakdown(categories, 3),
});

export const getBudgetTrendAnalytics = (
  items: BrainDumpItem[],
  financeDate: Date,
  viewMode: BudgetAnalyticsViewMode,
  budgetConfig?: BudgetConfig,
): BudgetTrendPoint[] => {
  const budgetUsageItems = items.filter(isBudgetUsageLike);
  const incomeItems = items.filter(isIncomeItem);

  if (viewMode === "weekly") {
    const { start, end } = getWeekBounds(financeDate);
    const days = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);
      return d;
    });
    const dailyTotals = Array.from({ length: 7 }, () => 0);
    const dailyIncomeTotals = Array.from({ length: 7 }, () => 0);
    const dailyCategories = Array.from(
      { length: 7 },
      () => new Map<string, { total: number; count: number }>(),
    );

    budgetUsageItems.forEach((item) => {
      const d = getExpenseDate(item);
      if (!d || d.getTime() < start.getTime() || d.getTime() >= end.getTime())
        return;
      const dayIndex = Math.floor(
        (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
          start.getTime()) /
          86400000,
      );
      if (dayIndex < 0 || dayIndex > 6) return;
      const amount = item.meta.amount || 0;
      dailyTotals[dayIndex] += amount;
      increment(
        dailyCategories[dayIndex],
        resolveBudgetCategoryLabel(item, budgetConfig),
        amount,
      );
    });

    incomeItems.forEach((item) => {
      const d = getExpenseDate(item);
      if (!d || d.getTime() < start.getTime() || d.getTime() >= end.getTime())
        return;
      const dayIndex = Math.floor(
        (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
          start.getTime()) /
          86400000,
      );
      if (dayIndex < 0 || dayIndex > 6) return;
      dailyIncomeTotals[dayIndex] += item.meta.amount || 0;
    });

    const maxTotal = Math.max(...dailyTotals, ...dailyIncomeTotals, 0);
    return days.map((day, index) =>
      buildTrendPoint(
        day.toLocaleDateString(undefined, { weekday: "short" }),
        dailyTotals[index],
        dailyIncomeTotals[index],
        maxTotal,
        dailyCategories[index],
      ),
    );
  }

  if (viewMode === "yearly") {
    const currentYear = financeDate.getFullYear();
    const monthlyTotals = Array.from({ length: 12 }, () => 0);
    const monthlyIncomeTotals = Array.from({ length: 12 }, () => 0);
    const previousMonthlyTotals = Array.from({ length: 12 }, () => 0);
    const previousMonthlyIncomeTotals = Array.from({ length: 12 }, () => 0);
    const monthlyCategories = Array.from(
      { length: 12 },
      () => new Map<string, { total: number; count: number }>(),
    );

    budgetUsageItems.forEach((item) => {
      const d = getExpenseDate(item);
      if (!d) return;
      const amount = item.meta.amount || 0;
      if (d.getFullYear() === currentYear) {
        const month = d.getMonth();
        monthlyTotals[month] += amount;
        increment(
          monthlyCategories[month],
          resolveBudgetCategoryLabel(item, budgetConfig),
          amount,
        );
      }
      if (d.getFullYear() === currentYear - 1)
        previousMonthlyTotals[d.getMonth()] += amount;
    });

    incomeItems.forEach((item) => {
      const d = getExpenseDate(item);
      if (!d) return;
      const amount = item.meta.amount || 0;
      if (d.getFullYear() === currentYear)
        monthlyIncomeTotals[d.getMonth()] += amount;
      if (d.getFullYear() === currentYear - 1)
        previousMonthlyIncomeTotals[d.getMonth()] += amount;
    });

    const maxTotal = Math.max(
      ...monthlyTotals,
      ...monthlyIncomeTotals,
      ...previousMonthlyTotals,
      ...previousMonthlyIncomeTotals,
      0,
    );
    return monthlyTotals.map((total, monthIndex) =>
      buildTrendPoint(
        new Date(currentYear, monthIndex, 1).toLocaleDateString(undefined, {
          month: "short",
        }),
        total,
        monthlyIncomeTotals[monthIndex],
        maxTotal,
        monthlyCategories[monthIndex],
        previousMonthlyTotals[monthIndex],
        previousMonthlyIncomeTotals[monthIndex],
      ),
    );
  }

  const year = financeDate.getFullYear();
  const month = financeDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyTotals = Array.from({ length: daysInMonth }, () => 0);
  const dailyIncomeTotals = Array.from({ length: daysInMonth }, () => 0);
  const dailyCategories = Array.from(
    { length: daysInMonth },
    () => new Map<string, { total: number; count: number }>(),
  );

  budgetUsageItems.forEach((item) => {
    const d = getExpenseDate(item);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) return;
    const dayIndex = d.getDate() - 1;
    const amount = item.meta.amount || 0;
    dailyTotals[dayIndex] += amount;
    increment(
      dailyCategories[dayIndex],
      resolveBudgetCategoryLabel(item, budgetConfig),
      amount,
    );
  });

  incomeItems.forEach((item) => {
    const d = getExpenseDate(item);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) return;
    dailyIncomeTotals[d.getDate() - 1] += item.meta.amount || 0;
  });

  const maxTotal = Math.max(...dailyTotals, ...dailyIncomeTotals, 0);
  return dailyTotals.map((total, index) =>
    buildTrendPoint(
      String(index + 1),
      total,
      dailyIncomeTotals[index],
      maxTotal,
      dailyCategories[index],
    ),
  );
};

export const getBudgetCategoryAnalytics = (
  items: BrainDumpItem[],
  financeDate: Date,
  budgetConfig: BudgetConfig,
  viewMode: BudgetAnalyticsViewMode,
): BudgetCategoryInsight[] => {
  const categoryMap = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      color?: string;
      total: number;
      commodities: Map<
        string,
        {
          total: number;
          count: number;
          subcommodities: Map<string, { total: number; count: number }>;
          merchants: Map<string, { total: number; count: number }>;
          transactions: BudgetCommodityTransaction[];
        }
      >;
    }
  >();

  const resolveCategory = (raw?: string) => {
    const rule = budgetConfig.rules.find(
      (candidate) =>
        candidate.id === raw ||
        candidate.name.toLowerCase() === (raw || "").toLowerCase(),
    );
    return rule || { id: "uncategorized", name: "Other", color: "bg-gray-400" };
  };

  items
    .filter(
      (item) =>
        isBudgetUsageLike(item) && isInPeriod(item, financeDate, viewMode),
    )
    .forEach((item) => {
      const amount = item.meta.amount || 0;
      const category = resolveCategory(item.meta.budgetCategory);
      const categoryBucket = categoryMap.get(category.id) || {
        categoryId: category.id,
        categoryName: category.name,
        color: category.color,
        total: 0,
        commodities: new Map(),
      };

      const commodity = getCommodityForItemAnalytics(item);
      const subcommodity = getSubcommodityForItemAnalytics(item);
      const merchant =
        getCanonicalMetaValue(item.meta, "merchant") ||
        item.meta.merchant ||
        "";
      const commodityBucket = categoryBucket.commodities.get(commodity) || {
        total: 0,
        count: 0,
        subcommodities: new Map(),
        merchants: new Map(),
        transactions: [],
      };

      categoryBucket.total += amount;
      commodityBucket.total += amount;
      commodityBucket.count += 1;
      increment(commodityBucket.subcommodities, subcommodity, amount);
      if (merchant) increment(commodityBucket.merchants, merchant, amount);
      commodityBucket.transactions.push({
        id: item.id,
        content: item.content,
        amount,
        date: getExpenseDate(item)?.toISOString(),
        categoryName: category.name,
        subcommodity,
      });

      categoryBucket.commodities.set(commodity, commodityBucket);
      categoryMap.set(category.id, categoryBucket);
    });

  return Array.from(categoryMap.values())
    .map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      color: category.color,
      total: category.total,
      commodities: Array.from(category.commodities.entries())
        .map(([name, stats]) => ({
          name,
          total: stats.total,
          count: stats.count,
          percentage:
            category.total > 0 ? (stats.total / category.total) * 100 : 0,
          subcommodities: sortedBreakdown(stats.subcommodities, 3),
          merchants: sortedBreakdown(stats.merchants, 2),
          transactions: stats.transactions
            .slice()
            .sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 4),
    }))
    .sort((a, b) => b.total - a.total);
};
