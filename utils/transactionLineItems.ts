import {
  BrainDumpItem,
  TransactionLineAllocationMode,
  TransactionLineItem,
} from '../types';

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

const normalizeAmount = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeCurrency = (value: unknown): string | undefined => {
  const normalized = normalizeText(value).toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
};

const normalizeAllocationMode = (
  value: unknown,
  kind: TransactionLineItem['kind'],
  budgetCategory?: string,
): TransactionLineAllocationMode => {
  if (value === 'category' || value === 'proportional' || value === 'uncategorized') return value;
  if (budgetCategory) return 'category';
  return kind && kind !== 'item' ? 'proportional' : 'category';
};

export const createTransactionLineItemId = (prefix = 'tx-line'): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const sanitizeTransactionLineItems = (value: unknown): TransactionLineItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') return undefined;
      const item = raw as Partial<TransactionLineItem>;
      const name = normalizeText(item.name);
      const amount = normalizeAmount(item.amount);
      if (!name || amount === undefined || amount === 0) return undefined;

      const quantity = normalizeText(item.quantity);
      const unitPrice = normalizeAmount(item.unitPrice);
      const budgetCategory = normalizeText(item.budgetCategory);
      const commodity = normalizeText(item.commodity);
      const subcommodity = normalizeText(item.subcommodity);
      const kind = ['item', 'tax', 'fee', 'discount', 'adjustment'].includes(String(item.kind))
        ? item.kind
        : 'item';
      const allocationMode = normalizeAllocationMode(item.allocationMode, kind, budgetCategory || undefined);
      const originalAmount = normalizeAmount(item.originalAmount);
      const originalUnitPrice = normalizeAmount(item.originalUnitPrice);
      const originalCurrency = normalizeCurrency(item.originalCurrency);

      return {
        id: normalizeText(item.id) || `tx-line-${index + 1}`,
        name,
        amount,
        quantity: quantity || undefined,
        unitPrice,
        budgetCategory: allocationMode === 'category' ? (budgetCategory || undefined) : undefined,
        commodity: commodity || undefined,
        subcommodity: subcommodity || undefined,
        kind,
        allocationMode,
        originalAmount,
        originalUnitPrice,
        originalCurrency,
      } as TransactionLineItem;
    })
    .filter(Boolean) as TransactionLineItem[];
};

export const sumTransactionLineItems = (lineItems?: TransactionLineItem[]): number =>
  sanitizeTransactionLineItems(lineItems).reduce((sum, item) => sum + item.amount, 0);

export const encodeTransactionLineItemsForSheet = (lineItems?: TransactionLineItem[]): string => {
  const sanitized = sanitizeTransactionLineItems(lineItems);
  return sanitized.length ? JSON.stringify(sanitized) : '';
};

export const parseTransactionLineItemsFromSheet = (value: unknown): TransactionLineItem[] => {
  if (Array.isArray(value)) return sanitizeTransactionLineItems(value);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    return sanitizeTransactionLineItems(JSON.parse(value));
  } catch {
    return [];
  }
};

export const convertTransactionLineItemsToIdr = (
  lineItems: TransactionLineItem[],
  currency: string,
  exchangeRateToIdr = 1,
): TransactionLineItem[] => {
  const normalizedCurrency = normalizeCurrency(currency) || 'IDR';
  const rate = normalizedCurrency === 'IDR' ? 1 : Number(exchangeRateToIdr);
  if (!Number.isFinite(rate) || rate <= 0) return [];

  return sanitizeTransactionLineItems(lineItems).map((line) => ({
    ...line,
    originalAmount: normalizedCurrency === 'IDR' ? undefined : line.amount,
    originalUnitPrice: normalizedCurrency === 'IDR' ? undefined : line.unitPrice,
    originalCurrency: normalizedCurrency === 'IDR' ? undefined : normalizedCurrency,
    amount: Math.round(line.amount * rate * 100) / 100,
    unitPrice: line.unitPrice === undefined ? undefined : Math.round(line.unitPrice * rate * 100) / 100,
  }));
};

export interface TransactionBudgetAllocation {
  id: string;
  name: string;
  amount: number;
  budgetCategory?: string;
  commodity?: string;
  subcommodity?: string;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const splitProportionally = (
  amount: number,
  weights: { category?: string; weight: number }[],
): { category?: string; amount: number }[] => {
  const usable = weights.filter((entry) => entry.weight > 0);
  const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0);
  if (!usable.length || totalWeight <= 0) return [{ amount }];

