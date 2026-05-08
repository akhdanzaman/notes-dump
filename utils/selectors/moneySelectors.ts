import { BrainDumpItem, ItemType, Wallet, BudgetConfig, SortOrder } from '../../types';
import { getCanonicalMetaValue, getCanonicalOrRawItemValue, getRawMetaValue, itemMatchesCanonicalSearch } from '../canonicalization/accessors';
import { ACHIEVED_GOAL_FINANCE_TYPE } from '../financeTypeUtils';
import { getShoppingDueDate, getShoppingTransactionDate } from '../shoppingDateUtils';
import { BudgetAnalyticsViewMode, getWeekBounds } from '../budgetAnalytics';

const resolveWalletBalanceKey = (wallets: Wallet[], value?: string) => {
    const normalized = value?.toLowerCase().trim();
    if (!normalized) return '';
    const wallet = wallets.find(w => w.id.toLowerCase() === normalized || w.name.toLowerCase() === normalized);
    return wallet ? wallet.name.toLowerCase() : normalized;
};

const resolveItemWalletBalanceKey = (wallets: Wallet[], item: BrainDumpItem) => {
    const canonicalPaymentMethod = getCanonicalMetaValue(item.meta, 'paymentMethod');
    const canonicalKey = resolveWalletBalanceKey(wallets, canonicalPaymentMethod);
    if (canonicalKey && wallets.some(w => w.name.toLowerCase() === canonicalKey)) return canonicalKey;

    const rawPaymentMethod = getRawMetaValue(item.meta, 'paymentMethod');
    return resolveWalletBalanceKey(wallets, rawPaymentMethod);
};

