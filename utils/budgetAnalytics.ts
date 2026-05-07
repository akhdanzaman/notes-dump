import { BrainDumpItem, BudgetConfig, ItemType } from '../types';
import { getCanonicalMetaValue } from './canonicalization/accessors';
import { getCommodityCanonicalForAnalytics, getSubcommodityCanonicalForAnalytics } from './canonicalization/defaults';
import { ACHIEVED_GOAL_FINANCE_TYPE } from './financeTypeUtils';
import { getShoppingTransactionDate } from './shoppingDateUtils';

export interface BudgetSubcommodityBreakdown {
  name: string;
  total: number;
  count: number;
}

export interface BudgetCommodityBreakdown {
  name: string;
  total: number;
  count: number;
  percentage: number;
  subcommodities: BudgetSubcommodityBreakdown[];
  merchants: BudgetSubcommodityBreakdown[];
}

export interface BudgetCategoryInsight {
  categoryId: string;
  categoryName: string;
  color?: string;
  total: number;
  commodities: BudgetCommodityBreakdown[];
}

const isInPeriod = (item: BrainDumpItem, financeDate: Date, viewMode: 'monthly' | 'yearly') => {
  const dateStr = item.type === ItemType.FINANCE
    ? (item.meta.date || item.created_at)
    : getShoppingTransactionDate(item);
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (viewMode === 'yearly') return d.getFullYear() === financeDate.getFullYear();
  return d.getFullYear() === financeDate.getFullYear() && d.getMonth() === financeDate.getMonth();
};

const isExpenseLike = (item: BrainDumpItem) => {
  if ((item.meta.amount || 0) <= 0) return false;
  if (item.type === ItemType.FINANCE) {
    if (item.status !== 'done') return false;
    const financeType = item.meta.financeType || 'expense';
    return financeType !== 'income'
      && financeType !== 'transfer'
      && financeType !== 'saving'
      && financeType !== ACHIEVED_GOAL_FINANCE_TYPE;
  }

  return (item.type === ItemType.SHOPPING || item.type === ItemType.TODO)
    && item.status === 'done'
    && item.meta.shoppingCategory !== 'saving'
    && item.meta.shoppingCategory !== 'investment'
    && item.meta.shoppingCategory !== 'routine';
};

const increment = (map: Map<string, { total: number; count: number }>, key: string, amount: number) => {
  const current = map.get(key) || { total: 0, count: 0 };
  current.total += amount;
  current.count += 1;
  map.set(key, current);
};

const sortedBreakdown = (map: Map<string, { total: number; count: number }>, limit = 4): BudgetSubcommodityBreakdown[] => Array.from(map.entries())
  .map(([name, stats]) => ({ name, total: stats.total, count: stats.count }))
  .sort((a, b) => b.total - a.total)
  .slice(0, limit);

export const getBudgetCategoryAnalytics = (
  items: BrainDumpItem[],
  financeDate: Date,
  budgetConfig: BudgetConfig,
  viewMode: 'monthly' | 'yearly'
): BudgetCategoryInsight[] => {
  const categoryMap = new Map<string, {
    categoryId: string;
    categoryName: string;
    color?: string;
    total: number;
    commodities: Map<string, {
      total: number;
      count: number;
      subcommodities: Map<string, { total: number; count: number }>;
      merchants: Map<string, { total: number; count: number }>;
    }>;
  }>();

  const resolveCategory = (raw?: string) => {
    const rule = budgetConfig.rules.find(candidate => candidate.id === raw || candidate.name.toLowerCase() === (raw || '').toLowerCase());
    return rule || { id: 'uncategorized', name: 'Other', color: 'bg-gray-400' };
  };

  items
    .filter(item => isExpenseLike(item) && isInPeriod(item, financeDate, viewMode))
    .forEach(item => {
      const amount = item.meta.amount || 0;
      const category = resolveCategory(item.meta.budgetCategory);
      const categoryBucket = categoryMap.get(category.id) || {
        categoryId: category.id,
        categoryName: category.name,
        color: category.color,
        total: 0,
        commodities: new Map(),
      };

      const commodity = getCommodityCanonicalForAnalytics(item.meta);
      const subcommodity = getSubcommodityCanonicalForAnalytics(item.meta);
      const merchant = getCanonicalMetaValue(item.meta, 'merchant') || item.meta.merchant || '';
      const commodityBucket = categoryBucket.commodities.get(commodity) || {
        total: 0,
        count: 0,
        subcommodities: new Map(),
        merchants: new Map(),
      };

      categoryBucket.total += amount;
      commodityBucket.total += amount;
      commodityBucket.count += 1;
      increment(commodityBucket.subcommodities, subcommodity, amount);
      if (merchant) increment(commodityBucket.merchants, merchant, amount);

      categoryBucket.commodities.set(commodity, commodityBucket);
      categoryMap.set(category.id, categoryBucket);
    });

  return Array.from(categoryMap.values())
    .map(category => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      color: category.color,
      total: category.total,
      commodities: Array.from(category.commodities.entries())
        .map(([name, stats]) => ({
          name,
          total: stats.total,
          count: stats.count,
          percentage: category.total > 0 ? (stats.total / category.total) * 100 : 0,
          subcommodities: sortedBreakdown(stats.subcommodities, 3),
          merchants: sortedBreakdown(stats.merchants, 2),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 4),
    }))
    .sort((a, b) => b.total - a.total);
};
