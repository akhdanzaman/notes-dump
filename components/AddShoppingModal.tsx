import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ShoppingCart, Clock, TrendingUp, Image as ImageIcon, Plus } from 'lucide-react';
import { ShoppingCategory, InvestmentAssetType, BudgetRule, Wallet, ShoppingLineItem } from '../types';
import { addItemModal, addItemModalMotion, responsiveModal } from './layout/contentSurface';
import { calculateFirstDueDate } from '../utils/selectors';
import { createShoppingLineItemId, sanitizeShoppingLineItems, sumShoppingLineItems } from '../utils/shoppingLineItems';

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
        investmentPlatform?: string,
        imageUrl?: string,
        shoppingLineItems?: ShoppingLineItem[]
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
    const [shoppingLineItems, setShoppingLineItems] = useState<ShoppingLineItem[]>([]);
    const [imageUrl, setImageUrl] = useState('');
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

    const isPurchaseCategory = category !== 'saving' && category !== 'investment';
    const sanitizedLineItems = sanitizeShoppingLineItems(shoppingLineItems);
    const hasLineItems = isPurchaseCategory && sanitizedLineItems.length > 0;
    const lineItemsTotal = sumShoppingLineItems(sanitizedLineItems);

    const addShoppingLineItem = () => {
        setShoppingLineItems(prev => [...prev, { id: createShoppingLineItemId(), name: '', quantity: '', amount: undefined }]);
    };

    const updateShoppingLineItem = (id: string, changes: Partial<ShoppingLineItem>) => {
        setShoppingLineItems(prev => prev.map(line => line.id === id ? { ...line, ...changes } : line));
    };

    const removeShoppingLineItem = (id: string) => {
        setShoppingLineItems(prev => prev.filter(line => line.id !== id));
    };

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
        const resolvedAmount = hasLineItems
            ? lineItemsTotal
            : amount
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
            category === 'investment' ? investmentPlatform.trim() || undefined : undefined,
            (category === 'saving' || category === 'investment') ? imageUrl.trim() || undefined : undefined,
            isPurchaseCategory && hasLineItems ? sanitizedLineItems : undefined
        );

        setContent('');
        setQuantity('');
        setShoppingLineItems([]);
        setImageUrl('');
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
                    initial={addItemModalMotion.initial}
                    animate={addItemModalMotion.animate}
                    exit={addItemModalMotion.exit}
                    transition={addItemModalMotion.transition}
                    className={addItemModal.panel}
                >
                    <div className={addItemModal.header}>
                        <h3 className={addItemModal.title}>
                            <ShoppingCart className={addItemModal.icon} />
                            {category === 'saving' ? 'Add Saving Goal' : (category === 'investment' ? 'Add Investment' : 'Add Shopping Item')}
                        </h3>
                        <button onClick={onClose} className={addItemModal.closeButton}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className={addItemModal.body}>
                        <div>
                            <label className={addItemModal.label}>
                                {category === 'saving' ? 'Goal Name' : (category === 'investment' ? 'Asset / Product Name' : 'Item Description')}
                            </label>
                            <input
                                type="text"
                                autoFocus
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder={category === 'saving' ? 'e.g. New Car' : (category === 'investment' ? 'e.g. Antam Gold, BBCA, SBN ORI' : 'What do you need?')}
                                className={addItemModal.input}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSave();
                                    }
                                }}
                            />
                        </div>

                        {(category === 'saving' || category === 'investment') && (
                            <div className={addItemModal.sectionPanel}>
                                <label className={addItemModal.sectionTitle}>
                                    <ImageIcon className="w-4 h-4" /> Thumbnail Image
                                </label>
                                <input
                                    type="url"
                                    value={imageUrl}
                                    onChange={e => setImageUrl(e.target.value)}
                                    placeholder="https://example.com/thumbnail.jpg"
                                    className={addItemModal.input}
                                />
                                <p className={addItemModal.helpText}>Optional. The card thumbnail will use this URL directly; leave empty to show the default empty image state.</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={addItemModal.label}>Category</label>
                                <select
                                    value={category}
                                    onChange={e => {
                                        const nextCategory = e.target.value as ShoppingCategory;
                                        setCategory(nextCategory);
                                        if (nextCategory === 'routine') {
                                            updateDateFromRoutineSchedule(interval, daysOfWeek, daysOfMonth, monthsOfYear);
                                        }
                                    }}
                                    className={addItemModal.select}
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
                                <label className={addItemModal.label}>{category === 'investment' ? 'Buy date' : 'Due date'}</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className={addItemModal.input}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {category !== 'saving' && category !== 'investment' && (
                                <div>
                                    <label className={addItemModal.label}>Quantity</label>
                                    <input
                                        type="text"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        placeholder="e.g. 2 pcs, 1 kg"
                                        className={addItemModal.input}
                                    />
                                </div>
                            )}
                            {category !== 'investment' && (
                            <div className={category === 'saving' ? 'col-span-2' : ''}>
                                <label className={addItemModal.label}>
                                    {category === 'saving' ? 'Target Amount' : 'Est. Cost'}
                                </label>
                                <input
                                    type="number"
                                    value={isPurchaseCategory && hasLineItems ? lineItemsTotal || '' : amount}
                                    onChange={e => setAmount(e.target.value)}
                                    readOnly={isPurchaseCategory && hasLineItems}
                                    placeholder="0"
                                    className={`${addItemModal.input} ${isPurchaseCategory && hasLineItems ? 'opacity-80 cursor-not-allowed' : ''}`}
                                />
                                {isPurchaseCategory && hasLineItems && (
                                    <p className={addItemModal.helpText}>Auto-summed from line items.</p>
                                )}
                            </div>
                            )}
                        </div>

                        {category === 'saving' && (
                            <div>
                                <label className={addItemModal.label}>Dedicated Wallet</label>
                                <select
                                    value={dedicatedWalletId}
                                    onChange={e => setDedicatedWalletId(e.target.value)}
                                    className={addItemModal.select}
                                >
                                    <option value="">Select Wallet</option>
                                    {wallets.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                                <p className={addItemModal.helpText}>This wallet will be exclusively used for this saving goal.</p>
                            </div>
                        )}

                        {category === 'investment' && (
                            <div className={addItemModal.accentSectionPanel}>
                                <label className={addItemModal.accentSectionTitle}>
                                    <TrendingUp className="w-4 h-4" /> Investment Details
                                </label>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={addItemModal.label}>Asset Type</label>
                                        <select
                                            value={investmentAssetType}
                                            onChange={e => setInvestmentAssetType(e.target.value as InvestmentAssetType)}
                                            className={`${addItemModal.select} focus:border-emerald-500`}
                                        >
                                            {INVESTMENT_ASSET_TYPES.map(type => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={addItemModal.label}>Ticker / Code</label>
                                        <input
                                            type="text"
                                            value={investmentSymbol}
                                            onChange={e => setInvestmentSymbol(e.target.value.toUpperCase())}
                                            placeholder="BBCA, ANTM, BTC"
                                            className={`${addItemModal.input} focus:border-emerald-500`}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className={addItemModal.label}>Units</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={investmentUnits}
                                            onChange={e => setInvestmentUnits(e.target.value)}
                                            placeholder="0"
                                            className={`${addItemModal.input} focus:border-emerald-500`}
                                        />
                                    </div>
                                    <div>
                                        <label className={addItemModal.label}>Avg Buy</label>
                                        <input
                                            type="number"
                                            value={investmentAveragePrice}
                                            onChange={e => setInvestmentAveragePrice(e.target.value)}
                                            placeholder="0"
                                            className={`${addItemModal.input} focus:border-emerald-500`}
                                        />
                                    </div>
                                    <div>
                                        <label className={addItemModal.label}>Now</label>
                                        <input
                                            type="number"
                                            value={investmentCurrentPrice}
                                            onChange={e => setInvestmentCurrentPrice(e.target.value)}
                                            placeholder="0"
                                            className={`${addItemModal.input} focus:border-emerald-500`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={addItemModal.label}>Investment Wallet / Platform</label>
                                    <input
                                        type="text"
                                        value={investmentPlatform}
                                        onChange={e => setInvestmentPlatform(e.target.value)}
                                        placeholder="e.g. Bibit, Ajaib, Pegadaian, Bank"
                                        className={`${addItemModal.input} focus:border-emerald-500`}
                                    />
                                    <p className={addItemModal.helpText}>This platform becomes an investment wallet. Invested capital is added later via Money &gt; Saving transaction, so wallet movement stays accurate.</p>
                                </div>
                            </div>
                        )}

                        {isPurchaseCategory && (
                            <div className={addItemModal.sectionPanel}>
                                <div className="flex items-center justify-between gap-3">
                                    <label className={addItemModal.sectionTitle}>
                                        <ShoppingCart className="w-4 h-4" /> Line Items
                                    </label>
                                    <span className="text-xs font-bold text-acc-shopping">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(lineItemsTotal)}
                                    </span>
                                </div>
                                <p className={addItemModal.helpText}>Optional. Add each grocery/product row here; the shopping total is summarized from these amounts.</p>

                                <div className="space-y-2">
                                    {shoppingLineItems.map((line, index) => (
                                        <div key={line.id} className="grid grid-cols-[1fr_72px_112px_auto] gap-2 items-center">
                                            <input
                                                type="text"
                                                value={line.name}
                                                onChange={e => updateShoppingLineItem(line.id, { name: e.target.value })}
                                                placeholder={`Item ${index + 1}`}
                                                className={addItemModal.input}
                                            />
                                            <input
                                                type="text"
                                                value={line.quantity || ''}
                                                onChange={e => updateShoppingLineItem(line.id, { quantity: e.target.value })}
                                                placeholder="Qty"
                                                className={addItemModal.input}
                                            />
                                            <input
                                                type="number"
                                                value={line.amount ?? ''}
                                                onChange={e => updateShoppingLineItem(line.id, { amount: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                placeholder="0"
                                                className={addItemModal.input}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeShoppingLineItem(line.id)}
                                                className="p-2 rounded-full text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                                aria-label="Remove line item"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addShoppingLineItem}
                                        className="px-3 py-2 rounded-xl bg-acc-shopping/10 text-acc-shopping text-xs font-bold hover:bg-acc-shopping/20 transition-colors flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add line item
                                    </button>
                                </div>
                            </div>
                        )}

                        {category !== 'saving' && category !== 'investment' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={addItemModal.label}>Budget Category</label>
                                    <select
                                        value={budgetCategory}
                                        onChange={e => setBudgetCategory(e.target.value)}
                                        className={addItemModal.select}
                                    >
                                        <option value="">No Category</option>
                                        {budgetRules.map(rule => (
                                            <option key={rule.id} value={rule.id}>{rule.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={addItemModal.label}>Payment Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={e => setPaymentMethod(e.target.value)}
                                        className={addItemModal.select}
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
                            <div className={addItemModal.sectionPanel}>
                                <label className={addItemModal.sectionTitle}>
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
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
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
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
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
                            </div>
                        )}

                        <div className="flex items-center gap-2 mt-4">
                            <input
                                type="checkbox"
                                id="hideFromCalendarShopping"
                                checked={hideFromCalendar}
                                onChange={(e) => setHideFromCalendar(e.target.checked)}
                                className={addItemModal.checkbox}
                            />
                            <label htmlFor="hideFromCalendarShopping" className="text-sm font-medium text-primary">
                                Hide from Calendar
                            </label>
                        </div>
                    </div>

                    <div className={addItemModal.footer}>
                        <button
                            onClick={handleSave}
                            disabled={!content.trim()}
                            className={addItemModal.primaryButton}
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
