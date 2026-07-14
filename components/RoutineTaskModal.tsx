import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Check } from 'lucide-react';
import { Priority } from '../types';
import { addItemModal, addItemModalMotion, responsiveModal } from './layout/contentSurface';

interface RoutineTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (
        content: string,
        interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
        daysOfWeek?: number[],
        daysOfMonth?: number[],
        monthsOfYear?: number[],
        date?: string,
        recurrenceDays?: number,
        priority?: Priority
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
    const [priority, setPriority] = useState<Priority>('normal');
    const [formError, setFormError] = useState('');

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
        setFormError('');
        if (!content.trim()) {
            setFormError('Nama routine harus diisi.');
            return;
        }

        // Validation: ensure at least one selection for non-daily
        if (interval === 'weekly' && daysOfWeek.length === 0) {
            setFormError('Pilih minimal satu hari untuk jadwal mingguan.');
            return;
        }
        if (interval === 'monthly' && daysOfMonth.length === 0) {
            setFormError('Pilih minimal satu tanggal untuk jadwal bulanan.');
            return;
        }
        if (interval === 'yearly' && monthsOfYear.length === 0) {
            setFormError('Pilih minimal satu bulan untuk jadwal tahunan.');
            return;
        }

        onSave(content, interval, daysOfWeek, daysOfMonth, monthsOfYear, date, undefined, priority);

        // Reset
        setContent('');
        setInterval('daily');
        setDaysOfWeek([]);
        setDaysOfMonth([]);
        setMonthsOfYear([]);
        setDate(new Date().toISOString().split('T')[0]);
        setPriority('normal');
        setFormError('');
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
            <div className={responsiveModal.sheetOverlay}>
                <motion.div
                    initial={addItemModalMotion.initial}
                    animate={addItemModalMotion.animate}
                    exit={addItemModalMotion.exit}
                    transition={addItemModalMotion.transition}
                    className={addItemModal.panel}
                >
                    <div className={addItemModal.header}>
                        <h3 className={addItemModal.title}>
                            <Clock className={addItemModal.icon} />
                            New Routine
                        </h3>
                        <button onClick={onClose} className={addItemModal.closeButton}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className={addItemModal.body}>
                        {formError && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">
                                {formError}
                            </div>
                        )}
                        <div>
                            <label className={addItemModal.label}>Task Description</label>
                            <input
                                type="text"
                                autoFocus
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="What needs to be done?"
                                className={addItemModal.input}
                            />
                        </div>

                        <div>
                            <label className={addItemModal.label}>Recurrence Pattern</label>

                            {/* Interval Selector */}
                            <div className="grid grid-cols-4 gap-2 bg-background p-1.5 rounded-xl border border-border/50 mb-4">
                                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(int => (
                                    <button
                                        key={int}
                                        onClick={() => {
                                            setInterval(int);
                                            updateDateFromSchedule(int, daysOfWeek, daysOfMonth, monthsOfYear);
                                        }}
                                        className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${interval === int ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-muted hover:text-primary hover:bg-muted/10'}`}
                                    >
                                        {int}
                                    </button>
                                ))}
                            </div>

                            {/* Weekly Selector */}
                            {interval === 'weekly' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                                    <div className="flex gap-1">
                                        {DAYS_OF_WEEK.map(day => (
                                            <button
                                                key={day.value}
                                                onClick={() => toggleDayOfWeek(day.value)}
                                                className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all border ${addItemModal.choiceButton(daysOfWeek.includes(day.value))}`}
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
                                    <label className={addItemModal.label}>Select Dates</label>
                                    <div className="grid grid-cols-7 gap-1">
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                            <button
                                                key={day}
                                                onClick={() => toggleDayOfMonth(day)}
                                                className={`w-full aspect-square rounded-md flex items-center justify-center text-[10px] font-bold transition-all border ${addItemModal.choiceButton(daysOfMonth.includes(day), 'bg-indigo-600 border-indigo-500 text-white shadow-sm')}`}
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
                                    <label className={addItemModal.label}>Select Months</label>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {MONTHS_OF_YEAR.map(month => (
                                            <button
                                                key={month.value}
                                                onClick={() => toggleMonthOfYear(month.value)}
                                                className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${addItemModal.choiceButton(monthsOfYear.includes(month.value))}`}
                                            >
                                                {month.label}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Start Date */}
                            <div className="bg-muted/5 p-3 rounded-2xl border border-border/50 mt-4">
                                <label className={addItemModal.label}>Start Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className={`${addItemModal.smallInput} pl-10 font-bold [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]`}
                                    />
                                </div>
                            </div>

                            <div className="mt-6">
                                <label className={addItemModal.label}>Priority</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['low', 'normal', 'high'] as Priority[]).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPriority(p)}
                                            className={`py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all ${
                                                priority === p
                                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                                    : 'bg-background border border-border text-muted hover:border-indigo-500/50'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={addItemModal.footer}>
                        <button
                            onClick={handleSave}
                            disabled={!content.trim()}
                            className={addItemModal.primaryButton}
                        >
                            <Check className="w-5 h-5" />
                            Create Routine
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RoutineTaskModal;
