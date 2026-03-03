
import { BrainDumpItem, ItemType, Skill, Wallet, BudgetConfig, SortOrder, NotesSubTab } from '../types';

// --- Focus Tab Selectors ---

export const getFocusItems = (items: BrainDumpItem[]) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowStart = todayStart + 86400000;
  const afterTomorrowStart = tomorrowStart + 86400000;

  const relevantItems = items.filter(i => 
      (i.type === ItemType.TODO || i.type === ItemType.EVENT) && 
      i.status === 'pending'
  );
  
  const today: BrainDumpItem[] = [];
  const tomorrow: BrainDumpItem[] = [];
  const later: BrainDumpItem[] = [];

  relevantItems.forEach(item => {
      if (!item.meta.date) {
          later.push(item);
          return;
      }

      const d = new Date(item.meta.date);
      const itemTime = d.getTime();
      
      if (isNaN(itemTime)) {
          later.push(item);
          return;
      }
      
      if (itemTime < tomorrowStart) {
          today.push(item);
      } else if (itemTime >= tomorrowStart && itemTime < afterTomorrowStart) {
          tomorrow.push(item);
      } else {
          later.push(item);
      }
  });

  const sortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
       const da = a.meta.date ? new Date(a.meta.date).getTime() : Infinity;
       const db = b.meta.date ? new Date(b.meta.date).getTime() : Infinity;
       return da - db;
  };

  return { 
      today: today.sort(sortFn), 
      tomorrow: tomorrow.sort(sortFn), 
      later: later.sort(sortFn) 
  };
};

export const getFocusMonthData = (items: BrainDumpItem[], date: Date, searchQuery: string, selectedTag: string) => {
    // 1. Filter items belonging to this month (Created OR Due)
    // AND are types TODO/EVENT
    const relevantItems = items.filter(i => {
        if (i.type !== ItemType.TODO && i.type !== ItemType.EVENT) return false;
        
        // Tag Filter
        if (selectedTag && !i.meta.tags?.includes(selectedTag)) return false;
        
        // Search Filter
        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            if (!i.content.toLowerCase().includes(lowerQ) && !i.meta.tags?.some(t => t.toLowerCase().includes(lowerQ))) return false;
        }

        const dateToCheck = i.meta.date || i.created_at;
        if (!dateToCheck) return false;
        
        const d = new Date(dateToCheck);
        const isSameMonth = d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
        
        // Dashboard Fix: Always include Today and Tomorrow items if we are looking at the current month
        // This prevents items from "disappearing" when they cross month boundaries (e.g. Feb 28 -> March 1)
        const now = new Date();
        const isCurrentMonthView = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        
        if (isCurrentMonthView) {
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const tomorrowEnd = todayStart + (2 * 86400000); // End of tomorrow
            const itemTime = d.getTime();
            if (itemTime >= todayStart && itemTime < tomorrowEnd) return true;
        }

        return isSameMonth;
    });

    // 2. Split Pending / Done (Excluding routines from doneList)
    const pendingList = relevantItems.filter(i => i.status === 'pending');
    const doneList = relevantItems.filter(i => i.status === 'done' && !i.meta.isRoutine);

    // 3. Group Pending & Routines
    const now = new Date();
    const oneDayAgo = now.getTime() - 86400000;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86400000;
    const afterTomorrowStart = tomorrowStart + 86400000;

    const today: BrainDumpItem[] = [];
    const tomorrow: BrainDumpItem[] = [];
    const later: BrainDumpItem[] = [];
    const routines: BrainDumpItem[] = [];

    // Add all routine items (pending and done) to routines group
    relevantItems.filter(i => i.meta.isRoutine).forEach(item => {
        routines.push(item);
    });

    // Process non-routine items (pending OR recently done within 24h)
    relevantItems.filter(i => !i.meta.isRoutine).forEach(item => {
        const isPending = item.status === 'pending';
        const isRecentlyDone = item.status === 'done' && item.completed_at && new Date(item.completed_at).getTime() > oneDayAgo;

        if (!isPending && !isRecentlyDone) return;

        // If no due date, categorize as Later
        if (!item.meta.date) {
            later.push(item);
            return;
        }

        const d = new Date(item.meta.date);
        const itemTime = d.getTime();
        
        if (isNaN(itemTime)) {
            later.push(item);
            return;
        }

        if (itemTime < tomorrowStart) {
            today.push(item);
        } else if (itemTime >= tomorrowStart && itemTime < afterTomorrowStart) {
            tomorrow.push(item);
        } else {
            later.push(item);
        }
    });

    const sortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
        if (a.status !== b.status) {
            return a.status === 'pending' ? -1 : 1;
        }
        const da = a.meta.date ? new Date(a.meta.date).getTime() : Infinity;
        const db = b.meta.date ? new Date(b.meta.date).getTime() : Infinity;
        return da - db;
    };

    // Special sort for routines: pending first, then done, then by date
    const routineSortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
        if (a.status !== b.status) {
            return a.status === 'pending' ? -1 : 1;
        }
        const da = a.meta.date ? new Date(a.meta.date).getTime() : Infinity;
        const db = b.meta.date ? new Date(b.meta.date).getTime() : Infinity;
        return da - db;
    };
    
    // Sort Done list by completed_at desc
    const sortedDone = doneList.sort((a,b) => {
        const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return db - da;
    });

    // Calculate Counts
    // Future pending routines count as "Done" contextually (temporarily done)
    const futurePendingRoutines = routines.filter(r => 
        r.status === 'pending' && 
        r.meta.date && 
        new Date(r.meta.date) > now
    );
    
    // Todo count: All pending items MINUS future pending routines
    // (Since pendingList includes all pending items, including routines)
    const activePendingCount = pendingList.length - futurePendingRoutines.length;

    // Done count: Done non-routines + Done routines + Future pending routines
    const doneRoutinesCount = routines.filter(r => r.status === 'done').length;
    const totalDoneCount = doneList.length + doneRoutinesCount + futurePendingRoutines.length;

    return {
        summary: {
            todo: activePendingCount,
            done: totalDoneCount
        },
        pendingGroups: {
            today: today.sort(sortFn),
            tomorrow: tomorrow.sort(sortFn),
            later: later.sort(sortFn),
            routines: routines.sort(routineSortFn)
        },
        doneList: sortedDone
    };
};

