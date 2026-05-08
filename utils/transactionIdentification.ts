import { BrainDumpItem, BudgetConfig, FinanceType, ItemType, Wallet } from '../types';
import { getCanonicalMetaValue, getRawMetaValue } from './canonicalization/accessors';
import { CANONICAL_OTHER_VALUE, normalizeCanonicalFallback } from './canonicalization/defaults';
import { ACHIEVED_GOAL_FINANCE_TYPE } from './financeTypeUtils';
import { getShoppingDueDate, getShoppingTransactionDate } from './shoppingDateUtils';
import { getCommodityForItemAnalytics, getSubcommodityForItemAnalytics } from './canonicalization/transactionInference';

export type TransactionIdentificationKind =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'saving'
  | 'achieved_goal'
  | 'implicit_expense'
  | 'planned_expense'
  | 'non_transaction';

export type TransactionWalletDirection = 'increase' | 'decrease' | 'debt_increase' | 'debt_decrease';
export type TransactionWalletRole = 'source' | 'destination';

export interface TransactionWalletEffect {
  walletKey: string;
  walletId?: string;
  walletName?: string;
  walletType?: Wallet['type'];
  role: TransactionWalletRole;
  direction: TransactionWalletDirection;
  amount: number;
  reason: string;
}

export interface TransactionAnalyticsIdentity {
  includeInTransactionList: boolean;
  countsAsIncome: boolean;
  countsAsExpense: boolean;
  countsAsSavings: boolean;
  countsAsTransfer: boolean;
  countsAsBudgetActual: boolean;
  countsAsBudgetPlanned: boolean;
  countsAsSpendAnatomy: boolean;
  countsAsWalletMovement: boolean;
  excludeReason?: string;
}

export interface TransactionIdentification {
  id: string;
  content: string;
  itemType: ItemType;
  status: BrainDumpItem['status'];
  kind: TransactionIdentificationKind;
  financeType?: FinanceType;
  amount: number;
  signedAmount: number;
  date?: Date;
  dateIso?: string;
  sourceWalletKey?: string;
  destinationWalletKey?: string;
  budgetCategoryId?: string;
  budgetCategoryName?: string;
  commodity: string;
  subcommodity: string;
  merchant?: string;
  tags: string[];
  analytics: TransactionAnalyticsIdentity;
  walletEffects: TransactionWalletEffect[];
  qualityFlags: string[];
}

export interface TransactionIdentificationSummary {
  total: number;
  actualIncome: number;
  actualExpense: number;
  plannedExpense: number;
  savings: number;
  transfers: number;
  netCashflow: number;
  spendAnatomyTotal: number;
  byKind: Record<TransactionIdentificationKind, { total: number; count: number }>;
  byCommodity: Array<{ name: string; total: number; count: number }>;
  byBudgetCategory: Array<{ id: string; name: string; total: number; count: number }>;
  qualityFlags: Array<{ flag: string; count: number; affectedAmount: number }>;
}

const emptyKindSummary = (): Record<TransactionIdentificationKind, { total: number; count: number }> => ({
  income: { total: 0, count: 0 },
  expense: { total: 0, count: 0 },
  transfer: { total: 0, count: 0 },
  saving: { total: 0, count: 0 },
  achieved_goal: { total: 0, count: 0 },
  implicit_expense: { total: 0, count: 0 },
  planned_expense: { total: 0, count: 0 },
  non_transaction: { total: 0, count: 0 },
});

export const resolveTransactionWalletKey = (wallets: Wallet[], value?: string) => {
  const normalized = value?.toLowerCase().trim();
  if (!normalized) return '';
  const wallet = wallets.find(w => w.id.toLowerCase() === normalized || w.name.toLowerCase() === normalized);
  return wallet ? wallet.name.toLowerCase() : normalized;
};

const getWallet = (wallets: Wallet[], key?: string) => key
  ? wallets.find(wallet => wallet.name.toLowerCase() === key || wallet.id.toLowerCase() === key)
  : undefined;

