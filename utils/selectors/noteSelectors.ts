import { BrainDumpItem, ItemType, NotesSubTab, SortOrder } from '../../types';

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
        relevantItems = items.filter(i => i.type === ItemType.SKILL_LOG || !!i.meta.skillId || !!i.meta.skillName);
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