export const getWalletStats = (items: BrainDumpItem[], wallets: Wallet[]) => {
    // Create a map to track balances
    const balanceMap = new Map<string, number>();

    wallets.forEach(w => balanceMap.set(w.name.toLowerCase(), w.initialBalance));

    // Go through ALL finished items that involve money
    items.forEach(item => {
        // Include done FINANCE items, and done SHOPPING/TODO items that have an amount
        const isFinance = item.type === ItemType.FINANCE;
        const isImplicitExpense = (item.type === ItemType.SHOPPING || item.type === ItemType.TODO) && item.status === 'done';

        if (!isFinance && !isImplicitExpense) return;
        if (isFinance && item.status !== 'done') return;
        if (!item.meta.amount) return;

        // Exclude saving goals and routine shopping items from implicit expenses (routines generate separate finance items)
        if (isImplicitExpense && (item.meta.shoppingCategory === 'saving' || item.meta.shoppingCategory === 'investment' || item.meta.shoppingCategory === 'routine')) return;

        const amount = item.meta.amount;
        const walletName = resolveItemWalletBalanceKey(wallets, item); // Source Wallet

        if (walletName && balanceMap.has(walletName)) {
            const current = balanceMap.get(walletName) || 0;
            const wallet = wallets.find(w => w.name.toLowerCase() === walletName);
            const isCC = wallet?.type === 'cc';

            const isIncome = isFinance && item.meta.financeType === 'income';
            const isTransfer = isFinance && item.meta.financeType === 'transfer';
            const isSaving = isFinance && item.meta.financeType === 'saving';
            const isAchievedGoal = isFinance && item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE;

            if (isIncome) {
                 // Income adds to Asset. If CC, it reduces debt (by subtracting from the 'positive' debt balance).
                 if (isCC) balanceMap.set(walletName, Math.max(0, current - amount));
                 else balanceMap.set(walletName, current + amount);
            } else if (isTransfer) {
                // Source of Transfer
                if (isCC) balanceMap.set(walletName, current + amount); // Cash Advance from CC -> Increases Debt
                else balanceMap.set(walletName, current - amount); // Transfer from Asset -> Decreases Asset

                // Destination of Transfer
                const destName = resolveWalletBalanceKey(wallets, item.meta.toWallet);
                if (destName && balanceMap.has(destName)) {
                    const destCurrent = balanceMap.get(destName) || 0;
                    const destWallet = wallets.find(w => w.name.toLowerCase() === destName);
                    const isDestCC = destWallet?.type === 'cc';

                    if (isDestCC) balanceMap.set(destName, Math.max(0, destCurrent - amount)); // Paying CC bill -> Decreases Debt
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
            } else if (isAchievedGoal) {
                // Achieved goals spend from the wallet now,
                // while staying out of expense analytics.
                if (isCC) balanceMap.set(walletName, current + amount);
                else balanceMap.set(walletName, current - amount);
            } else {
                // Expense (Finance expense or implicit expense from Shopping/Todo)
                if (isCC) balanceMap.set(walletName, current + amount); // Spending on CC -> Increases Debt
                else balanceMap.set(walletName, current - amount); // Spending from Asset -> Decreases Asset
            }
        }
    });

    // Map back to wallet objects
    const walletStats = wallets.map(w => ({
        ...w,
        currentBalance: balanceMap.get(w.name.toLowerCase()) ?? w.initialBalance
    }));

    // Calculate Total Net Worth: (Total Assets) - (Total CC Debt)
    const assets = walletStats.filter(w => w.type !== 'cc');
    const liabilities = walletStats.filter(w => w.type === 'cc');

    const totalAssets = assets.reduce((acc, w) => acc + w.currentBalance, 0);
    const totalDebt = liabilities.reduce((acc, w) => acc + w.currentBalance, 0);

    // Calculate total savings
    const activeGoals = new Set(items
        .filter(i => i.type === ItemType.SHOPPING && i.meta.shoppingCategory === 'saving' && i.status !== 'done')
        .map(i => i.id));

    const totalSavings = items
        .filter(i => i.type === ItemType.FINANCE && (i.status === 'done' || i.status === 'pending') && i.meta.financeType === 'saving' && i.meta.savingGoalId && activeGoals.has(i.meta.savingGoalId))
        .reduce((sum, item) => sum + (item.meta.amount || 0), 0);

    const totalNetWorth = totalAssets - totalDebt - totalSavings;

    return { walletStats, totalNetWorth, totalAssets, totalDebt, totalSavings };
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
    viewMode: BudgetAnalyticsViewMode = 'monthly',
    wallets: Wallet[] = []
) => {
    const resolveCategory = (cat?: string) => {
        if (!cat) return null;
        if (budgetConfig.rules.some(r => r.id === cat)) return cat;
        const foundRule = budgetConfig.rules.find(r => r.name.toLowerCase() === cat.toLowerCase());
        return foundRule ? foundRule.id : null;
    };

    const isDateInViewPeriod = (d: Date) => {
        if (viewMode === 'yearly') return d.getFullYear() === financeDate.getFullYear();
        if (viewMode === 'weekly') {
            const { start, end } = getWeekBounds(financeDate);
            return d.getTime() >= start.getTime() && d.getTime() < end.getTime();
        }
        return d.getMonth() === financeDate.getMonth() && d.getFullYear() === financeDate.getFullYear();
    };

    // 1. Explicit Finance Items
    let finance = items.filter(i => i.type === ItemType.FINANCE && (i.status === 'done' || i.status === 'pending') && (i.meta.amount || 0) > 0);

    // 2. Implicit Expenses
    const implicitExpenses = items.filter(i =>
        (i.type === ItemType.SHOPPING || i.type === ItemType.TODO) &&
        i.status === 'done' &&
        (i.meta.amount || 0) > 0 &&
        i.meta.shoppingCategory !== 'saving' && i.meta.shoppingCategory !== 'investment' &&
        i.meta.shoppingCategory !== 'routine'
    );

    // Combine them
    let allTransactions = [...finance, ...implicitExpenses];

    // Filter by Date (Month or Year)
    allTransactions = allTransactions.filter(i => {
        // For Finance items, prioritize the user-set date (meta.date).
        // For Shopping/Todos (implicit expenses), prioritize the completion date.
        // Fallback to creation date.
        const dateStr = (i.type === ItemType.FINANCE)
            ? (i.meta.date || i.created_at)
            : getShoppingTransactionDate(i);

        if (!dateStr) return false;

        const d = new Date(dateStr);
        return isDateInViewPeriod(d);
    });

    // --- FILTERS ---

    // Filter by Wallet (Source or Destination). Compare resolved wallet keys so
    // canonical paymentMethod IDs and raw wallet display names collapse together.
    if (filterWallet) {
        if (filterWallet === 'undefined') {
            allTransactions = allTransactions.filter(i =>
                !getCanonicalOrRawItemValue(i, 'paymentMethod') && !i.meta.toWallet
            );
        } else {
            const walletKey = resolveWalletBalanceKey(wallets, filterWallet);
            allTransactions = allTransactions.filter(i => {
                const sourceKey = resolveWalletBalanceKey(wallets, getCanonicalOrRawItemValue(i, 'paymentMethod'));
                const destinationKey = resolveWalletBalanceKey(wallets, i.meta.toWallet);
                return sourceKey === walletKey || destinationKey === walletKey;
            });
        }
    }

    // Filter by Type
    if (filterTransactionType) {
        allTransactions = allTransactions.filter(i => {
            if (filterTransactionType === 'shopping') {
                return i.type === ItemType.SHOPPING;
            }
            // Default to 'expense' if financeType is missing for money items
            const type = i.meta.financeType || ((i.type === ItemType.FINANCE || i.meta.amount) ? 'expense' : undefined);
            return type === filterTransactionType;
        });
    }

    // Filter by Category
    if (filterCategory) {
        allTransactions = allTransactions.filter(i => {
            if (filterTransactionType === 'saving') {
                return i.meta.savingGoalId === filterCategory;
            }
            const catId = resolveCategory(i.meta.budgetCategory);
            if (filterCategory === 'uncategorized') {
                return !catId;
            }
            return catId === filterCategory;
        });
    }

    // Filter by Amount Range
    if (filterMinAmount) {
        const min = parseFloat(filterMinAmount);
        if (!isNaN(min)) {
            allTransactions = allTransactions.filter(i => (i.meta.amount || 0) >= min);
        }
    }
    if (filterMaxAmount) {
        const max = parseFloat(filterMaxAmount);
        if (!isNaN(max)) {
            allTransactions = allTransactions.filter(i => (i.meta.amount || 0) <= max);
        }
    }

    // Filter by Tag
    if (selectedTag) {
        allTransactions = allTransactions.filter(i => i.meta?.tags?.includes(selectedTag));
    }

    // Filter by Search Query
    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        allTransactions = allTransactions.filter(i => itemMatchesCanonicalSearch(i, lowerQ));
    }

    // --- SORTING ---
    allTransactions.sort((a, b) => {
        const da = (a.type === ItemType.FINANCE) ? new Date(a.meta.date || a.created_at).getTime() : new Date(getShoppingTransactionDate(a)).getTime();
        const db = (b.type === ItemType.FINANCE) ? new Date(b.meta.date || b.created_at).getTime() : new Date(getShoppingTransactionDate(b)).getTime();

        if (sortOrder === 'newest') return db - da;
        if (sortOrder === 'oldest') return da - db;
        if (sortOrder === 'highest_amount') return (b.meta.amount || 0) - (a.meta.amount || 0);
        if (sortOrder === 'lowest_amount') return (a.meta.amount || 0) - (b.meta.amount || 0);
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

    // We need ALL items for the month/year (unfiltered) to calculate totals accurately
    let baseTransactions = [...finance, ...implicitExpenses].filter(i => {
        const dateStr = (i.type === ItemType.FINANCE)
            ? (i.meta.date || i.created_at)
            : getShoppingTransactionDate(i);
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return isDateInViewPeriod(d);
    });

    baseTransactions.forEach(item => {
        const amount = item.meta.amount || 0;
        const type = item.meta.financeType || 'expense';
        const isDone = item.status === 'done';

        if (type === 'income') {
            if (isDone) totalIncome += amount;
        } else if (type === 'expense' || type === 'transfer' || type === 'saving' || type === ACHIEVED_GOAL_FINANCE_TYPE) {
            // Only count actual expenses and savings, not transfers between own wallets
            if (type === 'transfer') return;
            if (type === ACHIEVED_GOAL_FINANCE_TYPE) return;

            if (type === 'saving' && isDone) {
                totalSavings += amount;
            }

            if (isDone) {
                totalExpense += amount;

                const catId = resolveCategory(item.meta.budgetCategory);

                if (catId) {
                    budgetMap.set(catId, (budgetMap.get(catId) || 0) + amount);
                } else {
                    uncategorized += amount;
                }
            } else {
                // Only add to projected/planned if NOT done
                projectedExpense += amount;

                const catId = resolveCategory(item.meta.budgetCategory);

                if (catId) {
                    plannedBudgetMap.set(catId, (plannedBudgetMap.get(catId) || 0) + amount);
                } else {
                    projectedUncategorized += amount;
                }
            }
        }
    });

    // 3. Routine Projections (Future/Planned)
    const routineItems = items.filter(i =>
        i.type === 'SHOPPING' &&
        i.meta.isRoutine === true
    );

    const calculateRemainingOccurrences = (item: BrainDumpItem, viewDate: Date, mode: BudgetAnalyticsViewMode) => {
        const { routineInterval, routineDaysOfWeek, routineDaysOfMonth, routineMonthsOfYear, recurrenceDays } = item.meta;
        const today = new Date();
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);

        if (mode === 'weekly') {
            const { start, end } = getWeekBounds(viewDate);
            if (end.getTime() <= todayStart.getTime()) return 0;
            const startCheck = start.getTime() <= todayStart.getTime() && todayStart.getTime() < end.getTime()
                ? todayStart
                : start;
            let count = 0;
            for (let currentCheckDate = new Date(startCheck); currentCheckDate.getTime() < end.getTime(); currentCheckDate.setDate(currentCheckDate.getDate() + 1)) {
                const dayOfWeek = currentCheckDate.getDay();
                const dayOfMonth = currentCheckDate.getDate();
                const month = currentCheckDate.getMonth();
                let isMatch = false;

                if (routineInterval === 'daily') {
                    isMatch = true;
                } else if (routineInterval === 'weekly' && routineDaysOfWeek) {
                    isMatch = routineDaysOfWeek.includes(dayOfWeek);
                } else if (routineInterval === 'monthly' && routineDaysOfMonth) {
                    isMatch = routineDaysOfMonth.includes(dayOfMonth);
                } else if (routineInterval === 'yearly' && routineMonthsOfYear) {
                    isMatch = routineMonthsOfYear.includes(month) && (!routineDaysOfMonth || routineDaysOfMonth.includes(dayOfMonth));
                } else if (!routineInterval && recurrenceDays) {
                    return Math.floor(Math.max(0, Math.ceil((end.getTime() - startCheck.getTime()) / 86400000)) / recurrenceDays);
                }

                if (isMatch) {
                    const isToday = currentCheckDate.getTime() === todayStart.getTime();
                    if (isToday) {
                        const isDoneToday = baseTransactions.some(t =>
                            t.content === item.content &&
                            Math.abs((t.meta.amount || 0) - (item.meta.amount || 0)) < 0.01 &&
                            (
                                (t.meta.date && new Date(t.meta.date).toDateString() === currentCheckDate.toDateString()) ||
                                (t.completed_at && new Date(t.completed_at).toDateString() === currentCheckDate.toDateString()) ||
                                (t.created_at && new Date(t.created_at).toDateString() === currentCheckDate.toDateString())
                            )
                        );
                        if (!isDoneToday) count++;
                    } else {
                        count++;
                    }
                }
            }
            return count;
        }

        if (mode === 'monthly') {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Determine start day
            let startDay = 1;

            // Check if viewDate is past, current, or future
            const viewTime = new Date(year, month, 1).getTime();
            const currentMonthTime = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

            if (viewTime < currentMonthTime) {
                return 0; // Past month, no remaining planned
            } else if (viewTime === currentMonthTime) {
                startDay = today.getDate(); // Start from today
            } else {
                startDay = 1; // Future month, start from 1st
            }

            let count = 0;

            // Iterate days from startDay to end of month
            for (let d = startDay; d <= daysInMonth; d++) {
                const currentCheckDate = new Date(year, month, d);
                let isMatch = false;

                if (routineInterval === 'daily') {
                    isMatch = true;
                } else if (routineInterval === 'weekly' && routineDaysOfWeek) {
                    if (routineDaysOfWeek.includes(currentCheckDate.getDay())) isMatch = true;
                } else if (routineInterval === 'monthly' && routineDaysOfMonth) {
                    if (routineDaysOfMonth.includes(d)) isMatch = true;
                } else if (routineInterval === 'yearly' && routineMonthsOfYear) {
                     // For yearly, if we are in the correct month, we count it once.
                     // But we need to know "when" in the month it happens to know if it's "remaining".
                     // If no day specified, we assume it's available if we are in the month.
                     // To avoid double counting in current month, we only count it if it's NOT done.
                     // But this loop is day-based.
                     // Let's simplify: If yearly and month matches, count 1 if we are at start of month or if it's not done?
                     // Let's just return 1 if month matches and we are not in past.
                     // And rely on the "Done" check below if it's today? No, yearly doesn't have a "day".
                     // Let's skip complex yearly logic here and stick to the "Total - Done" fallback for yearly/recurrence if needed,
                     // or just return 1 if future.
                     if (routineMonthsOfYear.includes(month)) {
                         // If future month: 1.
                         // If current month: Check if done?
                         // Let's just return 1 for now if it's the right month.
                         // This loop approach doesn't fit "Yearly without day".
                         // We'll handle it outside the loop or just add 1 here and break.
                         return 1;
                     }
                } else if (!routineInterval && recurrenceDays) {
                    // Legacy recurrence: approximate remaining
                    // (DaysRemaining / Recurrence)
                    return Math.floor((daysInMonth - startDay + 1) / recurrenceDays);
                }

                if (isMatch) {
                    // If it's today, check if already done to avoid double counting
                    if (viewTime === currentMonthTime && d === today.getDate()) {
                        const isDoneToday = baseTransactions.some(t =>
                            t.content === item.content &&
                            Math.abs((t.meta.amount || 0) - (item.meta.amount || 0)) < 0.01 &&
                            (
                                (t.meta.date && new Date(t.meta.date).getDate() === d) ||
                                (t.completed_at && new Date(t.completed_at).getDate() === d) ||
                                (t.created_at && new Date(t.created_at).getDate() === d)
                            )
                        );

                        if (!isDoneToday) count++;
                    } else {
                        // Future day in this month
                        count++;
                    }
                }
            }
            return count;
        }
        return 0;
    };

    routineItems.forEach(routine => {
        const remainingOccurrences = calculateRemainingOccurrences(routine, financeDate, viewMode);

        if (remainingOccurrences > 0) {
            const projectedAmount = remainingOccurrences * (routine.meta.amount || 0);

            projectedExpense += projectedAmount;

            const catId = resolveCategory(routine.meta.budgetCategory);
            if (catId) {
                plannedBudgetMap.set(catId, (plannedBudgetMap.get(catId) || 0) + projectedAmount);
            } else {
                projectedUncategorized += projectedAmount;
            }
        }
    });

    // 4. Pending Shopping Projections (Future/Planned)
    // Includes Urgent and other dated shopping items
    const pendingShoppingItems = items.filter(i =>
        i.type === ItemType.SHOPPING &&
        i.meta.shoppingCategory !== 'routine' &&
        i.meta.shoppingCategory !== 'saving' && i.meta.shoppingCategory !== 'investment' &&
        i.status !== 'done' &&
        (i.meta.amount || 0) > 0
    );

    pendingShoppingItems.forEach(item => {
        // Check if the item's due date falls within the current view period
        const dateStr = getShoppingDueDate(item);
        if (!dateStr) return; // Skip if no due date

        const d = new Date(dateStr);
        let isInPeriod = false;

        // Check if view period is in the past
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        const viewYear = financeDate.getFullYear();
        const viewMonth = financeDate.getMonth();

        const isPastView = (() => {
            if (viewMode === 'yearly') return viewYear < currentYear;
            if (viewMode === 'weekly') {
                const { end } = getWeekBounds(financeDate);
                const todayStart = new Date(today);
                todayStart.setHours(0, 0, 0, 0);
                return end.getTime() <= todayStart.getTime();
            }
            return viewYear < currentYear || (viewYear === currentYear && viewMonth < currentMonth);
        })();

        if (isPastView) return;

        isInPeriod = isDateInViewPeriod(d);

        if (isInPeriod) {
            const amount = item.meta.amount || 0;
            projectedExpense += amount;

            const catId = resolveCategory(item.meta.budgetCategory);
            if (catId) {
                plannedBudgetMap.set(catId, (plannedBudgetMap.get(catId) || 0) + amount);
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
        projectedUncategorized
    };
};