// --- Skill Selectors ---

const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    d.setHours(0, 0, 0, 0);
    return new Date(d.setDate(diff));
};

export const getSkillItems = (items: BrainDumpItem[], skills: Skill[]) => {
    const logs = items.filter(i => i.type === ItemType.SKILL_LOG).sort((a, b) => {
        const da = new Date(a.meta.date || a.created_at).getTime();
        const db = new Date(b.meta.date || b.created_at).getTime();
        return db - da; 
    });

    const skillStats = new Map<string, number>(); // All time
    const weeklyStats = new Map<string, number>(); // Current Week

    const startOfWeek = getStartOfWeek(new Date());

    skills.forEach(s => {
        skillStats.set(s.id, 0);
        weeklyStats.set(s.id, 0);
    });

    items.filter(i => i.type === ItemType.SKILL_LOG).forEach(log => {
        const duration = log.meta.durationMinutes || 0;
        const sId = log.meta.skillId;
        const logDate = new Date(log.meta.date || log.created_at);

        if (sId) {
           // Total
           skillStats.set(sId, (skillStats.get(sId) || 0) + duration);
           
           // Weekly
           if (logDate >= startOfWeek) {
               weeklyStats.set(sId, (weeklyStats.get(sId) || 0) + duration);
           }
        }
    });

    const stats = skills.map(skill => ({
        ...skill,
        totalHours: Math.round(((skillStats.get(skill.id) || 0) / 60) * 10) / 10,
        weeklyHours: Math.round(((weeklyStats.get(skill.id) || 0) / 60) * 10) / 10,
        weeklyProgress: skill.weeklyTargetMinutes 
          ? Math.min(100, ( (weeklyStats.get(skill.id) || 0) / skill.weeklyTargetMinutes ) * 100)
          : 0
    })).sort((a,b) => b.totalHours - a.totalHours);

    return { stats, logs: logs.slice(0, 10) };
};

// --- Shopping Selectors ---

