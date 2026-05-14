import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ShoppingCart, Calendar, Clock, TrendingUp } from 'lucide-react';
import { ShoppingCategory, InvestmentAssetType, BudgetRule, Wallet } from '../types';
import { responsiveModal } from './layout/contentSurface';
import { calculateFirstDueDate } from '../utils/selectors';

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
        dedicatedWalletId?: string,
        paymentMethod?: string,
        hideFromCalendar?: boolean,
        investmentAssetType?: InvestmentAssetType,
        investmentSymbol?: string,
        investmentUnits?: number,
        investmentAveragePrice?: number,
        investmentCurrentPrice?: number,
        investmentPlatform?: string
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

const INVESTMENT_ASSET_TYPES: { value: InvestmentAssetType; label: string; hint: string }[] = [
    { value: 'gold', label: 'Gold', hint: 'grams / bars' },
    { value: 'stock', label: 'Stock', hint: 'shares / lots' },
    { value: 'mutual_fund', label: 'Mutual Fund', hint: 'units' },
    { value: 'crypto', label: 'Crypto', hint: 'coins' },
    { value: 'bond', label: 'Bond', hint: 'nominal / units' },
    { value: 'deposit', label: 'Deposit', hint: 'principal' },
    { value: 'other', label: 'Other', hint: 'units' },
];

const formatDateInput = (value: Date) => {
    const offset = value.getTimezoneOffset() * 60000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 10);
};

