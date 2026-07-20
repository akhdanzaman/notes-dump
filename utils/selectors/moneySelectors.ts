import {
  BrainDumpItem,
  ItemType,
  Wallet,
  BudgetConfig,
  SortOrder,
} from "../../types";
import {
  getCanonicalMetaValue,
  getCanonicalOrRawItemValue,
  getRawMetaValue,
  itemMatchesCanonicalSearch,
} from "../canonicalization/accessors";
import {
  ACHIEVED_GOAL_FINANCE_TYPE,
  SAVING_WITHDRAWAL_FINANCE_TYPE,
  isIncomingLoanFinanceType,
  isOutgoingLoanFinanceType,
} from "../financeTypeUtils";
import { getSavingTransactionDelta } from "../savingTransactionUtils";
import {
  getShoppingDueDate,
  getShoppingTransactionDate,
} from "../shoppingDateUtils";
import { BudgetAnalyticsViewMode, getWeekBounds } from "../budgetAnalytics";
import { getInvestmentMetrics } from "../investmentMetrics";
import { getTransactionBudgetAllocations } from "../transactionLineItems";

const resolveWalletBalanceKey = (wallets: Wallet[], value?: string) => {
  const normalized = value?.toLowerCase().trim();
  if (!normalized) return "";
  const wallet = wallets.find(
    (w) =>
      w.id.toLowerCase() === normalized || w.name.toLowerCase() === normalized,
  );
  return wallet ? wallet.name.toLowerCase() : normalized;
};

const resolveItemWalletBalanceKey = (
  wallets: Wallet[],
  item: BrainDumpItem,
) => {
  const canonicalPaymentMethod = getCanonicalMetaValue(
    item.meta,
    "paymentMethod",
  );
  const canonicalKey = resolveWalletBalanceKey(wallets, canonicalPaymentMethod);
  if (
    canonicalKey &&
    wallets.some((w) => w.name.toLowerCase() === canonicalKey)
  )
    return canonicalKey;

  const rawPaymentMethod = getRawMetaValue(item.meta, "paymentMethod");
  const rawKey = resolveWalletBalanceKey(wallets, rawPaymentMethod);
  if (rawKey && wallets.some((w) => w.name.toLowerCase() === rawKey))
    return rawKey;

  // Fall back to dedicated wallet for shopping/implicit expenses
  if (item.meta.dedicatedWalletId) {
    const dedicatedKey = resolveWalletBalanceKey(
      wallets,
      item.meta.dedicatedWalletId,
    );
    if (
      dedicatedKey &&
      wallets.some((w) => w.name.toLowerCase() === dedicatedKey)
    )
      return dedicatedKey;
  }

  return "";
};

