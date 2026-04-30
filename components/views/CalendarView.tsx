import React, { useState, useMemo } from 'react';
import { BrainDumpItem, ItemType, AppSettings } from '../../types';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar as CalendarIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CalendarViewProps {
    items: BrainDumpItem[];
    handleToggleStatus: (id: string) => void;
    handleDelete: (id: string) => void;
    appSettings: AppSettings;
}

const CalendarView: React.FC<CalendarViewProps> = ({ items, handleToggleStatus, handleDelete, appSettings }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedItem, setSelectedItem] = useState<BrainDumpItem | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const nextMonth = () => {
        const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        setCurrentDate(next);
        setSelectedDate(next);
    };

    const prevMonth = () => {
        const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        setCurrentDate(prev);
        setSelectedDate(prev);
    };

    const today = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    // Prepare calendar grid
    const calendarDays: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // Previous month padding
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        calendarDays.push({
            date: new Date(currentYear, currentMonth - 1, prevMonthDays - i),
            isCurrentMonth: false
        });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push({
            date: new Date(currentYear, currentMonth, i),
            isCurrentMonth: true
        });
    }

    // Next month padding
    const remainingCells = 42 - calendarDays.length; // 6 rows of 7 days
    for (let i = 1; i <= remainingCells; i++) {
        calendarDays.push({
            date: new Date(currentYear, currentMonth + 1, i),
            isCurrentMonth: false
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

            // Handle routine items
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
                // Fallback for routine items without specific interval details
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

            // Handle regular items with specific dates (Priority: start-end > due date)
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
            } else if (dateStr) {
                const itemDate = new Date(dateStr);
                return itemDate.getDate() === date.getDate() &&
                       itemDate.getMonth() === date.getMonth() &&
                       itemDate.getFullYear() === date.getFullYear();
            }

            return false;
        });
    };

    const getItemColor = (type: ItemType) => {
        switch (type) {
            case ItemType.TODO: return 'bg-blue-500 text-white';
            case ItemType.EVENT: return 'bg-purple-500 text-white';
            case ItemType.SHOPPING: return 'bg-emerald-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const selectedDateItems = useMemo(() => {
        return getItemsForDate(selectedDate).sort((a, b) => {
            if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
            return a.content.localeCompare(b.content);
        });
    }, [items, selectedDate, currentDate]);

    const calendarStats = useMemo(() => {
        const todayItems = getItemsForDate(today);
        const monthItems = items.filter(item => {
            const relevantDate = item.meta.start || item.meta.date || item.meta.dateTime;
            if (!relevantDate && !(item.meta.isRoutine || item.meta.shoppingCategory === 'routine')) return false;
            if (item.meta.hideFromCalendar) return false;
            if (item.type !== ItemType.TODO && item.type !== ItemType.EVENT && item.type !== ItemType.SHOPPING) return false;
            if (item.meta.isRoutine || item.meta.shoppingCategory === 'routine') return true;
            const date = new Date(relevantDate || '');
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        const upcoming = monthItems.filter(item => item.status === 'pending').length;
        const routinesCount = monthItems.filter(item => item.meta.isRoutine || item.meta.shoppingCategory === 'routine').length;
        return {
            today: todayItems.length,
            upcoming,
            routines: routinesCount,
        };
    }, [items, currentMonth, currentYear]);

    return (
        <div className="flex flex-col h-full bg-background pt-safe">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-xl z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-bold text-primary">Calendar</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
                            setSelectedDate(new Date());
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-full bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-colors"
                    >
                        Today
                    </button>
                    <button onClick={prevMonth} className="p-2 hover:bg-muted/10 rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5 text-primary" />
                    </button>
                    <span className="text-sm font-bold w-32 text-center text-primary">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={nextMonth} className="p-2 hover:bg-muted/10 rounded-full transition-colors">
                        <ChevronRight className="w-5 h-5 text-primary" />
                    </button>
                </div>
            </div>

            <div className="px-4 pt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-surface border border-border p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Today</div>
                    <div className="mt-2 text-xl font-bold text-primary">{calendarStats.today}</div>
                </div>
                <div className="rounded-2xl bg-surface border border-border p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Upcoming</div>
                    <div className="mt-2 text-xl font-bold text-primary">{calendarStats.upcoming}</div>
                </div>
                <div className="rounded-2xl bg-surface border border-border p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Routines</div>
                    <div className="mt-2 text-xl font-bold text-primary">{calendarStats.routines}</div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 flex flex-col p-2 overflow-hidden">
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-[10px] font-bold text-muted uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-1">
                    {calendarDays.map((dayObj, idx) => {
                        const dayItems = getItemsForDate(dayObj.date);
                        const isToday = dayObj.date.getDate() === today.getDate() &&
                                        dayObj.date.getMonth() === today.getMonth() &&
                                        dayObj.date.getFullYear() === today.getFullYear();
                        const isSelected = dayObj.date.getDate() === selectedDate.getDate() &&
                                           dayObj.date.getMonth() === selectedDate.getMonth() &&
                                           dayObj.date.getFullYear() === selectedDate.getFullYear();

                        return (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedDate(dayObj.date)}
                                className={`h-full p-1 border rounded-lg flex flex-col gap-0.5 transition-colors overflow-hidden cursor-pointer ${
                                    dayObj.isCurrentMonth ? 'bg-surface border-border' : 'bg-muted/5 border-transparent opacity-50'
                                } ${isToday ? 'ring-1 ring-indigo-500 ring-inset' : ''} ${isSelected ? 'border-primary/40 bg-primary/5' : ''}`}
                            >
                                <div className={`text-[10px] font-bold text-center ${isToday ? 'text-indigo-500' : 'text-muted'}`}>
                                    {dayObj.date.getDate()}
                                </div>
                                <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
                                    {dayItems.slice(0, 2).map(item => (
                                        <div 
                                            key={item.id}
                                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                                            className={`text-[10.5px] leading-tight p-0.5 rounded-sm cursor-pointer line-clamp-2 ${getItemColor(item.type)} ${
                                                item.status === 'done' ? 'opacity-50 line-through' : 'opacity-100'
                                            }`}
                                            title={item.content}
                                        >
                                            {item.content}
                                        </div>
                                    ))}
                                    {dayItems.length > 2 && (
                                        <div className="text-[10px] text-center text-muted font-bold">+{dayItems.length - 2}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="px-4 pb-24 pt-2">
                <div className="rounded-[28px] border border-border bg-surface p-4">
                    <div className="flex items-center justify-between mb-3 gap-3">
                        <div>
                            <h2 className="text-base font-bold text-primary">
                                {selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </h2>
                            <p className="text-xs text-muted mt-1">{selectedDateItems.length > 0 ? `${selectedDateItems.length} item scheduled` : 'Nothing scheduled yet'}</p>
                        </div>
                    </div>

                    {selectedDateItems.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                            {selectedDateItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    className="w-full text-left rounded-2xl border border-border bg-background p-3 hover:border-primary/20 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.type}</div>
                                            <div className={`mt-1 font-medium ${item.status === 'done' ? 'text-muted line-through' : 'text-primary'}`}>{item.content}</div>
                                        </div>
                                        <span className={`w-2.5 h-2.5 rounded-full ${getItemColor(item.type).split(' ')[0]}`} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
                            This day is clear. Good spot for planning or recovery.
                        </div>
                    )}
                </div>
            </div>

            {/* Item Detail Modal */}
            <AnimatePresence>
                {selectedItem && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                        onClick={() => setSelectedItem(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-border">
                                <h3 className="font-bold text-primary flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${getItemColor(selectedItem.type).split(' ')[0]}`} />
                                    Item Details
                                </h3>
                                <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-muted/10 rounded-full">
                                    <X className="w-5 h-5 text-muted" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <div className="text-xs text-muted font-medium mb-1">Content</div>
                                    <div className="text-primary">{selectedItem.content}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs text-muted font-medium mb-1">Type</div>
                                        <div className="text-primary capitalize">{selectedItem.type.toLowerCase()}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted font-medium mb-1">Status</div>
                                        <div className="flex items-center gap-2">
                                            {selectedItem.status === 'done' ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <Circle className="w-4 h-4 text-muted" />
                                            )}
                                            <span className="text-primary capitalize">{selectedItem.status}</span>
                                        </div>
                                    </div>
                                    {(selectedItem.meta.date || selectedItem.meta.dateTime) && (
                                        <div>
                                            <div className="text-xs text-muted font-medium mb-1">Date</div>
                                            <div className="text-primary">
                                                {new Date(selectedItem.meta.date || selectedItem.meta.dateTime || '').toLocaleDateString()}
                                            </div>
                                        </div>
                                    )}
                                    {selectedItem.meta.start && (
                                        <div>
                                            <div className="text-xs text-muted font-medium mb-1">Starts</div>
                                            <div className="text-primary">{new Date(selectedItem.meta.start).toLocaleString()}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-border">
                                    <button
                                        onClick={() => {
                                            handleDelete(selectedItem.id);
                                            setSelectedItem(null);
                                        }}
                                        className="px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                    >
                                        Delete
                                    </button>
                                    <button 
                                        onClick={() => {
                                            handleToggleStatus(selectedItem.id);
                                            setSelectedItem({ ...selectedItem, status: selectedItem.status === 'done' ? 'pending' : 'done' });
                                        }}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
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
