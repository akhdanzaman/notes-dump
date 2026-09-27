import { BrainDumpItem, ItemType } from '../types';
import { calculateNextDueDate, calculateFirstDueDate, advanceRoutineDueDateToTodayOrFuture, advanceRecurringDueDateByDaysToTodayOrFuture, isBeforeLocalDay, isSameLocalDay } from './selectors';
import { supportsNestedTodoSubtasks } from './deepWorkTodoModel';

export const isRoutineItem = (item?: BrainDumpItem | null): item is BrainDumpItem => {
    if (!item) return false;
    const isShoppingRoutine = item.type === ItemType.SHOPPING && item.meta.shoppingCategory === 'routine';
    const isTodoRoutine = item.type === ItemType.TODO && !!item.meta.isRoutine;
    const isSkillRoutine = item.type === ItemType.SKILLS && !!item.meta.isRoutine;
    return isShoppingRoutine || isTodoRoutine || isSkillRoutine;
};

const getValidRoutineDate = (rawDate?: string, fallback: Date = new Date()): Date => {
    const parsed = rawDate ? new Date(rawDate) : new Date(fallback);
    return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
};

const getRoutineManualNextDueDate = (item: BrainDumpItem, now = new Date()): Date | null => {
    const rawDate = item.meta.routineManualNextDueDate;
    if (!rawDate) return null;

    const manualNextDueDate = new Date(rawDate);
    if (Number.isNaN(manualNextDueDate.getTime())) return null;

    return advanceRoutineDateToTodayOrFuture(item, manualNextDueDate, now);
};

const getRoutineTodayActivationDate = (item: BrainDumpItem, now = new Date(), timeSource?: Date | null): Date => {
    const fallbackDate = getValidRoutineDate(item.meta.date, now);
    const source = timeSource && !Number.isNaN(timeSource.getTime()) ? timeSource : fallbackDate;
    const activationDate = new Date(now);
    activationDate.setHours(
        source.getHours(),
        source.getMinutes(),
        source.getSeconds(),
        source.getMilliseconds()
    );
    return activationDate;
};

const advanceRoutineDateToTodayOrFuture = (item: BrainDumpItem, dueDate: Date, now = new Date()): Date => {
    const isShoppingRoutine = item.type === ItemType.SHOPPING && item.meta.shoppingCategory === 'routine';

    if (isShoppingRoutine && !item.meta.routineInterval) {
        return advanceRecurringDueDateByDaysToTodayOrFuture(
            dueDate,
            Math.max(Number(item.meta.recurrenceDays || 7), 1),
            now
        );
    }

    return advanceRoutineDueDateToTodayOrFuture(
        dueDate,
        item.meta.routineInterval || 'daily',
        item.meta.routineDaysOfWeek,
        item.meta.routineDaysOfMonth,
        item.meta.routineMonthsOfYear,
        now
    );
};

export const getRoutineCurrentDueDate = (item: BrainDumpItem, now = new Date()): Date | null => {
    if (!isRoutineItem(item)) return null;
    const scheduledDate = getValidRoutineDate(item.meta.date, now);
    const manualNextDueDate = getRoutineManualNextDueDate(item, now);

    if (item.status === 'pending' && manualNextDueDate && isBeforeLocalDay(scheduledDate, now)) {
        return manualNextDueDate;
    }

    return advanceRoutineDateToTodayOrFuture(item, scheduledDate, now);
};