export const resolveTransactionDate = (item: BrainDumpItem, includePlannedDueDate = false): Date | undefined => {
  const dateStr = item.type === ItemType.FINANCE
    ? (item.meta.date || item.completed_at || item.created_at)
    : (getShoppingTransactionDate(item) || (includePlannedDueDate ? getShoppingDueDate(item) : undefined) || item.completed_at || item.created_at);
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const resolveBudgetCategory = (item: BrainDumpItem, budgetConfig?: BudgetConfig) => {
  const raw = item.meta.budgetCategory;
  if (!raw) return undefined;
  const rule = budgetConfig?.rules.find(candidate => candidate.id === raw || candidate.name.toLowerCase() === raw.toLowerCase());
  return rule ? { id: rule.id, name: rule.name } : { id: raw, name: raw };
};

const pushWalletEffect = (
  effects: TransactionWalletEffect[],
  wallets: Wallet[],
  walletKey: string | undefined,
  role: TransactionWalletRole,
  amount: number,
  directionForAsset: TransactionWalletDirection,
  directionForCreditCard: TransactionWalletDirection,
  reason: string
) => {
  if (!walletKey || amount <= 0) return;
  const wallet = getWallet(wallets, walletKey);
  if (!wallet) return;
  effects.push({
    walletKey,
    walletId: wallet.id,
    walletName: wallet.name,
    walletType: wallet.type,
    role,
    direction: wallet.type === 'cc' ? directionForCreditCard : directionForAsset,
    amount,
    reason,
  });
};

const isBudgetSpendCategory = (item: BrainDumpItem) => item.meta.shoppingCategory !== 'saving'
  && item.meta.shoppingCategory !== 'investment'
  && item.meta.shoppingCategory !== 'routine';

const isCanonicalFallbackOnly = (item: BrainDumpItem, field: 'commodity' | 'subcommodity') => {
  const canonical = item.meta.canonical?.[field];
  if (!canonical) return false;
  return normalizeCanonicalFallback(canonical.value) === CANONICAL_OTHER_VALUE
    && canonical.source === 'system_rule'
    && (canonical.confidence ?? 1) <= 0.3;
};

export const identifyTransaction = (
  item: BrainDumpItem,
  options: { wallets?: Wallet[]; budgetConfig?: BudgetConfig } = {}
): TransactionIdentification => {
  const wallets = options.wallets || [];
  const amount = item.meta.amount || 0;
  const financeType = item.meta.financeType;
  const isFinance = item.type === ItemType.FINANCE;
  const isDone = item.status === 'done';
  const isPending = item.status === 'pending';
  const isImplicitExpense = (item.type === ItemType.SHOPPING || item.type === ItemType.TODO)
    && isDone
    && amount > 0
    && isBudgetSpendCategory(item);
  const isPlannedShoppingExpense = item.type === ItemType.SHOPPING
    && isPending
    && amount > 0
    && isBudgetSpendCategory(item);

  let kind: TransactionIdentificationKind = 'non_transaction';
  if (isFinance && amount > 0) {
    if (financeType === 'income') kind = 'income';
    else if (financeType === 'transfer') kind = 'transfer';
    else if (financeType === 'saving') kind = 'saving';
    else if (financeType === ACHIEVED_GOAL_FINANCE_TYPE) kind = 'achieved_goal';
    else kind = isDone ? 'expense' : 'planned_expense';
  } else if (isImplicitExpense) {
    kind = 'implicit_expense';
  } else if (isPlannedShoppingExpense) {
    kind = 'planned_expense';
  }

  const canonicalSourceWalletKey = resolveTransactionWalletKey(wallets, getCanonicalMetaValue(item.meta, 'paymentMethod'));
  const sourceWalletKey = canonicalSourceWalletKey && getWallet(wallets, canonicalSourceWalletKey)
    ? canonicalSourceWalletKey
    : resolveTransactionWalletKey(wallets, getRawMetaValue(item.meta, 'paymentMethod'));
  const destinationWalletKey = resolveTransactionWalletKey(wallets, item.meta.toWallet);
  const budgetCategory = resolveBudgetCategory(item, options.budgetConfig);
  const commodity = getCommodityForItemAnalytics(item);
  const subcommodity = getSubcommodityForItemAnalytics(item);
  const merchant = getCanonicalMetaValue(item.meta, 'merchant') || item.meta.merchant || undefined;

  const countsAsIncome = isDone && kind === 'income';
  const countsAsTransfer = kind === 'transfer';
  const countsAsSavings = isDone && kind === 'saving';
  const countsAsBudgetActual = isDone && (kind === 'expense' || kind === 'implicit_expense' || kind === 'saving');
  const countsAsBudgetPlanned = isPending && (kind === 'planned_expense' || kind === 'saving');
  const countsAsSpendAnatomy = isDone && (kind === 'expense' || kind === 'implicit_expense');
  const countsAsExpense = countsAsBudgetActual;
  const countsAsWalletMovement = isDone && amount > 0 && (isFinance || isImplicitExpense);

  const analytics: TransactionAnalyticsIdentity = {
    includeInTransactionList: (isFinance && (isDone || isPending) && amount > 0) || isImplicitExpense,
    countsAsIncome,
    countsAsExpense,
    countsAsSavings,
    countsAsTransfer,
    countsAsBudgetActual,
    countsAsBudgetPlanned,
    countsAsSpendAnatomy,
    countsAsWalletMovement,
    excludeReason: kind === 'non_transaction'
      ? 'Not a money transaction.'
      : kind === 'transfer'
        ? 'Internal transfer affects wallets but not spend analytics.'
        : kind === 'achieved_goal'
          ? 'Achieved goal affects wallet balance but stays out of expense analytics.'
          : undefined,
  };

  const walletEffects: TransactionWalletEffect[] = [];
  if (countsAsWalletMovement && sourceWalletKey && getWallet(wallets, sourceWalletKey)) {
    if (kind === 'income') {
      pushWalletEffect(walletEffects, wallets, sourceWalletKey, 'source', amount, 'increase', 'debt_decrease', 'income received');
    } else if (kind === 'transfer') {
      pushWalletEffect(walletEffects, wallets, sourceWalletKey, 'source', amount, 'decrease', 'debt_increase', 'transfer source');
      pushWalletEffect(walletEffects, wallets, destinationWalletKey, 'destination', amount, 'increase', 'debt_decrease', 'transfer destination');
    } else if (kind === 'saving') {
      if (destinationWalletKey && getWallet(wallets, destinationWalletKey)) {
        pushWalletEffect(walletEffects, wallets, sourceWalletKey, 'source', amount, 'decrease', 'debt_increase', 'saving source');
        pushWalletEffect(walletEffects, wallets, destinationWalletKey, 'destination', amount, 'increase', 'increase', 'saving destination');
      }
    } else {
      pushWalletEffect(walletEffects, wallets, sourceWalletKey, 'source', amount, 'decrease', 'debt_increase', 'expense paid');
    }
  }

  const qualityFlags: string[] = [];
  if (kind !== 'non_transaction' && amount <= 0) qualityFlags.push('missing_amount');
  if (countsAsBudgetActual || countsAsBudgetPlanned || countsAsSpendAnatomy) {
    if (!budgetCategory?.id) qualityFlags.push('missing_budget_category');
  }
  if (countsAsSpendAnatomy) {
    if (commodity === CANONICAL_OTHER_VALUE || isCanonicalFallbackOnly(item, 'commodity')) qualityFlags.push('weak_commodity_identity');
    if (subcommodity === CANONICAL_OTHER_VALUE || isCanonicalFallbackOnly(item, 'subcommodity')) qualityFlags.push('weak_subcommodity_identity');
  }
  if (countsAsWalletMovement && !sourceWalletKey) qualityFlags.push('missing_source_wallet');
  if (kind === 'transfer' && !destinationWalletKey) qualityFlags.push('missing_transfer_destination');
  if (kind === 'saving' && !item.meta.savingGoalId) qualityFlags.push('missing_saving_goal');

  const date = resolveTransactionDate(item, true);
  const signedAmount = countsAsIncome ? amount : countsAsBudgetActual || kind === 'achieved_goal' ? -amount : 0;

  return {
    id: item.id,
    content: item.content,
    itemType: item.type,
    status: item.status,
    kind,
    financeType,
    amount,
    signedAmount,
    date,
    dateIso: date?.toISOString(),
    sourceWalletKey: sourceWalletKey || undefined,
    destinationWalletKey: destinationWalletKey || undefined,
    budgetCategoryId: budgetCategory?.id,
    budgetCategoryName: budgetCategory?.name,
    commodity,
    subcommodity,
    merchant,
    tags: item.meta.tags || [],
    analytics,
    walletEffects,
    qualityFlags,
  };
};

export const identifyTransactions = (
  items: BrainDumpItem[],
  options: { wallets?: Wallet[]; budgetConfig?: BudgetConfig } = {}
) => items.map(item => identifyTransaction(item, options));

const incrementSummaryMap = (map: Map<string, { name?: string; total: number; count: number }>, key: string, amount: number, name?: string) => {
  const current = map.get(key) || { name, total: 0, count: 0 };
  current.total += amount;
  current.count += 1;
  if (name) current.name = name;
  map.set(key, current);
};

export const summarizeTransactionIdentifications = (identifications: TransactionIdentification[]): TransactionIdentificationSummary => {
  const byKind = emptyKindSummary();
  const byCommodity = new Map<string, { total: number; count: number }>();
  const byBudgetCategory = new Map<string, { name?: string; total: number; count: number }>();
  const qualityFlags = new Map<string, { total: number; count: number }>();

  let actualIncome = 0;
  let actualExpense = 0;
  let plannedExpense = 0;
  let savings = 0;
  let transfers = 0;
  let spendAnatomyTotal = 0;

  identifications.forEach(identity => {
    byKind[identity.kind].count += 1;
    byKind[identity.kind].total += identity.amount;

    if (identity.analytics.countsAsIncome) actualIncome += identity.amount;
    if (identity.analytics.countsAsBudgetActual) actualExpense += identity.amount;
    if (identity.analytics.countsAsBudgetPlanned) plannedExpense += identity.amount;
    if (identity.analytics.countsAsSavings) savings += identity.amount;
    if (identity.analytics.countsAsTransfer) transfers += identity.amount;
    if (identity.analytics.countsAsSpendAnatomy) {
      spendAnatomyTotal += identity.amount;
      incrementSummaryMap(byCommodity, identity.commodity, identity.amount);
      if (identity.budgetCategoryId) incrementSummaryMap(byBudgetCategory, identity.budgetCategoryId, identity.amount, identity.budgetCategoryName);
    }

    identity.qualityFlags.forEach(flag => incrementSummaryMap(qualityFlags, flag, identity.amount));
  });

  return {
    total: identifications.length,
    actualIncome,
    actualExpense,
    plannedExpense,
    savings,
    transfers,
    netCashflow: actualIncome - actualExpense,
    spendAnatomyTotal,
    byKind,
    byCommodity: Array.from(byCommodity.entries())
      .map(([name, stats]) => ({ name, total: stats.total, count: stats.count }))
      .sort((a, b) => b.total - a.total),
    byBudgetCategory: Array.from(byBudgetCategory.entries())
      .map(([id, stats]) => ({ id, name: stats.name || id, total: stats.total, count: stats.count }))
      .sort((a, b) => b.total - a.total),
    qualityFlags: Array.from(qualityFlags.entries())
      .map(([flag, stats]) => ({ flag, count: stats.count, affectedAmount: stats.total }))
      .sort((a, b) => b.affectedAmount - a.affectedAmount),
  };
};
