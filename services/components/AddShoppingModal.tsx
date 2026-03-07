import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ShoppingCart, Calendar, Clock } from 'lucide-react';
import { ShoppingCategory, BudgetRule, Wallet } from '../types';

interface AddShoppingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (
        content: string, 
        category: ShoppingCategory, 
        quantity?: string, 
        amount?: number, 
        budgetCategory?: string, 
        date?: string,
        routineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly',
        routineDaysOfWeek?: number[],
        routineDaysOfMonth?: number[],
        routineMonthsOfYear?: number[],
        dedicatedWalletId?: string
    ) => void;
    initialCategory?: ShoppingCategory;
    budgetRules: BudgetRule[];
    wallets: Wallet[];
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

const AddShoppingModal: React.FC<AddShoppingModalProps> = ({ isOpen, onClose, onSave, initialCategory = 'not_urgent', budgetRules, wallets }) => {
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<ShoppingCategory>(initialCategory);
    const [quantity, setQuantity] = useState('');
    const [amount, setAmount] = useState('');
    const [budgetCategory, setBudgetCategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [dedicatedWalletId, setDedicatedWalletId] = useState('');
    
    // Routine specific state
    const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [daysOfMonth, setDaysOfMonth] = useState<number[]>([]);
    const [monthsOfYear, setMonthsOfYear] = useState<number[]>([]);

    useEffect(() => {
        if (isOpen) {
            setCategory(initialCategory);
        }
    }, [isOpen, initialCategory]);

    const handleSave = () => {
        if (!content.trim()) return;
        
        if (category === 'routine') {
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
        }

        if (category === 'saving' && !dedicatedWalletId) {
            alert('Please select a dedicated wallet for this saving goal.');
            return;
        }

        onSave(
            content, 
            category, 
            quantity.trim() || undefined, 
            amount ? Number(amount) : undefined, 
            budgetCategory || undefined,
            new Date(date).toISOString(),
            category === 'routine' ? interval : undefined,
            category === 'routine' ? daysOfWeek : undefined,
            category === 'routine' ? daysOfMonth : undefined,
            category === 'routine' ? monthsOfYear : undefined,
            category === 'saving' ? dedicatedWalletId : undefined
        );
        
        setContent('');
        setQuantity('');
        setAmount('');
        setBudgetCategory('');
        setDate(new Date().toISOString().split('T')[0]);
        setDedicatedWalletId('');
        setInterval('weekly');
        setDaysOfWeek([]);
        setDaysOfMonth([]);
        setMonthsOfYear([]);
        onClose();
    };

    const toggleDayOfWeek = (val: number) => {
        if (daysOfWeek.includes(val)) {
            setDaysOfWeek(daysOfWeek.filter(d => d !== val));
        } else {
            setDaysOfWeek([...daysOfWeek, val]);
        }
    };

    const toggleDayOfMonth = (val: number) => {
        if (daysOfMonth.includes(val)) {
            setDaysOfMonth(daysOfMonth.filter(d => d !== val));
        } else {
            setDaysOfMonth([...daysOfMonth, val]);
        }
    };

    const toggleMonthOfYear = (val: number) => {
        if (monthsOfYear.includes(val)) {
            setMonthsOfYear(monthsOfYear.filter(m => m !== val));
        } else {
            setMonthsOfYear([...monthsOfYear, val]);
        }
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
                    <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-indigo-500" />
                            Add Shopping Item
                        </h3>
                        <button onClick={onClose} className="p-2 bg-muted/10 hover:bg-muted/20 rounded-full text-muted transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div>
                            <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
                                {category === 'saving' ? 'Goal Name' : 'Item Description'}
                            </label>
                            <input 
                                type="text"
                                autoFocus
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder={category === 'saving' ? 'e.g. New Car' : 'What do you need?'}
                                className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSave();
                                    }
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Category</label>
                                <select 
                                    value={category}
                                    onChange={e => setCategory(e.target.value as ShoppingCategory)}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                    disabled={initialCategory === 'saving'}
                                >
                                    <option value="urgent">Urgent</option>
                                    <option value="routine">Routine</option>
                                    <option value="not_urgent">Normal</option>
                                    <option value="saving">Saving Goal</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Date</label>
                                <input 
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {category !== 'saving' && (
                                <div>
                                    <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Quantity</label>
                                    <input 
                                        type="text"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        placeholder="e.g. 2 pcs, 1 kg"
                                        className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                    />
                                </div>
                            )}
                            <div className={category === 'saving' ? 'col-span-2' : ''}>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
                                    {category === 'saving' ? 'Target Amount' : 'Est. Cost'}
                                </label>
                                <input 
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                />
                            </div>
                        </div>

                        {category === 'saving' && (
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Dedicated Wallet</label>
                                <select 
                                    value={dedicatedWalletId}
                                    onChange={e => setDedicatedWalletId(e.target.value)}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                >
                                    <option value="">Select Wallet</option>
                                    {wallets.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted mt-2">This wallet will be exclusively used for this saving goal.</p>
                            </div>
                        )}

                        {category !== 'saving' && (
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Budget Category</label>
                                <select 
                                    value={budgetCategory}
                                    onChange={e => setBudgetCategory(e.target.value)}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                >
                                    <option value="">No Category</option>
                                    {budgetRules.map(rule => (
                                        <option key={rule.id} value={rule.id}>{rule.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {category === 'routine' && (
                            <div className="mt-4 p-4 border border-border rounded-2xl bg-muted/5">
                                <label className="block text-sm font-bold text-muted mb-3 uppercase tracking-wider flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Routine Schedule
                                </label>
                                
                                {/* Interval Selector */}
                                <div className="grid grid-cols-4 gap-2 bg-background p-1.5 rounded-xl border border-border/50 mb-4">
                                    {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(int => (
                                        <button
                                            key={int}
                                            onClick={() => setInterval(int)}
                                            className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${interval === int ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-muted hover:text-primary hover:bg-muted/10'}`}
                                        >
                                            {int}
                                        </button>
                                    ))}
                                </div>

                                {/* Weekly Selector */}
                                {interval === 'weekly' && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
                                        <div className="flex gap-1">
                                            {DAYS_OF_WEEK.map(day => (
                                                <button
                                                    key={day.value}
                                                    onClick={() => toggleDayOfWeek(day.value)}
                                                    className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all border ${daysOfWeek.includes(day.value) ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                                                >
                                                    {day.label[0]}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Monthly Selector */}
                                {interval === 'monthly' && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
                                        <label className="block text-[10px] font-bold text-muted mb-2 uppercase tracking-widest">Select Dates</label>
                                        <div className="grid grid-cols-7 gap-1">
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                <button
                                                    key={day}
                                                    onClick={() => toggleDayOfMonth(day)}
                                                    className={`w-full aspect-square rounded-md flex items-center justify-center text-[10px] font-bold transition-all border ${daysOfMonth.includes(day) ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Yearly Selector */}
                                {interval === 'yearly' && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
                                        <label className="block text-[10px] font-bold text-muted mb-2 uppercase tracking-widest">Select Months</label>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {MONTHS_OF_YEAR.map(month => (
                                                <button
                                                    key={month.value}
                                                    onClick={() => toggleMonthOfYear(month.value)}
                                                    className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${monthsOfYear.includes(month.value) ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                                                >
                                                    {month.label}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-border shrink-0">
                        <button 
                            onClick={handleSave}
                            disabled={!content.trim()}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            Add Item
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddShoppingModal;
