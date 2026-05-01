import React, { useMemo, useState } from 'react';
import { BrainDumpItem, ItemType, AppSettings } from '../../types';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar as CalendarIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CalendarViewProps {
    items: BrainDumpItem[];
    handleToggleStatus: (id: string) => void;
    handleDelete: (id: string, type: 'item' | 'wallet' | 'skill') => void;
    appSettings: AppSettings;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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

const CalendarView: React.FC<CalendarViewProps> = ({ items, handleToggleStatus, handleDelete, appSettings }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedItem, setSelectedItem] = useState<BrainDumpItem | null>(null);

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

    const getItemsForDate = (date: Date) => {
        return items.filter(item => {
            if (item.type !== ItemType.TODO && item.type !== ItemType.EVENT && item.type !== ItemType.SHOPPING) {
                return false;
            }

            if (item.meta.hideFromCalendar) {
                return false;
            }

            if (item.meta.isRoutine || item.meta.shoppingCategory === 'routine') {
                const interval = item.meta.routineInterval;
                if (interval === 'daily') return true;
                if (interval === 'weekly' && item.meta.routineDaysOfWeek) {
                    return item.meta.routineDaysOfWeek.includes(date.getDay());
                }
                if (interval === 'monthly' && item.meta.routineDaysOfMonth) {
                    return item.meta.routineDaysOfMonth.includes(date.getDate());
                }
                if (interval === 'yearly' && item.meta.routineMonthsOfYear && item.meta.routineDaysOfMonth) {
                    return item.meta.routineMonthsOfYear.includes(date.getMonth()) &&
                           item.meta.routineDaysOfMonth.includes(date.getDate());
                }
                if (!interval) {
                    const itemDateStr = item.meta.start || item.meta.date || item.meta.dateTime;
                    if (itemDateStr) {
                        const itemDate = new Date(itemDateStr);
                        return itemDate.getDate() === date.getDate() &&
                               itemDate.getMonth() === date.getMonth() &&
                               itemDate.getFullYear() === date.getFullYear();
                    }
                }
                return false;
            }

            const startStr = item.meta.start;
            const endStr = item.meta.end;
            const dateStr = item.meta.date || item.meta.dateTime;

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

                return compareDate >= startDate && compareDate <= endDate;
            }

            if (dateStr) {
                const itemDate = new Date(dateStr);
                return itemDate.getDate() === date.getDate() &&
                       itemDate.getMonth() === date.getMonth() &&
                       itemDate.getFullYear() === date.getFullYear();
            }

            return false;
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
        <div className="flex flex-col h-full bg-background pt-safe">
            <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xl">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface text-primary">
                            <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-primary">Calendar Wireframe</h1>
                            <p className="text-xs text-muted">Month layout only, low-fidelity view</p>
                        </div>
                    </div>
                    <button
                        onClick={goToToday}
                        className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted/10"
                    >
                        Today
                    </button>
                </div>

                <div className="flex items-center justify-between px-4 pb-3">
                    <button onClick={prevMonth} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface text-primary transition-colors hover:bg-muted/10">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="rounded-2xl border border-border bg-surface px-4 py-2 text-center min-w-[168px]">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Month</div>
                        <div className="text-sm font-semibold text-primary">
                            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                    <button onClick={nextMonth} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface text-primary transition-colors hover:bg-muted/10">
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4">
                    <div className="rounded-2xl border border-border bg-surface p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Scheduled</div>
                        <div className="mt-1 text-lg font-semibold text-primary">{scheduledCount}</div>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Done</div>
                        <div className="mt-1 text-lg font-semibold text-primary">{doneCount}</div>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Routine</div>
                        <div className="mt-1 text-lg font-semibold text-primary">{routineCount}</div>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Busiest</div>
                        <div className="mt-1 text-sm font-semibold text-primary">
                            {busiestDay.date ? `${busiestDay.date.getDate()} (${busiestDay.count})` : '—'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden px-2 pb-2">
                <div className="flex h-full flex-col rounded-[28px] border border-border bg-surface/50 p-2">
                    <div className="grid grid-cols-7 gap-2 px-1 pb-2 pt-1">
                        {WEEK_DAYS.map(day => (
                            <div key={day} className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-2 min-h-0">
                        {calendarDays.map((dayObj, idx) => {
                            const isToday = dayObj.date.getDate() === today.getDate() &&
                                dayObj.date.getMonth() === today.getMonth() &&
                                dayObj.date.getFullYear() === today.getFullYear();

                            const visibleItems = dayObj.items.slice(0, 3);
                            const hiddenCount = Math.max(0, dayObj.items.length - visibleItems.length);

                            return (
                                <div
                                    key={`${getDateKey(dayObj.date)}-${idx}`}
                                    className={[
                                        'min-h-0 rounded-2xl border p-2 flex flex-col gap-2 overflow-hidden transition-colors',
                                        dayObj.isCurrentMonth
                                            ? 'border-border bg-surface'
                                            : 'border-dashed border-border/80 bg-background/30 opacity-60',
                                        isToday ? 'border-primary' : '',
                                    ].join(' ')}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className={[
                                            'flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold',
                                            isToday ? 'border-primary text-primary' : 'border-border text-muted',
                                        ].join(' ')}>
                                            {dayObj.date.getDate()}
                                        </div>
                                        {dayObj.items.length > 0 && (
                                            <div className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                                                {dayObj.items.length}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
                                        {visibleItems.length === 0 ? (
                                            <div className="space-y-1 pt-1 opacity-50">
                                                <div className="h-2.5 rounded-full border border-dashed border-border/70" />
                                                <div className="h-2.5 w-4/5 rounded-full border border-dashed border-border/70" />
                                            </div>
                                        ) : (
                                            visibleItems.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setSelectedItem(item)}
                                                    className={[
                                                        'w-full rounded-xl border px-2 py-1 text-left text-[10px] leading-tight transition-colors',
                                                        item.status === 'done'
                                                            ? 'border-border text-muted line-through opacity-70'
                                                            : 'border-border text-primary hover:bg-muted/5',
                                                    ].join(' ')}
                                                    title={item.content}
                                                >
                                                    <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">
                                                        {getItemTypeLabel(item.type)}
                                                    </div>
                                                    <div className="line-clamp-2">{item.content}</div>
                                                </button>
                                            ))
                                        )}

                                        {hiddenCount > 0 && (
                                            <div className="rounded-xl border border-dashed border-border px-2 py-1 text-[10px] text-muted">
                                                +{hiddenCount} more
                                            </div>
                                        )}
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
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                        onClick={() => setSelectedItem(null)}
                    >
                        <motion.div
                            initial={{ y: 12, opacity: 0, scale: 0.98 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 12, opacity: 0, scale: 0.98 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md overflow-hidden rounded-[28px] border border-border bg-surface shadow-xl"
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
