
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
        return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
    });

    // 2. Split Pending / Done
    const pendingList = relevantItems.filter(i => i.status === 'pending');
    const doneList = relevantItems.filter(i => i.status === 'done');

    // 3. Group Pending (Reuse logic but flat if not current month?)
    // Actually, we can just use the standard Today/Tomorrow logic for "Due dates"
    // but filtered to this month.
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86400000;
    const afterTomorrowStart = tomorrowStart + 86400000;

    const today: BrainDumpItem[] = [];
    const tomorrow: BrainDumpItem[] = [];
    const later: BrainDumpItem[] = [];

    pendingList.forEach(item => {
        // If no due date, categorize as Later (or Today if created today? Let's stick to Later/General)
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

        // Logic:
        // If due date < tomorrowStart => Today (Overdue or Today)
        // If due date is tomorrow => Tomorrow
        // Else => Later in this month
        
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
    
    // Sort Done list by completed_at desc
    const sortedDone = doneList.sort((a,b) => {
        const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return db - da;
    });

    return {
        summary: {
            todo: pendingList.length,
            done: doneList.length
        },
        pendingGroups: {
            today: today.sort(sortFn),
            tomorrow: tomorrow.sort(sortFn),
            later: later.sort(sortFn)
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

    return { urgent, routine, normal };
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
        // JOURNAL: Include explicit journals AND done TODO items
        relevantItems = items.filter(i => 
            i.type === ItemType.JOURNAL || 
            (i.type === ItemType.TODO && i.status === 'done')
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

            const isIncome = item.meta.financeType === 'income' || item.meta.financeType === 'reimbursement';
            const isTransfer = item.meta.financeType === 'transfer';
            
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
            } else {
                // Expense or Lending
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
    const totalNetWorth = totalAssets - totalDebt;

    return { walletStats, totalNetWorth, totalAssets, totalDebt };
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
    sortOrder: SortOrder
) => {
    const resolveCategory = (cat?: string) => {
        if (!cat) return null;
        if (budgetConfig.rules.some(r => r.id === cat)) return cat; 
        const foundRule = budgetConfig.rules.find(r => r.name.toLowerCase() === cat.toLowerCase());
        return foundRule ? foundRule.id : null;
    };

    // 1. Explicit Finance Items
    let finance = items.filter(i => i.type === ItemType.FINANCE);
    
    // 2. Implicit Expenses
    const implicitExpenses = items.filter(i => 
        (i.type === ItemType.SHOPPING || i.type === ItemType.TODO) && 
        i.status === 'done' && 
        (i.meta.amount || 0) > 0
    );

    // Combine them
    let allTransactions = [...finance, ...implicitExpenses];
    
    // Filter by Month
    allTransactions = allTransactions.filter(i => {
        const dateStr = i.completed_at || i.created_at;
        if (!dateStr) return false;
        
        const d = new Date(dateStr);
        return d.getMonth() === financeDate.getMonth() && d.getFullYear() === financeDate.getFullYear();
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
        if (curr.meta?.financeType === 'income' || curr.meta?.financeType === 'reimbursement') {
            return acc + (curr.meta.amount || 0);
        }
        return acc;
    }, 0);

    const totalExpense = allTransactions.reduce((acc, curr) => {
      if (curr.meta?.financeType === 'transfer') return acc;
      
      // If type is expense, lending or implicit expense
      const type = curr.meta.financeType || 'expense';
      if (type === 'expense' || type === 'lending') {
           return acc + (curr.meta.amount || 0);
      }
      return acc;
    }, 0);
    
    // FULL MONTH DATA (Unfiltered by wallet/amount/type) for Budget Context
    let fullMonthTransactions = [...finance, ...implicitExpenses];
    fullMonthTransactions = fullMonthTransactions.filter(i => {
        const dateStr = i.completed_at || i.created_at;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getMonth() === financeDate.getMonth() && d.getFullYear() === financeDate.getFullYear();
    });

    const budgetMap = new Map<string, number>();
    const plannedBudgetMap = new Map<string, number>();
    let uncategorized = 0;
    let projectedUncategorized = 0;
    
    budgetConfig.rules.forEach(rule => {
        budgetMap.set(rule.id, 0);
        plannedBudgetMap.set(rule.id, 0);
    });



    // Use fullMonthTransactions for correct Budget Progress bars
    fullMonthTransactions.forEach(item => {
         if (item.meta?.financeType === 'income' || item.meta?.financeType === 'reimbursement' || item.meta?.financeType === 'transfer') return;
         
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
    const startOfMonth = new Date(financeDate.getFullYear(), financeDate.getMonth(), 1);
    const endOfMonth = new Date(financeDate.getFullYear(), financeDate.getMonth() + 1, 0, 23, 59, 59);
    const now = new Date();

    items.forEach(item => {
         if ((item.type !== ItemType.SHOPPING && item.type !== ItemType.TODO) || (item.meta.amount || 0) <= 0) return;
         if (item.type === ItemType.SHOPPING && (!item.meta.shoppingCategory || item.meta.shoppingCategory === 'not_urgent')) return;

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
             const recurrence = item.meta.recurrenceDays || 7;
             let nextDue: Date;
             if (item.status === 'done' && item.completed_at) {
                 nextDue = new Date(new Date(item.completed_at).getTime() + (recurrence * 86400000));
             } else if (item.meta.date) {
                 nextDue = new Date(item.meta.date);
             } else {
                 nextDue = new Date();
             }
             
             const cursor = new Date(nextDue);
             while (cursor < startOfMonth) {
                 cursor.setDate(cursor.getDate() + recurrence);
             }
             while (cursor <= endOfMonth) {
                 projectedExpense += amount;
                 addToPlanned(amount);
                 cursor.setDate(cursor.getDate() + recurrence);
             }
         } else {
             if (item.status === 'pending') {
                 const targetDate = item.meta.date ? new Date(item.meta.date) : null;
                 if (!targetDate) {
                     if (financeDate.getMonth() === now.getMonth() && financeDate.getFullYear() === now.getFullYear()) {
                         projectedExpense += amount;
                         addToPlanned(amount);
                     }
                 } else {
                     if (targetDate.getMonth() === financeDate.getMonth() && targetDate.getFullYear() === financeDate.getFullYear()) {
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
