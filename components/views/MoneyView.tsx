import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff, Eye, TrendingUp, TrendingDown, Wallet as WalletIcon, List, PieChart, Pencil, Trash2, PiggyBank, CreditCard, ChevronLeft, ChevronRight, Plus, AlertCircle, MoreHorizontal } from 'lucide-react';
import { BrainDumpItem, Wallet, BudgetConfig, MoneyView, AppSettings, SortOrder, FinanceType, ItemType, Tab, Priority } from '../../types';
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
    clearMoneyFilters?: () => void;
    setFilterTransactionType?: (val: string) => void;
    savingGoals: BrainDumpItem[];
    setActiveTab: (tab: Tab) => void;
    onAddItem: (type: ItemType) => void;
}

const fmt = (n: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
}).format(n);

const formatMoneyDate = (dateInput?: string) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const getTransactionDate = (item: BrainDumpItem) => {
    if (item.type === ItemType.FINANCE) return item.meta.date || item.created_at;
    return item.completed_at || item.created_at;
};

const getTransactionKind = (item: BrainDumpItem) => {
    if (item.type === ItemType.SHOPPING) return 'shopping';
    if (item.meta.financeType) return item.meta.financeType;
    if (item.meta.amount) return 'expense';
    return 'expense';
};

const MoneyViewComponent: React.FC<MoneyViewProps> = ({
    items, wallets, budgetConfig, moneyView, setMoneyView,
    financeDate, setFinanceDate, showBalance, setShowBalance, appSettings,
    handleDelete, handleUpdateItem, handleToggleStatus, handleOpenEditWallet, handleOpenAddWallet,
    setDeleteId, setDeleteType, setIsSettingsOpen,
    filterWallet, filterTransactionType, filterCategory, filterMinAmount, filterMaxAmount, selectedTag, searchQuery, sortOrder,
    clearMoneyFilters, setFilterTransactionType,
    savingGoals, setActiveTab, onAddItem
}) => {
    const swipeHandlers = useSwipeTabs('money', setActiveTab);

    const changeMonth = (offset: number) => {
        const newDate = new Date(financeDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setFinanceDate(newDate);
    };

    const dateSwipeHandlers = useSwipeDate(
        () => changeMonth(-1),
        () => changeMonth(1)
    );

    const [budgetViewMode, setBudgetViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
    const [walletActionId, setWalletActionId] = useState<string | null>(null);

    const orderedTabs: MoneyView[] = ['transactions', 'wallets', 'budget'];

    const { walletStats, totalNetWorth, totalAssets, totalDebt, totalSavings } = getWalletStats(items, wallets);
    const {
        list,
        totalIncome,
        totalExpense,
        projectedExpense,
        budgetMap,
        plannedBudgetMap,
        uncategorized,
        projectedUncategorized,
    } = getFinanceItems(
        items,
        financeDate,
        budgetConfig,
        filterWallet,
        filterTransactionType,
        filterCategory,
        filterMinAmount,
        filterMaxAmount,
        selectedTag,
        searchQuery,
        sortOrder,
        budgetViewMode
    );

    const effectiveIncome = budgetConfig.monthlyIncome > 0
        ? (budgetViewMode === 'yearly' ? budgetConfig.monthlyIncome * 12 : budgetConfig.monthlyIncome)
        : totalIncome;

    const budgetUsage = effectiveIncome > 0 ? (totalExpense / effectiveIncome) * 100 : 0;
    const debtWalletCount = walletStats.filter(wallet => wallet.type === 'cc').length;
    const monthLabel = financeDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const activeFilters = useMemo(() => {
        const filters: string[] = [];
        if (filterTransactionType) {
            filters.push(`Type: ${filterTransactionType.charAt(0).toUpperCase()}${filterTransactionType.slice(1)}`);
        }
        if (filterWallet) filters.push(`Wallet: ${filterWallet}`);
        if (filterCategory) filters.push(`Category: ${filterCategory}`);
        if (selectedTag) filters.push(`#${selectedTag}`);
        if (searchQuery) filters.push(`Search: ${searchQuery}`);
        if (filterMinAmount || filterMaxAmount) {
            filters.push(`Amount: ${filterMinAmount || '0'}-${filterMaxAmount || '∞'}`);
        }
        return filters;
    }, [filterTransactionType, filterWallet, filterCategory, selectedTag, searchQuery, filterMinAmount, filterMaxAmount]);

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
        noDarken: true,
        className: 'mb-0',
    };

    const renderTransactionRow = (item: BrainDumpItem) => {
        const kind = getTransactionKind(item);
        const amount = item.meta.amount || 0;
        const dateLabel = formatMoneyDate(getTransactionDate(item));
        const categoryLabel = budgetConfig.rules.find(rule => rule.id === item.meta.budgetCategory)?.name
            || item.meta.budgetCategory
            || (kind === 'income' ? 'Income' : kind === 'saving' ? 'Saving' : kind === 'transfer' ? 'Transfer' : 'Expense');
        const walletLabel = item.meta.paymentMethod || item.meta.toWallet;
        const metaBits = [categoryLabel, walletLabel, dateLabel].filter(Boolean);
        const isExpanded = expandedTransactionId === item.id;

        const amountPrefix = kind === 'income' ? '+' : '-';
        const amountColor = kind === 'income'
            ? 'text-emerald-500'
            : kind === 'saving'
                ? 'text-indigo-500'
                : kind === 'transfer'
                    ? 'text-primary'
                    : 'text-[#FF5722]';

        return (
            <div key={item.id} className="border-b border-border/70 last:border-b-0 py-3 first:pt-0 last:pb-0">
                <button type="button" onClick={() => setExpandedTransactionId(current => current === item.id ? null : item.id)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-primary line-clamp-1">{item.content}</p>
                            <p className="mt-1 text-xs text-muted">{metaBits.join(' • ')}</p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className={`text-sm font-semibold ${amountColor}`}>
                                {showBalance ? `${amountPrefix}${fmt(amount).replace('Rp', 'Rp ')}` : '••••'}
                            </p>
                            <p className="mt-1 text-xs text-muted">{isExpanded ? 'Hide' : 'Detail'}</p>
                        </div>
                    </div>
                </button>

                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-3">
                                <Card item={item} {...cardProps} enableCollapse={false} embedded categoryName={categoryLabel} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const renderTransactions = () => (
        <div>
            <div className="flex flex-wrap gap-2">
                {[
                    { label: 'All', value: '' },
                    { label: 'Expense', value: 'expense' },
                    { label: 'Income', value: 'income' },
                    { label: 'Saving', value: 'saving' },
                ].map((chip) => (
                    <button
                        key={chip.label}
                        onClick={() => setFilterTransactionType?.(chip.value)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                            filterTransactionType === chip.value
                                ? 'bg-indigo-500 text-white'
                                : 'bg-muted/10 text-muted hover:text-primary'
                        }`}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {activeFilters.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {activeFilters.map(filter => (
                        <span key={filter} className="rounded-full bg-muted/10 px-3 py-1 text-xs font-medium text-muted">
                            {filter}
                        </span>
                    ))}
                    {clearMoneyFilters && (
                        <button
                            onClick={clearMoneyFilters}
                            className="text-xs font-semibold text-indigo-500 transition-opacity hover:opacity-80"
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}

            <div className="mt-4">
                {list.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                        <p className="text-sm text-muted">
                            {activeFilters.length > 0 || filterTransactionType
                                ? 'No transactions match the current filters.'
                                : 'No transactions recorded for this period.'}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            <button
                                onClick={() => onAddItem(ItemType.FINANCE)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                            >
                                <Plus className="w-4 h-4" /> Add Transaction
                            </button>
                            {clearMoneyFilters && (activeFilters.length > 0 || filterTransactionType) && (
                                <button
                                    onClick={clearMoneyFilters}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-muted/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted/20"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div>{list.map(renderTransactionRow)}</div>
                )}
            </div>
        </div>
    );

    const renderWallets = () => (
        <div>
            <p className="text-sm text-muted">
                Wallets: {walletStats.length} • {debtWalletCount} debt account{debtWalletCount === 1 ? '' : 's'}
            </p>

            {walletStats.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                    <p className="text-sm text-muted">No wallets yet. Add one place where money actually lives.</p>
                    <button
                        onClick={handleOpenAddWallet}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" /> Add Wallet
                    </button>
                </div>
            ) : (
            <div className="mt-4 rounded-3xl border border-border/70 bg-surface divide-y divide-border/70">
                {walletStats.map((wallet) => {
                    const walletSavings = savingGoals
                        .filter(goal => goal.meta.dedicatedWalletId === wallet.id)
                        .reduce((sum, goal) => sum + (goal.meta.savedAmount || 0), 0);
                    const typeLabel = wallet.type === 'cc'
                        ? 'Debt account'
                        : wallet.type === 'bank'
                            ? 'Bank account'
                            : wallet.type === 'ewallet'
                                ? 'E-wallet'
                                : 'Cash wallet';

                    return (
                        <div key={wallet.id} className="px-4 py-4 first:pt-5 last:pb-5">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-2xl bg-muted/10 p-2 text-muted">
                                    {wallet.type === 'bank' ? <PiggyBank className="w-4 h-4" /> : wallet.type === 'cc' ? <CreditCard className="w-4 h-4" /> : <WalletIcon className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-primary">{wallet.name}</h3>
                                            <p className="mt-1 text-xs text-muted">{typeLabel}{walletSavings > 0 ? ` • Savings ${showBalance ? fmt(walletSavings) : '••••'}` : ''}</p>
                                        </div>
                                        <p className="shrink-0 text-sm font-semibold text-primary">
                                            {showBalance ? fmt(wallet.currentBalance) : '••••'}
                                        </p>
                                    </div>

                                    <AnimatePresence initial={false}>
                                        {walletActionId === wallet.id && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenEditWallet(wallet)}
                                                        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted/10"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setDeleteId(wallet.id);
                                                            setDeleteType('wallet');
                                                        }}
                                                        className="inline-flex items-center gap-1 rounded-xl border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setWalletActionId(current => current === wallet.id ? null : wallet.id)}
                                    className="mt-0.5 rounded-xl p-2 text-muted transition-colors hover:bg-muted/10 hover:text-primary"
                                    aria-label={`Actions for ${wallet.name}`}
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            )}

            {walletStats.length > 0 && (
                <button
                    onClick={handleOpenAddWallet}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-primary/30 hover:text-primary"
                >
                    <Plus className="w-4 h-4" /> Add Wallet
                </button>
            )}
        </div>
    );

    const renderBudget = () => {
        if (effectiveIncome === 0) {
            return (
                <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                    <AlertCircle className="mx-auto mb-3 h-6 w-6 text-muted" />
                    <p className="text-sm text-muted">Set monthly income or record income first to unlock budget breakdown.</p>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                    >
                        Set Income
                    </button>
                </div>
            );
        }

        if (budgetConfig.rules.length === 0) {
            return (
                <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                    <AlertCircle className="mx-auto mb-3 h-6 w-6 text-muted" />
                    <p className="text-sm text-muted">No budget categories yet. Add a few rules before reviewing the breakdown.</p>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                    >
                        Open Settings
                    </button>
                </div>
            );
        }

        return (
            <div>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-primary">Budget used: {Math.min(budgetUsage, 999).toFixed(0)}%</p>
                        <p className="mt-1 text-xs text-muted">
                            {showBalance ? `${fmt(totalExpense)} / ${fmt(effectiveIncome)} planned` : '•••• / •••• planned'}
                            {projectedExpense > 0 ? ` • ${showBalance ? fmt(projectedExpense) : '••••'} pending` : ''}
                        </p>
                    </div>
                    <div className="flex rounded-full bg-muted/10 p-1">
                        <button
                            onClick={() => setBudgetViewMode('monthly')}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${budgetViewMode === 'monthly' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
                        >
                            M
                        </button>
                        <button
                            onClick={() => setBudgetViewMode('yearly')}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${budgetViewMode === 'yearly' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
                        >
                            Y
                        </button>
                    </div>
                </div>

                <div className="mt-4 rounded-3xl border border-border/70 bg-surface divide-y divide-border/70">
                    {budgetConfig.rules.map((rule) => {
                        const spent = budgetMap.get(rule.id) || 0;
                        const planned = plannedBudgetMap.get(rule.id) || 0;
                        const limit = effectiveIncome * (rule.percentage / 100);
                        const progress = limit > 0 ? (spent / limit) * 100 : 0;

                        return (
                            <div key={rule.id} className="px-4 py-4 first:pt-5 last:pb-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`h-2.5 w-2.5 rounded-full ${rule.color || 'bg-gray-500'}`} />
                                            <h3 className="text-sm font-semibold text-primary">{rule.name}</h3>
                                        </div>
                                        <p className="mt-1 text-xs text-muted">
                                            {showBalance ? `${fmt(spent)} / ${fmt(limit)}` : '•••• / ••••'}
                                            {planned > 0 ? ` • planned ${showBalance ? fmt(planned) : '••••'}` : ''}
                                        </p>
                                    </div>
                                    <p className="shrink-0 text-sm font-semibold text-primary">{Math.min(progress, 999).toFixed(0)}%</p>
                                </div>

                                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
                                    <div
                                        className={`h-full rounded-full ${rule.color || 'bg-gray-500'}`}
                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}

                    {(uncategorized > 0 || projectedUncategorized > 0) && (
                        <div className="px-4 py-4 last:pb-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                                        <h3 className="text-sm font-semibold text-primary">Other</h3>
                                    </div>
                                    <p className="mt-1 text-xs text-muted">
                                        {showBalance ? fmt(uncategorized) : '••••'}
                                        {projectedUncategorized > 0 ? ` • planned ${showBalance ? fmt(projectedUncategorized) : '••••'}` : ''}
                                    </p>
                                </div>
                                <p className="shrink-0 text-sm font-semibold text-primary">
                                    {effectiveIncome > 0 ? Math.min((uncategorized / effectiveIncome) * 100, 999).toFixed(0) : '0'}%
                                </p>
                            </div>
                            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
                                <div
                                    className="h-full rounded-full bg-gray-400"
                                    style={{ width: `${effectiveIncome > 0 ? Math.min((uncategorized / effectiveIncome) * 100, 100) : 0}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const content = moneyView === 'wallets'
        ? renderWallets()
        : moneyView === 'budget'
            ? renderBudget()
            : renderTransactions();

    return (
        <div
            className="min-h-[60vh] pb-24"
            onTouchStart={swipeHandlers.onTouchStart}
            onTouchMove={swipeHandlers.onTouchMove}
            onTouchEnd={swipeHandlers.onTouchEnd}
        >
            <motion.div style={swipeHandlers.style} className="will-change-transform">
                <div className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 pb-3 pt-safe backdrop-blur">
                    <div className="flex items-center justify-between gap-3 pb-2 pt-4">
                        <div
                            className="flex items-center gap-3"
                            onTouchStart={dateSwipeHandlers.onTouchStart}
                            onTouchMove={dateSwipeHandlers.onTouchMove}
                            onTouchEnd={dateSwipeHandlers.onTouchEnd}
                        >
                            <button onClick={() => changeMonth(-1)} className="rounded-full p-1.5 text-muted transition-colors hover:bg-muted/10 hover:text-primary">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">{monthLabel}</p>
                            <button onClick={() => changeMonth(1)} className="rounded-full p-1.5 text-muted transition-colors hover:bg-muted/10 hover:text-primary">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowBalance(!showBalance)}
                                className="rounded-2xl bg-muted/10 p-2 text-muted transition-colors hover:text-primary"
                            >
                                {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                                onClick={() => onAddItem(ItemType.FINANCE)}
                                className="rounded-2xl bg-indigo-500 p-2 text-white shadow-sm transition-opacity hover:opacity-90"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="pb-4 pt-1">
                        <h1 className="text-3xl font-bold tracking-tight text-primary">
                            {showBalance ? fmt(totalNetWorth) : '••••••••'}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                            <span className="inline-flex items-center gap-1"><TrendingUp className="h-4 w-4 text-emerald-500" /> {showBalance ? fmt(totalIncome) : '••••'}</span>
                            <span className="inline-flex items-center gap-1"><TrendingDown className="h-4 w-4 text-[#FF5722]" /> {showBalance ? fmt(totalExpense) : '••••'}</span>
                            {(totalDebt > 0 || totalSavings > 0 || totalAssets > 0) && (
                                <span className="text-xs text-muted/80">
                                    Assets {showBalance ? fmt(totalAssets) : '••'} • Debt {showBalance ? fmt(totalDebt) : '••'} • Savings {showBalance ? fmt(totalSavings || 0) : '••'}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex rounded-2xl bg-black/5 p-1 dark:bg-white/10">
                        {orderedTabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setMoneyView(tab);
                                    setExpandedTransactionId(null);
                                    setWalletActionId(null);
                                }}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                                    moneyView === tab ? 'bg-surface text-primary shadow-sm' : 'text-primary/50 hover:text-primary'
                                }`}
                            >
                                {tab === 'transactions' && <List className="w-4 h-4" />}
                                {tab === 'wallets' && <WalletIcon className="w-4 h-4" />}
                                {tab === 'budget' && <PieChart className="w-4 h-4" />}
                                <span className="capitalize">{tab}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${moneyView}-${financeDate.toISOString()}-${budgetViewMode}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="px-4 pt-4"
                    >
                        {content}
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default MoneyViewComponent;