export const getShoppingItems = (items: BrainDumpItem[]) => {
    const visibleItems = items.filter(i => {
        if (i.type !== ItemType.SHOPPING) return false;
        if (i.status === 'pending') return true;
        if (i.status === 'done' && i.meta?.shoppingCategory === 'routine') return true;
        if (i.status === 'done' && i.meta?.shoppingCategory === 'saving') return true; // Keep savings visible even if done
        if (i.status === 'done' && i.completed_at) {
            const completedTime = new Date(i.completed_at).getTime();
            const now = new Date().getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            return (now - completedTime) < oneDayMs;
        }
        return false;
    });
    
    const urgent = visibleItems.filter(i => i.meta?.shoppingCategory === 'urgent');
    const routine = visibleItems.filter(i => i.meta?.shoppingCategory === 'routine');
    const savings = visibleItems.filter(i => i.meta?.shoppingCategory === 'saving').map(goal => {
        const savedAmount = items
            .filter(i => i.type === ItemType.FINANCE && i.status === 'done' && i.meta.financeType === 'saving' && i.meta.savingGoalId === goal.id)
            .reduce((sum, item) => sum + (item.meta.amount || 0), 0);
        return { ...goal, meta: { ...goal.meta, savedAmount } };
    });
    const normal = visibleItems.filter(i => !i.meta?.shoppingCategory || i.meta.shoppingCategory === 'not_urgent');

    const sortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
        const da = a.meta.date ? new Date(a.meta.date).getTime() : 0;
        const db = b.meta.date ? new Date(b.meta.date).getTime() : 0;
        return da - db;
    };

    urgent.sort(sortFn);
    routine.sort(sortFn);
    normal.sort(sortFn);
    savings.sort(sortFn);

    return { urgent, routine, normal, savings };
};

// --- Note Selectors ---

export const getNoteItems = (
    items: BrainDumpItem[], 
    notesSubTab: NotesSubTab,
    selectedTag: string,
    filterDate: string,
    filterDateTo: string,
    searchQuery: string,
    sortOrder: SortOrder
) => {
    // Separation logic
    let relevantItems: BrainDumpItem[] = [];
    
    if (notesSubTab === 'general') {
        relevantItems = items.filter(i => i.type === ItemType.NOTE && i.status !== 'done');
    } else if (notesSubTab === 'skills') {
        relevantItems = items.filter(i => i.type === ItemType.SKILL_LOG);
    } else {
        // JOURNAL: Include explicit journals AND done TODO items (excluding routines, as they generate their own history items)
        relevantItems = items.filter(i => 
            i.type === ItemType.JOURNAL || 
            (i.type === ItemType.TODO && i.status === 'done' && !i.meta.isRoutine)
        );
    }
    
    // Tag Filter
    if (selectedTag) {
        relevantItems = relevantItems.filter(i => i.meta?.tags?.includes(selectedTag));
    }
    
    // Date Range Filter
    if (filterDate) {
        const startDate = new Date(filterDate);
        startDate.setHours(0, 0, 0, 0);

        // Default to same day if To date is missing
        const endDate = filterDateTo ? new Date(filterDateTo) : new Date(filterDate);
        endDate.setHours(23, 59, 59, 999);

        relevantItems = relevantItems.filter(i => {
             const itemDateStr = i.meta.date || i.created_at;
             if (!itemDateStr) return false;
             
             const itemDate = new Date(itemDateStr);
             
             return itemDate >= startDate && itemDate <= endDate;
        });
    }

    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        relevantItems = relevantItems.filter(i => i.content.toLowerCase().includes(lowerQ) || i.meta.tags?.some(t => t.toLowerCase().includes(lowerQ)));
    }

    return relevantItems.sort((a, b) => {
        // Sort by actual date for Journals, created for others usually
        const da = a.meta.date ? new Date(a.meta.date).getTime() : new Date(a.created_at).getTime();
        const db = b.meta.date ? new Date(b.meta.date).getTime() : new Date(b.created_at).getTime();
        
        return sortOrder === 'newest' ? db - da : da - db;
    });
};

