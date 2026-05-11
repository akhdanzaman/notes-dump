import { BrainDumpItem, ItemType } from '../../types';

export const getPriorityWeight = (p?: string) => {
    if (p === 'high') return 3;
    if (p === 'low') return 1;
    return 2; // normal or undefined
};

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
       const pa = getPriorityWeight(a.meta.priority);
       const pb = getPriorityWeight(b.meta.priority);
       if (pa !== pb) return pb - pa;

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
        
        // Routines are always visible regardless of month, tag filter, or search query
        // so they don't "disappear" after being completed or having their next occurrence
        // in a different month.
        if (i.meta.isRoutine) return true;

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
        const pa = getPriorityWeight(a.meta.priority);
        const pb = getPriorityWeight(b.meta.priority);
        if (pa !== pb) return pb - pa;

        const da = a.meta.date ? new Date(a.meta.date).getTime() : Infinity;
        const db = b.meta.date ? new Date(b.meta.date).getTime() : Infinity;
        return da - db;
    };

    // Special sort for routines: pending first, then done, then by priority, then by date
    const routineSortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
        if (a.status !== b.status) {
            return a.status === 'pending' ? -1 : 1;
        }
        const pa = getPriorityWeight(a.meta.priority);
        const pb = getPriorityWeight(b.meta.priority);
        if (pa !== pb) return pb - pa;

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
