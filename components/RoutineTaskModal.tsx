import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Check } from 'lucide-react';

interface RoutineTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (
        content: string,
        interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
        daysOfWeek?: number[],
        daysOfMonth?: number[],
        monthsOfYear?: number[],
        date?: string
    ) => void;
}

const DAYS_OF_WEEK = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
];

const MONTHS_OF_YEAR = [
    { label: 'Jan', value: 0 }, { label: 'Feb', value: 1 }, { label: 'Mar', value: 2 },
    { label: 'Apr', value: 3 }, { label: 'May', value: 4 }, { label: 'Jun', value: 5 },
    { label: 'Jul', value: 6 }, { label: 'Aug', value: 7 }, { label: 'Sep', value: 8 },
    { label: 'Oct', value: 9 }, { label: 'Nov', value: 10 }, { label: 'Dec', value: 11 }
];

const RoutineTaskModal: React.FC<RoutineTaskModalProps> = ({ isOpen, onClose, onSave }) => {
    const [content, setContent] = useState('');
    const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [daysOfMonth, setDaysOfMonth] = useState<number[]>([]);
    const [monthsOfYear, setMonthsOfYear] = useState<number[]>([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Helper to calculate next due date based on schedule
    const calculateNextDate = (
        int: 'daily' | 'weekly' | 'monthly' | 'yearly',
        dOfWeek: number[],
        dOfMonth: number[],
        mOfYear: number[]
    ) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (int === 'daily') {
            return today;
        }

        if (int === 'weekly' && dOfWeek.length > 0) {
            // Find next occurrence of any selected day
            for (let i = 0; i < 7; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                if (dOfWeek.includes(d.getDay())) {
                    return d;
                }
            }
        }

        if (int === 'monthly' && dOfMonth.length > 0) {
            // Find next occurrence of any selected date
            // Check current month first
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            
            // Sort selected days
            const sortedDays = [...dOfMonth].sort((a, b) => a - b);
            
            // Check remaining days in current month
            for (const day of sortedDays) {
                if (day >= today.getDate() && day <= daysInMonth) {
                    return new Date(currentYear, currentMonth, day);
                }
            }
            
            // If not found, get first available day in next month
            const nextMonth = new Date(currentYear, currentMonth + 1, 1);
            // Handle edge case where next month might not have the day (e.g. Feb 30)
            // But for simplicity, we just take the first valid day from the list
            // Ideally we should check validity for next month
            const nextMonthDays = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
            for (const day of sortedDays) {
                if (day <= nextMonthDays) {
                    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day);
                }
            }
        }

        if (int === 'yearly' && mOfYear.length > 0) {
             // Find next occurrence of any selected month
             const currentMonth = today.getMonth();
             const currentYear = today.getFullYear();
             const sortedMonths = [...mOfYear].sort((a, b) => a - b);

             // Check remaining months in current year
             for (const month of sortedMonths) {
                 if (month >= currentMonth) {
                     // If it's the current month, check if today is valid (assuming 1st of month if no day specified, or just today)
                     // For yearly, we usually just set it to the 1st of that month if we don't have day selector
                     // But if it's current month, we can set to today if we want immediate start, or 1st if strictly following pattern
                     // Let's set to 1st of the month for future months, and today if current month (and today is >= 1st)
                     if (month > currentMonth) {
                         return new Date(currentYear, month, 1);
                     } else {
                         // Current month
                         return today;
                     }
                 }
             }

             // If not found, go to next year
             return new Date(currentYear + 1, sortedMonths[0], 1);
        }

        return today;
    };

    const updateDateFromSchedule = (
        int: 'daily' | 'weekly' | 'monthly' | 'yearly',
        dOfWeek: number[],
        dOfMonth: number[],
        mOfYear: number[]
    ) => {
        const nextDate = calculateNextDate(int, dOfWeek, dOfMonth, mOfYear);
        // Adjust for timezone offset to ensure YYYY-MM-DD is correct
        const offset = nextDate.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(nextDate.getTime() - offset)).toISOString().slice(0, 10);
        setDate(localISOTime);
    };

    const handleSave = () => {
        if (!content.trim()) return;
        
        // Validation: ensure at least one selection for non-daily
        if (interval === 'weekly' && daysOfWeek.length === 0) {
            alert('Please select at least one day of the week.');
            return;
        }
        if (interval === 'monthly' && daysOfMonth.length === 0) {
            alert('Please select at least one date of the month.');
            return;
        }
        if (interval === 'yearly' && monthsOfYear.length === 0) {
            alert('Please select at least one month of the year.');
            return;
        }

        onSave(content, interval, daysOfWeek, daysOfMonth, monthsOfYear, date);
        
        // Reset
        setContent('');
        setInterval('daily');
        setDaysOfWeek([]);
        setDaysOfMonth([]);
        setMonthsOfYear([]);
        setDate(new Date().toISOString().split('T')[0]);
        onClose();
    };

    const toggleDayOfWeek = (val: number) => {
        let newDays;
        if (daysOfWeek.includes(val)) {
            newDays = daysOfWeek.filter(d => d !== val);
        } else {
            newDays = [...daysOfWeek, val];
        }
        setDaysOfWeek(newDays);
        updateDateFromSchedule(interval, newDays, daysOfMonth, monthsOfYear);
    };

    const toggleDayOfMonth = (val: number) => {
        let newDays;
        if (daysOfMonth.includes(val)) {
            newDays = daysOfMonth.filter(d => d !== val);
        } else {
            newDays = [...daysOfMonth, val];
        }
        setDaysOfMonth(newDays);
        updateDateFromSchedule(interval, daysOfWeek, newDays, monthsOfYear);
    };

    const toggleMonthOfYear = (val: number) => {
        let newMonths;
        if (monthsOfYear.includes(val)) {
            newMonths = monthsOfYear.filter(m => m !== val);
        } else {
            newMonths = [...monthsOfYear, val];
        }
        setMonthsOfYear(newMonths);
        updateDateFromSchedule(interval, daysOfWeek, daysOfMonth, newMonths);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="bg-surface border border-border rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="p-8 border-b border-border flex justify-between items-center shrink-0 bg-indigo-500/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Clock className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-primary tracking-tight">New Routine</h3>
                                <p className="text-xs text-muted font-medium uppercase tracking-widest">Create a recurring task</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted/10 rounded-xl text-muted transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-8 overflow-y-auto flex-1 space-y-8">
                        <div>
                            <label className="block text-[10px] font-bold text-muted mb-3 uppercase tracking-[0.2em]">Task Description</label>
                            <input 
                                type="text"
                                autoFocus
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="What needs to be done?"
                                className="w-full bg-background border-b-2 border-border focus:border-indigo-500 py-4 text-2xl text-primary focus:outline-none font-medium transition-colors placeholder:text-muted/30"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-muted mb-3 uppercase tracking-[0.2em]">Recurrence Pattern</label>
                            
                            {/* Interval Selector */}
                            <div className="grid grid-cols-4 gap-2 bg-muted/5 p-1.5 rounded-2xl border border-border/50 mb-4">
                                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(int => (
                                    <button
                                        key={int}
                                        onClick={() => {
                                            setInterval(int);
                                            updateDateFromSchedule(int, daysOfWeek, daysOfMonth, monthsOfYear);
                                        }}
                                        className={`py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${interval === int ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-muted hover:text-primary hover:bg-background'}`}
                                    >
                                        {int}
                                    </button>
                                ))}
                            </div>

                            {/* Weekly Selector */}
                            {interval === 'weekly' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                                    <div className="flex gap-2">
                                        {DAYS_OF_WEEK.map(day => (
                                            <button
                                                key={day.value}
                                                onClick={() => toggleDayOfWeek(day.value)}
                                                className={`flex-1 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all border ${daysOfWeek.includes(day.value) ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                                            >
                                                {day.label[0]}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Monthly Selector */}
                            {interval === 'monthly' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                                    <label className="block text-[10px] font-bold text-muted mb-2 uppercase tracking-widest">Select Dates</label>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                            <button
                                                key={day}
                                                onClick={() => toggleDayOfMonth(day)}
                                                className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all border ${daysOfMonth.includes(day) ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Yearly Selector */}
                            {interval === 'yearly' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                                    <label className="block text-[10px] font-bold text-muted mb-2 uppercase tracking-widest">Select Months</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {MONTHS_OF_YEAR.map(month => (
                                            <button
                                                key={month.value}
                                                onClick={() => toggleMonthOfYear(month.value)}
                                                className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${monthsOfYear.includes(month.value) ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                                            >
                                                {month.label}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Start Date */}
                            <div className="bg-muted/5 p-3 rounded-2xl border border-border/50 mt-4">
                                <label className="text-[10px] uppercase text-muted font-bold mb-2 block tracking-widest">Start Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                                    <input 
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl pl-10 pr-3 py-3 text-sm font-bold text-primary focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 border-t border-border shrink-0 bg-background/50">
                        <button 
                            onClick={handleSave}
                            disabled={!content.trim()}
                            className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-bold text-lg hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 active:scale-[0.98]"
                        >
                            <Check className="w-6 h-6" />
                            Create Routine
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RoutineTaskModal;
