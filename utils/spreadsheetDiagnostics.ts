import { BrainDumpItem, BudgetConfig, ItemType, Wallet } from '../types';
import { getCanonicalMetaValue, getCanonicalOrRawItemValue } from './canonicalization/accessors';
import { ACHIEVED_GOAL_FINANCE_TYPE } from './financeTypeUtils';
import { findSemanticDuplicateReviewCandidates } from './itemDedupe';
import { inspectStructuredFinanceField, normalizeReferenceKey, referenceMatch, StructuredFinanceField } from './structuredFieldValidation';
import { getTransactionBudgetAllocations } from './transactionLineItems';

export type DataQualitySeverity = 'critical' | 'warning' | 'info';

export interface DataQualityIssue {
  severity: DataQualitySeverity;
  itemId: string;
  sheet: string;
  reason: string;
  suggestedFix: string;
}

export interface DailyMoneyDriverSummary {
  todayExpense: number;
  yesterdayExpense: number;
  todayIncome: number;
  yesterdayIncome: number;
  expenseDelta: number;
  incomeDelta: number;
  spendLine: string;
  mainDriverLine: string;
  walletMovementLine: string;
  patternLine: string;
}

export interface SpreadsheetHealthSummary {
  generatedAt: string;
  guideLine: string;
  syncHealthLine: string;
  dataHealthLine: string;
  itemCountLine: string;
}

const fmtCurrency = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(value || 0);

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getItemTimestamp = (item: BrainDumpItem) => {
  const raw = item.type === ItemType.FINANCE
    ? (item.meta.date || item.completed_at || item.created_at)
    : (item.completed_at || item.meta.date || item.meta.dateTime || item.meta.start || item.created_at);
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : new Date(item.created_at).getTime();
};

const getWalletKey = (item: BrainDumpItem) => getCanonicalOrRawItemValue(item, 'paymentMethod') || item.meta.paymentMethod || '';

const getWalletLabel = (walletKey: string, wallets: Wallet[]) => {
  if (!walletKey) return 'Unknown wallet';
  return referenceMatch(walletKey, wallets)?.name || walletKey;
};

const getCategoryLabel = (categoryKey: string | undefined, budgetConfig: BudgetConfig) => {
  if (!categoryKey) return '';
  return referenceMatch(categoryKey, budgetConfig.rules)?.name || categoryKey;
};

const hasKnownWallet = (walletKey: string | undefined, wallets: Wallet[]) => {
  if (!walletKey) return false;
  return Boolean(referenceMatch(walletKey, wallets));
};

const hasKnownBudgetCategory = (categoryKey: string | undefined, budgetConfig: BudgetConfig) => {
  if (!categoryKey) return false;
  return Boolean(referenceMatch(categoryKey, budgetConfig.rules));
};

const hasReferenceCasingMismatch = (
  value: string | undefined,
  reference: { id: string; name: string } | undefined,
) => {
  if (!value || !reference) return false;
  const normalized = normalizeReferenceKey(value);
  const matches = normalized === normalizeReferenceKey(reference.id)
    || normalized === normalizeReferenceKey(reference.name);
  return matches && value !== reference.id && value !== reference.name;
};

const auditValuePreview = (value: unknown) => {
  const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : String(value ?? '');
  return normalized.length > 100 ? `${normalized.slice(0, 100)}…` : normalized;
};

const normalFinanceType = (financeType: string | undefined) => (
  !financeType || financeType === 'expense' || financeType === 'income' || financeType === 'transfer'
);

const walletTransferFinanceType = (financeType: string | undefined) => (
  financeType === 'transfer' || financeType === 'saving' || financeType === 'saving_withdrawal'
);

const isExpenseFinanceType = (financeType: string | undefined) => (
  !financeType || financeType === 'expense' || financeType === 'loan_out'
);

