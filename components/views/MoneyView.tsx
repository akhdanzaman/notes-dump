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
import { getBudgetCategoryAnalytics, getBudgetTrendAnalytics } from '../../utils/budgetAnalytics';

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

    const [budgetViewMode, setBudgetViewMode] = useState<'monthly' | 'yearly'>('monthly');

    // Date Swipe Logic
    const changePeriod = (offset: number) => {
        const newDate = new Date(financeDate);
        if (moneyView === 'budget' && budgetViewMode === 'yearly') {
            newDate.setFullYear(newDate.getFullYear() + offset);
        } else {
            newDate.setMonth(newDate.getMonth() + offset);
        }
        setFinanceDate(newDate);
    };
    
    const dateSwipeHandlers = useSwipeDate(
        () => changePeriod(-1), // Swipe Right -> Prev Period
        () => changePeriod(1)   // Swipe Left -> Next Period
    );

    // Sub-Tab Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

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
    const monthUsageWithPlannedPercent = effectiveIncome > 0 ? Math.min(999, ((totalExpense + projectedExpense) / effectiveIncome) * 100) : 0;
    const budgetCategoryAnalytics = useMemo(
        () => getBudgetCategoryAnalytics(items, financeDate, budgetConfig, budgetViewMode),
        [items, financeDate, budgetConfig, budgetViewMode]
    );
    const budgetTrendAnalytics = useMemo(
        () => getBudgetTrendAnalytics(items, financeDate, budgetViewMode, budgetConfig),
        [items, financeDate, budgetViewMode, budgetConfig]
    );
    const showBudgetYearSelector = moneyView === 'budget' && budgetViewMode === 'yearly';
    const selectedPeriodTotal = budgetTrendAnalytics.reduce((sum, point) => sum + point.total, 0);
    const previousPeriodTotal = budgetTrendAnalytics.reduce((sum, point) => sum + (point.previousTotal || 0), 0);
    const peakTrendPoint = budgetTrendAnalytics.reduce((peak, point) => point.total > peak.total ? point : peak, budgetTrendAnalytics[0] || { label: '—', total: 0, percentage: 0 });
    const hoveredTrendPoint = hoveredTrendIndex !== null ? budgetTrendAnalytics[hoveredTrendIndex] : undefined;
    const hoveredTrendLabel = hoveredTrendPoint
        ? (budgetViewMode === 'yearly'
            ? `${hoveredTrendPoint.label} ${financeDate.getFullYear()}`
            : `${hoveredTrendPoint.label} ${financeDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`)
        : undefined;
    const hoveredTrendTooltipLeft = hoveredTrendIndex !== null && budgetTrendAnalytics.length > 0
        ? Math.min(86, Math.max(14, ((hoveredTrendIndex + 0.5) / budgetTrendAnalytics.length) * 100))
        : 50;

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
                    <div data-money-tabs="true" className="mb-5 flex w-full bg-black/5 dark:bg-white/20 rounded-2xl p-1">
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

                    <div className="lg:space-y-6" data-money-header-grid="true">
                        <div className="mb-6 flex items-start justify-between gap-4 pb-2 lg:mb-0 lg:grid lg:grid-cols-8 lg:items-start lg:gap-4 lg:pb-3 xl:gap-5">
                            <div className="min-w-0 lg:col-span-6 lg:pt-1">
                                <div className="text-sm font-bold opacity-60 uppercase tracking-wider">Total Net Worth</div>
                                <div className="text-xs font-medium opacity-50">Assets, debt, and savings across wallets</div>
                                <div className="mt-2 flex min-w-0 items-center gap-3 lg:mt-3">
                                    <div className="truncate text-4xl font-bold tracking-tight lg:text-5xl">{showBalance ? fmt(totalNetWorth) : '••••••••'}</div>
                                    <button onClick={() => setShowBalance(!showBalance)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity" aria-label={showBalance ? 'Hide balance' : 'Show balance'}>
                                        {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div 
                                data-swipe-date="money-month"
                                className="shrink-0 rounded-[20px] bg-black/5 px-2 py-2 touch-pan-y sm:px-3 lg:col-span-2 lg:w-full lg:rounded-[24px] lg:px-4 lg:py-3"
                                onTouchStart={dateSwipeHandlers.onTouchStart}
                                onTouchMove={dateSwipeHandlers.onTouchMove}
                                onTouchEnd={dateSwipeHandlers.onTouchEnd}
                            >
                                <div className="flex items-center justify-between gap-1 lg:gap-2">
                                    <button onClick={() => changePeriod(-1)} className="p-1 hover:bg-black/10 rounded-full transition-colors lg:p-2" aria-label={showBudgetYearSelector ? 'Previous year' : 'Previous month'}><ChevronLeft className="w-4 h-4" /></button>
                                    <AnimatePresence mode="wait">
                                        <motion.div 
                                            key={`${showBudgetYearSelector ? 'year' : 'month'}-${financeDate.toISOString()}`}
                                            data-money-month-label="true"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.2 }}
                                            className="flex min-w-16 flex-col items-center sm:min-w-20 lg:min-w-24"
                                        >
                                            <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider leading-none mb-1 lg:text-xs">
                                                {showBudgetYearSelector ? 'Year' : financeDate.getFullYear()}
                                            </span>
                                            <span className="text-sm font-bold leading-none sm:text-base lg:text-lg">
                                                {showBudgetYearSelector ? financeDate.getFullYear() : financeDate.toLocaleDateString(undefined, { month: 'short' })}
                                            </span>
                                        </motion.div>
                                    </AnimatePresence>
                                    <button onClick={() => changePeriod(1)} className="p-1 hover:bg-black/10 rounded-full transition-colors lg:p-2" aria-label={showBudgetYearSelector ? 'Next year' : 'Next month'}><ChevronRight className="w-4 h-4" /></button>
                                </div>
                                {moneyView === 'budget' && (
                                    <div className="mt-2 flex bg-white/50 dark:bg-black/10 rounded-full p-1 cursor-pointer">
                                        <button 
                                            onClick={() => setBudgetViewMode('monthly')}
                                            className={`${budgetViewMode === 'monthly' ? 'bg-surface text-primary shadow-sm dark:bg-white dark:text-black' : 'text-primary/50 hover:text-primary'} flex-1 rounded-full px-3 py-1 text-xs font-bold transition-colors`}
                                        >
                                            M
                                        </button>
                                        <button 
                                            onClick={() => setBudgetViewMode('yearly')}
                                            className={`${budgetViewMode === 'yearly' ? 'bg-surface text-primary shadow-sm dark:bg-white dark:text-black' : 'text-primary/50 hover:text-primary'} flex-1 rounded-full px-3 py-1 text-xs font-bold transition-colors`}
                                        >
                                            Y
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-8 gap-3 mb-4 lg:mb-5 lg:gap-4 xl:gap-5">
                            <div className="col-span-3 min-w-0 bg-black/5 rounded-[24px] px-3 py-4 lg:px-5 lg:py-5">
                                <div className="flex items-center gap-1 text-xs font-bold opacity-60 uppercase tracking-wider mb-1 lg:mb-2"><TrendingUp className="w-4 h-4 shrink-0 text-emerald-500" /> Income</div>
                                <div className="truncate text-lg font-bold text-emerald-600 dark:text-emerald-500 lg:text-2xl">{showBalance ? fmt(totalIncome) : '••••'}</div>
                            </div>
                            <div className="col-span-3 min-w-0 bg-black/5 rounded-[24px] px-3 py-4 lg:px-5 lg:py-5">
                                <div className="flex items-center gap-1 text-xs font-bold opacity-60 uppercase tracking-wider mb-1 lg:mb-2"><TrendingDown className="w-4 h-4 shrink-0 text-[#FF5722]" /> Expense</div>
                                <div className="truncate text-lg font-bold text-[#FF5722] lg:text-2xl">{showBalance ? fmt(totalExpense) : '••••'}</div>
                            </div>
                            <div className="col-span-2 min-w-0 bg-black/5 rounded-[24px] px-3 py-4 lg:px-5 lg:py-5">
                                <div className="flex items-center justify-center gap-1 text-[10px] font-bold opacity-60 uppercase tracking-wider mb-1 lg:mb-2 lg:justify-start lg:text-xs"><AlertCircle className="hidden w-4 h-4 shrink-0 text-amber-500 lg:block" /> Used</div>
                                <div className="flex items-baseline justify-center gap-1 truncate lg:justify-start">
                                    <span className="truncate text-lg font-bold text-primary lg:text-2xl">{effectiveIncome > 0 ? `${monthUsagePercent.toFixed(0)}%` : '—'}</span>
                                    {effectiveIncome > 0 && projectedExpense > 0 && (
                                        <>
                                            <span className="text-sm font-bold text-muted/50 lg:text-base">|</span>
                                            <span className="truncate text-sm font-semibold leading-tight text-amber-500 lg:text-base">{`${monthUsageWithPlannedPercent.toFixed(0)}%`}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 pt-4 border-t border-border items-center justify-between" data-money-header-side-card="true">
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
                                className="w-10 h-10 flex items-center justify-center bg-black dark:bg-zinc-800 text-white dark:text-white rounded-full hover:scale-110 active:scale-95 transition-all"
                                aria-label="Add finance"
                                title="Add finance"
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
                            <div className="space-y-6 text-primary">
                                <div className="bg-surface border border-border rounded-[32px] p-6 text-primary">
                                    <div className="mb-6 flex items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-3xl font-bold tracking-tight">Spend Timeline</h2>
                                            <div className="mt-1 text-sm font-semibold text-muted">{budgetViewMode === 'yearly' ? 'Monthly spend with YoY comparison' : 'Daily spend across the selected month'}</div>
                                        </div>
                                        <TrendingUp className="h-6 w-6 text-muted" />
                                    </div>

                                    <div className="rounded-3xl border border-border bg-black/[0.02] p-4 dark:bg-white/[0.04]">
                                        <div className="mb-4 flex items-end justify-between gap-4">
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">{budgetViewMode === 'yearly' ? 'YoY Trend' : 'Month Trend'}</div>
                                                <div className="mt-1 text-xl font-bold">{showBalance ? fmt(selectedPeriodTotal) : '••••'}</div>
                                            </div>
                                            <div className="text-right text-xs text-muted">
                                                <div>Peak: <span className="font-bold text-primary">{peakTrendPoint.label}</span></div>
                                                {budgetViewMode === 'yearly' && previousPeriodTotal > 0 && (
                                                    <div>Prev year: <span className="font-bold text-amber-500">{showBalance ? fmt(previousPeriodTotal) : '••••'}</span></div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
                                            <span>Hover bars untuk lihat spend, income, dan kategori.</span>
                                            <span className="font-semibold">Peak {peakTrendPoint.label}</span>
                                        </div>

                                        <div className="relative flex h-40 items-end gap-1 rounded-2xl bg-white/50 px-2 pb-2 pt-14 dark:bg-black/10">
                                            {hoveredTrendPoint && (
                                                <div
                                                    className="pointer-events-none absolute top-2 z-20 w-64 -translate-x-1/2 rounded-2xl border border-border bg-surface/95 p-3 text-xs shadow-xl shadow-black/10 backdrop-blur dark:shadow-black/30"
                                                    style={{ left: `${hoveredTrendTooltipLeft}%` }}
                                                >
                                                    <div className="mb-2 flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="font-bold text-primary">{hoveredTrendLabel}</div>
                                                            {budgetViewMode === 'yearly' && hoveredTrendPoint.previousTotal !== undefined && (
                                                                <div className="mt-0.5 text-[10px] font-semibold text-amber-500">
                                                                    Prev spend {showBalance ? fmt(hoveredTrendPoint.previousTotal) : '••••'}
                                                                    {hoveredTrendPoint.previousIncome !== undefined ? ` · income ${showBalance ? fmt(hoveredTrendPoint.previousIncome) : '••••'}` : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-[#FF5722]">{showBalance ? fmt(hoveredTrendPoint.total) : '••••'}</div>
                                                            <div className="font-semibold text-emerald-600 dark:text-emerald-500">{showBalance ? fmt(hoveredTrendPoint.income) : '••••'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="border-t border-border pt-2">
                                                        <div className="mb-1 font-bold uppercase tracking-[0.14em] text-muted">Categories</div>
                                                        {hoveredTrendPoint.categories.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {hoveredTrendPoint.categories.map(category => (
                                                                    <div key={`${hoveredTrendLabel}-${category.name}`} className="flex items-center justify-between gap-2">
                                                                        <span className="truncate text-muted">{category.name}</span>
                                                                        <span className="shrink-0 font-bold text-primary">{showBalance ? fmt(category.total) : '••••'}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-muted">No category spend</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {budgetTrendAnalytics.map((point, index) => {
                                                const showLabel = budgetViewMode === 'yearly' || index === 0 || index === Math.floor(budgetTrendAnalytics.length / 2) || index === budgetTrendAnalytics.length - 1;
                                                const isHovered = hoveredTrendIndex === index;
                                                return (
                                                    <div
                                                        key={`${point.label}-${index}`}
                                                        onMouseEnter={() => setHoveredTrendIndex(index)}
                                                        onMouseLeave={() => setHoveredTrendIndex(null)}
                                                        className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                                                    >
                                                        <div className="relative flex h-20 w-full items-end justify-center">
                                                            {budgetViewMode === 'yearly' && point.previousTotal !== undefined && point.previousTotal > 0 && (
                                                                <div
                                                                    className={`absolute bottom-0 w-1/2 rounded-t-full bg-amber-400/40 transition-all ${isHovered ? 'bg-amber-400/70' : ''}`}
                                                                    style={{ height: `${Math.max(point.previousPercentage || 0, 3)}%` }}
                                                                />
                                                            )}
                                                            <div
                                                                className={`relative z-10 w-full max-w-3 rounded-t-full bg-primary/80 transition-all group-hover:bg-primary group-focus:bg-primary ${isHovered ? 'max-w-4 bg-primary shadow-sm' : ''}`}
                                                                style={{ height: `${point.total > 0 ? Math.max(point.percentage, 4) : 1}%` }}
                                                            />
                                                        </div>
                                                        <div className={`h-3 text-[9px] font-bold uppercase leading-none ${showLabel || isHovered ? 'text-muted' : 'text-transparent'}`}>{point.label}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {budgetViewMode === 'yearly' && previousPeriodTotal > 0 && (
                                            <div className="mt-3 flex items-center gap-4 text-[11px] font-semibold text-muted">
                                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary/80"></span>{financeDate.getFullYear()}</span>
                                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400/50"></span>{financeDate.getFullYear() - 1}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>


                                <div className={`grid gap-6 ${budgetCategoryAnalytics.length > 0 ? 'lg:grid-cols-2 lg:items-start' : ''}`}>
                                <div className="bg-surface border border-border rounded-[32px] p-6 text-primary">
                                {/* Header */}
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-3xl font-bold tracking-tight">
                                        {budgetConfig.rules.length} Categories
                                    </h2>
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
                                        const percentageOfCategoryUsedPlanned = limit > 0 ? ((spent + planned) / limit) * 100 : 0;
                                        
                                        const textColorClass = rule.color ? rule.color.replace('bg-', 'text-') : 'text-gray-400';

                                        return (
                                            <div key={rule.id}>
                                                <div className={`flex items-center gap-2 text-sm font-semibold mb-1 ${textColorClass}`}>
                                                    <div className={`w-2 h-2 rounded-full ${rule.color || 'bg-gray-500'}`}></div>
                                                    {rule.name}
                                                </div>
                                                <div className={`text-sm font-bold mb-2 ${textColorClass} flex items-center justify-between`}>
                                                    <div>
                                                        <div>
                                                            {percentageOfCategorySpent.toFixed(1)} % <span className="text-muted font-normal text-xs ml-1">({showBalance ? fmt(spent) : '•••'} / {showBalance ? fmt(limit) : '•••'})</span>
                                                        </div>
                                                        {planned > 0 && (
                                                            <div className="text-amber-500 font-semibold text-[11px] leading-tight mt-0.5">
                                                                {percentageOfCategoryUsedPlanned.toFixed(1)} %
                                                            </div>
                                                        )}
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
                                                    <div>
                                                        {effectiveIncome > 0 ? ((uncategorized / effectiveIncome) * 100).toFixed(1) : 0} % <span className="text-muted font-normal text-xs ml-1">({showBalance ? fmt(uncategorized) : '•••'})</span>
                                                    </div>
                                                    {projectedUncategorized > 0 && (
                                                        <div className="text-amber-500 font-semibold text-[11px] leading-tight mt-0.5">
                                                            {effectiveIncome > 0 ? (((uncategorized + projectedUncategorized) / effectiveIncome) * 100).toFixed(1) : 0} %
                                                        </div>
                                                    )}
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
                                {budgetCategoryAnalytics.length > 0 && (
                                    <div className="bg-surface border border-border rounded-[32px] p-6 text-primary">
                                        <div className="mb-6 flex items-start justify-between gap-4">
                                            <div>
                                                <h2 className="text-3xl font-bold tracking-tight">Spend Anatomy</h2>
                                                <div className="mt-1 text-sm font-semibold text-muted">Category → commodity → subcommodity</div>
                                            </div>
                                            <PieChart className="h-6 w-6 text-muted" />
                                        </div>

                                        <div className="space-y-4">
                                            {budgetCategoryAnalytics.slice(0, 3).map(category => (
                                                <div key={category.categoryId} className="space-y-2">
                                                    <div className="flex items-center justify-between gap-3 text-xs">
                                                        <div className="flex min-w-0 items-center gap-2 font-bold text-primary">
                                                            <span className={`h-2 w-2 rounded-full ${category.color || 'bg-gray-400'}`}></span>
                                                            <span className="truncate">{category.categoryName}</span>
                                                        </div>
                                                        <span className="shrink-0 font-semibold text-muted">{showBalance ? fmt(category.total) : '•••'}</span>
                                                    </div>
                                                    <div className="flex h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                                                        {category.commodities.map((commodity, index) => (
                                                            <div
                                                                key={`${category.categoryId}-${commodity.name}`}
                                                                className={`${index % 2 === 0 ? (category.color || 'bg-gray-500') : 'bg-amber-500'} ${index > 1 ? 'opacity-50' : index === 1 ? 'opacity-70' : ''}`}
                                                                style={{ width: `${Math.max(commodity.percentage, 3)}%` }}
                                                                title={`${commodity.name}: ${commodity.percentage.toFixed(1)}%`}
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {category.commodities.slice(0, 2).map(commodity => {
                                                            const topSubs = commodity.subcommodities
                                                                .slice(0, 2)
                                                                .map(sub => sub.name)
                                                                .join(' + ');
                                                            const topMerchants = commodity.merchants
                                                                .slice(0, 2)
                                                                .map(merchant => merchant.name)
                                                                .join(' / ');
                                                            return (
                                                                <div key={`${category.categoryId}-${commodity.name}-detail`} className="rounded-2xl bg-white/60 p-3 text-xs dark:bg-white/5">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="font-bold text-primary">{commodity.name}</span>
                                                                        <span className="font-semibold text-muted">{commodity.percentage.toFixed(0)}%</span>
                                                                    </div>
                                                                    <div className="mt-1 text-[11px] leading-snug text-muted">
                                                                        {topSubs ? `Dominated by ${topSubs}` : 'No subcommodity signal yet'}
                                                                        {topMerchants ? ` · Vendor: ${topMerchants}` : ''}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
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
