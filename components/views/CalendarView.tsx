import React, { useMemo, useState } from 'react';
import { BrainDumpItem, ItemType, AppSettings, Tab } from '../../types';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar as CalendarIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { contentSurface, responsiveModal } from '../layout/contentSurface';
import { getShoppingDueDate } from '../../utils/shoppingDateUtils';

interface CalendarViewProps {
    items: BrainDumpItem[];
    handleToggleStatus: (id: string) => void;
    handleDelete: (id: string, type: 'item' | 'wallet' | 'skill') => void;
    appSettings: AppSettings;
    setActiveTab: (tab: Tab) => void;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isSameDay = (left: Date, right: Date) => (
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear()
);

const getItemTypeLabel = (type: ItemType) => {
    switch (type) {
        case ItemType.TODO:
            return 'TASK';
        case ItemType.EVENT:
            return 'EVENT';
        case ItemType.SHOPPING:
            return 'SHOP';
        default:
            return 'ITEM';
    }
};

const CalendarView: React.FC<CalendarViewProps> = ({ items, handleToggleStatus, handleDelete, appSettings, setActiveTab }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedItem, setSelectedItem] = useState<BrainDumpItem | null>(null);
    const swipeHandlers = useSwipeTabs('calendar', setActiveTab);

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const goToToday = () => {
        const now = new Date();
        setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    };

    const today = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    const getItemsForDate = (date: Date): BrainDumpItem[] => {
        return items.flatMap<BrainDumpItem>((item) => {
            if (item.type !== ItemType.TODO && item.type !== ItemType.EVENT && item.type !== ItemType.SHOPPING) {
                return [];
            }

            if (item.meta.hideFromCalendar) {
                return [];
            }

            if (item.meta.isRoutine || item.meta.shoppingCategory === 'routine') {
                const anchorStr = item.meta.start || (item.type === ItemType.SHOPPING ? getShoppingDueDate(item) : (item.meta.date || item.meta.dateTime)) || item.created_at;
                const anchorDate = anchorStr ? new Date(anchorStr) : new Date(item.created_at);
                anchorDate.setHours(0, 0, 0, 0);

                const compareDate = new Date(date);
                compareDate.setHours(12, 0, 0, 0);

                const interval = item.meta.routineInterval;
                let occursOnDate = false;

                if (interval === 'daily') occursOnDate = compareDate >= anchorDate;
                else if (interval === 'weekly' && item.meta.routineDaysOfWeek) {
                    occursOnDate = compareDate >= anchorDate && item.meta.routineDaysOfWeek.includes(compareDate.getDay());
                } else if (interval === 'monthly' && item.meta.routineDaysOfMonth) {
                    occursOnDate = compareDate >= anchorDate && item.meta.routineDaysOfMonth.includes(compareDate.getDate());
                } else if (interval === 'yearly' && item.meta.routineMonthsOfYear && item.meta.routineDaysOfMonth) {
                    occursOnDate = compareDate >= anchorDate &&
                        item.meta.routineMonthsOfYear.includes(compareDate.getMonth()) &&
                        item.meta.routineDaysOfMonth.includes(compareDate.getDate());
                } else if (!interval && item.meta.recurrenceDays) {
                    const diffDays = Math.floor((compareDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
                    occursOnDate = diffDays >= 0 && diffDays % item.meta.recurrenceDays === 0;
                } else if (!interval) {
                    occursOnDate = isSameDay(anchorDate, compareDate);
                }

                if (!occursOnDate) return [];

                const completedDate = item.completed_at ? new Date(item.completed_at) : null;
                if (completedDate) completedDate.setHours(0, 0, 0, 0);

                const occurrenceStatus: BrainDumpItem['status'] = completedDate && isSameDay(completedDate, compareDate)
                    ? 'done'
                    : 'pending';

                return [{
                    ...item,
                    status: occurrenceStatus,
                    completed_at: occurrenceStatus === 'done' ? item.completed_at : undefined,
                    meta: {
                        ...item.meta,
                        date: compareDate.toISOString()
                    }
                }];
            }

            const startStr = item.meta.start;
            const endStr = item.meta.end;
            const dateStr = item.type === ItemType.SHOPPING ? getShoppingDueDate(item) : (item.meta.date || item.meta.dateTime);

            if (startStr) {
                const startDate = new Date(startStr);
                startDate.setHours(0, 0, 0, 0);

                let endDate = new Date(startStr);
                if (endStr) {
                    endDate = new Date(endStr);
                }
                endDate.setHours(23, 59, 59, 999);

                const compareDate = new Date(date);
                compareDate.setHours(12, 0, 0, 0);

                return compareDate >= startDate && compareDate <= endDate ? [item] : [];
            }

            if (dateStr) {
                const itemDate = new Date(dateStr);
                return isSameDay(itemDate, date) ? [item] : [];
            }

            return [];
        });
    };

    const calendarDays = useMemo(() => {
        const days: { date: Date; isCurrentMonth: boolean; items: BrainDumpItem[] }[] = [];

        const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - 1, prevMonthDays - i);
            days.push({
                date,
                isCurrentMonth: false,
                items: getItemsForDate(date),
            });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(currentYear, currentMonth, i);
            days.push({
                date,
                isCurrentMonth: true,
                items: getItemsForDate(date),
            });
        }

        const remainingCells = 42 - days.length;
        for (let i = 1; i <= remainingCells; i++) {
            const date = new Date(currentYear, currentMonth + 1, i);
            days.push({
                date,
                isCurrentMonth: false,
                items: getItemsForDate(date),
            });
        }

        return days;
    }, [currentMonth, currentYear, daysInMonth, firstDayOfMonth, items]);

