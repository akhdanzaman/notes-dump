import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff, Eye, TrendingUp, TrendingDown, Wallet as WalletIcon, List, PieChart, Pencil, Trash2, PiggyBank, CreditCard, ChevronLeft, ChevronRight, Calculator, Plus, AlertCircle } from 'lucide-react';
import { BrainDumpItem, Wallet, BudgetConfig, MoneyView, AppSettings, SortOrder, FinanceType, ItemType, Tab } from '../../types';
import { getWalletStats, getFinanceItems } from '../../utils/selectors';
import Card from '../Card';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';

interface MoneyViewProps {
    items: BrainDumpItem[];
    wallets: Wallet[];
    budgetConfig: BudgetConfig;
    moneyView: MoneyView;
    setMoneyView: (view: MoneyView) => void;
    financeDate: Date;
    setFinanceDate: (d: Date) => void;
    showBalance: boolean;
    setShowBalance: (val: boolean) => void;
    appSettings: AppSettings;

    handleDelete: (id: string) => void;
    handleUpdateItem: (
        id: string, 
        newContent: string, 
        newTags: string[], 
        newAmount?: number, 
        newDate?: string, 
        newPaymentMethod?: string, 
        newBudgetCategory?: string, 
        newDuration?: number, 
        newSkillId?: string, 
        newToWallet?: string, 
        newFinanceType?: FinanceType, 
        newProgress?: number, 
        newProgressNotes?: string,
        newShoppingCategory?: any,
        newRecurrenceDays?: number,
        newQuantity?: string,
        newIsRoutine?: boolean,
        newRoutineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly',
        newRoutineDaysOfWeek?: number[],
        newRoutineDaysOfMonth?: number[],
        newRoutineMonthsOfYear?: number[],
        newSavingGoalId?: string,
        newDedicatedWalletId?: string
    ) => void;
    handleOpenEditWallet: (w: Wallet) => void;
    handleOpenAddWallet: () => void;
    setDeleteId: (id: string) => void;
    setDeleteType: (type: 'skill' | 'wallet' | null) => void;
    setIsSettingsOpen: (val: boolean) => void;

    // Filters
    filterWallet: string;
    filterTransactionType: string;
    filterCategory: string;
    filterMinAmount: string;
    filterMaxAmount: string;
    selectedTag: string;
    searchQuery: string;
    sortOrder: SortOrder;
    savingGoals: BrainDumpItem[];
    setActiveTab: (tab: Tab) => void;
    onAddItem: (type: ItemType) => void;
}

