import React, { useMemo, useState } from 'react';
import { BrainDumpItem, ItemType, AppSettings } from '../../types';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar as CalendarIcon, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CalendarViewProps {
    items: BrainDumpItem[];
    handleToggleStatus: (id: string) => void;
    handleDelete: (id: string, type: 'item' | 'wallet' | 'skill') => void;
    appSettings: AppSettings;
}

const isSameDay = (a: Date, b: Date) => (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
);

const getDayKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const CalendarView: React.FC<CalendarViewProps> = ({ items, handleToggleStatus, handleDelete, appSettings }) => {
    void handleDelete;
    void appSettings;

    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedItem, setSelectedItem] = useState<BrainDumpItem | null>(null);

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const jumpToToday = () => {
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDate(today);
    };

    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    const calendarDays: { date: Date; isCurrentMonth: boolean }[] = [];

    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        calendarDays.push({
            date: new Date(currentYear, currentMonth - 1, prevMonthDays - i),
            isCurrentMonth: false,
        });
    }

    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push({
            date: new Date(currentYear, currentMonth, i),
            isCurrentMonth: true,
        });
    }

    const remainingCells = 42 - calendarDays.length;
    for (let i = 1; i <= remainingCells; i++) {
        calendarDays.push({
            date: new Date(currentYear, currentMonth + 1, i),
            isCurrentMonth: false,
        });
    }

    const getItemsForDate = (date: Date) => {
        return items.filter(item => {
            if (item.type !== ItemType.TODO && item.type !== ItemType.EVENT && item.type !== ItemType.SHOPPING) {
                return false;
            }

            if (item.meta.hideFromCalendar) {
                return false;
            }

            if (item.type === ItemType.SHOPPING && item.meta.shoppingCategory !== 'urgent' && item.meta.shoppingCategory !== 'routine') {
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
                    return item.meta.routineMonthsOfYear.includes(date.getMonth())
                        && item.meta.routineDaysOfMonth.includes(date.getDate());
                }
                if (!interval) {
                    const itemDateStr = item.meta.start || item.meta.date || item.meta.dateTime;
                    if (itemDateStr) {
                        const itemDate = new Date(itemDateStr);
                        return isSameDay(itemDate, date);
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
                const endDate = endStr ? new Date(endStr) : new Date(startStr);
                endDate.setHours(23, 59, 59, 999);
                const compareDate = new Date(date);
                compareDate.setHours(12, 0, 0, 0);
                return compareDate >= startDate && compareDate <= endDate;
            }

            if (dateStr) {
                const itemDate = new Date(dateStr);
                return isSameDay(itemDate, date);
            }

            return false;
        });
    };

    const dayItemsMap = useMemo(() => {
        const map = new Map<string, BrainDumpItem[]>();
        calendarDays.forEach(day => {
            map.set(getDayKey(day.date), getItemsForDate(day.date));
        });
        return map;
    }, [items, currentDate]);

    const selectedDayItems = useMemo(() => {
        const list = dayItemsMap.get(getDayKey(selectedDate)) || [];
        return [...list].sort((a, b) => {
            const order = (item: BrainDumpItem) => {
                if (item.type === ItemType.EVENT) return 1;
                if (item.type === ItemType.TODO) return 2;
                if (item.type === ItemType.SHOPPING && item.meta.shoppingCategory === 'urgent') return 3;
                if (item.meta.isRoutine || item.meta.shoppingCategory === 'routine') return 4;
                return 5;
            };

            const orderDiff = order(a) - order(b);
            if (orderDiff !== 0) return orderDiff;

            const aTime = a.meta.dateTime || a.meta.start || a.meta.date || a.created_at;
            const bTime = b.meta.dateTime || b.meta.start || b.meta.date || b.created_at;
            return new Date(aTime).getTime() - new Date(bTime).getTime();
        });
    }, [dayItemsMap, selectedDate]);

    const monthItemsCount = useMemo(() => {
        return calendarDays.reduce((sum, day) => {
            if (!day.isCurrentMonth) return sum;
            return sum + ((dayItemsMap.get(getDayKey(day.date)) || []).length > 0 ? 1 : 0);
        }, 0);
    }, [calendarDays, dayItemsMap]);

    const upcomingWeekCount = useMemo(() => {
        const nowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const weekEnd = nowStart + (7 * 86400000);
        return items.filter(item => {
            if (item.type !== ItemType.TODO && item.type !== ItemType.EVENT && item.type !== ItemType.SHOPPING) return false;
            const rawDate = item.meta.start || item.meta.date || item.meta.dateTime;
            if (!rawDate) return false;
            const time = new Date(rawDate).getTime();
            return time >= nowStart && time < weekEnd;
        }).length;
    }, [items, today]);

    const getAgendaMeta = (item: BrainDumpItem) => {
        if (item.type === ItemType.EVENT) {
            const time = item.meta.start || item.meta.dateTime || item.meta.date;
            const label = time ? new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null;
            return label ? `Event • ${label}` : 'Event';
        }

        if (item.type === ItemType.SHOPPING) {
            return item.meta.shoppingCategory === 'routine' ? 'Shopping • routine' : 'Shopping • urgent';
        }

        if (item.meta.isRoutine) return 'Task • routine';

        if (item.meta.date) {
            const due = new Date(item.meta.date);
            const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
            if (dueStart < startToday) return 'Task • overdue';
        }

        return 'Task • due today';
    };

    const getItemDotClass = (item: BrainDumpItem) => {
        if (item.type === ItemType.EVENT) return 'bg-purple-500';
        if (item.type === ItemType.SHOPPING) return item.meta.shoppingCategory === 'urgent' ? 'bg-emerald-500' : 'bg-indigo-400';
        if (item.meta.isRoutine) return 'bg-indigo-400';
        return 'bg-blue-500';
    };

    return (
        <div className="min-h-[60vh] bg-background pb-24 pt-safe">
            <div className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 pb-4 backdrop-blur">
                <div className="flex items-start justify-between gap-3 pb-4 pt-4">
                    <div>
                        <p className="text-3xl font-bold tracking-tight text-primary">
                            {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="mt-2 text-sm text-muted">
                            {monthItemsCount} scheduled day{monthItemsCount === 1 ? '' : 's'} • {upcomingWeekCount} upcoming this week
                        </p>
                    </div>
                    <button
                        onClick={jumpToToday}
                        className="rounded-2xl bg-muted/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted/20"
                    >
                        Today
                    </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <button onClick={prevMonth} className="rounded-full p-2 text-muted transition-colors hover:bg-muted/10 hover:text-primary">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted">
                        <CalendarIcon className="h-4 w-4" /> Month view
                    </div>
                    <button onClick={nextMonth} className="rounded-full p-2 text-muted transition-colors hover:bg-muted/10 hover:text-primary">
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div className="space-y-5 px-4 pt-4">
                <section className="rounded-3xl border border-border/70 bg-surface p-3">
                    <div className="mb-2 grid grid-cols-7 gap-1">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((dayObj, idx) => {
                            const dayItems = dayItemsMap.get(getDayKey(dayObj.date)) || [];
                            const isTodayDate = isSameDay(dayObj.date, today);
                            const isSelected = isSameDay(dayObj.date, selectedDate);

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        setSelectedDate(dayObj.date);
                                        setCurrentDate(new Date(dayObj.date.getFullYear(), dayObj.date.getMonth(), 1));
                                    }}
                                    className={`min-h-[58px] rounded-2xl border px-2 py-2 text-left transition-colors ${
                                        isSelected
                                            ? 'border-indigo-500 bg-indigo-500/8'
                                            : dayObj.isCurrentMonth
                                                ? 'border-border/70 bg-background hover:bg-muted/10'
                                                : 'border-transparent bg-muted/5 text-muted/60'
                                    } ${isTodayDate ? 'ring-1 ring-indigo-500/50 ring-inset' : ''}`}
                                >
                                    <div className={`text-xs font-semibold ${isSelected ? 'text-indigo-500' : dayObj.isCurrentMonth ? 'text-primary' : 'text-muted/60'}`}>
                                        {dayObj.date.getDate()}
                                    </div>
                                    <div className="mt-2 flex items-center gap-1">
                                        {dayItems.slice(0, 2).map(item => (
                                            <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${getItemDotClass(item)}`} />
                                        ))}
                                        {dayItems.length > 2 && (
                                            <span className="rounded-full bg-muted/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                                +{dayItems.length - 2}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="rounded-3xl border border-border/70 bg-surface">
                    <div className="border-b border-border/70 px-4 py-4">
                        <h2 className="text-lg font-semibold text-primary">
                            {selectedDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long' })}
                        </h2>
                        <p className="mt-1 text-sm text-muted">
                            {selectedDayItems.length > 0
                                ? `${selectedDayItems.length} item${selectedDayItems.length === 1 ? '' : 's'}`
                                : 'Nothing scheduled'}
                        </p>
                    </div>

                    {selectedDayItems.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <p className="text-sm text-muted">Good day for planning or deep work.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/70">
                            {selectedDayItems.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedItem(item)}
                                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-medium ${item.status === 'done' ? 'text-muted line-through' : 'text-primary'}`}>
                                            {item.content}
                                        </p>
                                        <p className="mt-1 text-xs text-muted">{getAgendaMeta(item)}</p>
                                    </div>
                                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
                        onClick={() => setSelectedItem(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0, y: 24 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.96, opacity: 0, y: 24 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md overflow-hidden rounded-t-[32px] border border-border bg-surface sm:rounded-[32px]"
                        >
                            <div className="flex items-center justify-between border-b border-border px-5 py-4">
                                <h3 className="text-base font-semibold text-primary">Detail</h3>
                                <button onClick={() => setSelectedItem(null)} className="rounded-full p-1 text-muted transition-colors hover:bg-muted/10">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="space-y-4 px-5 py-5">
                                <div>
                                    <p className="text-lg font-semibold text-primary">{selectedItem.content}</p>
                                    <p className="mt-1 text-sm text-muted">{getAgendaMeta(selectedItem)}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Type</p>
                                        <p className="mt-1 capitalize text-primary">{selectedItem.type.toLowerCase()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Status</p>
                                        <div className="mt-1 flex items-center gap-2 text-primary">
                                            {selectedItem.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted" />}
                                            <span className="capitalize">{selectedItem.status}</span>
                                        </div>
                                    </div>
                                </div>

                                {(selectedItem.meta.date || selectedItem.meta.dateTime || selectedItem.meta.start) && (
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">When</p>
                                        <p className="mt-1 text-sm text-primary">
                                            {new Date(selectedItem.meta.start || selectedItem.meta.dateTime || selectedItem.meta.date || '').toLocaleString('id-ID', {
                                                day: 'numeric',
                                                month: 'long',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 border-t border-border pt-4">
                                    <button
                                        onClick={() => {
                                            handleToggleStatus(selectedItem.id);
                                            setSelectedItem({ ...selectedItem, status: selectedItem.status === 'done' ? 'pending' : 'done' });
                                        }}
                                        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                                            selectedItem.status === 'done'
                                                ? 'bg-muted/10 text-primary hover:bg-muted/20'
                                                : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                        }`}
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