  let assigned = 0;
  return usable.map((entry, index) => {
    const value = index === usable.length - 1
      ? roundMoney(amount - assigned)
      : roundMoney(amount * (entry.weight / totalWeight));
    assigned = roundMoney(assigned + value);
    return { category: entry.category, amount: value };
  });
};

export const getTransactionBudgetAllocations = (item: BrainDumpItem): TransactionBudgetAllocation[] => {
  const lineItems = sanitizeTransactionLineItems(item.meta.transactionLineItems);
  if (!lineItems.length) {
    const amount = item.meta.amount || 0;
    return amount !== 0
      ? [{
          id: item.id,
          name: item.content,
          amount,
          budgetCategory: item.meta.budgetCategory,
          commodity: item.meta.commodity,
          subcommodity: item.meta.subcommodity,
        }]
      : [];
  }

  const directLines = lineItems.filter((line) => line.allocationMode !== 'proportional');
  const proportionalLines = lineItems.filter((line) => line.allocationMode === 'proportional');
  const directAllocations: TransactionBudgetAllocation[] = directLines.map((line) => ({
    id: `${item.id}:${line.id}`,
    name: line.name,
    amount: line.amount,
    budgetCategory: line.allocationMode === 'uncategorized'
      ? undefined
      : (line.budgetCategory || item.meta.budgetCategory),
    commodity: line.commodity || item.meta.commodity,
    subcommodity: line.subcommodity || item.meta.subcommodity,
  }));

  const weightByCategory = new Map<string, number>();
  let uncategorizedWeight = 0;
  directAllocations.forEach((allocation) => {
    const weight = Math.max(allocation.amount, 0);
    if (weight <= 0) return;
    if (allocation.budgetCategory) {
      weightByCategory.set(
        allocation.budgetCategory,
        (weightByCategory.get(allocation.budgetCategory) || 0) + weight,
      );
    } else {
      uncategorizedWeight += weight;
    }
  });

  const weights = [
    ...Array.from(weightByCategory.entries()).map(([category, weight]) => ({ category, weight })),
    ...(uncategorizedWeight > 0 ? [{ category: undefined, weight: uncategorizedWeight }] : []),
  ];

  if (!weights.length && item.meta.budgetCategory) {
    weights.push({ category: item.meta.budgetCategory, weight: 1 });
  }

  const proportionalAllocations = proportionalLines.flatMap((line) =>
    splitProportionally(line.amount, weights).map((split, index) => ({
      id: `${item.id}:${line.id}:share-${index + 1}`,
      name: line.name,
      amount: split.amount,
      budgetCategory: split.category,
      commodity: line.commodity || item.meta.commodity,
      subcommodity: line.subcommodity || item.meta.subcommodity,
    })),
  );

  return [...directAllocations, ...proportionalAllocations].filter((allocation) => allocation.amount !== 0);
};

export const getTransactionCategoryIds = (item: BrainDumpItem): string[] =>
  Array.from(new Set(
    getTransactionBudgetAllocations(item)
      .map((allocation) => allocation.budgetCategory)
      .filter((value): value is string => !!value),
  ));

export const hasMixedTransactionCategories = (item: BrainDumpItem): boolean =>
  getTransactionCategoryIds(item).length > 1;

export const getTransactionCategorySummary = (
  item: BrainDumpItem,
): { budgetCategory?: string; amount: number }[] => {
  const totals = new Map<string, number>();
  getTransactionBudgetAllocations(item).forEach((allocation) => {
    const key = allocation.budgetCategory || '';
    totals.set(key, roundMoney((totals.get(key) || 0) + allocation.amount));
  });
  return Array.from(totals.entries())
    .map(([budgetCategory, amount]) => ({ budgetCategory: budgetCategory || undefined, amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
};

export const countUncategorizedTransactionLines = (
  item: BrainDumpItem,
): number => {
  const lines = sanitizeTransactionLineItems(item.meta.transactionLineItems);
  return lines.filter((line) => {
    if (line.allocationMode === 'proportional') return false;
    if (line.allocationMode === 'uncategorized') return true;
    return !line.budgetCategory && !item.meta.budgetCategory;
  }).length;
};
