import { BrainDumpItem, TransactionLineItem } from '../types';

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

const normalizeAmount = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

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

      return {
        id: normalizeText(item.id) || `tx-line-${index + 1}`,
        name,
        amount,
        quantity: quantity || undefined,
        unitPrice,
        budgetCategory: budgetCategory || undefined,
        commodity: commodity || undefined,
        subcommodity: subcommodity || undefined,
        kind,
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

export interface TransactionBudgetAllocation {
  id: string;
  name: string;
  amount: number;
  budgetCategory?: string;
  commodity?: string;
  subcommodity?: string;
}

export const getTransactionBudgetAllocations = (item: BrainDumpItem): TransactionBudgetAllocation[] => {
  const lineItems = sanitizeTransactionLineItems(item.meta.transactionLineItems);
  if (!lineItems.length) {
    const amount = item.meta.amount || 0;
    return amount > 0
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

  return lineItems.map((line) => ({
    id: `${item.id}:${line.id}`,
    name: line.name,
    amount: line.amount,
    budgetCategory: line.budgetCategory || item.meta.budgetCategory,
    commodity: line.commodity || item.meta.commodity,
    subcommodity: line.subcommodity || item.meta.subcommodity,
  }));
};

export const getTransactionCategoryIds = (item: BrainDumpItem): string[] =>
  Array.from(new Set(
    getTransactionBudgetAllocations(item)
      .map((allocation) => allocation.budgetCategory)
      .filter((value): value is string => !!value),
  ));

export const hasMixedTransactionCategories = (item: BrainDumpItem): boolean =>
  getTransactionCategoryIds(item).length > 1;
