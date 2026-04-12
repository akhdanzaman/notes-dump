import { v4 as uuidv4 } from 'uuid';
import { DbSchema, BrainDumpItem, ItemType, FinanceType } from '../types';

const fmtDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString() + ' ' + new Date(dateStr).toLocaleTimeString();
};

export const reconcileSpreadsheetData = (db: DbSchema, valueRanges: any[]): DbSchema => {
    if (!Array.isArray(valueRanges)) return db;
    const newItems = [...db.data];
    let hasChanges = false;

    const getCatId = (name: string) => db.budgetConfig?.rules.find(r => r.name === name)?.id || name;
    const getWalId = (name: string) => db.wallets?.find(w => w.name === name)?.id || name;
    const getSkillId = (name: string) => db.skills?.find(s => s.name === name)?.id || name;

    const seenItemIds = new Set<string>();

    // 1. Transactions
    const txSheet = valueRanges.find(r => r.range && r.range.includes('Transactions'));
    if (txSheet && txSheet.values) {
        const rows = txSheet.values.slice(1);
        for (const row of rows) {
            const [date, type, category, description, amountStr, wallet, toWallet, tagsStr, idStr] = row;
            if (!date && !description && !amountStr && !idStr) continue;
            const amount = parseFloat(amountStr) || 0;
            
            const match = newItems.find(i => 
                (idStr && i.id === idStr) ||
                (!idStr && (i.type === ItemType.FINANCE || (i.type === ItemType.SHOPPING && i.status === 'done')) &&
                i.content === description &&
                (i.meta.amount || 0) === amount &&
                fmtDate(i.type === ItemType.SHOPPING ? (i.completed_at || i.created_at) : (i.meta.date || i.created_at)) === date)
            );

            if (match) {
                seenItemIds.add(match.id);
                let updated = false;
                
                if (match.content !== description) { match.content = description; updated = true; }
                if (match.meta.amount !== amount) { match.meta.amount = amount; updated = true; }
                
                const newCatId = getCatId(category);
                if (match.meta.budgetCategory !== newCatId) { match.meta.budgetCategory = newCatId; updated = true; }
                
                const newWalId = getWalId(wallet);
                if (match.meta.paymentMethod !== newWalId) { match.meta.paymentMethod = newWalId; updated = true; }
                
                const newToWalId = getWalId(toWallet);
                if (match.meta.toWallet !== newToWalId) { match.meta.toWallet = newToWalId; updated = true; }
                
                const newType = type as FinanceType;
                if (match.meta.financeType !== newType) { match.meta.financeType = newType; updated = true; }
                
                const newTags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : [];
                if (JSON.stringify(match.meta.tags || []) !== JSON.stringify(newTags)) { match.meta.tags = newTags; updated = true; }
                
                const parsedDate = new Date(date);
                if (!isNaN(parsedDate.getTime())) {
                    const isoDate = parsedDate.toISOString();
                    if (match.type === ItemType.SHOPPING) {
                        if (match.completed_at !== isoDate) { match.completed_at = isoDate; updated = true; }
                    } else {
                        if (match.meta.date !== isoDate) { match.meta.date = isoDate; updated = true; }
                    }
                }
                
                if (updated) hasChanges = true;
            } else {
                const parsedDate = new Date(date);
                const isoDate = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
                
                const newId = uuidv4();
                newItems.push({
                    id: newId,
                    type: ItemType.FINANCE,
                    content: description || 'Manual Transaction',
                    status: 'done',
                    created_at: isoDate,
                    meta: {
                        date: isoDate,
                        financeType: (type as FinanceType) || 'expense',
                        amount: amount,
                        budgetCategory: getCatId(category),
                        paymentMethod: getWalId(wallet),
                        toWallet: getWalId(toWallet),
                        tags: tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : []
                    }
                });
                seenItemIds.add(newId);
                hasChanges = true;
            }
        }
    }

    // 2. Todos
    const todoSheet = valueRanges.find(r => r.range && r.range.includes('Todos'));
    if (todoSheet && todoSheet.values) {
        const headers = todoSheet.values[0] || [];
        const hasDueDate = headers.includes("Due_Date");
        const rows = todoSheet.values.slice(1);
        for (const row of rows) {
            let status, priority, content, dueDateStr, tagsStr, createdAt, completedAt, progressStr, progressNotes, idStr;
            if (hasDueDate) {
                [status, priority, content, dueDateStr, tagsStr, createdAt, completedAt, progressStr, progressNotes, idStr] = row;
            } else {
                [status, priority, content, tagsStr, createdAt, completedAt, progressStr, progressNotes, idStr] = row;
                dueDateStr = '';
            }
            
            if (!content && !createdAt && !idStr) continue;
            
            const match = newItems.find(i => 
                (idStr && i.id === idStr) ||
                (!idStr && i.type === ItemType.TODO &&
                i.content === content &&
                fmtDate(i.created_at) === createdAt)
            );

            if (match) {
                seenItemIds.add(match.id);
                let updated = false;
                if (match.content !== content) { match.content = content; updated = true; }
                if (match.status !== status && (status === 'pending' || status === 'done')) {
                    match.status = status;
                    updated = true;
                }
                const progress = parseInt((progressStr || '').replace('%', ''));
                if (!isNaN(progress) && match.meta.progress !== progress) {
                    match.meta.progress = progress;
                    updated = true;
                }
                if (priority && match.meta.priority !== priority) {
                    match.meta.priority = priority;
                    updated = true;
                }
                if (progressNotes !== undefined && match.meta.progressNotes !== progressNotes) {
                    match.meta.progressNotes = progressNotes;
                    updated = true;
                }
                const newTags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : [];
                if (JSON.stringify(match.meta.tags || []) !== JSON.stringify(newTags)) { match.meta.tags = newTags; updated = true; }
                
                if (dueDateStr) {
                    const parsedDueDate = new Date(dueDateStr);
                    if (!isNaN(parsedDueDate.getTime())) {
                        const isoDueDate = parsedDueDate.toISOString();
                        if (match.meta.date !== isoDueDate) {
                            match.meta.date = isoDueDate;
                            updated = true;
                        }
                    }
                } else if (match.meta.date) {
                    match.meta.date = undefined;
                    updated = true;
                }
                
                if (updated) hasChanges = true;
            } else {
                const parsedDate = new Date(createdAt);
                const isoDate = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
                
                let isoDueDate = undefined;
                if (dueDateStr) {
                    const parsedDueDate = new Date(dueDateStr);
                    if (!isNaN(parsedDueDate.getTime())) {
                        isoDueDate = parsedDueDate.toISOString();
                    }
                }

                const newId = uuidv4();
                newItems.push({
                    id: newId,
                    type: ItemType.TODO,
                    content: content || 'Manual Todo',
                    status: (status === 'done' ? 'done' : 'pending'),
                    created_at: isoDate,
                    meta: {
                        priority: priority || 'normal',
                        tags: tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : [],
                        progress: parseInt((progressStr || '').replace('%', '')) || 0,
                        progressNotes: progressNotes || '',
                        date: isoDueDate
                    }
                });
                seenItemIds.add(newId);
                hasChanges = true;
            }
        }
    }

    // 3. Shopping
    const shopSheet = valueRanges.find(r => r.range && r.range.includes('Shopping'));
    if (shopSheet && shopSheet.values) {
        const headers = shopSheet.values[0] || [];
        const hasDueDate = headers.includes("Due_Date");
        const rows = shopSheet.values.slice(1);
        for (const row of rows) {
            let status, item, amountStr, category, quantity, dueDateStr, tagsStr, idStr;
            if (hasDueDate) {
                [status, item, amountStr, category, quantity, dueDateStr, tagsStr, idStr] = row;
            } else {
                [status, item, amountStr, category, quantity, tagsStr, idStr] = row;
                dueDateStr = '';
            }
            
            if (!item && !amountStr && !idStr) continue;
            const amount = parseFloat(amountStr) || 0;
            
            const match = newItems.find(i => 
                (idStr && i.id === idStr) ||
                (!idStr && i.type === ItemType.SHOPPING &&
                i.content === item &&
                (i.meta.amount || 0) === amount)
            );

            if (match) {
                seenItemIds.add(match.id);
                let updated = false;
                if (match.content !== item) { match.content = item; updated = true; }
                if (match.meta.amount !== amount) { match.meta.amount = amount; updated = true; }
                if (match.status !== status && (status === 'pending' || status === 'done')) {
                    match.status = status;
                    updated = true;
                }
                if (category !== undefined && match.meta.shoppingCategory !== category) {
                    match.meta.shoppingCategory = category;
                    updated = true;
                }
                if (quantity !== undefined && match.meta.quantity !== quantity) {
                    match.meta.quantity = quantity;
                    updated = true;
                }
                const newTags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : [];
                if (JSON.stringify(match.meta.tags || []) !== JSON.stringify(newTags)) { match.meta.tags = newTags; updated = true; }
                
                if (dueDateStr) {
                    const parsedDueDate = new Date(dueDateStr);
                    if (!isNaN(parsedDueDate.getTime())) {
                        const isoDueDate = parsedDueDate.toISOString();
                        if (match.meta.date !== isoDueDate) {
                            match.meta.date = isoDueDate;
                            updated = true;
                        }
                    }
                } else if (match.meta.date) {
                    match.meta.date = undefined;
                    updated = true;
                }
                
                if (updated) hasChanges = true;
            } else {
                let isoDueDate = undefined;
                if (dueDateStr) {
                    const parsedDueDate = new Date(dueDateStr);
                    if (!isNaN(parsedDueDate.getTime())) {
                        isoDueDate = parsedDueDate.toISOString();
                    }
                }

                const newId = uuidv4();
                newItems.push({
                    id: newId,
                    type: ItemType.SHOPPING,
                    content: item || 'Manual Item',
                    status: (status === 'done' ? 'done' : 'pending'),
                    created_at: new Date().toISOString(),
                    meta: {
                        amount: amount,
                        shoppingCategory: category || 'not_urgent',
                        quantity: quantity || '',
                        tags: tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : [],
                        date: isoDueDate
                    }
                });
                seenItemIds.add(newId);
                hasChanges = true;
            }
        }
    }

    // 4. Events
    const eventSheet = valueRanges.find(r => r.range && r.range.includes('Events'));
    if (eventSheet && eventSheet.values) {
        const rows = eventSheet.values.slice(1);
        for (const row of rows) {
            const [date, priority, event, tagsStr, idStr] = row;
            if (!event && !date && !idStr) continue;
            
            const match = newItems.find(i => 
                (idStr && i.id === idStr) ||
                (!idStr && i.type === ItemType.EVENT &&
                i.content === event &&
                fmtDate(i.meta.date) === date)
            );

            if (match) {
                seenItemIds.add(match.id);
                let updated = false;
                if (match.content !== event) { match.content = event; updated = true; }
                if (priority !== undefined && match.meta.priority !== priority) {
                    match.meta.priority = priority;
                    updated = true;
                }
                const newTags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : [];
                if (JSON.stringify(match.meta.tags || []) !== JSON.stringify(newTags)) { match.meta.tags = newTags; updated = true; }
                
                const parsedDate = new Date(date);
                if (!isNaN(parsedDate.getTime())) {
                    const isoDate = parsedDate.toISOString();
                    if (match.meta.date !== isoDate) { match.meta.date = isoDate; updated = true; }
                }
                
                if (updated) hasChanges = true;
            } else {
                const parsedDate = new Date(date);
                const isoDate = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
                const newId = uuidv4();
                newItems.push({
                    id: newId,
                    type: ItemType.EVENT,
                    content: event || 'Manual Event',
                    status: 'pending',
                    created_at: new Date().toISOString(),
                    meta: {
                        date: isoDate,
                        priority: priority || 'normal',
                        tags: tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : []
                    }
                });
                seenItemIds.add(newId);
                hasChanges = true;
            }
        }
    }

    // 5. Notes & Journals
    const notesSheet = valueRanges.find(r => r.range && r.range.includes('Notes & Journals'));
    if (notesSheet && notesSheet.values) {
        const rows = notesSheet.values.slice(1);
        for (const row of rows) {
            const [date, type, content, tagsStr, idStr] = row;
            if (!content && !date && !idStr) continue;
            
            const match = newItems.find(i => 
                (idStr && i.id === idStr) ||
                (!idStr && (i.type === ItemType.NOTE || i.type === ItemType.JOURNAL) &&
                i.content === content &&
                fmtDate(i.created_at) === date)
            );

            if (match) {
                seenItemIds.add(match.id);
                let updated = false;
                if (match.content !== content) { match.content = content; updated = true; }
                const newType = type === 'journal' ? ItemType.JOURNAL : ItemType.NOTE;
                if (match.type !== newType) { match.type = newType; updated = true; }
                
                const newTags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : [];
                if (JSON.stringify(match.meta.tags || []) !== JSON.stringify(newTags)) { match.meta.tags = newTags; updated = true; }
                
                const parsedDate = new Date(date);
                if (!isNaN(parsedDate.getTime())) {
                    const isoDate = parsedDate.toISOString();
                    if (match.created_at !== isoDate) { match.created_at = isoDate; updated = true; }
                }
                
                if (updated) hasChanges = true;
            } else {
                const parsedDate = new Date(date);
                const isoDate = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
                const newId = uuidv4();
                newItems.push({
                    id: newId,
                    type: (type === 'journal' ? ItemType.JOURNAL : ItemType.NOTE),
                    content: content || 'Manual Note',
                    status: 'done',
                    created_at: isoDate,
                    meta: {
                        date: isoDate,
                        tags: tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : []
                    }
                });
                seenItemIds.add(newId);
                hasChanges = true;
            }
        }
    }

    // 6. Skill Logs (Removed)

    // 7. Settings Reconciliation
    const walletSheet = valueRanges.find(r => r.range && r.range.includes('Wallets Config'));
    if (walletSheet && walletSheet.values) {
        const rows = walletSheet.values.slice(1);
        db.wallets = rows.map(row => ({
            id: row[0],
            name: row[1],
            type: row[2],
            initialBalance: parseFloat(row[3]) || 0,
            color: row[4]
        }));
        hasChanges = true;
    }

    const budgetSheet = valueRanges.find(r => r.range && r.range.includes('Budget Rules'));
    console.log("Budget Sheet found:", !!budgetSheet);
    if (budgetSheet && budgetSheet.values) {
        console.log("Budget Sheet values:", budgetSheet.values);
        const rows = budgetSheet.values.slice(1);
        if (!db.budgetConfig) db.budgetConfig = { monthlyIncome: 0, rules: [] };
        
        const newRules: any[] = [];
        for (const row of rows) {
            const prop = row[0];
            const val = row[1];
            const color = row[2];
            console.log(`Processing budget row: prop=${prop}, val=${val}, color=${color}`);
            if (prop === 'Monthly Income') {
                db.budgetConfig.monthlyIncome = parseFloat(val) || 0;
            } else if (prop && prop.startsWith('Rule: ')) {
                const name = prop.replace('Rule: ', '');
                // Parse "50% (ID: 123)"
                const match = val ? val.match(/([\d.]+)%\s*\(ID:\s*(.+)\)/) : null;
                console.log(`Rule match for ${name}:`, match);
                if (match) {
                    newRules.push({
                        id: match[2],
                        name: name,
                        percentage: parseFloat(match[1]) || 0,
                        color: color || db.budgetConfig.rules.find(r => r.id === match[2])?.color || 'bg-gray-500'
                    });
                }
            }
        }
        if (newRules.length > 0) {
            db.budgetConfig.rules = newRules;
        }
        hasChanges = true;
    }

    const skillConfigSheet = valueRanges.find(r => r.range && r.range.includes('Skills Config'));
    if (skillConfigSheet && skillConfigSheet.values) {
        const rows = skillConfigSheet.values.slice(1);
        db.skills = rows.map(row => ({
            id: row[0],
            name: row[1],
            weeklyTargetMinutes: parseInt(row[2]) || 0,
            created_at: row[3],
            color: row[4]
        }));
        hasChanges = true;
    }

    const settingsSheet = valueRanges.find(r => r.range && r.range.includes('Themes & Settings'));
    if (settingsSheet && settingsSheet.values) {
        const rows = settingsSheet.values.slice(1);
        if (!db.appSettings) db.appSettings = { defaultCollapsed: false, hideMoney: false };
        if (!db.monthlyThemes) db.monthlyThemes = {};
        
        const newThemes: Record<string, string> = {};
        for (const row of rows) {
            if (row[0] === 'Setting') {
                if (row[1] === 'Default Collapsed') db.appSettings.defaultCollapsed = row[2] === 'TRUE';
                if (row[1] === 'Hide Money') db.appSettings.hideMoney = row[2] === 'TRUE';
            } else if (row[0] === 'Theme') {
                if (row[1] && row[2]) {
                    newThemes[row[1]] = row[2];
                }
            }
        }
        db.monthlyThemes = newThemes;
        hasChanges = true;
    }

    const sheetsFetched = {
        tx: !!txSheet,
        todo: !!todoSheet,
        shop: !!shopSheet,
        event: !!eventSheet,
        notes: !!notesSheet,
        wallet: !!walletSheet,
        budget: !!budgetSheet,
        skillConfig: !!skillConfigSheet,
        settings: !!settingsSheet
    };

    const finalItems = newItems.filter(item => {
        if (seenItemIds.has(item.id)) return true;
        
        let sheetWasFetched = false;
        // Strict check: if it's a shopping item that is done, it MUST be in the Transactions sheet.
        // If it's a shopping item that is pending, it MUST be in the Shopping sheet.
        if (item.type === ItemType.FINANCE) sheetWasFetched = sheetsFetched.tx;
        else if (item.type === ItemType.SHOPPING) {
            if (item.status === 'done') sheetWasFetched = sheetsFetched.tx;
            else sheetWasFetched = sheetsFetched.shop;
        }
        else if (item.type === ItemType.TODO) sheetWasFetched = sheetsFetched.todo;
        else if (item.type === ItemType.EVENT) sheetWasFetched = sheetsFetched.event;
        else if (item.type === ItemType.NOTE || item.type === ItemType.JOURNAL) sheetWasFetched = sheetsFetched.notes;

        if (sheetWasFetched) {
            hasChanges = true;
            return false;
        }

        return true;
    });

    if (hasChanges) {
        return { ...db, data: finalItems };
    }

    return db;
};