export const getWalletStats = (items: BrainDumpItem[], wallets: Wallet[]) => {
  // Create a map to track balances
  const balanceMap = new Map<string, number>();

  wallets.forEach((w) =>
    balanceMap.set(w.name.toLowerCase(), w.initialBalance),
  );

  // Track implicit expenses (shopping/todo) without wallet assignment.
  // These still reduce total net worth even though they can't be attributed
  // to a specific wallet.
  let unassignedExpenses = 0;

  // Go through ALL finished items that involve money
  items.forEach((item) => {
    // Include done FINANCE items, and done SHOPPING/TODO items that have an amount
    const isFinance = item.type === ItemType.FINANCE;
    const isImplicitExpense =
      (item.type === ItemType.SHOPPING || item.type === ItemType.TODO) &&
      item.status === "done";

    if (!isFinance && !isImplicitExpense) return;
    if (isFinance && item.status !== "done") return;
    if (!item.meta.amount) return;

    // Exclude saving goals and routine shopping items from implicit expenses (routines generate separate finance items)
    if (
      isImplicitExpense &&
      (item.meta.shoppingCategory === "saving" ||
        item.meta.shoppingCategory === "investment" ||
        item.meta.shoppingCategory === "routine")
    )
      return;

    const amount = item.meta.amount;
    const walletName = resolveItemWalletBalanceKey(wallets, item); // Source Wallet

    if (walletName && balanceMap.has(walletName)) {
      const current = balanceMap.get(walletName) || 0;
      const wallet = wallets.find((w) => w.name.toLowerCase() === walletName);
      const isCC = wallet?.type === "cc";

      const isIncome = isFinance && item.meta.financeType === "income";
      const isTransfer = isFinance && item.meta.financeType === "transfer";
      const isSaving = isFinance && item.meta.financeType === "saving";
      const isSavingWithdrawal = isFinance && item.meta.financeType === SAVING_WITHDRAWAL_FINANCE_TYPE;
      const isIncomingLoan = isFinance && isIncomingLoanFinanceType(item.meta.financeType);
      const isOutgoingLoan = isFinance && isOutgoingLoanFinanceType(item.meta.financeType);
      const isAchievedGoal =
        isFinance && item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE;

      if (isIncome || isIncomingLoan) {
        // Income adds to Asset. If CC, it reduces debt (by subtracting from the 'positive' debt balance).
        if (isCC) balanceMap.set(walletName, Math.max(0, current - amount));
        else balanceMap.set(walletName, current + amount);
      } else if (isTransfer) {
        // Source of Transfer
        if (isCC)
          balanceMap.set(walletName, current + amount); // Cash Advance from CC -> Increases Debt
        else balanceMap.set(walletName, current - amount); // Transfer from Asset -> Decreases Asset

        // Destination of Transfer
        const destName = resolveWalletBalanceKey(wallets, item.meta.toWallet);
        if (destName && balanceMap.has(destName)) {
          const destCurrent = balanceMap.get(destName) || 0;
          const destWallet = wallets.find(
            (w) => w.name.toLowerCase() === destName,
          );
          const isDestCC = destWallet?.type === "cc";

          if (isDestCC)
            balanceMap.set(destName, Math.max(0, destCurrent - amount)); // Paying CC bill -> Decreases Debt
          else balanceMap.set(destName, destCurrent + amount); // Transfer to Asset -> Increases Asset
        }
      } else if (isSaving) {
        const destName = resolveWalletBalanceKey(wallets, item.meta.toWallet);
        if (destName && balanceMap.has(destName)) {
          // Investment saving moves money from a source wallet into an investment platform wallet.
          if (isCC) balanceMap.set(walletName, current + amount);
          else balanceMap.set(walletName, current - amount);

          const destCurrent = balanceMap.get(destName) || 0;
          balanceMap.set(destName, destCurrent + amount);
        }
        // Regular saving goals without a destination wallet keep existing behavior: wallet balance remains unchanged.
      } else if (isSavingWithdrawal) {
        // Liquidating an investment/dedicated saving wallet reverses the original saving movement.
        if (isCC) balanceMap.set(walletName, Math.max(0, current - amount));
        else balanceMap.set(walletName, current - amount);

        const destName = resolveWalletBalanceKey(wallets, item.meta.toWallet);
        if (destName && balanceMap.has(destName)) {
          const destCurrent = balanceMap.get(destName) || 0;
          const destWallet = wallets.find((w) => w.name.toLowerCase() === destName);
          if (destWallet?.type === "cc") balanceMap.set(destName, Math.max(0, destCurrent - amount));
          else balanceMap.set(destName, destCurrent + amount);
        }
      } else if (isAchievedGoal) {
        // Achieved goals spend from the wallet now,
        // while staying out of expense analytics.
        if (isCC) balanceMap.set(walletName, current + amount);
        else balanceMap.set(walletName, current - amount);
      } else if (isOutgoingLoan) {
        if (isCC) balanceMap.set(walletName, current + amount);
        else balanceMap.set(walletName, current - amount);
      } else {
        // Expense (Finance expense or implicit expense from Shopping/Todo)
        if (isCC)
          balanceMap.set(walletName, current + amount); // Spending on CC -> Increases Debt
        else balanceMap.set(walletName, current - amount); // Spending from Asset -> Decreases Asset
      }
    } else if (isImplicitExpense) {
      // Done shopping/todo items without explicit wallet still count as expenses.
      // They reduce total net worth without being attributed to a specific wallet.
      unassignedExpenses += amount;
    }
  });

  items
    .filter(
      (item) =>
        item.type === ItemType.SHOPPING &&
        item.meta.shoppingCategory === "investment" &&
        item.meta.dedicatedWalletId,
    )
    .forEach((investment) => {
      const walletKey = resolveWalletBalanceKey(
        wallets,
        investment.meta.dedicatedWalletId,
      );
      if (!walletKey || !balanceMap.has(walletKey)) return;

      const linkedCapital = items
        .filter(
          (item) =>
            item.type === ItemType.FINANCE &&
            item.status === "done" &&
            item.meta.savingGoalId === investment.id,
        )
        .reduce((sum, item) => sum + getSavingTransactionDelta(item), 0);
      const metrics = getInvestmentMetrics({
        ...investment,
        meta: {
          ...investment.meta,
          savedAmount: linkedCapital || investment.meta.savedAmount,
        },
      });

      if (metrics.profitLoss !== 0) {
        balanceMap.set(
          walletKey,
          (balanceMap.get(walletKey) || 0) + metrics.profitLoss,
        );
      }
    });

  // Map back to wallet objects
  const walletStats = wallets.map((w) => ({
    ...w,
    currentBalance: balanceMap.get(w.name.toLowerCase()) ?? w.initialBalance,
  }));

  // Calculate Total Net Worth: (Total Assets) - (Total CC Debt)
  const assets = walletStats.filter((w) => w.type !== "cc");
  const liabilities = walletStats.filter((w) => w.type === "cc");

  const totalAssets = assets.reduce((acc, w) => acc + w.currentBalance, 0);
  const totalDebt = liabilities.reduce((acc, w) => acc + w.currentBalance, 0);

  // Calculate total savings

  const activeSavingsTargets = new Set(
    items
      .filter(
        (i) =>
          i.type === ItemType.SHOPPING &&
          (i.meta.shoppingCategory === "saving" ||
            i.meta.shoppingCategory === "investment") &&
          i.status !== "done",
      )
      .map((i) => i.id),
  );

  const totalSavings = items
    .filter(
      (i) =>
        i.type === ItemType.FINANCE &&
        (i.status === "done" || i.status === "pending") &&
        i.meta.savingGoalId &&
        activeSavingsTargets.has(i.meta.savingGoalId),
    )
    .reduce((sum, item) => sum + getSavingTransactionDelta(item), 0);

  const totalNetWorth =
    totalAssets - totalDebt - totalSavings - unassignedExpenses;

  return {
    walletStats,
    totalNetWorth,
    totalAssets,
    totalDebt,
    totalSavings,
    unassignedExpenses,
  };
};