const getRoutineNextDueDate = (item: BrainDumpItem, now = new Date()): Date | null => {
    if (!isRoutineItem(item)) return null;

    const completedDate = getValidRoutineDate(item.completed_at, now);
    const scheduledDate = getValidRoutineDate(item.meta.date, completedDate);
    const hasValidCompletedDate = !!item.completed_at && !Number.isNaN(new Date(item.completed_at).getTime());
    const hasValidScheduledDate = !!item.meta.date && !Number.isNaN(new Date(item.meta.date).getTime());
    const manualNextDueDate = getRoutineManualNextDueDate(item, now);

    if (
        item.status === 'done' &&
        hasValidCompletedDate &&
        manualNextDueDate &&
        manualNextDueDate.getTime() > completedDate.getTime() &&
        !isSameLocalDay(manualNextDueDate, completedDate)
    ) {
        return manualNextDueDate;
    }

    if (item.status === 'done' && hasValidCompletedDate && hasValidScheduledDate && scheduledDate.getTime() > completedDate.getTime()) {
        return advanceRoutineDateToTodayOrFuture(item, scheduledDate, now);
    }

    const anchorDate = hasValidScheduledDate ? scheduledDate : completedDate;
    let nextDueDate: Date;

    if (item.type === ItemType.SHOPPING && item.meta.shoppingCategory === 'routine' && !item.meta.routineInterval) {
        const recurrenceDays = Math.max(Number(item.meta.recurrenceDays || 7), 1);
        nextDueDate = new Date(anchorDate.getTime() + (recurrenceDays * 24 * 60 * 60 * 1000));
    } else {
        nextDueDate = calculateNextDueDate(
            anchorDate,
            item.meta.routineInterval || 'daily',
            item.meta.routineDaysOfWeek,
            item.meta.routineDaysOfMonth,
            item.meta.routineMonthsOfYear
        );
    }

    return advanceRoutineDateToTodayOrFuture(item, nextDueDate, now);
};

export const isRoutineScheduledToday = (item: BrainDumpItem, now = new Date()): boolean => {
    if (!isRoutineItem(item)) return false;
    const currentDueDate = getRoutineCurrentDueDate(item, now);
    if (currentDueDate && isSameLocalDay(currentDueDate, now)) return true;

    const nextDueDate = getRoutineNextDueDate(item, now);
    return !!nextDueDate && isSameLocalDay(nextDueDate, now);
};

export const isRoutineLockedUntilNextDue = (item: BrainDumpItem, now = new Date()): boolean => {
    if (!isRoutineItem(item) || item.status !== 'done') return false;
    return !isRoutineScheduledToday(item, now);
};

export const calculateFirstRoutineDueDate = (
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly' | undefined,
    daysOfWeek?: number[],
    daysOfMonth?: number[],
    monthsOfYear?: number[],
    recurrenceDays?: number,
    previousDate?: string
): Date => {
    const baseDate = new Date();
    const previous = previousDate ? new Date(previousDate) : null;
    if (previous && !Number.isNaN(previous.getTime())) {
        baseDate.setHours(previous.getHours(), previous.getMinutes(), previous.getSeconds(), previous.getMilliseconds());
    } else {
        baseDate.setHours(9, 0, 0, 0);
    }

    if (!interval) {
        const days = Math.max(Number(recurrenceDays || 1), 1);
        return new Date(baseDate.getTime() + (days * 24 * 60 * 60 * 1000));
    }

    return calculateFirstDueDate(baseDate, interval, daysOfWeek, daysOfMonth, monthsOfYear);
};

export const getRoutineDurationMinutes = (item: BrainDumpItem): number => {
    if (Number(item.meta.durationMinutes) > 0) return Number(item.meta.durationMinutes);

    const startRaw = item.meta.start || item.meta.date;
    const endRaw = item.meta.end;
    if (!startRaw || !endRaw) return 0;

    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

    return Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0);
};

export const getRoutineEndForNextStart = (item: BrainDumpItem, nextStart: Date): string | undefined => {
    const durationMinutes = getRoutineDurationMinutes(item);
    if (!durationMinutes) return item.meta.end;
    return new Date(nextStart.getTime() + durationMinutes * 60000).toISOString();
};