const MoneyViewComponent: React.FC<MoneyViewProps> = ({
    items, wallets, budgetConfig, moneyView, setMoneyView,
    financeDate, setFinanceDate, showBalance, setShowBalance, appSettings,
    handleDelete, handleUpdateItem, handleOpenEditWallet, handleOpenAddWallet,
    setDeleteId, setDeleteType, setIsSettingsOpen,
    filterWallet, filterTransactionType, filterCategory, filterMinAmount, filterMaxAmount, selectedTag, searchQuery, sortOrder,
    savingGoals, setActiveTab, onAddItem
}) => {
    
    // Main Tab Swipe Logic
    const swipeHandlers = useSwipeTabs('money', setActiveTab);

    // Date Swipe Logic
    const changeMonth = (offset: number) => {
        const newDate = new Date(financeDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setFinanceDate(newDate);
    };
    
    const dateSwipeHandlers = useSwipeDate(
        () => changeMonth(-1), // Swipe Right -> Prev Month
        () => changeMonth(1)   // Swipe Left -> Next Month
    );

    // Sub-Tab Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [budgetViewMode, setBudgetViewMode] = useState<'monthly' | 'yearly'>('monthly');

    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const isHorizontalSwipe = useRef<boolean | null>(null);

    const tabs: MoneyView[] = ['wallets', 'transactions', 'budget'];
    const activeIndex = tabs.indexOf(moneyView);

    // Calculate Data for All Views
    const { walletStats, totalNetWorth, totalAssets, totalDebt, totalSavings } = getWalletStats(items, wallets);
    
    const { 
        list, totalIncome, totalExpense, projectedExpense, 
        budgetMap, plannedBudgetMap, uncategorized, projectedUncategorized 
    } = getFinanceItems(
        items, financeDate, budgetConfig, 
        filterWallet, filterTransactionType, filterCategory, filterMinAmount, filterMaxAmount, selectedTag, searchQuery, sortOrder,
        budgetViewMode
    );

    const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
               
    const effectiveIncome = budgetConfig.monthlyIncome > 0 
        ? (budgetViewMode === 'yearly' ? budgetConfig.monthlyIncome * 12 : budgetConfig.monthlyIncome) 
        : totalIncome;
    const incomeLabel = budgetConfig.monthlyIncome > 0 
        ? (budgetViewMode === 'yearly' ? 'Fixed Income (Yearly)' : 'Fixed Income') 
        : 'Recorded Income';

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsDragging(true);
        isHorizontalSwipe.current = null;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;

        if (isHorizontalSwipe.current === null) {
             if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
                 isHorizontalSwipe.current = true;
             } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
                 isHorizontalSwipe.current = false;
             }
        }

        if (isHorizontalSwipe.current) {
            // Resistance
            if ((activeIndex === 0 && dx > 0) || (activeIndex === 2 && dx < 0)) {
                setDragOffset(dx * 0.3);
            } else {
                setDragOffset(dx);
            }
        }
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        const threshold = window.innerWidth * 0.25;

        if (isHorizontalSwipe.current && Math.abs(dragOffset) > threshold) {
            if (dragOffset < 0 && activeIndex < 2) {
                setMoneyView(tabs[activeIndex + 1]);
            }
            if (dragOffset > 0 && activeIndex > 0) {
                setMoneyView(tabs[activeIndex - 1]);
            }
        }
        
        setDragOffset(0);
        touchStartRef.current = null;
        isHorizontalSwipe.current = null;
    };

    const cardProps = {
        onUpdate: handleUpdateItem,
        onDelete: handleDelete,
        enableCollapse: true,
        defaultCollapsed: appSettings.defaultCollapsed,
        hideMoney: appSettings.hideMoney,
        wallets,
        budgetRules: budgetConfig.rules,
        savingGoals,
        noStrikethrough: true,
        noDarken: true
    };

    return (
        <div className="min-h-[60vh] overflow-hidden pb-20">
            {/* Top Container */}
            <motion.div 
                layoutId="top-container"
                className="bg-white dark:bg-zinc-100 text-black rounded-b-[32px] p-6 pt-12 shadow-sm mb-4 touch-pan-y"
                transition={{ type: "tween", duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                onTouchStart={swipeHandlers.onTouchStart}
                onTouchMove={swipeHandlers.onTouchMove}
                onTouchEnd={swipeHandlers.onTouchEnd}
                style={{ x: swipeHandlers.dragOffset }}
            >
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "linear" }}
                >
                    <div className="flex bg-black/5 rounded-2xl p-1 mb-6">
                        {tabs.map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setMoneyView(tab)}
                                className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${moneyView === tab ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-black/40 hover:text-black'}`}
                            >
                                {tab === 'wallets' && <WalletIcon className="w-4 h-4" />}
                                {tab === 'transactions' && <List className="w-4 h-4" />}
                                {tab === 'budget' && <PieChart className="w-4 h-4" />}
                                <span className="capitalize hidden sm:inline">{tab === 'transactions' ? 'Transactions' : tab}</span>
                            </button>
                        ))}
                    </div>

                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <div className="text-sm font-bold opacity-60 uppercase tracking-wider">Total Net Worth</div>
                            <button onClick={() => setShowBalance(!showBalance)} className="opacity-60 hover:opacity-100 transition-opacity">
                                {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="text-4xl font-bold mb-6 tracking-tight">{showBalance ? fmt(totalNetWorth) : '••••••••'}</div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div 
                                className="bg-black/5 rounded-[24px] p-4 flex flex-col justify-center touch-pan-y"
                                onTouchStart={dateSwipeHandlers.onTouchStart}
                                onTouchMove={dateSwipeHandlers.onTouchMove}
                                onTouchEnd={dateSwipeHandlers.onTouchEnd}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-black/10 rounded-full transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                                    
                                    <AnimatePresence mode="wait">
                                        <motion.div 
                                            key={financeDate.toISOString()}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.2 }}
                                            className="flex flex-col items-center"
                                        >
                                            <span className="text-xs font-bold opacity-60 uppercase tracking-wider leading-none mb-1">
                                                {financeDate.getFullYear()}
                                            </span>
                                            <span className="text-xl font-bold leading-none">
                                                {financeDate.toLocaleDateString(undefined, { month: 'long' })}
                                            </span>
                                        </motion.div>
                                    </AnimatePresence>

                                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-black/10 rounded-full transition-colors"><ChevronRight className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="bg-black/5 rounded-[24px] p-4">
                                <div className="flex items-center gap-1 text-xs font-bold opacity-60 uppercase tracking-wider mb-1"><TrendingDown className="w-4 h-4 text-[#FF5722]" /> Expense</div>
                                <div className="text-xl font-bold text-[#FF5722]">{showBalance ? fmt(totalExpense) : '••••'}</div>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 pt-4 border-t border-black/10 dark:border-white/10 items-center justify-between">
                            <div className="flex gap-4">
                                <div className="text-sm font-medium opacity-80">
                                Assets: <span className="text-emerald-600 dark:text-emerald-500 font-bold">{showBalance ? fmt(totalAssets) : '••'}</span>
                                </div>
                                <div className="text-sm font-medium opacity-80">
                                Debt: <span className="text-[#FF5722] font-bold">{showBalance ? fmt(totalDebt) : '••'}</span>
                                </div>
                                <div className="text-sm font-medium opacity-80 flex items-center gap-1">
                                    Savings: <span className="text-[#6366F1] font-bold">{showBalance ? fmt(totalSavings || 0) : '••'}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => onAddItem(ItemType.FINANCE)}
                                className="w-10 h-10 flex items-center justify-center bg-black dark:bg-zinc-800 text-white dark:text-white rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
            
            {/* Sliding Container */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } }}
                className="touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <motion.div 
                    className="flex w-full will-change-transform"
                    style={{
                        transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
                        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                    {/* VIEW: Wallets */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex-shrink-0 px-4"
                    >
                        <div className="space-y-4">
                            {walletStats.map(wallet => (
                                <div 
                                    key={wallet.id} 
                                    className="bg-surface rounded-[24px] p-4 shadow-sm transition-all hover:bg-surface/80 relative group"
                                >
                                    <div className="flex flex-col gap-1">
                                        {/* Header */}
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-5 h-5 rounded-full ${wallet.color} flex items-center justify-center text-white`}>
                                                    {wallet.type === 'bank' ? <PiggyBank className="w-3 h-3" /> : 
                                                        wallet.type === 'cc' ? <CreditCard className="w-3 h-3" /> : 
                                                        wallet.type === 'ewallet' ? <WalletIcon className="w-3 h-3" /> :
                                                        <WalletIcon className="w-3 h-3" />}
                                                </div>
                                                <span className="text-sm font-semibold capitalize text-primary opacity-70">
                                                    {wallet.type}
                                                </span>
                                            </div>
                                            
                                            <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleOpenEditWallet(wallet)}
                                                    className="p-1.5 hover:bg-muted/10 rounded-xl text-muted hover:text-primary transition-colors"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => { setDeleteId(wallet.id); setDeleteType('wallet'); }}
                                                    className="p-1.5 hover:bg-red-900/30 rounded-xl text-muted hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="flex justify-between items-start gap-4 mt-1">
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <div className="text-base font-medium text-primary truncate">
                                                    {wallet.name}
                                                </div>
                                                {wallet.type === 'cc' && (
                                                    <div className="mt-1">
                                                        <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Debt Account</span>
                                                    </div>
                                                )}
                                                {(() => {
                                                    const walletSavings = savingGoals
                                                        .filter(g => g.meta.dedicatedWalletId === wallet.id)
                                                        .reduce((sum, g) => sum + (g.meta.savedAmount || 0), 0);
                                                    
                                                    if (walletSavings > 0) {
                                                        return (
                                                            <div className="mt-1">
                                                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                    Savings: {showBalance ? fmt(walletSavings) : '••••'}
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                            <div className="text-base font-bold shrink-0 mt-0.5 text-primary">
                                                {showBalance ? fmt(wallet.currentBalance) : '••••••••'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button onClick={handleOpenAddWallet} className="w-full border border-dashed border-border rounded-3xl flex items-center justify-center p-4 hover:border-primary/30 hover:bg-surface/50 transition-all text-muted hover:text-primary gap-2">
                                <Plus className="w-5 h-5" />
                                <span className="text-sm font-medium">Add Wallet</span>
                            </button>
                        </div>
                    </motion.div>

                    {/* VIEW: Transactions */}
                    <motion.div 
                        key={"transactions-" + financeDate.toISOString()}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="w-full flex-shrink-0 px-4"
                    >
                        <div>
                            {list.length === 0 ? <div className="text-center text-muted py-10">No transactions recorded.</div> : (
                                <div className="space-y-2">
                                    {list.map(item => {
                                        const categoryName = budgetConfig.rules.find(r => r.id === item.meta.budgetCategory)?.name || item.meta.budgetCategory;
                                        return (
                                            <Card 
                                            key={item.id} 
                                            item={item} 
                                            {...cardProps}
                                            categoryName={categoryName}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* VIEW: Budget Dashboard */}
                    <motion.div 
                        key={"budget-" + financeDate.toISOString()}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="w-full flex-shrink-0 px-4 pb-8"
                    >
                        {effectiveIncome === 0 ? (
                            <div className="text-center p-6 bg-surface border border-border rounded-3xl">
                                <PiggyBank className="w-8 h-8 text-muted mx-auto mb-2" />
                                <p className="text-sm text-muted">Set a <strong>Monthly Income</strong> in Settings <br/>or record Income to see your budget breakdown.</p>
                                <button onClick={() => setIsSettingsOpen(true)} className="mt-4 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-semibold hover:bg-primary/20">
                                    Set Income
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-[#222224] border border-zinc-200 dark:border-none rounded-[32px] p-6 text-zinc-900 dark:text-white shadow-xl">
                                {/* Header */}
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-3xl font-bold tracking-tight">
                                        {budgetConfig.rules.length} Categories
                                    </h2>
                                    <div className="flex bg-zinc-100 dark:bg-white/20 rounded-full p-1 cursor-pointer">
                                        <button 
                                            onClick={() => setBudgetViewMode('monthly')}
                                            className={`${budgetViewMode === 'monthly' ? 'bg-white dark:bg-white text-black' : 'text-zinc-500 dark:text-white/60'} rounded-full px-3 py-1 text-xs font-bold transition-colors`}
                                        >
                                            M
                                        </button>
                                        <button 
                                            onClick={() => setBudgetViewMode('yearly')}
                                            className={`${budgetViewMode === 'yearly' ? 'bg-white dark:bg-white text-black' : 'text-zinc-500 dark:text-white/60'} rounded-full px-3 py-1 text-xs font-bold transition-colors`}
                                        >
                                            Y
                                        </button>
                                    </div>
                                </div>

                                {/* Basis Fixed Income & Planned Spending */}
                                <div className="flex justify-between items-end mb-8 pb-6 border-b border-zinc-100 dark:border-white/10">
                                    <div>
                                        <div className="text-zinc-500 dark:text-white/60 text-sm mb-1 font-medium">Basis: {incomeLabel}</div>
                                        <div className="text-xl font-bold">{showBalance ? fmt(effectiveIncome) : '••••'}</div>
                                    </div>
                                    {projectedExpense > 0 && (
                                        <div className="text-right">
                                            <div className="text-zinc-500 dark:text-white/60 text-sm mb-1 font-medium">Planned</div>
                                            <div className="text-xl font-bold text-amber-600 dark:text-amber-500">{showBalance ? fmt(projectedExpense) : '••••'}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Categories List */}
                                <div className="space-y-6">
                                    {budgetConfig.rules.map(rule => {
                                        const spent = budgetMap.get(rule.id) || 0;
                                        const planned = plannedBudgetMap.get(rule.id) || 0;
                                        const limit = effectiveIncome * (rule.percentage / 100);
                                        
                                        // Calculate percentages relative to TOTAL income for the bars
                                        const percentageOfTotalSpent = effectiveIncome > 0 ? (spent / effectiveIncome) * 100 : 0;
                                        const percentageOfTotalPlanned = effectiveIncome > 0 ? (planned / effectiveIncome) * 100 : 0;
                                        
                                        // Calculate percentage relative to CATEGORY limit for the text display
                                        const percentageOfCategorySpent = limit > 0 ? (spent / limit) * 100 : 0;
                                        
                                        const textColorClass = rule.color ? rule.color.replace('bg-', 'text-') : 'text-gray-400';

                                        return (
                                            <div key={rule.id}>
                                                <div className={`flex items-center gap-2 text-sm font-semibold mb-1 ${textColorClass}`}>
                                                    <div className={`w-2 h-2 rounded-full ${rule.color || 'bg-gray-500'}`}></div>
                                                    {rule.name}
                                                </div>
                                                <div className={`text-sm font-bold mb-2 ${textColorClass} flex items-center justify-between`}>
                                                    <div>
                                                        {percentageOfCategorySpent.toFixed(1)} % <span className="text-zinc-400 dark:text-white/40 font-normal text-xs ml-1">({showBalance ? fmt(spent) : '•••'} / {showBalance ? fmt(limit) : '•••'})</span>
                                                    </div>
                                                    {planned > 0 && (
                                                        <div className="text-amber-600 dark:text-amber-500 font-medium text-[10px] uppercase tracking-wider">
                                                            Planned: {showBalance ? fmt(planned) : '•••'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="h-3 w-full bg-zinc-100 dark:bg-white/20 rounded-full overflow-hidden flex relative">
                                                    <div className={`h-full ${rule.color || 'bg-gray-500'}`} style={{ width: `${Math.min(percentageOfTotalSpent, 100)}%` }}></div>
                                                    {planned > 0 && (
                                                        <div className={`h-full ${rule.color || 'bg-gray-500'} opacity-40 bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] dark:bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)]`} style={{ width: `${Math.min(percentageOfTotalPlanned, 100 - Math.min(percentageOfTotalSpent, 100))}%` }}></div>
                                                    )}
                                                    {/* Limit Marker at the rule's percentage of total */}
                                                    <div 
                                                        className="h-full w-0.5 bg-zinc-400 dark:bg-white z-20 absolute top-0 shadow-[0_0_4px_rgba(0,0,0,0.2)]"
                                                        style={{ left: `${rule.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Uncategorized */}
                                    {(uncategorized > 0 || projectedUncategorized > 0) && (
                                        <div className="pt-4 border-t border-zinc-100 dark:border-white/10 mt-4">
                                            <div className="flex items-center gap-2 text-sm font-semibold mb-1 text-gray-400">
                                                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                                Other
                                            </div>
                                            <div className="text-sm font-bold mb-2 text-gray-400 flex items-center justify-between">
                                                <div>
                                                    {effectiveIncome > 0 ? ((uncategorized / effectiveIncome) * 100).toFixed(1) : 0} % <span className="text-zinc-400 dark:text-white/40 font-normal text-xs ml-1">({showBalance ? fmt(uncategorized) : '•••'})</span>
                                                </div>
                                                {projectedUncategorized > 0 && (
                                                    <div className="text-amber-600 dark:text-amber-500 font-medium text-[10px] uppercase tracking-wider">
                                                        Planned: {showBalance ? fmt(projectedUncategorized) : '•••'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="h-3 w-full bg-zinc-100 dark:bg-white/20 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-gray-400" style={{ width: `${Math.min((uncategorized / effectiveIncome) * 100, 100)}%` }}></div>
                                                {projectedUncategorized > 0 && (
                                                    <div className="h-full bg-gray-400 opacity-40 bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] dark:bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)]" style={{ width: `${Math.min((projectedUncategorized / effectiveIncome) * 100, 100 - Math.min((uncategorized / effectiveIncome) * 100, 100))}%` }}></div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default MoneyViewComponent;