export const isSpreadsheetExpenseItem = (item: BrainDumpItem) => {
  if (item.type === ItemType.SHOPPING) {
    return item.status === 'done' && item.meta.shoppingCategory !== 'saving' && item.meta.shoppingCategory !== 'investment' && (item.meta.amount || 0) > 0;
  }

  return item.type === ItemType.FINANCE
    && item.status === 'done'
    && isExpenseFinanceType(item.meta.financeType)
    && (item.meta.amount || 0) > 0;
};

const isSpendishTransaction = (item: BrainDumpItem) => (
  item.type === ItemType.FINANCE
  && item.status === 'done'
  && item.meta.financeType !== 'income'
  && item.meta.financeType !== ACHIEVED_GOAL_FINANCE_TYPE
  && (item.meta.amount || 0) > 0
);

const isEditableTransactionRow = (item: BrainDumpItem) => (
  item.type === ItemType.FINANCE
  || (item.type === ItemType.SHOPPING && item.status === 'done' && item.meta.shoppingCategory !== 'saving' && item.meta.shoppingCategory !== 'investment')
);

export const buildDataQualityIssues = (
  items: BrainDumpItem[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig
): DataQualityIssue[] => {
  const issues: DataQualityIssue[] = [];
  const idGroups = items.reduce<Map<string, BrainDumpItem[]>>((groups, item) => {
    const normalizedId = normalizeReferenceKey(item.id);
    if (!normalizedId) return groups;
    const group = groups.get(normalizedId) || [];
    group.push(item);
    groups.set(normalizedId, group);
    return groups;
  }, new Map());

  items.filter(item => !normalizeReferenceKey(item.id)).forEach(item => {
    issues.push({
      severity: 'critical',
      itemId: '',
      sheet: 'All editable tabs',
      reason: `Item '${auditValuePreview(item.content)}' has no ID, so it cannot be updated or deduplicated safely.`,
      suggestedFix: 'Assign a stable unique ID before the next spreadsheet sync.',
    });
  });

  Array.from(idGroups.values())
    .filter(group => group.length > 1)
    .forEach(group => {
      issues.push({
        severity: 'critical',
        itemId: group[0].id,
        sheet: 'All editable tabs',
        reason: `Duplicate item ID appears ${group.length} times; spreadsheet edits may update the wrong item.`,
        suggestedFix: 'Keep the real row, delete/recreate accidental duplicates in the editable source tab, then sync again.',
      });
    });

  findSemanticDuplicateReviewCandidates(items).forEach(candidate => {
    issues.push({
      severity: 'warning',
      itemId: candidate.itemIds.join(', '),
      sheet: candidate.itemType === ItemType.FINANCE ? 'Transactions' : 'All editable tabs',
      reason: `Possible duplicate content has different IDs (${candidate.itemIds.join(', ')}); rows were retained for manual review.`,
      suggestedFix: 'Review the rows together. Delete one only after confirming they represent the same real-world item.',
    });
  });

  items.filter(isEditableTransactionRow).forEach(item => {
    const walletKey = getWalletKey(item);
    const sheet = item.type === ItemType.SHOPPING ? 'Shopping / Transactions' : 'Transactions';
    const financeType = item.meta.financeType;

    if (item.type === ItemType.FINANCE && normalFinanceType(financeType)) {
      const amount = Number(item.meta.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        issues.push({
          severity: 'critical',
          itemId: item.id,
          sheet,
          reason: `${financeType || 'expense'} transaction Amount must be greater than zero; found '${auditValuePreview(item.meta.amount)}'.`,
          suggestedFix: 'Enter the real positive transaction amount, or move the row to review if the amount is unknown.',
        });
      }
    }

    const walletInspection = inspectStructuredFinanceField('paymentMethod', walletKey);
    if (walletKey && walletInspection.rejectionReason) {
      issues.push({
        severity: 'critical',
        itemId: item.id,
        sheet,
        reason: `Wallet contains overlong/model/prompt prose: '${auditValuePreview(walletKey)}'.`,
        suggestedFix: 'Move the raw value to quarantine and use only a registered wallet ID/name in Wallet.',
      });
    }

    if (!walletKey) {
      issues.push({
        severity: 'warning',
        itemId: item.id,
        sheet,
        reason: 'Transaction has no paymentMethod/wallet, so wallet movement cannot be trusted.',
        suggestedFix: 'Set the Wallet column to one of the registered Wallets Config names/IDs.',
      });
    } else if (!walletInspection.rejectionReason && wallets.length > 0 && !hasKnownWallet(walletKey, wallets)) {
      issues.push({
        severity: 'warning',
        itemId: item.id,
        sheet,
        reason: `Transaction wallet '${walletKey}' is not in Wallets Config.`,
        suggestedFix: 'Use an existing Wallets Config ID/name, or add the missing wallet in Wallets Config.',
      });
    } else if (!walletInspection.rejectionReason) {
      const wallet = referenceMatch(walletKey, wallets);
      if (hasReferenceCasingMismatch(walletKey, wallet)) {
        issues.push({
          severity: 'info',
          itemId: item.id,
          sheet,
          reason: `Wallet '${walletKey}' matches '${wallet?.name}' only after case normalization.`,
          suggestedFix: `Replace it with the canonical wallet ID '${wallet?.id}'.`,
        });
      }
    }

    if (item.meta.toWallet && !walletTransferFinanceType(financeType)) {
      issues.push({
        severity: 'critical',
        itemId: item.id,
        sheet,
        reason: `To_Wallet is populated for non-transfer financeType '${financeType || 'expense'}'.`,
        suggestedFix: 'Clear To_Wallet; destination wallets belong only to wallet-transfer flows.',
      });
    }

    if (item.type === ItemType.FINANCE && financeType === 'transfer') {
      if (!item.meta.toWallet) {
        issues.push({
          severity: 'critical',
          itemId: item.id,
          sheet: 'Transactions',
          reason: 'Transfer is missing To_Wallet, so only the outgoing side can be reconciled.',
          suggestedFix: 'Fill To_Wallet with the destination wallet ID/name from Wallets Config.',
        });
      }
    }

    if (item.meta.toWallet) {
      const toWalletInspection = inspectStructuredFinanceField('toWallet', item.meta.toWallet);
      if (toWalletInspection.rejectionReason) {
        issues.push({
          severity: 'critical',
          itemId: item.id,
          sheet: 'Transactions',
          reason: `To_Wallet contains overlong/model/prompt prose: '${auditValuePreview(item.meta.toWallet)}'.`,
          suggestedFix: 'Move the raw value to quarantine and use only a registered destination wallet ID/name.',
        });
      } else if (wallets.length > 0 && !hasKnownWallet(item.meta.toWallet, wallets)) {
        issues.push({
          severity: 'warning',
          itemId: item.id,
          sheet: 'Transactions',
          reason: `Transfer destination wallet '${item.meta.toWallet}' is not in Wallets Config.`,
          suggestedFix: 'Use an existing destination wallet ID/name, or add it in Wallets Config before syncing.',
        });
      } else {
        const destination = referenceMatch(item.meta.toWallet, wallets);
        if (hasReferenceCasingMismatch(item.meta.toWallet, destination)) {
          issues.push({
            severity: 'info',
            itemId: item.id,
            sheet: 'Transactions',
            reason: `To_Wallet '${item.meta.toWallet}' matches '${destination?.name}' only after case normalization.`,
            suggestedFix: `Replace it with the canonical wallet ID '${destination?.id}'.`,
          });
        }
      }
    }

    const taxonomyFields: Array<{ field: StructuredFinanceField; label: string }> = [
      { field: 'budgetCategory', label: 'Category' },
      { field: 'commodity', label: 'Commodity' },
      { field: 'subcommodity', label: 'Subcommodity' },
      { field: 'merchant', label: 'Merchant' },
    ];
    taxonomyFields.forEach(({ field, label }) => {
      const value = item.meta[field];
      if (value === undefined) return;
      const inspection = inspectStructuredFinanceField(field, value);
      if (inspection.rejectionReason) {
        issues.push({
          severity: 'critical',
          itemId: item.id,
          sheet,
          reason: `${label} contains overlong/model/prompt prose: '${auditValuePreview(value)}'.`,
          suggestedFix: `Move the raw value to quarantine and replace ${label} with a short structured value.`,
        });
      }
    });

    if (item.meta.budgetCategory && budgetConfig.rules.length > 0) {
      const budgetRule = referenceMatch(item.meta.budgetCategory, budgetConfig.rules);
      if (budgetRule && hasReferenceCasingMismatch(item.meta.budgetCategory, budgetRule)) {
        issues.push({
          severity: 'info',
          itemId: item.id,
          sheet,
          reason: `Category '${item.meta.budgetCategory}' matches '${budgetRule.name}' only after case normalization.`,
          suggestedFix: `Replace it with the canonical budget category ID '${budgetRule.id}'.`,
        });
      }
    }

    if (isSpreadsheetExpenseItem(item) && item.meta.financeType !== 'loan_out') {
      const allocations = getTransactionBudgetAllocations(item);
      const missingCategory = allocations.some(allocation => !allocation.budgetCategory);
      const unknownCategory = allocations.find(allocation =>
        allocation.budgetCategory && budgetConfig.rules.length > 0 && !hasKnownBudgetCategory(allocation.budgetCategory, budgetConfig)
      )?.budgetCategory;

      if (missingCategory) {
        issues.push({
          severity: 'warning',
          itemId: item.id,
          sheet,
          reason: 'Expense has an uncategorized transaction line, so budget pace and driver summaries are incomplete.',
          suggestedFix: 'Set a category on every line item, or set the transaction default Category as fallback.',
        });
      } else if (unknownCategory) {
        issues.push({
          severity: 'warning',
          itemId: item.id,
          sheet,
          reason: `Expense category '${unknownCategory}' is not in Budget Rules.`,
          suggestedFix: 'Use an existing Budget Rules ID/name, or add the category to Budget Rules.',
        });
      }
    }

    item.meta.dataQualityQuarantine?.forEach(quarantined => {
      issues.push({
        severity: 'critical',
        itemId: item.id,
        sheet,
        reason: `${quarantined.field} is quarantined (${quarantined.reason}); rejected raw value: '${auditValuePreview(quarantined.rawValue)}'.`,
        suggestedFix: 'Review the rejected raw value and enter a valid structured replacement before clearing the quarantine record.',
      });
    });

    if (item.meta.parserNeedsReview && item.meta.parserReviewReason && /quarantined|Rejected\s+(?:meta|payload|entityRefs)\./i.test(item.meta.parserReviewReason)) {
      issues.push({
        severity: 'critical',
        itemId: item.id,
        sheet,
        reason: `Parser quarantine review: ${auditValuePreview(item.meta.parserReviewReason)}`,
        suggestedFix: 'Inspect the parser review reason and enter only validated structured values before approving the transaction.',
      });
    }
  });

  const itemIds = new Set(items.map(item => item.id));
  items.filter(item => item.type === ItemType.TODO).forEach(item => {
    item.meta.childTodoIds?.forEach(childId => {
      if (!itemIds.has(childId)) {
        issues.push({
          severity: 'warning',
          itemId: item.id,
          sheet: 'Todos',
          reason: `Deep-work parent points to missing child todo '${childId}'.`,
          suggestedFix: 'Remove the missing Child_IDs value or recreate the step todo before syncing.',
        });
      }
    });

    if (item.meta.parentTodoId && !itemIds.has(item.meta.parentTodoId)) {
      issues.push({
        severity: 'warning',
        itemId: item.id,
        sheet: 'Todos',
        reason: `Deep-work step points to missing parent todo '${item.meta.parentTodoId}'.`,
        suggestedFix: 'Fix Parent_ID to an existing parent todo, or clear Parent_ID if this is standalone.',
      });
    }
  });

  const severityRank: Record<DataQualitySeverity, number> = { critical: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.sheet.localeCompare(b.sheet) || a.itemId.localeCompare(b.itemId));
};

const getWindowItems = (items: BrainDumpItem[], start: Date, end: Date) => items.filter(item => {
  const ts = getItemTimestamp(item);
  return ts >= start.getTime() && ts < end.getTime();
});

const getExpenseTotal = (items: BrainDumpItem[], start: Date, end: Date) => getWindowItems(items, start, end)
  .filter(isSpreadsheetExpenseItem)
  .reduce((sum, item) => sum + (item.meta.amount || 0), 0);

const getIncomeTotal = (items: BrainDumpItem[], start: Date, end: Date) => getWindowItems(items, start, end)
  .filter(item => item.type === ItemType.FINANCE && item.status === 'done' && item.meta.financeType === 'income')
  .reduce((sum, item) => sum + (item.meta.amount || 0), 0);

const signedDelta = (value: number) => `${value >= 0 ? '+' : '-'}${fmtCurrency(Math.abs(value))}`;

const buildMainDriverLine = (
  todayExpenseItems: BrainDumpItem[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig
) => {
  if (todayExpenseItems.length === 0) {
    return 'Main driver: no structured expense rows today.';
  }

  type DriverGroup = {
    key: string;
    label: string;
    basis: string;
    amount: number;
    wallets: Record<string, number>;
    tags: Set<string>;
    canonical: Set<string>;
    categoryKey?: string;
  };

  const groups = new Map<string, DriverGroup>();

  todayExpenseItems.forEach(item => {
    const tags = item.meta.tags || [];
    const canonicalMerchant = getCanonicalMetaValue(item.meta, 'merchant');
    const canonicalSubcommodity = getCanonicalMetaValue(item.meta, 'subcommodity');
    const categoryLabel = getCategoryLabel(item.meta.budgetCategory, budgetConfig);

    const basis = categoryLabel
      ? 'category'
      : tags[0]
        ? 'tag'
        : canonicalMerchant
          ? 'canonical merchant'
          : canonicalSubcommodity
            ? 'canonical subcommodity'
            : 'amount-only uncategorised';

    const label = categoryLabel || tags[0] || canonicalMerchant || canonicalSubcommodity || 'Uncategorised spend';
    const key = `${basis}:${label.toLowerCase()}`;
    const amount = item.meta.amount || 0;
    const walletKey = getWalletKey(item) || 'unknown';

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        basis,
        amount: 0,
        wallets: {},
        tags: new Set<string>(),
        canonical: new Set<string>(),
        categoryKey: item.meta.budgetCategory,
      });
    }

    const group = groups.get(key)!;
    group.amount += amount;
    group.wallets[walletKey] = (group.wallets[walletKey] || 0) + amount;
    tags.forEach(tag => group.tags.add(tag));
    if (canonicalMerchant) group.canonical.add(canonicalMerchant);
    if (canonicalSubcommodity) group.canonical.add(canonicalSubcommodity);
  });

  const top = Array.from(groups.values()).sort((a, b) => b.amount - a.amount)[0];
  const topWallet = Object.entries(top.wallets).sort((a, b) => b[1] - a[1])[0];
  const walletCopy = topWallet ? ` via ${getWalletLabel(topWallet[0], wallets)}` : '';
  const tagCopy = top.tags.size > 0 ? `; tags: ${Array.from(top.tags).slice(0, 2).join(', ')}` : '';
  const canonicalCopy = top.canonical.size > 0 ? `; canonical: ${Array.from(top.canonical).slice(0, 2).join(', ')}` : '';
  const categoryRule = top.categoryKey ? budgetConfig.rules.find(rule => rule.id === top.categoryKey || rule.name === top.categoryKey) : undefined;
  const budgetLimit = categoryRule && budgetConfig.monthlyIncome > 0 ? budgetConfig.monthlyIncome * categoryRule.percentage / 100 : 0;
  const budgetCopy = budgetLimit > 0 ? `; ${Math.round((top.amount / budgetLimit) * 100)}% of monthly ${categoryRule!.name} budget` : '';
  const rawGuard = top.basis === 'amount-only uncategorised' ? ' (no category/tag/canonical metadata yet)' : '';

  return `Main driver: ${top.label} (${top.basis}) · ${fmtCurrency(top.amount)}${walletCopy}${tagCopy}${canonicalCopy}${budgetCopy}${rawGuard}.`;
};

