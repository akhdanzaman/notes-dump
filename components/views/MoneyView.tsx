import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff, Eye, TrendingUp, TrendingDown, Wallet as WalletIcon, List, PieChart, Pencil, Trash2, PiggyBank, CreditCard, ChevronLeft, ChevronRight, Calculator, Plus, AlertCircle } from 'lucide-react';
import { BrainDumpItem, Wallet, BudgetConfig, MoneyView, AppSettings, SortOrder, FinanceType, ItemType, Tab, Priority } from '../../types';
import { getWalletStats, getFinanceItems } from '../../utils/selectors';
import Card from '../Card';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';
import { useLazyItems } from '../../hooks/useLazyItems';
import LoadMoreButton from '../LoadMoreButton';
import { contentSurface } from '../layout/contentSurface';

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
        newDedicatedWalletId?: string,
        newPriority?: Priority
    ) => void;
    handleToggleStatus: (id: string) => void;
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
    handleDelete, handleUpdateItem, handleToggleStatus, handleOpenEditWallet, handleOpenAddWallet,
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
        budgetViewMode,
        wallets
    );

    const visibleWallets = useLazyItems(walletStats, {
        resetKey: `money-wallets-${walletStats.length}-${savingGoals.length}`,
    });
    const visibleTransactions = useLazyItems(list, {
        resetKey: `money-transactions-${financeDate.getFullYear()}-${financeDate.getMonth()}-${filterWallet}-${filterTransactionType}-${filterCategory}-${filterMinAmount}-${filterMaxAmount}-${selectedTag}-${searchQuery}-${sortOrder}-${list.length}`,
    });

    const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
               
    const effectiveIncome = budgetConfig.monthlyIncome > 0 
        ? (budgetViewMode === 'yearly' ? budgetConfig.monthlyIncome * 12 : budgetConfig.monthlyIncome) 
        : totalIncome;
    const incomeLabel = budgetConfig.monthlyIncome > 0 
        ? (budgetViewMode === 'yearly' ? 'Fixed Income (Yearly)' : 'Fixed Income') 
        : 'Recorded Income';
    const monthUsagePercent = effectiveIncome > 0 ? Math.min(999, (totalExpense / effectiveIncome) * 100) : 0;

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
        onToggleStatus: handleToggleStatus,
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
        <div className={contentSurface.pageShell}>
            {/* Top Container */}
            <motion.div 
                layoutId="top-container"
                data-swipe-tabs="money"
                className={contentSurface.headerHero}
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
                    <div data-money-tabs="true" className="flex bg-black/5 dark:bg-white/20 rounded-2xl p-1 mb-5 lg:max-w-2xl">
                        {tabs.map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setMoneyView(tab)}
                                className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${moneyView === tab ? 'bg-surface text-primary' : 'text-primary/40 hover:text-primary'}`}
                            >
                                {tab === 'wallets' && <WalletIcon className="w-4 h-4" />}
                                {tab === 'transactions' && <List className="w-4 h-4" />}
                                {tab === 'budget' && <PieChart className="w-4 h-4" />}
                                <span className="capitalize hidden sm:inline">{tab === 'transactions' ? 'Transactions' : tab}</span>
                            </button>
                        ))}
                    </div>

                    <div className={contentSurface.moneyHeaderGrid} data-money-header-grid="true">
                        <section className="min-w-0 flex flex-col justify-between rounded-[28px] bg-black/5 p-4 lg:p-5 xl:p-6">
                            <div>
                                <div className="flex justify-between items-start gap-4 mb-2">
                                    <div>
                                        <div className="text-sm font-bold opacity-60 uppercase tracking-wider">Total Net Worth</div>
                                        <div className="text-xs font-medium opacity-50">Assets, debt, and savings across wallets</div>
                                    </div>
                                    <div 
                                        data-swipe-date="money-month"
                                        className="shrink-0 rounded-2xl bg-surface/65 px-2 py-2 touch-pan-y"
                                        onTouchStart={dateSwipeHandlers.onTouchStart}
                                        onTouchMove={dateSwipeHandlers.onTouchMove}
                                        onTouchEnd={dateSwipeHandlers.onTouchEnd}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-black/10 rounded-full transition-colors" aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></button>
                                            <AnimatePresence mode="wait">
                                                <motion.div 
                                                    key={financeDate.toISOString()}
                                                    data-money-month-label="true"
                                                    initial={{ opacity: 0, x: 10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -10 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="flex min-w-20 flex-col items-center"
                                                >
                                                    <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider leading-none mb-1">
                                                        {financeDate.getFullYear()}
                                                    </span>
                                                    <span className="text-sm font-bold leading-none sm:text-base">
                                                        {financeDate.toLocaleDateString(undefined, { month: 'short' })}
                                                    </span>
                                                </motion.div>
                                            </AnimatePresence>
                                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-black/10 rounded-full transition-colors" aria-label="Next month"><ChevronRight className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-5 flex min-w-0 items-center justify-between gap-3">
                                    <div className="truncate text-4xl font-bold tracking-tight xl:text-5xl">{showBalance ? fmt(totalNetWorth) : '••••••••'}</div>
                                    <button onClick={() => setShowBalance(!showBalance)} className="shrink-0 rounded-full p-2 opacity-60 hover:bg-black/10 hover:opacity-100 transition-all" aria-label={showBalance ? 'Hide balance' : 'Show balance'}>
                                        {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className={contentSurface.moneyMetricGrid} data-money-metric-grid="true">
                                <div className="min-w-0 rounded-[22px] bg-surface/65 p-3 lg:p-4">
                                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold opacity-60 uppercase tracking-wider lg:text-xs"><TrendingUp className="w-4 h-4 shrink-0 text-emerald-500" /> Income</div>
                                    <div className="truncate text-lg font-bold text-emerald-600 dark:text-emerald-500 lg:text-xl">{showBalance ? fmt(totalIncome) : '••••'}</div>
                                </div>
                                <div className="min-w-0 rounded-[22px] bg-surface/65 p-3 lg:p-4">
                                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold opacity-60 uppercase tracking-wider lg:text-xs"><TrendingDown className="w-4 h-4 shrink-0 text-[#FF5722]" /> Expense</div>
                                    <div className="truncate text-lg font-bold text-[#FF5722] lg:text-xl">{showBalance ? fmt(totalExpense) : '••••'}</div>
                                </div>
                                <div className="min-w-0 rounded-[22px] bg-surface/65 p-3 lg:p-4">
                                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold opacity-60 uppercase tracking-wider lg:text-xs"><AlertCircle className="w-4 h-4 shrink-0 text-amber-500" /> Used</div>
                                    <div className="truncate text-lg font-bold text-primary lg:text-xl">{effectiveIncome > 0 ? `${monthUsagePercent.toFixed(0)}%` : '—'}</div>
                                </div>
                            </div>
                        </section>

                        <aside className="rounded-[28px] bg-black/5 p-4 lg:p-5" data-money-header-side-card="true">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="min-w-0 rounded-[18px] bg-surface/65 p-3 text-center">
                                    <div className="mb-1 truncate text-[10px] font-bold uppercase tracking-wider opacity-60">Assets</div>
                                    <div className="truncate text-sm font-bold text-emerald-600 dark:text-emerald-500">{showBalance ? fmt(totalAssets) : '••'}</div>
                                </div>
                                <div className="min-w-0 rounded-[18px] bg-surface/65 p-3 text-center">
                                    <div className="mb-1 truncate text-[10px] font-bold uppercase tracking-wider opacity-60">Debt</div>
                                    <div className="truncate text-sm font-bold text-[#FF5722]">{showBalance ? fmt(totalDebt) : '••'}</div>
                                </div>
                                <div className="min-w-0 rounded-[18px] bg-surface/65 p-3 text-center">
                                    <div className="mb-1 truncate text-[10px] font-bold uppercase tracking-wider opacity-60">Savings</div>
                                    <div className="truncate text-sm font-bold text-[#6366F1]">{showBalance ? fmt(totalSavings || 0) : '••'}</div>
                                </div>
                            </div>

                            <button 
                                onClick={() => onAddItem(ItemType.FINANCE)}
                                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-95 dark:bg-zinc-800 dark:text-white"
                            >
                                <Plus className="w-5 h-5" />
                                Add finance
                            </button>
                        </aside>
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
                        className={`w-full flex-shrink-0 ${contentSurface.contentPad}`}
                    >
                        <div className={contentSurface.cardGrid}>
                            {visibleWallets.visibleItems.map(wallet => (
                                <div 
                                    key={wallet.id} 
                                    className="bg-surface rounded-[24px] p-4 transition-all hover:bg-surface/80 relative group"
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
                                                        .filter(g => g.status !== 'done')
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

                            <LoadMoreButton remainingCount={visibleWallets.remainingCount} onClick={visibleWallets.loadMore} />

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
                        className={`w-full flex-shrink-0 ${contentSurface.contentPad}`}
                    >
                        <div className={contentSurface.moneyWorkspaceGrid} data-money-workspace="transactions">
                            {list.length === 0 ? <div className={`${contentSurface.emptyStateCard} ${contentSurface.moneyPrimaryPanel}`}>No transactions recorded.</div> : (
                                <div className={`${contentSurface.denseList} ${contentSurface.moneyPrimaryPanel}`} data-money-primary-column="true">
                                    {visibleTransactions.visibleItems.map(item => {
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
                                    <LoadMoreButton remainingCount={visibleTransactions.remainingCount} onClick={visibleTransactions.loadMore} className="mt-4" />
                                </div>
                            )}
                            <aside className={contentSurface.moneySideCard} data-money-side-card="filters">
                                <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-muted">Filters</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between gap-3"><span>Wallet</span><strong className="text-primary">{filterWallet || 'All'}</strong></div>
                                    <div className="flex justify-between gap-3"><span>Type</span><strong className="text-primary capitalize">{filterTransactionType || 'All'}</strong></div>
                                    <div className="flex justify-between gap-3"><span>Category</span><strong className="text-primary">{filterCategory || 'All'}</strong></div>
                                    {(filterMinAmount || filterMaxAmount) && (
                                        <div className="flex justify-between gap-3"><span>Amount</span><strong className="text-primary">{filterMinAmount || '0'} - {filterMaxAmount || '∞'}</strong></div>
                                    )}
                                    {selectedTag && <div className="flex justify-between gap-3"><span>Tag</span><strong className="text-primary">#{selectedTag}</strong></div>}
                                    {searchQuery && <div className="flex justify-between gap-3"><span>Search</span><strong className="text-primary truncate">{searchQuery}</strong></div>}
                                </div>
                                <div className="mt-4 border-t border-border pt-4 text-xs leading-relaxed">
                                    Desktop keeps the same Floating Search filters; this panel mirrors active state for scanability.
                                </div>
                            </aside>
                        </div>
                    </motion.div>

                    {/* VIEW: Budget Dashboard */}
                    <motion.div 
                        key={"budget-" + financeDate.toISOString()}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className={`w-full flex-shrink-0 ${contentSurface.contentPad} pb-8`}
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
                            <div className="bg-surface border border-border rounded-[32px] p-6 text-primary">
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
                                <div className="flex justify-between items-end mb-8 pb-6 border-b border-border">
                                    <div>
                                        <div className="text-muted text-sm mb-1 font-medium">Basis: {incomeLabel}</div>
                                        <div className="text-xl font-bold">{showBalance ? fmt(effectiveIncome) : '••••'}</div>
                                    </div>
                                    {projectedExpense > 0 && (
                                        <div className="text-right">
                                            <div className="text-muted text-sm mb-1 font-medium">Planned</div>
                                            <div className="text-xl font-bold text-amber-500">{showBalance ? fmt(projectedExpense) : '••••'}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Categories List */}
                                <div className="space-y-6">
                                    {budgetConfig.rules?.map(rule => {
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
                                                        {percentageOfCategorySpent.toFixed(1)} % <span className="text-muted font-normal text-xs ml-1">({showBalance ? fmt(spent) : '•••'} / {showBalance ? fmt(limit) : '•••'})</span>
                                                    </div>
                                                    {planned > 0 && (
                                                        <div className="text-amber-500 font-medium text-[10px] uppercase tracking-wider">
                                                            Planned: {showBalance ? fmt(planned) : '•••'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="h-3 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex relative">
                                                    <div className={`h-full ${rule.color || 'bg-gray-500'}`} style={{ width: `${Math.min(percentageOfTotalSpent, 100)}%` }}></div>
                                                    {planned > 0 && (
                                                        <div className={`h-full ${rule.color || 'bg-gray-500'} opacity-40 bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] dark:bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)]`} style={{ width: `${Math.min(percentageOfTotalPlanned, 100 - Math.min(percentageOfTotalSpent, 100))}%` }}></div>
                                                    )}
                                                    {/* Limit Marker at the rule's percentage of total */}
                                                    <div 
                                                        className="h-full w-0.5 bg-zinc-400 dark:bg-white z-20 absolute top-0"
                                                        style={{ left: `${rule.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Uncategorized */}
                                    {(uncategorized > 0 || projectedUncategorized > 0) && (
                                        <div className="pt-4 border-t border-border mt-4">
                                            <div className="flex items-center gap-2 text-sm font-semibold mb-1 text-gray-400">
                                                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                                Other
                                            </div>
                                            <div className="text-sm font-bold mb-2 text-gray-400 flex items-center justify-between">
                                                <div>
                                                    {effectiveIncome > 0 ? ((uncategorized / effectiveIncome) * 100).toFixed(1) : 0} % <span className="text-muted font-normal text-xs ml-1">({showBalance ? fmt(uncategorized) : '•••'})</span>
                                                </div>
                                                {projectedUncategorized > 0 && (
                                                    <div className="text-amber-500 font-medium text-[10px] uppercase tracking-wider">
                                                        Planned: {showBalance ? fmt(projectedUncategorized) : '•••'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="h-3 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex">
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