export const getJournalGroups = (journalItems: BrainDumpItem[], sortOrder: SortOrder) => {
    const groups: Record<string, BrainDumpItem[]> = {};
    
    journalItems.forEach(item => {
        // For TODOs, use completed_at if available to place them on the day they were done.
        // For Journals, use meta.date or created_at.
        const dateStr = (item.type === ItemType.TODO && item.completed_at) 
          ? item.completed_at 
          : (item.meta.date || item.created_at);
          
        const dateObj = new Date(dateStr);
        // Key by YYYY-MM-DD
        const key = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    // Sort items within day by time (creation or completion)
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => {
            const ta = (a.type === ItemType.TODO && a.completed_at) ? new Date(a.completed_at).getTime() : new Date(a.created_at).getTime();
            const tb = (b.type === ItemType.TODO && b.completed_at) ? new Date(b.completed_at).getTime() : new Date(b.created_at).getTime();
            return sortOrder === 'newest' ? tb - ta : ta - tb;
        });
    });

    // Sort groups themselves
    const sortedKeys = Object.keys(groups).sort((a, b) => {
         return sortOrder === 'newest' ? new Date(b).getTime() - new Date(a).getTime() : new Date(a).getTime() - new Date(b).getTime();
    });
    
    // Return entries in order
    const sortedGroups: Record<string, BrainDumpItem[]> = {};
    sortedKeys.forEach(key => sortedGroups[key] = groups[key]);

    return sortedGroups;
};

// --- Money Selectors ---