const AddShoppingModal: React.FC<AddShoppingModalProps> = ({ isOpen, onClose, onSave, initialCategory = 'not_urgent', budgetRules, wallets }) => {
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<ShoppingCategory>(initialCategory);
    const [quantity, setQuantity] = useState('');
    const [amount, setAmount] = useState('');
    const [budgetCategory, setBudgetCategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [dedicatedWalletId, setDedicatedWalletId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [hideFromCalendar, setHideFromCalendar] = useState(false);
    const [investmentAssetType, setInvestmentAssetType] = useState<InvestmentAssetType>('gold');
    const [investmentSymbol, setInvestmentSymbol] = useState('');
    const [investmentUnits, setInvestmentUnits] = useState('');
    const [investmentAveragePrice, setInvestmentAveragePrice] = useState('');
    const [investmentCurrentPrice, setInvestmentCurrentPrice] = useState('');
    const [investmentPlatform, setInvestmentPlatform] = useState('');

    // Routine specific state
    const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [daysOfMonth, setDaysOfMonth] = useState<number[]>([]);
    const [monthsOfYear, setMonthsOfYear] = useState<number[]>([]);

    const updateDateFromRoutineSchedule = (
        nextInterval: 'daily' | 'weekly' | 'monthly' | 'yearly',
        nextDaysOfWeek: number[],
        nextDaysOfMonth: number[],
        nextMonthsOfYear: number[]
    ) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setDate(formatDateInput(calculateFirstDueDate(today, nextInterval, nextDaysOfWeek, nextDaysOfMonth, nextMonthsOfYear)));
    };

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

        if (category === 'investment' && !investmentPlatform.trim()) {
            alert('Please enter the investment platform/broker/storage. It will be tracked as an investment wallet.');
            return;
        }

        const parsedUnits = investmentUnits ? Number(investmentUnits) : undefined;
        const parsedAveragePrice = investmentAveragePrice ? Number(investmentAveragePrice) : undefined;
        const parsedCurrentPrice = investmentCurrentPrice ? Number(investmentCurrentPrice) : undefined;
        const resolvedAmount = amount
            ? Number(amount)
            : (category === 'investment' && parsedUnits && parsedAveragePrice ? parsedUnits * parsedAveragePrice : undefined);

        onSave(
            content,
            category,
            quantity.trim() || undefined,
            category === 'investment' ? undefined : resolvedAmount,
            budgetCategory || undefined,
            new Date(date).toISOString(),
            category === 'routine' ? interval : undefined,
            category === 'routine' ? daysOfWeek : undefined,
            category === 'routine' ? daysOfMonth : undefined,
            category === 'routine' ? monthsOfYear : undefined,
            category === 'saving' ? dedicatedWalletId : undefined,
            paymentMethod || undefined,
            hideFromCalendar,
            category === 'investment' ? investmentAssetType : undefined,
            category === 'investment' ? investmentSymbol.trim() || undefined : undefined,
            category === 'investment' ? parsedUnits : undefined,
            category === 'investment' ? parsedAveragePrice : undefined,
            category === 'investment' ? parsedCurrentPrice : undefined,
            category === 'investment' ? investmentPlatform.trim() || undefined : undefined
        );

        setContent('');
        setQuantity('');
        setAmount('');
        setBudgetCategory('');
        setDate(new Date().toISOString().split('T')[0]);
        setDedicatedWalletId('');
        setPaymentMethod('');
        setInvestmentAssetType('gold');
        setInvestmentSymbol('');
        setInvestmentUnits('');
        setInvestmentAveragePrice('');
        setInvestmentCurrentPrice('');
        setInvestmentPlatform('');
        setInterval('weekly');
        setDaysOfWeek([]);
        setDaysOfMonth([]);
        setMonthsOfYear([]);
        setHideFromCalendar(false);
        onClose();
    };

    const toggleDayOfWeek = (val: number) => {
        let nextDays: number[];
        if (daysOfWeek.includes(val)) {
            nextDays = daysOfWeek.filter(d => d !== val);
        } else {
            nextDays = [...daysOfWeek, val];
        }
        setDaysOfWeek(nextDays);
        updateDateFromRoutineSchedule(interval, nextDays, daysOfMonth, monthsOfYear);
    };

    const toggleDayOfMonth = (val: number) => {
        let nextDays: number[];
        if (daysOfMonth.includes(val)) {
            nextDays = daysOfMonth.filter(d => d !== val);
        } else {
            nextDays = [...daysOfMonth, val];
        }
        setDaysOfMonth(nextDays);
        updateDateFromRoutineSchedule(interval, daysOfWeek, nextDays, monthsOfYear);
    };

    const toggleMonthOfYear = (val: number) => {
        let nextMonths: number[];
        if (monthsOfYear.includes(val)) {
            nextMonths = monthsOfYear.filter(m => m !== val);
        } else {
            nextMonths = [...monthsOfYear, val];
        }
        setMonthsOfYear(nextMonths);
        updateDateFromRoutineSchedule(interval, daysOfWeek, daysOfMonth, nextMonths);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className={responsiveModal.sheetOverlay}>
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className={`${responsiveModal.denseFormPanel} max-h-[90vh]`}
                >
                    <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-indigo-500" />
                            {category === 'saving' ? 'Add Saving Goal' : (category === 'investment' ? 'Add Investment' : 'Add Shopping Item')}
                        </h3>
                        <button onClick={onClose} className="p-2 bg-muted/10 hover:bg-muted/20 rounded-full text-muted transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div>
                            <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
                                {category === 'saving' ? 'Goal Name' : (category === 'investment' ? 'Asset / Product Name' : 'Item Description')}
                            </label>
                            <input
                                type="text"
                                autoFocus
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder={category === 'saving' ? 'e.g. New Car' : (category === 'investment' ? 'e.g. Antam Gold, BBCA, SBN ORI' : 'What do you need?')}
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
                                    onChange={e => {
                                        const nextCategory = e.target.value as ShoppingCategory;
                                        setCategory(nextCategory);
                                        if (nextCategory === 'routine') {
                                            updateDateFromRoutineSchedule(interval, daysOfWeek, daysOfMonth, monthsOfYear);
                                        }
                                    }}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                    disabled={initialCategory === 'saving' || initialCategory === 'investment'}
                                >
                                    <option value="urgent">Urgent</option>
                                    <option value="routine">Routine</option>
                                    <option value="not_urgent">Normal</option>
                                    <option value="saving">Saving Goal</option>
                                    <option value="investment">Investment</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">{category === 'investment' ? 'Buy date' : 'Due date'}</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {category !== 'saving' && category !== 'investment' && (
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
                            {category !== 'investment' && (
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
                            )}
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

                        {category === 'investment' && (
                            <div className="mt-4 p-4 border border-emerald-500/20 rounded-2xl bg-emerald-500/5 space-y-4">
                                <label className="block text-sm font-bold text-emerald-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> Investment Details
                                </label>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">Asset Type</label>
                                        <select
                                            value={investmentAssetType}
                                            onChange={e => setInvestmentAssetType(e.target.value as InvestmentAssetType)}
                                            className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-emerald-500 font-medium appearance-none"
                                        >
                                            {INVESTMENT_ASSET_TYPES.map(type => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">Ticker / Code</label>
                                        <input
                                            type="text"
                                            value={investmentSymbol}
                                            onChange={e => setInvestmentSymbol(e.target.value.toUpperCase())}
                                            placeholder="BBCA, ANTM, BTC"
                                            className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-emerald-500 font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">Units</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={investmentUnits}
                                            onChange={e => setInvestmentUnits(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-emerald-500 font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">Avg Buy</label>
                                        <input
                                            type="number"
                                            value={investmentAveragePrice}
                                            onChange={e => setInvestmentAveragePrice(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-emerald-500 font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">Now</label>
                                        <input
                                            type="number"
                                            value={investmentCurrentPrice}
                                            onChange={e => setInvestmentCurrentPrice(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-emerald-500 font-medium"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">Investment Wallet / Platform</label>
                                    <input
                                        type="text"
                                        value={investmentPlatform}
                                        onChange={e => setInvestmentPlatform(e.target.value)}
                                        placeholder="e.g. Bibit, Ajaib, Pegadaian, Bank"
                                        className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-emerald-500 font-medium"
                                    />
                                    <p className="text-xs text-muted mt-2">This platform becomes an investment wallet. Invested capital is added later via Money &gt; Saving transaction, so wallet movement stays accurate.</p>
                                </div>
                            </div>
                        )}

                        {category !== 'saving' && category !== 'investment' && (
                            <div className="grid grid-cols-2 gap-4">
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
                                <div>
                                    <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Payment Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={e => setPaymentMethod(e.target.value)}
                                        className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                    >
                                        <option value="">Select Wallet</option>
                                        {wallets.map(w => (
                                            <option key={w.id} value={w.name}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
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
                                            onClick={() => {
                                                setInterval(int);
                                                updateDateFromRoutineSchedule(int, daysOfWeek, daysOfMonth, monthsOfYear);
                                            }}
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

                        <div className="flex items-center gap-2 mt-4">
                            <input
                                type="checkbox"
                                id="hideFromCalendarShopping"
                                checked={hideFromCalendar}
                                onChange={(e) => setHideFromCalendar(e.target.checked)}
                                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="hideFromCalendarShopping" className="text-sm font-medium text-primary">
                                Hide from Calendar
                            </label>
                        </div>
                    </div>

                    <div className="p-6 border-t border-border shrink-0">
                        <button
                            onClick={handleSave}
                            disabled={!content.trim()}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            {category === 'saving' ? 'Create Goal' : (category === 'investment' ? 'Add Investment' : 'Add Item')}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddShoppingModal;