export const getFinanceItems = (
  items: BrainDumpItem[],
  financeDate: Date,
  budgetConfig: BudgetConfig,
  filterWallet: string,
  filterTransactionType: string,
  filterCategory: string,
  filterMinAmount: string,
  filterMaxAmount: string,
  selectedTag: string,
  searchQuery: string,
  sortOrder: SortOrder,
  viewMode: BudgetAnalyticsViewMode = "monthly",
  wallets: Wallet[] = [],
) => {
  const resolveCategory = (cat?: string) => {
    if (!cat) return null;
    if (budgetConfig.rules.some((r) => r.id === cat)) return cat;
    const foundRule = budgetConfig.rules.find(
      (r) => r.name.toLowerCase() === cat.toLowerCase(),
    );
    return foundRule ? foundRule.id : null;
  };

  const isDateInViewPeriod = (d: Date) => {
    if (viewMode === "yearly")
      return d.getFullYear() === financeDate.getFullYear();
    if (viewMode === "weekly") {
      const { start, end } = getWeekBounds(financeDate);
      return d.getTime() >= start.getTime() && d.getTime() < end.getTime();
    }
    return (
      d.getMonth() === financeDate.getMonth() &&
      d.getFullYear() === financeDate.getFullYear()
    );
  };

  // 1. Explicit Finance Items
  let finance = items.filter(
    (i) =>
      i.type === ItemType.FINANCE &&
      (i.status === "done" || i.status === "pending") &&
      (i.meta.amount || 0) > 0,
  );

  // 2. Implicit Expenses
  const isMoneyPlanItem = (i: BrainDumpItem) =>
    (i.type === ItemType.SHOPPING || i.type === ItemType.TODO) &&
    (i.meta.amount || 0) > 0 &&
    i.meta.shoppingCategory !== "saving" &&
    i.meta.shoppingCategory !== "investment" &&
    i.meta.shoppingCategory !== "routine";

  const implicitExpenses = items.filter(
    (i) => isMoneyPlanItem(i) && i.status === "done",
  );

  // Combine them
  let allTransactions = [...finance, ...implicitExpenses];

  // Filter by Date (Month or Year)
  allTransactions = allTransactions.filter((i) => {
    // For Finance items, prioritize the user-set date (meta.date).
    // For Shopping/Todos (implicit expenses), prioritize the completion date.
    // Fallback to creation date.
    const dateStr =
      i.type === ItemType.FINANCE
        ? i.meta.date || i.created_at
        : getShoppingTransactionDate(i);

    if (!dateStr) return false;

    const d = new Date(dateStr);
    return isDateInViewPeriod(d);
  });

  // --- FILTERS ---

  // Filter by Wallet (Source or Destination). Compare resolved wallet keys so
  // canonical paymentMethod IDs and raw wallet display names collapse together.
  if (filterWallet) {
    if (filterWallet === "undefined") {
      allTransactions = allTransactions.filter(
        (i) =>
          !getCanonicalOrRawItemValue(i, "paymentMethod") && !i.meta.toWallet,
      );
    } else {
      const walletKey = resolveWalletBalanceKey(wallets, filterWallet);
      allTransactions = allTransactions.filter((i) => {
        const sourceKey = resolveWalletBalanceKey(
          wallets,
          getCanonicalOrRawItemValue(i, "paymentMethod"),
        );
        const destinationKey = resolveWalletBalanceKey(
          wallets,
          i.meta.toWallet,
        );
        return sourceKey === walletKey || destinationKey === walletKey;
      });
    }
  }

  // Filter by Type
  if (filterTransactionType) {
    allTransactions = allTransactions.filter((i) => {
      if (filterTransactionType === "shopping") {
        return i.type === ItemType.SHOPPING;
      }
      // Default to 'expense' if financeType is missing for money items
      const type =
        i.meta.financeType ||
        (i.type === ItemType.FINANCE || i.meta.amount ? "expense" : undefined);
      return type === filterTransactionType;
    });
  }

  // Filter by Category
  if (filterCategory) {
    allTransactions = allTransactions.filter((i) => {
      if (filterTransactionType === "saving") {
        return i.meta.savingGoalId === filterCategory;
      }
      const allocations = getTransactionBudgetAllocations(i);
      const categoryIds = allocations.map((allocation) => resolveCategory(allocation.budgetCategory));
      if (filterCategory === "uncategorized") {
        return categoryIds.length === 0 || categoryIds.some((catId) => !catId);
      }
      return categoryIds.includes(filterCategory);
    });
  }

  // Filter by Amount Range
  if (filterMinAmount) {
    const min = parseFloat(filterMinAmount);
    if (!isNaN(min)) {
      allTransactions = allTransactions.filter(
        (i) => (i.meta.amount || 0) >= min,
      );
    }
  }
  if (filterMaxAmount) {
    const max = parseFloat(filterMaxAmount);
    if (!isNaN(max)) {
      allTransactions = allTransactions.filter(
        (i) => (i.meta.amount || 0) <= max,
      );
    }
  }

  // Filter by Tag
  if (selectedTag) {
    allTransactions = allTransactions.filter((i) =>
      i.meta?.tags?.includes(selectedTag),
    );
  }

  // Filter by Search Query
  if (searchQuery) {
    const lowerQ = searchQuery.toLowerCase();
    allTransactions = allTransactions.filter((i) =>
      itemMatchesCanonicalSearch(i, lowerQ) ||
      (i.meta.transactionLineItems || []).some((line) => line.name.toLowerCase().includes(lowerQ)),
    );
  }

  // --- SORTING ---
  allTransactions.sort((a, b) => {
    const da =
      a.type === ItemType.FINANCE
        ? new Date(a.meta.date || a.created_at).getTime()
        : new Date(getShoppingTransactionDate(a)).getTime();
    const db =
      b.type === ItemType.FINANCE
        ? new Date(b.meta.date || b.created_at).getTime()
        : new Date(getShoppingTransactionDate(b)).getTime();

    if (sortOrder === "newest") return db - da;
    if (sortOrder === "oldest") return da - db;
    if (sortOrder === "highest_amount")
      return (b.meta.amount || 0) - (a.meta.amount || 0);
    if (sortOrder === "lowest_amount")
      return (a.meta.amount || 0) - (b.meta.amount || 0);
    return db - da;
  });

  // --- CALCULATIONS ---

  let totalIncome = 0;
  let totalExpense = 0;
  let projectedExpense = 0;
  let totalSavings = 0;
  const budgetMap = new Map<string, number>();
  const plannedBudgetMap = new Map<string, number>();
  let uncategorized = 0;
  let projectedUncategorized = 0;
  let totalBudgetUsed = 0;
  let projectedBudgetUsed = 0;

  const addBudgetUsage = (
    item: BrainDumpItem,
    amount: number,
    isDone: boolean,
    includeUncategorized = true,
  ) => {
    const allocations = item.meta.transactionLineItems?.length
      ? getTransactionBudgetAllocations(item)
      : [{ amount, budgetCategory: item.meta.budgetCategory }];

    if (isDone) totalBudgetUsed += amount;
    else projectedBudgetUsed += amount;

    allocations.forEach((allocation) => {
      const catId = resolveCategory(allocation.budgetCategory);
      if (isDone) {
        if (catId) budgetMap.set(catId, (budgetMap.get(catId) || 0) + allocation.amount);
        else if (includeUncategorized) uncategorized += allocation.amount;
      } else {
        if (catId) plannedBudgetMap.set(catId, (plannedBudgetMap.get(catId) || 0) + allocation.amount);
        else if (includeUncategorized) projectedUncategorized += allocation.amount;
      }
    });
  };

  // We need ALL actual items for the selected period (unfiltered) to calculate totals accurately.
  // Planned expenses are added separately from pending urgent shopping and routine shopping below
  // so they are not double-counted in current/future budget periods.
  let baseTransactions = [...finance, ...implicitExpenses].filter((i) => {
    const dateStr =
      i.type === ItemType.FINANCE
        ? i.meta.date || i.created_at
        : i.status === "done"
          ? getShoppingTransactionDate(i)
          : getShoppingDueDate(i) || getShoppingTransactionDate(i);
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return isDateInViewPeriod(d);
  });

  baseTransactions.forEach((item) => {
    const amount = item.meta.amount || 0;
    const type = item.meta.financeType || "expense";
    const isDone = item.status === "done";

    if (type === "income") {
      if (isDone) totalIncome += amount;
      return;
    }

    if (type === "transfer" || type === ACHIEVED_GOAL_FINANCE_TYPE) {
      return;
    }

    if (type === "saving" || type === SAVING_WITHDRAWAL_FINANCE_TYPE) {
      if (isDone) {
        totalSavings += type === "saving" ? amount : -amount;
      }

      if (type === SAVING_WITHDRAWAL_FINANCE_TYPE) return;

      // Saving hanya masuk budget analytics kalau punya budget category.
      // Jadi saving goal biasa tanpa kategori tidak mengganggu uncategorized.
      if (item.meta.budgetCategory) {
        addBudgetUsage(item, amount, isDone, false);
      }

      return;
    }

    if (type === "expense") {
      if (isDone) {
        totalExpense += amount;
      } else {
        projectedExpense += amount;
      }

      addBudgetUsage(item, amount, isDone, true);
    }
  });

  // 3. Routine Shopping Projections (Planned)
  const routineItems = items.filter(
    (i) =>
      i.type === ItemType.SHOPPING &&
      (i.meta.shoppingCategory === "routine" || i.meta.isRoutine === true) &&
      (i.meta.amount || 0) > 0,
  );

  const getViewBounds = (
    viewDate: Date,
    mode: BudgetAnalyticsViewMode,
  ): { start: Date; end: Date } => {
    if (mode === "weekly") return getWeekBounds(viewDate);

    const start = new Date(viewDate);
    start.setHours(0, 0, 0, 0);

    if (mode === "yearly") {
      start.setMonth(0, 1);
      const end = new Date(start);
      end.setFullYear(start.getFullYear() + 1);
      return { start, end };
    }

    start.setDate(1);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);
    return { start, end };
  };

  const datesMatchDay = (date: Date, daysOfMonth: number[]) => {
    const daysInMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
    ).getDate();
    return daysOfMonth.some(
      (day) => Math.min(day, daysInMonth) === date.getDate(),
    );
  };

  const getRoutineAnchorDate = (item: BrainDumpItem) => {
    const raw = getShoppingDueDate(item) || item.created_at;
    const anchor = new Date(raw);
    return Number.isNaN(anchor.getTime()) ? new Date(item.created_at) : anchor;
  };

  const isRoutineOccurrenceDate = (
    item: BrainDumpItem,
    date: Date,
    anchor: Date,
  ) => {
    if (date.getTime() < anchor.getTime()) return false;

    const {
      routineInterval,
      routineDaysOfWeek = [],
      routineDaysOfMonth = [],
      routineMonthsOfYear = [],
      recurrenceDays,
    } = item.meta;

    if (!routineInterval && recurrenceDays) {
      const anchorStart = new Date(anchor);
      anchorStart.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (date.getTime() - anchorStart.getTime()) / 86400000,
      );
      return diffDays >= 0 && diffDays % recurrenceDays === 0;
    }

    if (routineInterval === "weekly") {
      const days =
        routineDaysOfWeek.length > 0 ? routineDaysOfWeek : [anchor.getDay()];
      return days.includes(date.getDay());
    }

    if (routineInterval === "monthly") {
      const days =
        routineDaysOfMonth.length > 0 ? routineDaysOfMonth : [anchor.getDate()];
      return datesMatchDay(date, days);
    }

    if (routineInterval === "yearly") {
      const months =
        routineMonthsOfYear.length > 0
          ? routineMonthsOfYear
          : [anchor.getMonth()];
      const days =
        routineDaysOfMonth.length > 0 ? routineDaysOfMonth : [anchor.getDate()];
      return months.includes(date.getMonth()) && datesMatchDay(date, days);
    }

    return routineInterval === "daily";
  };

  const hasActualRoutineExpenseOnDate = (item: BrainDumpItem, date: Date) =>
    baseTransactions.some(
      (t) =>
        t.status === "done" &&
        Math.abs((t.meta.amount || 0) - (item.meta.amount || 0)) < 0.01 &&
        (t.meta.budgetCategory || "") === (item.meta.budgetCategory || "") &&
        (t.content === item.content ||
          t.meta.parentTodoId === item.id ||
          t.meta.savingGoalId === item.id) &&
        ((t.meta.date &&
          new Date(t.meta.date).toDateString() === date.toDateString()) ||
          (t.completed_at &&
            new Date(t.completed_at).toDateString() === date.toDateString()) ||
          (t.created_at &&
            new Date(t.created_at).toDateString() === date.toDateString())),
    );

  const calculateRoutineOccurrencesInView = (
    item: BrainDumpItem,
    viewDate: Date,
    mode: BudgetAnalyticsViewMode,
  ) => {
    const { start, end } = getViewBounds(viewDate, mode);
    const anchor = getRoutineAnchorDate(item);
    anchor.setHours(0, 0, 0, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const startCheck = new Date(
      Math.max(start.getTime(), anchor.getTime(), todayStart.getTime()),
    );
    startCheck.setHours(0, 0, 0, 0);

    let count = 0;
    for (
      let currentCheckDate = new Date(startCheck);
      currentCheckDate.getTime() < end.getTime();
      currentCheckDate.setDate(currentCheckDate.getDate() + 1)
    ) {
      if (!isRoutineOccurrenceDate(item, currentCheckDate, anchor)) continue;
      if (hasActualRoutineExpenseOnDate(item, currentCheckDate)) continue;
      count++;
    }
    return count;
  };

  routineItems.forEach((routine) => {
    const remainingOccurrences = calculateRoutineOccurrencesInView(
      routine,
      financeDate,
      viewMode,
    );

    if (remainingOccurrences > 0) {
      const projectedAmount = remainingOccurrences * (routine.meta.amount || 0);

      projectedExpense += projectedAmount;
      projectedBudgetUsed += projectedAmount;
      const catId = resolveCategory(routine.meta.budgetCategory);
      if (catId) {
        plannedBudgetMap.set(
          catId,
          (plannedBudgetMap.get(catId) || 0) + projectedAmount,
        );
      } else {
        projectedUncategorized += projectedAmount;
      }
    }
  });

  // 4. Pending Urgent Shopping Projections (Planned)
  const pendingShoppingItems = items.filter(
    (i) =>
      i.type === ItemType.SHOPPING &&
      i.meta.shoppingCategory === "urgent" &&
      i.status !== "done" &&
      (i.meta.amount || 0) > 0,
  );

  pendingShoppingItems.forEach((item) => {
    // Check if the item's due date falls within the current view period
    const dateStr = getShoppingDueDate(item);
    if (!dateStr) return; // Skip if no due date

    const d = new Date(dateStr);
    const isInPeriod = isDateInViewPeriod(d);

    if (isInPeriod) {
      const amount = item.meta.amount || 0;
      projectedExpense += amount;
      projectedBudgetUsed += amount;
      const catId = resolveCategory(item.meta.budgetCategory);
      if (catId) {
        plannedBudgetMap.set(
          catId,
          (plannedBudgetMap.get(catId) || 0) + amount,
        );
      } else {
        projectedUncategorized += amount;
      }
    }
  });

  return {
    list: allTransactions,
    totalIncome,
    totalExpense,
    projectedExpense,
    totalSavings,
    budgetMap,
    plannedBudgetMap,
    uncategorized,
    projectedUncategorized,
    totalBudgetUsed,
    projectedBudgetUsed,
  };
};