export const getWalletStats = (items: BrainDumpItem[], wallets: Wallet[]) => {
    // Create a map to track balances
    const balanceMap = new Map<string, number>();
    
    wallets.forEach(w => balanceMap.set(w.name.toLowerCase(), w.initialBalance));

    // Go through ALL finished items that involve money
    items.forEach(item => {
        if (item.status !== 'done' && item.type !== ItemType.FINANCE) return;
        if (!item.meta.amount) return;
        
        const amount = item.meta.amount;
        const walletName = item.meta.paymentMethod?.toLowerCase(); // Source Wallet
        
        if (walletName && balanceMap.has(walletName)) {
            const current = balanceMap.get(walletName) || 0;
            const wallet = wallets.find(w => w.name.toLowerCase() === walletName);
            const isCC = wallet?.type === 'cc';

            const isIncome = item.meta.financeType === 'income';
            const isTransfer = item.meta.financeType === 'transfer';
            const isSaving = item.meta.financeType === 'saving';
            
            if (isIncome) {
                 // Income adds to Asset. If CC, it reduces debt (by subtracting from the 'positive' debt balance).
                 if (isCC) balanceMap.set(walletName, Math.max(0, current - amount)); 
                 else balanceMap.set(walletName, current + amount);
            } else if (isTransfer) {
                // Source of Transfer
                if (isCC) balanceMap.set(walletName, current + amount); // Cash Advance from CC -> Increases Debt
                else balanceMap.set(walletName, current - amount); // Transfer from Asset -> Decreases Asset
                
                // Destination of Transfer
                const destName = item.meta.toWallet?.toLowerCase();
                if (destName && balanceMap.has(destName)) {
                    const destCurrent = balanceMap.get(destName) || 0;
                    const destWallet = wallets.find(w => w.name.toLowerCase() === destName);
                    const isDestCC = destWallet?.type === 'cc';
                    
                    if (isDestCC) balanceMap.set(destName, Math.max(0, destCurrent - amount)); // Paying CC bill -> Decreases Debt
                    else balanceMap.set(destName, destCurrent + amount); // Transfer to Asset -> Increases Asset
                }
            } else if (isSaving) {
                // Savings do not reduce asset (wallet balance remains unchanged)
                // but they will reduce net worth later
            } else {
                // Expense
                if (isCC) balanceMap.set(walletName, current + amount); // Spending on CC -> Increases Debt
                else balanceMap.set(walletName, current - amount); // Spending from Asset -> Decreases Asset
            }
        }
    });

    // Map back to wallet objects
    const walletStats = wallets.map(w => ({
        ...w,
        currentBalance: balanceMap.get(w.name.toLowerCase()) || w.initialBalance
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
    viewMode: 'monthly' | 'yearly' = 'monthly'
) => {
    const resolveCategory = (cat?: string) => {
        if (!cat) return null;
        if (budgetConfig.rules.some(r => r.id === cat)) return cat; 
        const foundRule = budgetConfig.rules.find(r => r.name.toLowerCase() === cat.toLowerCase());
        return foundRule ? foundRule.id : null;
    };

    // 1. Explicit Finance Items
    let finance = items.filter(i => i.type === ItemType.FINANCE && (i.status === 'done' || i.status === 'pending') && (i.meta.amount || 0) > 0);
    
    // 2. Implicit Expenses
    const implicitExpenses = items.filter(i => 
        (i.type === ItemType.SHOPPING || i.type === ItemType.TODO) && 
        i.status === 'done' && 
        (i.meta.amount || 0) > 0 &&
        !i.meta.isRoutine && 
        i.meta.shoppingCategory !== 'routine' &&
        i.meta.shoppingCategory !== 'saving'
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
            : (i.completed_at || i.created_at);
            
        if (!dateStr) return false;
        
        const d = new Date(dateStr);
        if (viewMode === 'yearly') {
            return d.getFullYear() === financeDate.getFullYear();
        } else {
            return d.getMonth() === financeDate.getMonth() && d.getFullYear() === financeDate.getFullYear();
        }
    });

    // --- FILTERS ---

    // Filter by Wallet (Source or Destination)
    if (filterWallet) {
        if (filterWallet === 'undefined') {
            allTransactions = allTransactions.filter(i => 
                !i.meta.paymentMethod && !i.meta.toWallet
            );
        } else {
            const wName = filterWallet.toLowerCase();
            allTransactions = allTransactions.filter(i => 
                i.meta.paymentMethod?.toLowerCase() === wName || 
                i.meta.toWallet?.toLowerCase() === wName
            );
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
        allTransactions = allTransactions.filter(i => (i.meta.amount || 0) >= parseFloat(filterMinAmount));
    }
    if (filterMaxAmount) {
        allTransactions = allTransactions.filter(i => (i.meta.amount || 0) <= parseFloat(filterMaxAmount));
    }

    // Tag Filter
    if (selectedTag) allTransactions = allTransactions.filter(i => i.meta?.tags?.includes(selectedTag));
    
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      allTransactions = allTransactions.filter(i => i.content.toLowerCase().includes(lowerQ));
    }

    // Sort
    allTransactions.sort((a, b) => {
        // Amount Sort
        if (sortOrder === 'highest_amount') {
            return (b.meta.amount || 0) - (a.meta.amount || 0);
        }
        if (sortOrder === 'lowest_amount') {
            return (a.meta.amount || 0) - (b.meta.amount || 0);
        }

        // Default Date Sort (Prioritize Activity Date > Completed Date > Created Date)
        const getDate = (i: BrainDumpItem) => {
            // Priority 1: Explicit Activity Date (meta.date)
            if (i.meta.date && i.meta.date !== 'null') return new Date(i.meta.date).getTime();
            // Priority 2: Completed Date (for logged transactions, this is often the "activity" timestamp)
            if (i.completed_at) return new Date(i.completed_at).getTime();
            // Priority 3: Creation Date (fallback)
            return new Date(i.created_at).getTime();
        };

        const dateA = getDate(a);
        const dateB = getDate(b);
        
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // Totals
    const totalIncome = allTransactions.reduce((acc, curr) => {
        if (curr.meta?.financeType === 'income') {
            return acc + (curr.meta.amount || 0);
        }
        return acc;
    }, 0);

    const totalExpense = allTransactions.reduce((acc, curr) => {
      if (curr.meta?.financeType === 'transfer') return acc;
      
      // If type is expense or implicit expense
      const type = curr.meta.financeType || 'expense';
      if (type === 'expense') {
           return acc + (curr.meta.amount || 0);
      }
      return acc;
    }, 0);
    
    // FULL PERIOD DATA (Unfiltered by wallet/amount/type) for Budget Context
    let fullPeriodTransactions = [...finance, ...implicitExpenses];
    fullPeriodTransactions = fullPeriodTransactions.filter(i => {
        const dateStr = (i.type === ItemType.FINANCE) 
            ? (i.meta.date || i.created_at) 
            : (i.completed_at || i.created_at);

        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (viewMode === 'yearly') {
            return d.getFullYear() === financeDate.getFullYear();
        } else {
            return d.getMonth() === financeDate.getMonth() && d.getFullYear() === financeDate.getFullYear();
        }
    });

    const budgetMap = new Map<string, number>();
    const plannedBudgetMap = new Map<string, number>();
    let uncategorized = 0;
    let projectedUncategorized = 0;
    
    budgetConfig.rules.forEach(rule => {
        budgetMap.set(rule.id, 0);
        plannedBudgetMap.set(rule.id, 0);
    });



    // Use fullPeriodTransactions for correct Budget Progress bars
    fullPeriodTransactions.forEach(item => {
         if (item.meta?.financeType === 'income' || item.meta?.financeType === 'transfer') return;
         
         const amt = item.meta?.amount || 0;
         const catId = resolveCategory(item.meta?.budgetCategory);

         if (catId) {
             budgetMap.set(catId, (budgetMap.get(catId) || 0) + amt);
         } else {
             uncategorized += amt;
         }
    });

    // --- Projected / Planned Expenses ---
    let projectedExpense = 0;
    
    let startOfPeriod: Date, endOfPeriod: Date;
    
    if (viewMode === 'yearly') {
        startOfPeriod = new Date(financeDate.getFullYear(), 0, 1);
        endOfPeriod = new Date(financeDate.getFullYear(), 11, 31, 23, 59, 59);
    } else {
        startOfPeriod = new Date(financeDate.getFullYear(), financeDate.getMonth(), 1);
        endOfPeriod = new Date(financeDate.getFullYear(), financeDate.getMonth() + 1, 0, 23, 59, 59);
    }
    
    const now = new Date();

    items.forEach(item => {
         if ((item.type !== ItemType.SHOPPING && item.type !== ItemType.TODO) || (item.meta.amount || 0) <= 0) return;
         if (item.type === ItemType.SHOPPING && (!item.meta.shoppingCategory || item.meta.shoppingCategory === 'not_urgent' || item.meta.shoppingCategory === 'saving')) return;

         const amount = item.meta.amount || 0;
         const catId = resolveCategory(item.meta.budgetCategory);
         
         const addToPlanned = (amt: number) => {
             if (catId) {
                 plannedBudgetMap.set(catId, (plannedBudgetMap.get(catId) || 0) + amt);
             } else {
                 projectedUncategorized += amt;
             }
         };

         if (item.type === ItemType.SHOPPING && item.meta.shoppingCategory === 'routine') {
             const interval = item.meta.routineInterval || 'weekly';
             const daysOfWeek = item.meta.routineDaysOfWeek || [];
             const daysOfMonth = item.meta.routineDaysOfMonth || [];
             const monthsOfYear = item.meta.routineMonthsOfYear || [];

             let nextDue: Date;
             if (item.status === 'done' && item.completed_at) {
                 nextDue = calculateNextDueDate(new Date(item.completed_at), interval, daysOfWeek, daysOfMonth, monthsOfYear);
             } else if (item.meta.date) {
                 nextDue = new Date(item.meta.date);
             } else {
                 nextDue = new Date();
             }
             
             let cursor = new Date(nextDue);
             
             // Move cursor to start of period if it's before
             // Safety break to prevent infinite loops
             let safety = 0;
             while (cursor < startOfPeriod && safety < 1000) {
                 cursor = calculateNextDueDate(cursor, interval, daysOfWeek, daysOfMonth, monthsOfYear);
                 safety++;
             }
             
             safety = 0;
             while (cursor <= endOfPeriod && safety < 1000) {
                 projectedExpense += amount;
                 addToPlanned(amount);
                 cursor = calculateNextDueDate(cursor, interval, daysOfWeek, daysOfMonth, monthsOfYear);
                 safety++;
             }
         } else {
             if (item.status === 'pending') {
                 const targetDate = item.meta.date ? new Date(item.meta.date) : null;
                 if (!targetDate) {
                     // If no date, assume current period if current period includes NOW
                     if (now >= startOfPeriod && now <= endOfPeriod) {
                         projectedExpense += amount;
                         addToPlanned(amount);
                     }
                 } else {
                     if (targetDate >= startOfPeriod && targetDate <= endOfPeriod) {
                         projectedExpense += amount;
                         addToPlanned(amount);
                     }
                 }
             }
         }
    });

    return { 
        list: allTransactions, 
        totalIncome, 
        totalExpense, 
        balance: totalIncome - totalExpense, 
        projectedExpense, 
        budgetMap, 
        plannedBudgetMap,
        uncategorized, 
        projectedUncategorized 
    };
};

export const calculateNextDueDate = (
    completedDate: Date,
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
    daysOfWeek: number[] = [],
    daysOfMonth: number[] = [],
    monthsOfYear: number[] = []
): Date => {
    let nextDueTime = completedDate.getTime();
    
    if (interval === 'daily') {
        nextDueTime = completedDate.getTime() + (1 * 24 * 60 * 60 * 1000);
    } 
    else if (interval === 'weekly') {
        if (daysOfWeek.length > 0) {
            const currentDay = completedDate.getDay(); // 0-6
            const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
            const nextDay = sortedDays.find(d => d > currentDay);
            
            if (nextDay !== undefined) {
                const daysToAdd = nextDay - currentDay;
                nextDueTime = completedDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
            } else {
                const firstDay = sortedDays[0];
                const daysToAdd = (7 - currentDay) + firstDay;
                nextDueTime = completedDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
            }
        } else {
             nextDueTime = completedDate.getTime() + (7 * 24 * 60 * 60 * 1000);
        }
    }
    else if (interval === 'monthly') {
        if (daysOfMonth.length > 0) {
            const currentDay = completedDate.getDate(); // 1-31
            const sortedDays = [...daysOfMonth].sort((a, b) => a - b);
            const nextDay = sortedDays.find(d => d > currentDay);
            
            const nextDateObj = new Date(completedDate);
            if (nextDay !== undefined) {
                // Same month, later date
                nextDateObj.setDate(nextDay);
            } else {
                // Next month, first available date
                // We need to be careful about month overflow (e.g. Jan 31 -> Feb 28/29)
                // If we just add 1 month, it might skip.
                // Strategy: Set to 1st of next month, then set date.
                nextDateObj.setMonth(nextDateObj.getMonth() + 1);
                nextDateObj.setDate(sortedDays[0]);
            }
            nextDueTime = nextDateObj.getTime();
        } else {
            nextDueTime = completedDate.getTime() + (30 * 24 * 60 * 60 * 1000);
        }
    }
    else if (interval === 'yearly') {
        if (monthsOfYear.length > 0) {
            const currentMonth = completedDate.getMonth(); // 0-11
            const sortedMonths = [...monthsOfYear].sort((a, b) => a - b);
            const nextMonth = sortedMonths.find(m => m > currentMonth);
            
            const nextDateObj = new Date(completedDate);
            if (nextMonth !== undefined) {
                nextDateObj.setMonth(nextMonth);
                nextDateObj.setDate(1); 
            } else {
                nextDateObj.setFullYear(nextDateObj.getFullYear() + 1);
                nextDateObj.setMonth(sortedMonths[0]);
                nextDateObj.setDate(1);
            }
            nextDueTime = nextDateObj.getTime();
        } else {
            nextDueTime = completedDate.getTime() + (365 * 24 * 60 * 60 * 1000);
        }
    }
    
    return new Date(nextDueTime);
};

export const calculateFirstDueDate = (
    fromDate: Date,
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
    daysOfWeek: number[] = [],
    daysOfMonth: number[] = [],
    monthsOfYear: number[] = []
): Date => {
    let nextDueTime = fromDate.getTime();
    
    if (interval === 'daily') {
        // Starts today
        return fromDate;
    } 
    else if (interval === 'weekly') {
        if (daysOfWeek.length > 0) {
            const currentDay = fromDate.getDay(); // 0-6
            const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
            // Find today or future day in same week
            const nextDay = sortedDays.find(d => d >= currentDay);
            
            if (nextDay !== undefined) {
                const daysToAdd = nextDay - currentDay;
                nextDueTime = fromDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
            } else {
                // Wrap to next week
                const firstDay = sortedDays[0];
                const daysToAdd = (7 - currentDay) + firstDay;
                nextDueTime = fromDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
            }
        }
    }
    else if (interval === 'monthly') {
        if (daysOfMonth.length > 0) {
            const currentDay = fromDate.getDate(); // 1-31
            const sortedDays = [...daysOfMonth].sort((a, b) => a - b);
            const nextDay = sortedDays.find(d => d >= currentDay);
            
            const nextDateObj = new Date(fromDate);
            if (nextDay !== undefined) {
                // Same month, today or later
                nextDateObj.setDate(nextDay);
            } else {
                // Next month, first available date
                nextDateObj.setMonth(nextDateObj.getMonth() + 1);
                nextDateObj.setDate(sortedDays[0]);
            }
            nextDueTime = nextDateObj.getTime();
        }
    }
    else if (interval === 'yearly') {
        if (monthsOfYear.length > 0) {
            const currentMonth = fromDate.getMonth(); // 0-11
            const sortedMonths = [...monthsOfYear].sort((a, b) => a - b);
            // Check if current month is in list, if so, check if day is passed? 
            // Usually yearly is just "in this month". Let's assume 1st of month for simplicity or today if same month.
            
            const nextMonth = sortedMonths.find(m => m >= currentMonth);
            
            const nextDateObj = new Date(fromDate);
            if (nextMonth !== undefined) {
                if (nextMonth > currentMonth) {
                    nextDateObj.setMonth(nextMonth);
                    nextDateObj.setDate(1);
                } else {
                    // Same month, so it's today (or we could check days if we had them, but we don't for yearly)
                    // Let's assume if it's the same month, it's due "this month", so "now" is fine.
                }
            } else {
                // Next year
                nextDateObj.setFullYear(nextDateObj.getFullYear() + 1);
                nextDateObj.setMonth(sortedMonths[0]);
                nextDateObj.setDate(1);
            }
            nextDueTime = nextDateObj.getTime();
        }
    }
    
    return new Date(nextDueTime);
};

export const getRoutineScheduleLabel = (
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily',
    daysOfWeek: number[] = [],
    daysOfMonth: number[] = [],
    monthsOfYear: number[] = [],
    recurrenceDays: number = 1
): string => {
    if (interval === 'daily') {
        return recurrenceDays > 1 ? `Every ${recurrenceDays} Days` : 'Every Day';
    }
    
    if (interval === 'weekly') {
        if (!daysOfWeek || daysOfWeek.length === 0) return `Every ${recurrenceDays > 1 ? recurrenceDays + ' ' : ''}Week${recurrenceDays > 1 ? 's' : ''}`;
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = daysOfWeek
            .sort((a, b) => a - b)
            .map(d => dayNames[d]);
            
        return `Every ${selectedDays.join(', ')}`;
    }
    
    if (interval === 'monthly') {
        if (!daysOfMonth || daysOfMonth.length === 0) return `Every ${recurrenceDays > 1 ? recurrenceDays + ' ' : ''}Month${recurrenceDays > 1 ? 's' : ''}`;
        
        const selectedDates = daysOfMonth.sort((a, b) => a - b).map(d => {
            const lastDigit = d % 10;
            const suffix = (d >= 11 && d <= 13) ? 'th' : (lastDigit === 1 ? 'st' : (lastDigit === 2 ? 'nd' : (lastDigit === 3 ? 'rd' : 'th')));
            return `${d}${suffix}`;
        });
        
        return `Monthly on ${selectedDates.join(', ')}`;
    }
    
    if (interval === 'yearly') {
        if (!monthsOfYear || monthsOfYear.length === 0) return `Every ${recurrenceDays > 1 ? recurrenceDays + ' ' : ''}Year${recurrenceDays > 1 ? 's' : ''}`;
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const selectedMonths = monthsOfYear
            .sort((a, b) => a - b)
            .map(m => monthNames[m]);
            
        return `Yearly in ${selectedMonths.join(', ')}`;
    }
    
    return 'Routine';
};