const buildWalletMovementLine = (todayItems: BrainDumpItem[], wallets: Wallet[]) => {
  const movement: Record<string, number> = {};
  const addMovement = (walletKey: string | undefined, amount: number) => {
    const key = walletKey || 'unknown';
    movement[key] = (movement[key] || 0) + amount;
  };

  todayItems.forEach(item => {
    const amount = item.meta.amount || 0;
    if (amount <= 0 || item.status !== 'done') return;

    if (item.type === ItemType.SHOPPING && item.meta.shoppingCategory !== 'saving' && item.meta.shoppingCategory !== 'investment') {
      addMovement(getWalletKey(item), -amount);
      return;
    }

    if (item.type !== ItemType.FINANCE) return;
    const walletKey = getWalletKey(item);

    if (item.meta.financeType === 'income') {
      addMovement(walletKey, amount);
    } else if (item.meta.financeType === 'transfer') {
      addMovement(walletKey, -amount);
      if (item.meta.toWallet) addMovement(item.meta.toWallet, amount);
    } else if (item.meta.financeType === 'saving') {
      addMovement(walletKey, -amount);
      if (item.meta.toWallet) addMovement(item.meta.toWallet, amount);
    } else if (item.meta.financeType !== ACHIEVED_GOAL_FINANCE_TYPE) {
      addMovement(walletKey, -amount);
    }
  });

  const entries = Object.entries(movement)
    .filter(([, amount]) => amount !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4);

  if (entries.length === 0) {
    return 'Wallet movement: no completed wallet movement today; transfers excluded from spend.';
  }

  return `Wallet movement: ${entries.map(([walletKey, amount]) => `${getWalletLabel(walletKey, wallets)} ${signedDelta(amount)}`).join(', ')}; transfers/savings excluded from spend totals.`;
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const buildPatternLine = (items: BrainDumpItem[], todayStart: Date, todayExpense: number, yesterdayExpense: number) => {
  const previousDays = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(todayStart);
    start.setDate(todayStart.getDate() - (index + 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return getExpenseTotal(items, start, end);
  });

  const nonZeroHistory = previousDays.filter(value => value > 0);
  const baseline = median(nonZeroHistory);
  if (todayExpense === 0) {
    return yesterdayExpense > 0
      ? `Pattern: spend paused today after ${fmtCurrency(yesterdayExpense)} yesterday.`
      : 'Pattern: quiet spend day; no completed expenses today or yesterday.';
  }
  if (baseline <= 0) {
    return 'Pattern: new/low-history spend day; watch categories before calling it normal.';
  }

  if (todayExpense > baseline * 1.8 && todayExpense - yesterdayExpense > baseline * 0.5) {
    return `Pattern: unusual spike vs 7-day median ${fmtCurrency(baseline)}; verify category/wallet metadata.`;
  }

  if (todayExpense < baseline * 0.55) {
    return `Pattern: lighter than recent median ${fmtCurrency(baseline)}.`;
  }

  return `Pattern: normal vs recent median ${fmtCurrency(baseline)}.`;
};

export const buildDailyMoneyDriverSummary = (
  items: BrainDumpItem[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  now = new Date()
): DailyMoneyDriverSummary => {
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const todayItems = getWindowItems(items, todayStart, tomorrowStart);
  const todayExpenseItems = todayItems.filter(isSpreadsheetExpenseItem);
  const todayExpense = todayExpenseItems.reduce((sum, item) => sum + (item.meta.amount || 0), 0);
  const yesterdayExpense = getExpenseTotal(items, yesterdayStart, todayStart);
  const todayIncome = getIncomeTotal(items, todayStart, tomorrowStart);
  const yesterdayIncome = getIncomeTotal(items, yesterdayStart, todayStart);

  return {
    todayExpense,
    yesterdayExpense,
    todayIncome,
    yesterdayIncome,
    expenseDelta: todayExpense - yesterdayExpense,
    incomeDelta: todayIncome - yesterdayIncome,
    spendLine: `Today spend: ${fmtCurrency(todayExpense)} vs yesterday ${fmtCurrency(yesterdayExpense)} (${signedDelta(todayExpense - yesterdayExpense)}).`,
    mainDriverLine: buildMainDriverLine(todayExpenseItems, wallets, budgetConfig),
    walletMovementLine: buildWalletMovementLine(todayItems, wallets),
    patternLine: buildPatternLine(items, todayStart, todayExpense, yesterdayExpense),
  };
};

export const buildSpreadsheetHealthSummary = (
  items: BrainDumpItem[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  issues: DataQualityIssue[],
  now = new Date()
): SpreadsheetHealthSummary => {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  const criticalCount = issues.filter(issue => issue.severity === 'critical').length;
  const warningCount = issues.filter(issue => issue.severity === 'warning').length;
  const staleConfigWarnings = [
    wallets.length === 0 ? 'no wallets configured' : '',
    budgetConfig.rules.length === 0 ? 'no budget rules configured' : '',
  ].filter(Boolean);

  return {
    generatedAt: now.toLocaleString(),
    guideLine: 'Generated-only: Sheet1 and Data Quality are rewritten on sync. Source-of-truth tabs are dedicated sheets: Transactions, Todos, Shopping, Events, Notes & Journals, Skill Logs, Wallets Config, Skills Config, Budget Rules, Themes & Settings, Chat History, Canonical Rules.',
    syncHealthLine: `SYNC HEALTH: generated ${now.toLocaleString()} • dedicated sheet schema • each source tab is cleared and rewritten directly.`,
    dataHealthLine: issues.length === 0
      ? `DATA HEALTH: no issues detected${staleConfigWarnings.length ? `; setup note: ${staleConfigWarnings.join(', ')}` : ''}.`
      : `DATA HEALTH: ${issues.length} issue(s): ${criticalCount} critical, ${warningCount} warning. See generated Data Quality tab for fixes.`,
    itemCountLine: `Item counts: ${Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => `${type} ${count}`).join(' • ') || 'no items yet'}.`,
  };
};

export const buildDataQualitySheetData = (issues: DataQualityIssue[]): (string | number | boolean | null)[][] => {
  const header = ['Severity', 'Item ID', 'Sheet/Tab', 'Reason', 'Suggested Fix'];
  return [
    ['DATA QUALITY'],
    ['Generated-only audit. Fix the editable source tabs; this tab is cleared and rewritten on every spreadsheet sync.'],
    [issues.length === 0 ? 'No issues detected. Sync/data audit looks healthy.' : `${issues.length} issue(s) detected. Highest severity rows are listed first.`],
    header,
    ...(issues.length === 0
      ? [['info', '', 'Data Quality', 'No issues detected.', 'Nothing to fix right now.']]
      : issues.map(issue => [issue.severity, issue.itemId, issue.sheet, issue.reason, issue.suggestedFix]))
  ];
};