export const resetRoutineItemForToday = (currentItems: BrainDumpItem[], id: string, now = new Date()): BrainDumpItem[] => {
    const item = currentItems.find(candidate => candidate.id === id);
    if (!item || !isRoutineItem(item)) return currentItems;

    const currentDueDate = getRoutineCurrentDueDate(item, now);
    const nextDueDate = getRoutineNextDueDate(item, now);
    const isScheduledToday = !!currentDueDate && isSameLocalDay(currentDueDate, now);
    const manualNextDueDate = !isScheduledToday ? (currentDueDate || nextDueDate) : null;
    const resetDueDate = isScheduledToday && currentDueDate
        ? currentDueDate
        : getRoutineTodayActivationDate(item, now, currentDueDate || nextDueDate);

    if (!resetDueDate) return currentItems;

    const childIdsToReset = new Set<string>();
    if (supportsNestedTodoSubtasks(item)) {
        (item.meta.childTodoIds || []).forEach(childId => childIdsToReset.add(childId));
        currentItems.forEach(candidate => {
            if (candidate.meta.parentTodoId === item.id) childIdsToReset.add(candidate.id);
        });
    }

    return currentItems.map(candidate => {
        if (candidate.id === id) {
            return {
                ...item,
                status: 'pending' as const,
                completed_at: undefined,
                meta: {
                    ...item.meta,
                    date: resetDueDate.toISOString(),
                    start: item.meta.start ? resetDueDate.toISOString() : item.meta.start,
                    end: getRoutineEndForNextStart(item, resetDueDate),
                    progress: 0,
                    progressNotes: undefined,
                    lastGeneratedHistoryId: undefined,
                    routineManualNextDueDate: manualNextDueDate && !isSameLocalDay(manualNextDueDate, resetDueDate)
                        ? manualNextDueDate.toISOString()
                        : undefined,
                },
            };
        }

        if (!childIdsToReset.has(candidate.id)) return candidate;
        return {
            ...candidate,
            status: 'pending' as const,
            completed_at: undefined,
            meta: {
                ...candidate.meta,
                progress: 0,
                progressNotes: undefined,
            }
        };
    });
};

export const resetDueRoutineItems = (currentItems: BrainDumpItem[], now = new Date()): BrainDumpItem[] => {
    const childIdsByParentId = new Map<string, Set<string>>();
    currentItems.forEach(item => {
        if (item.meta.parentTodoId) {
            const ids = childIdsByParentId.get(item.meta.parentTodoId) || new Set<string>();
            ids.add(item.id);
            childIdsByParentId.set(item.meta.parentTodoId, ids);
        }
    });

    const childIdsToReset = new Set<string>();
    const nextItems = currentItems.map(item => {
        if (!isRoutineItem(item)) return item;

        if (item.status === 'pending') {
            const currentDueDate = getRoutineCurrentDueDate(item, now);
            const storedDueDate = item.meta.date ? new Date(item.meta.date) : null;
            const shouldMoveStaleSchedule = currentDueDate && (
                !storedDueDate ||
                Number.isNaN(storedDueDate.getTime()) ||
                (isBeforeLocalDay(storedDueDate, now) && currentDueDate.getTime() !== storedDueDate.getTime())
            );

            if (shouldMoveStaleSchedule) {
                return {
                    ...item,
                    meta: {
                        ...item.meta,
                        date: currentDueDate.toISOString(),
                        start: item.meta.start ? currentDueDate.toISOString() : item.meta.start,
                        end: getRoutineEndForNextStart(item, currentDueDate),
                        routineManualNextDueDate: undefined,
                    }
                };
            }

            return item;
        }

        if (item.status === 'done' && item.completed_at) {
            const nextDueDate = getRoutineNextDueDate(item, now);
            if (nextDueDate && isSameLocalDay(nextDueDate, now)) {
                if (supportsNestedTodoSubtasks(item)) {
                    (item.meta.childTodoIds || []).forEach(childId => childIdsToReset.add(childId));
                    (childIdsByParentId.get(item.id) || new Set<string>()).forEach(childId => childIdsToReset.add(childId));
                }

                return {
                    ...item,
                    status: 'pending' as const,
                    completed_at: undefined,
                    meta: {
                        ...item.meta,
                        date: nextDueDate.toISOString(),
                        start: item.meta.start ? nextDueDate.toISOString() : item.meta.start,
                        end: getRoutineEndForNextStart(item, nextDueDate),
                        progress: 0,
                        progressNotes: undefined,
                        lastGeneratedHistoryId: undefined,
                        routineManualNextDueDate: undefined,
                    }
                };
            }
        }

        return item;
    });
    if (childIdsToReset.size === 0) return nextItems;

    return nextItems.map(item => {
        if (!childIdsToReset.has(item.id)) return item;
        return {
            ...item,
            status: 'pending' as const,
            completed_at: undefined,
            meta: {
                ...item.meta,
                progress: 0,
                progressNotes: undefined,
            }
        };
    });
};
