import { v4 as uuidv4 } from 'uuid';
import { DbSchema, BrainDumpItem, ItemType, FinanceType, DeepWorkBlockerStatus, DeepWorkCompletionMode, DeepWorkStatus } from '../types';
import { ACHIEVED_GOAL_FINANCE_TYPE, getAchievedGoalName, parseFinanceType } from '../utils/financeTypeUtils';
import { applyDeepWorkChildProgress, applyDeepWorkCompletionSemantics, normalizeDeepWorkTodoMeta, parseSubtasksFromSheet } from '../utils/deepWorkTodoModel';

const fmtDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString() + ' ' + new Date(dateStr).toLocaleTimeString();
};

const parseNotesSheetItemType = (value: unknown): ItemType => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'journal' ? ItemType.JOURNAL : ItemType.NOTE;
};

const splitSheetList = (value: unknown): string[] | undefined => {
    if (typeof value !== 'string') return undefined;
    const parts = value
        .split(/[,\n;]/)
        .map(v => v.trim())
        .filter(Boolean);
    return parts.length > 0 ? Array.from(new Set(parts)) : undefined;
};

const cleanCell = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const cleaned = value.replace(/\s+/g, ' ').trim();
    return cleaned || undefined;
};

const parsePositiveInt = (value: unknown): number | undefined => {
    const parsed = parseInt(String(value || '').replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const parseCompletionMode = (value: unknown): DeepWorkCompletionMode | undefined => {
    const normalized = cleanCell(value);
    return normalized === 'manual' || normalized === 'all_subtasks' || normalized === 'final_output_check'
        ? normalized
        : undefined;
};

const parseDeepWorkStatus = (value: unknown): DeepWorkStatus | undefined => {
    const normalized = cleanCell(value);
    return normalized === 'suggested' || normalized === 'accepted' || normalized === 'active' || normalized === 'dismissed' || normalized === 'done'
        ? normalized
        : undefined;
};

const parseBlockerStatus = (value: unknown): DeepWorkBlockerStatus | undefined => {
    const normalized = cleanCell(value);
    return normalized === 'clear' || normalized === 'blocked' || normalized === 'needs_input' || normalized === 'unknown'
        ? normalized
        : undefined;
};

const getHeaderCell = (headers: unknown[], row: unknown[], name: string): unknown => {
    const index = headers.indexOf(name);
    return index >= 0 ? row[index] : undefined;
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
            const financeType = parseFinanceType(type) || 'expense';
            
            const match = newItems.find(i => 
                (idStr && i.id === idStr && (i.type === ItemType.FINANCE || (i.type === ItemType.SHOPPING && i.status === 'done' && i.meta.shoppingCategory !== 'saving'))) ||
                (!idStr && (i.type === ItemType.FINANCE || (i.type === ItemType.SHOPPING && i.status === 'done' && i.meta.shoppingCategory !== 'saving')) &&
                i.content === description &&
                (i.meta.amount || 0) === amount &&
                fmtDate(i.type === ItemType.SHOPPING ? (i.completed_at || i.created_at) : (i.meta.date || i.created_at)) === date)
            );

            if (match) {
                seenItemIds.add(match.id);
                let updated = false;

                if (match.status !== 'done') {
                    match.status = 'done';
                    updated = true;
                }
                
                if (match.content !== description) { match.content = description; updated = true; }
                if (match.meta.amount !== amount) { match.meta.amount = amount; updated = true; }
                
                const newCatId = getCatId(category);
                if (match.meta.budgetCategory !== newCatId) { match.meta.budgetCategory = newCatId; updated = true; }
                
                const newWalId = getWalId(wallet);
                if (match.meta.paymentMethod !== newWalId) { match.meta.paymentMethod = newWalId; updated = true; }
                
                const newToWalId = getWalId(toWallet);
                if (match.meta.toWallet !== newToWalId) { match.meta.toWallet = newToWalId; updated = true; }
                
                const newType = financeType as FinanceType;
                if (match.meta.financeType !== newType) { match.meta.financeType = newType; updated = true; }

                if (newType === ACHIEVED_GOAL_FINANCE_TYPE) {
                    const matchedGoal = newItems.find(i =>
                        i.type === ItemType.SHOPPING &&
                        i.meta.shoppingCategory === 'saving' &&
                        getAchievedGoalName(description).toLowerCase() === i.content.trim().toLowerCase()
                    );
                    if (matchedGoal && match.meta.savingGoalId !== matchedGoal.id) {
                        match.meta.savingGoalId = matchedGoal.id;
                        updated = true;
                    }
                }
                
                const newTags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : [];
                if (JSON.stringify(match.meta.tags || []) !== JSON.stringify(newTags)) { match.meta.tags = newTags; updated = true; }
                
                const parsedDate = new Date(date);
                if (!isNaN(parsedDate.getTime())) {
                    const isoDate = parsedDate.toISOString();
                    if (match.type === ItemType.SHOPPING) {
                        if (match.completed_at !== isoDate) { match.completed_at = isoDate; updated = true; }
                    } else {
                        if (match.meta.date !== isoDate) { match.meta.date = isoDate; updated = true; }
                        if (match.completed_at !== isoDate) { match.completed_at = isoDate; updated = true; }
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
                        financeType,
                        amount: amount,
                        budgetCategory: getCatId(category),
                        paymentMethod: getWalId(wallet),
                        toWallet: getWalId(toWallet),
                        savingGoalId: financeType === ACHIEVED_GOAL_FINANCE_TYPE
                            ? newItems.find(i => i.type === ItemType.SHOPPING && i.meta.shoppingCategory === 'saving' && getAchievedGoalName(description).toLowerCase() === i.content.trim().toLowerCase())?.id
                            : undefined,
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
        const hasType = headers.includes("Type");
        const hasStartDate = headers.includes("Start_Date");
        const rows = todoSheet.values.slice(1);
        for (const row of rows) {
            let typeStr, status, priority, content, dueDateStr, startDateStr, endDateStr, tagsStr, createdAt, completedAt, progressStr, progressNotes, idStr;
            
            if (hasType && hasStartDate) {
                // New format: ["Type", "Status", "Priority", "Content", "Due_Date", "Start_Date", "End_Date", "Tags", "Created_At", "Completed_At", "Progress", "Progress_Notes", "ID"]
                [typeStr, status, priority, content, dueDateStr, startDateStr, endDateStr, tagsStr, createdAt, completedAt, progressStr, progressNotes, idStr] = row;
            } else if (hasDueDate) {
                // Old format 1: ["Status", "Priority", "Content", "Due_Date", "Tags", "Created_At", "Completed_At", "Progress", "Progress_Notes", "ID"]
                [status, priority, content, dueDateStr, tagsStr, createdAt, completedAt, progressStr, progressNotes, idStr] = row;
            } else {
                // Old format 2
                [status, priority, content, tagsStr, createdAt, completedAt, progressStr, progressNotes, idStr] = row;
                dueDateStr = '';
            }
            
            if (!content && !createdAt && !idStr) continue;

            const hasParentTodoIdColumn = headers.includes("Parent_ID");
            const hasDeepWorkRoleColumn = headers.includes("Deep_Work_Role");
            const hasStepOrderColumn = headers.includes("Step_Order");
            const hasStepCountColumn = headers.includes("Step_Count");
            const hasChildIdsColumn = headers.includes("Child_IDs");
            const hasCompletionModeColumn = headers.includes("Completion_Mode");
            const hasDeepWorkStatusColumn = headers.includes("Deep_Work_Status");
            const hasNextActionColumn = headers.includes("Next_Action");
            const hasFinalOutputColumn = headers.includes("Final_Output");
            const hasSessionEstimateColumn = headers.includes("Session_Estimate_Min");
            const hasBlockerStatusColumn = headers.includes("Blocker_Status");
            const hasBlockerCheckColumn = headers.includes("Blocker_Check");
            const hasSubtasksColumn = headers.includes("Subtasks");
            const parentTodoId = hasParentTodoIdColumn ? row[headers.indexOf("Parent_ID")] : undefined;
            const deepWorkRole = hasDeepWorkRoleColumn ? row[headers.indexOf("Deep_Work_Role")] : undefined;
            const stepOrderStr = hasStepOrderColumn ? row[headers.indexOf("Step_Order")] : undefined;
            const stepCountStr = hasStepCountColumn ? row[headers.indexOf("Step_Count")] : undefined;
            const stepOrder = parseInt(stepOrderStr || '', 10);
            const stepCount = parseInt(stepCountStr || '', 10);
            const childTodoIds = hasChildIdsColumn ? splitSheetList(getHeaderCell(headers, row, "Child_IDs")) : undefined;
            const completionMode = hasCompletionModeColumn ? parseCompletionMode(getHeaderCell(headers, row, "Completion_Mode")) : undefined;
            const deepWorkStatus = hasDeepWorkStatusColumn ? parseDeepWorkStatus(getHeaderCell(headers, row, "Deep_Work_Status")) : undefined;
            const nextAction = hasNextActionColumn ? cleanCell(getHeaderCell(headers, row, "Next_Action")) : undefined;
            const finalOutput = hasFinalOutputColumn ? cleanCell(getHeaderCell(headers, row, "Final_Output")) : undefined;
            const sessionEstimate = hasSessionEstimateColumn ? parsePositiveInt(getHeaderCell(headers, row, "Session_Estimate_Min")) : undefined;
            const blockerStatus = hasBlockerStatusColumn ? parseBlockerStatus(getHeaderCell(headers, row, "Blocker_Status")) : undefined;
            const blockerCheck = hasBlockerCheckColumn ? cleanCell(getHeaderCell(headers, row, "Blocker_Check")) : undefined;
            const subtasks = hasSubtasksColumn ? parseSubtasksFromSheet(getHeaderCell(headers, row, "Subtasks")) : undefined;
            
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
                const newParentTodoId = parentTodoId || undefined;
                if (hasParentTodoIdColumn && match.meta.parentTodoId !== newParentTodoId) { match.meta.parentTodoId = newParentTodoId; updated = true; }
                const newDeepWorkParent = deepWorkRole === 'parent' || !!childTodoIds?.length || !!nextAction || !!finalOutput;
                if ((hasDeepWorkRoleColumn || hasChildIdsColumn || hasNextActionColumn || hasFinalOutputColumn) && !!match.meta.deepWorkParent !== newDeepWorkParent) { match.meta.deepWorkParent = newDeepWorkParent || undefined; updated = true; }
                if (hasChildIdsColumn && JSON.stringify(match.meta.childTodoIds || []) !== JSON.stringify(childTodoIds || [])) { match.meta.childTodoIds = childTodoIds; updated = true; }
                if (hasCompletionModeColumn && match.meta.deepWorkCompletionMode !== completionMode) { match.meta.deepWorkCompletionMode = completionMode; updated = true; }
                if (hasDeepWorkStatusColumn && match.meta.deepWorkStatus !== deepWorkStatus) { match.meta.deepWorkStatus = deepWorkStatus; updated = true; }
                if (hasNextActionColumn && match.meta.deepWorkNextAction !== nextAction) { match.meta.deepWorkNextAction = nextAction; updated = true; }
                if (hasFinalOutputColumn && match.meta.deepWorkFinalOutput !== finalOutput) { match.meta.deepWorkFinalOutput = finalOutput; updated = true; }
                if (hasSessionEstimateColumn && match.meta.deepWorkSessionEstimateMinutes !== sessionEstimate) { match.meta.deepWorkSessionEstimateMinutes = sessionEstimate; updated = true; }
                if (hasBlockerStatusColumn && match.meta.deepWorkBlockerStatus !== blockerStatus) { match.meta.deepWorkBlockerStatus = blockerStatus; updated = true; }
                if (hasBlockerCheckColumn && match.meta.deepWorkBlockerCheck !== blockerCheck) { match.meta.deepWorkBlockerCheck = blockerCheck; updated = true; }
                if (hasSubtasksColumn && JSON.stringify(match.meta.subtasks || []) !== JSON.stringify(subtasks || [])) { match.meta.subtasks = subtasks; updated = true; }
                const newStepIndex = !isNaN(stepOrder) ? stepOrder : undefined;
                if (hasStepOrderColumn && match.meta.deepWorkStepIndex !== newStepIndex) { match.meta.deepWorkStepIndex = newStepIndex; updated = true; }
                const newStepCount = !isNaN(stepCount) ? stepCount : undefined;
                if (hasStepCountColumn && match.meta.deepWorkStepCount !== newStepCount) { match.meta.deepWorkStepCount = newStepCount; updated = true; }
                if ((newDeepWorkParent || newParentTodoId) && !match.meta.deepWorkPlanId) { match.meta.deepWorkPlanId = newParentTodoId || match.id; updated = true; }
                const normalizedMeta = normalizeDeepWorkTodoMeta(match.meta);
                if (JSON.stringify(match.meta) !== JSON.stringify(normalizedMeta)) { match.meta = normalizedMeta; updated = true; }
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

                if (startDateStr) {
                    const parsedStart = new Date(startDateStr);
                    if (!isNaN(parsedStart.getTime())) {
                        const isoStart = parsedStart.toISOString();
                        if (match.meta.start !== isoStart) {
                            match.meta.start = isoStart;
                            updated = true;
                        }
                    }
                } else if (match.meta.start) {
                    match.meta.start = undefined;
                    updated = true;
                }

                if (endDateStr) {
                    const parsedEnd = new Date(endDateStr);
                    if (!isNaN(parsedEnd.getTime())) {
                        const isoEnd = parsedEnd.toISOString();
                        if (match.meta.end !== isoEnd) {
                            match.meta.end = isoEnd;
                            updated = true;
                        }
                    }
                } else if (match.meta.end) {
                    match.meta.end = undefined;
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

                let isoStart = undefined;
                if (startDateStr) {
                    const parsedStart = new Date(startDateStr);
                    if (!isNaN(parsedStart.getTime())) {
                        isoStart = parsedStart.toISOString();
                    }
                }

                let isoEnd = undefined;
                if (endDateStr) {
                    const parsedEnd = new Date(endDateStr);
                    if (!isNaN(parsedEnd.getTime())) {
                        isoEnd = parsedEnd.toISOString();
                    }
                }

                const newId = idStr || uuidv4();
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
                        date: isoDueDate,
                        start: isoStart,
                        end: isoEnd,
                        parentTodoId: parentTodoId || undefined,
                        childTodoIds,
                        deepWorkParent: deepWorkRole === 'parent' || !!childTodoIds?.length || !!nextAction || !!finalOutput || undefined,
                        deepWorkPlanId: deepWorkRole === 'parent' ? newId : (parentTodoId || undefined),
                        deepWorkCompletionMode: completionMode,
                        deepWorkStatus,
                        deepWorkNextAction: nextAction,
                        deepWorkFinalOutput: finalOutput,
                        deepWorkSessionEstimateMinutes: sessionEstimate,
                        deepWorkBlockerStatus: blockerStatus,
                        deepWorkBlockerCheck: blockerCheck,
                        deepWorkStepIndex: !isNaN(stepOrder) ? stepOrder : undefined,
                        deepWorkStepCount: !isNaN(stepCount) ? stepCount : undefined,
                        subtasks
                    }
                });
                seenItemIds.add(newId);
                hasChanges = true;
            }
        }

        const progressUpdatedItems = applyDeepWorkChildProgress(newItems);
        const completionUpdatedItems = applyDeepWorkCompletionSemantics(progressUpdatedItems);
        if (completionUpdatedItems !== newItems) {
            newItems.splice(0, newItems.length, ...completionUpdatedItems);
            hasChanges = true;
        }
    }

    // 3. Shopping
    const shopSheet = valueRanges.find(r => r.range && r.range.includes('Shopping'));
    if (shopSheet && shopSheet.values) {
        const headers = shopSheet.values[0] || [];
        const hasDueDate = headers.includes("Due_Date");
        const hasCompletedAt = headers.includes("Completed_At");
        const rows = shopSheet.values.slice(1);
        for (const row of rows) {
            let status, item, amountStr, category, quantity, dueDateStr, tagsStr, completedAtStr, idStr;
            
            if (hasDueDate && hasCompletedAt) {
                [status, item, amountStr, category, quantity, dueDateStr, tagsStr, completedAtStr, idStr] = row;
            } else if (hasDueDate) {
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

                if (completedAtStr) {
                    const parsedCompletedAt = new Date(completedAtStr);
                    if (!isNaN(parsedCompletedAt.getTime())) {
                        const isoCompletedAt = parsedCompletedAt.toISOString();
                        if (match.completed_at !== isoCompletedAt) {
                            match.completed_at = isoCompletedAt;
                            updated = true;
                        }
                    }
                } else if (status === 'pending' && match.completed_at) {
                    match.completed_at = undefined;
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

                let isoCompletedAt = undefined;
                if (completedAtStr) {
                    const parsedCompletedAt = new Date(completedAtStr);
                    if (!isNaN(parsedCompletedAt.getTime())) {
                        isoCompletedAt = parsedCompletedAt.toISOString();
                    }
                }

                const newId = uuidv4();
                newItems.push({
                    id: newId,
                    type: ItemType.SHOPPING,
                    content: item || 'Manual Item',
                    status: (status === 'done' ? 'done' : 'pending'),
                    created_at: new Date().toISOString(),
                    completed_at: isoCompletedAt,
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
        const headers = eventSheet.values[0] || [];
        const hasType = headers.includes("Type");
        const hasStartDate = headers.includes("Start_Date");
        const rows = eventSheet.values.slice(1);
        for (const row of rows) {
            let typeStr, date, startDateStr, endDateStr, priority, event, tagsStr, idStr;
            
            if (hasType && hasStartDate) {
                // New format: ["Type", "Date", "Start_Date", "End_Date", "Priority", "Event", "Tags", "ID"]
                [typeStr, date, startDateStr, endDateStr, priority, event, tagsStr, idStr] = row;
            } else {
                // Old format: ["Date", "Priority", "Event", "Tags", "ID"]
                [date, priority, event, tagsStr, idStr] = row;
            }
            
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

                if (startDateStr) {
                    const parsedStart = new Date(startDateStr);
                    if (!isNaN(parsedStart.getTime())) {
                        const isoStart = parsedStart.toISOString();
                        if (match.meta.start !== isoStart) {
                            match.meta.start = isoStart;
                            updated = true;
                        }
                    }
                } else if (match.meta.start) {
                    match.meta.start = undefined;
                    updated = true;
                }

                if (endDateStr) {
                    const parsedEnd = new Date(endDateStr);
                    if (!isNaN(parsedEnd.getTime())) {
                        const isoEnd = parsedEnd.toISOString();
                        if (match.meta.end !== isoEnd) {
                            match.meta.end = isoEnd;
                            updated = true;
                        }
                    }
                } else if (match.meta.end) {
                    match.meta.end = undefined;
                    updated = true;
                }
                
                if (updated) hasChanges = true;
            } else {
                const parsedDate = new Date(date);
                const isoDate = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
                
                let isoStart = undefined;
                if (startDateStr) {
                    const parsedStart = new Date(startDateStr);
                    if (!isNaN(parsedStart.getTime())) {
                        isoStart = parsedStart.toISOString();
                    }
                }

                let isoEnd = undefined;
                if (endDateStr) {
                    const parsedEnd = new Date(endDateStr);
                    if (!isNaN(parsedEnd.getTime())) {
                        isoEnd = parsedEnd.toISOString();
                    }
                }

                const newId = uuidv4();
                newItems.push({
                    id: newId,
                    type: ItemType.EVENT,
                    content: event || 'Manual Event',
                    status: 'pending',
                    created_at: new Date().toISOString(),
                    meta: {
                        date: isoDate,
                        start: isoStart,
                        end: isoEnd,
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
                const newType = parseNotesSheetItemType(type);
                if (match.type !== newType) { match.type = newType; updated = true; }

                if (newType === ItemType.JOURNAL) {
                    if (match.status !== 'done') { match.status = 'done'; updated = true; }
                    const journalCompletedAt = match.completed_at || match.meta.date || match.created_at;
                    if (match.completed_at !== journalCompletedAt) { match.completed_at = journalCompletedAt; updated = true; }
                }
                
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
                const itemType = parseNotesSheetItemType(type);
                const newId = idStr || uuidv4();
                newItems.push({
                    id: newId,
                    type: itemType,
                    content: content || 'Manual Note',
                    status: itemType === ItemType.JOURNAL ? 'done' : 'pending',
                    created_at: isoDate,
                    completed_at: itemType === ItemType.JOURNAL ? isoDate : undefined,
                    meta: {
                        date: itemType === ItemType.JOURNAL ? isoDate : undefined,
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
        // Completed saving goals remain in Shopping; only their achieved-goal transaction lives in Transactions.
        if (item.type === ItemType.FINANCE) sheetWasFetched = sheetsFetched.tx;
        else if (item.type === ItemType.SHOPPING) {
            if (item.status === 'done' && item.meta.shoppingCategory === 'saving') sheetWasFetched = sheetsFetched.shop;
            else if (item.status === 'done') sheetWasFetched = sheetsFetched.tx;
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