    const currentMonthCells = calendarDays.filter(day => day.isCurrentMonth);
    const scheduledCount = currentMonthCells.reduce((sum, day) => sum + day.items.length, 0);
    const doneCount = currentMonthCells.reduce((sum, day) => sum + day.items.filter(item => item.status === 'done').length, 0);
    const routineCount = currentMonthCells.reduce((sum, day) => sum + day.items.filter(item => item.meta.isRoutine || item.meta.shoppingCategory === 'routine').length, 0);
    const busiestDay = currentMonthCells.reduce<{ date: Date | null; count: number }>((best, day) => {
        if (day.items.length > best.count) {
            return { date: day.date, count: day.items.length };
        }
        return best;
    }, { date: null, count: 0 });

    const selectedItemDate = selectedItem?.meta.start || selectedItem?.meta.date || selectedItem?.meta.dateTime;

    return (
        <div className="min-h-screen bg-background pt-safe pb-36 lg:pb-32">
            <motion.div
                layoutId="top-container"
                data-swipe-tabs="calendar"
                className={contentSurface.headerHero}
                transition={{ type: 'tween', duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                onTouchStart={swipeHandlers.onTouchStart}
                onTouchMove={swipeHandlers.onTouchMove}
                onTouchEnd={swipeHandlers.onTouchEnd}
                style={{ x: swipeHandlers.dragOffset }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 text-primary dark:bg-white/10">
                            <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">Timeline</div>
                            <h1 className="text-xl font-semibold text-primary">Calendar</h1>
                            <p className="text-xs text-muted">Swipe header to move between app tabs</p>
                        </div>
                    </div>
                    <button
                        onClick={goToToday}
                        className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
                    >
                        Today
                    </button>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <button onClick={prevMonth} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 text-primary transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="rounded-2xl bg-black/5 px-4 py-2 text-center min-w-[168px] dark:bg-white/10">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Month</div>
                        <div className="text-sm font-semibold text-primary">
                            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                    <button onClick={nextMonth} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 text-primary transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15">
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/10">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Scheduled</div>
                        <div className="mt-1 text-lg font-semibold text-primary">{scheduledCount}</div>
                    </div>
                    <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/10">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Done</div>
                        <div className="mt-1 text-lg font-semibold text-primary">{doneCount}</div>
                    </div>
                    <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/10">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Routine</div>
                        <div className="mt-1 text-lg font-semibold text-primary">{routineCount}</div>
                    </div>
                    <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/10">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Busiest</div>
                        <div className="mt-1 text-sm font-semibold text-primary">
                            {busiestDay.date ? `${busiestDay.date.getDate()} (${busiestDay.count})` : '—'}
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className={`${contentSurface.contentPad} pb-2 pt-3`} data-ndz-calendar-width-policy="validated-standard-cap">
                <div className={contentSurface.calendarFrame}>
                    <div className="grid grid-cols-7 border-b border-border bg-background/40">
                        {WEEK_DAYS.map(day => (
                            <div key={day} className="py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                                {day.slice(0, 1)}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 auto-rows-[minmax(132px,auto)] sm:auto-rows-[minmax(148px,auto)] lg:auto-rows-[minmax(168px,auto)]">
                        {calendarDays.map((dayObj, idx) => {
                            const isToday = dayObj.date.getDate() === today.getDate() &&
                                dayObj.date.getMonth() === today.getMonth() &&
                                dayObj.date.getFullYear() === today.getFullYear();

                            const visibleItems = dayObj.items.slice(0, 4);
                            const hiddenCount = Math.max(0, dayObj.items.length - visibleItems.length);

                            return (
                                <div
                                    key={`${getDateKey(dayObj.date)}-${idx}`}
                                    className={[
                                        'min-w-0 border-r border-b border-border/80 px-1 py-1.5 lg:px-2 lg:py-2 flex flex-col gap-1 overflow-hidden transition-colors last:border-r-0',
                                        idx % 7 === 6 ? 'border-r-0' : '',
                                        dayObj.isCurrentMonth
                                            ? 'bg-surface/70'
                                            : 'bg-background/30 text-muted/50',
                                        isToday ? 'bg-indigo-500/5' : '',
                                    ].join(' ')}
                                >
                                    <div className="flex items-center justify-between min-w-0">
                                        <div className={[
                                            'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none',
                                            isToday ? 'bg-primary text-background' : dayObj.isCurrentMonth ? 'text-primary' : 'text-muted/50',
                                        ].join(' ')}>
                                            {dayObj.date.getDate()}
                                        </div>
                                        {hiddenCount > 0 && (
                                            <div className="text-[9px] font-semibold text-muted">
                                                +{hiddenCount}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-1 overflow-hidden">
                                        {visibleItems.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => setSelectedItem(item)}
                                                className={[
                                                    'block w-full min-w-0 rounded-md px-1.5 py-1 lg:px-2 text-left text-[9px] lg:text-[10px] leading-[1.15] transition-colors',
                                                    item.status === 'done'
                                                        ? 'bg-muted/10 text-muted line-through opacity-70'
                                                        : item.type === ItemType.EVENT
                                                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25'
                                                            : item.type === ItemType.SHOPPING
                                                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
                                                                : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/25',
                                                ].join(' ')}
                                                title={`${getItemTypeLabel(item.type)} · ${item.content}`}
                                            >
                                                <span className="line-clamp-2 break-words font-medium">
                                                    {item.content}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`${responsiveModal.overlay} z-50 flex items-center justify-center p-4`}
                        onClick={() => setSelectedItem(null)}
                    >
                        <motion.div
                            initial={{ y: 12, opacity: 0, scale: 0.98 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 12, opacity: 0, scale: 0.98 }}
                            onClick={e => e.stopPropagation()}
                            className={`${responsiveModal.panel} w-full max-w-md lg:max-w-xl overflow-hidden rounded-[28px] border bg-surface`}
                        >
                            <div className="flex items-center justify-between border-b border-border px-4 py-4">
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Item Detail</div>
                                    <div className="mt-1 text-base font-semibold text-primary">{selectedItem.content}</div>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="rounded-full border border-border p-2 text-muted transition-colors hover:bg-muted/10 hover:text-primary">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-4 p-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-border p-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Type</div>
                                        <div className="mt-1 text-sm font-semibold text-primary">{getItemTypeLabel(selectedItem.type)}</div>
                                    </div>
                                    <div className="rounded-2xl border border-border p-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Status</div>
                                        <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-primary">
                                            {selectedItem.status === 'done' ? (
                                                <CheckCircle2 className="h-4 w-4" />
                                            ) : (
                                                <Circle className="h-4 w-4" />
                                            )}
                                            {selectedItem.status}
                                        </div>
                                    </div>
                                </div>

                                {selectedItemDate && (
                                    <div className="rounded-2xl border border-border p-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Schedule</div>
                                        <div className="mt-1 text-sm text-primary">
                                            {new Date(selectedItemDate).toLocaleDateString()}
                                        </div>
                                        {selectedItem.meta.end && (
                                            <div className="text-xs text-muted">
                                                until {new Date(selectedItem.meta.end).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedItem.meta.tags && selectedItem.meta.tags.length > 0 && (
                                    <div className="rounded-2xl border border-border p-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Tags</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {selectedItem.meta.tags.map(tag => (
                                                <span key={tag} className="rounded-full border border-border px-2 py-1 text-xs text-primary">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 border-t border-border pt-4">
                                    <button
                                        onClick={() => {
                                            handleToggleStatus(selectedItem.id);
                                            setSelectedItem({ ...selectedItem, status: selectedItem.status === 'done' ? 'pending' : 'done' });
                                        }}
                                        className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/10"
                                    >
                                        {selectedItem.status === 'done' ? 'Mark Pending' : 'Mark Done'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CalendarView;
