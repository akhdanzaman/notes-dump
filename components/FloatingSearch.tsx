import React, { useRef, useEffect } from 'react';
import {
    Search,
    X,
    Filter,
    Tag,
    CalendarDays,
    ArrowUpDown
} from 'lucide-react';
import {
    Tab,
    LibrarySubTab,
    MoneyView,
    Wallet,
    SortOrder,
    BudgetConfig,
    BrainDumpItem
} from '../types';

interface FloatingSearchProps {
    activeTab: Tab;
    librarySubTab: LibrarySubTab;
    moneyView: MoneyView;
    isSearchExpanded: boolean;
    setIsSearchExpanded: (val: boolean) => void;
    searchQuery: string;
    setSearchQuery: (val: string) => void;

    selectedTag: string;
    setSelectedTag: (val: string) => void;
    filterDate: string;
    setFilterDate: (val: string) => void;
    filterDateTo: string;
    setFilterDateTo: (val: string) => void;
    sortOrder: SortOrder;
    setSortOrder: (val: SortOrder) => void;

    filterWallet: string;
    setFilterWallet: (val: string) => void;
    filterTransactionType: string;
    setFilterTransactionType: (val: string) => void;
    filterCategory: string;
    setFilterCategory: (val: string) => void;
    filterMinAmount: string;
    setFilterMinAmount: (val: string) => void;
    filterMaxAmount: string;
    setFilterMaxAmount: (val: string) => void;

    uniqueTags: string[];
    wallets: Wallet[];
    budgetConfig: BudgetConfig;
    savingGoals?: BrainDumpItem[];
}

const FloatingSearch: React.FC<FloatingSearchProps> = ({
    activeTab,
    librarySubTab,
    moneyView,
    isSearchExpanded,
    setIsSearchExpanded,
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    filterDate,
    setFilterDate,
    filterDateTo,
    setFilterDateTo,
    sortOrder,
    setSortOrder,
    filterWallet,
    setFilterWallet,
    filterTransactionType,
    setFilterTransactionType,
    filterCategory,
    setFilterCategory,
    filterMinAmount,
    setFilterMinAmount,
    filterMaxAmount,
    setFilterMaxAmount,
    uniqueTags,
    wallets,
    budgetConfig,
    savingGoals = []
}) => {
    if (activeTab !== 'library' && activeTab !== 'money') return null;
    if (activeTab === 'library' && librarySubTab === 'journal') return null;

    const isMoney = activeTab === 'money';
    const isTransactions = moneyView === 'transactions';
    const activeFilterCount = [
        selectedTag,
        filterDate,
        filterDateTo,
        filterWallet,
        filterTransactionType,
        filterCategory,
        filterMinAmount,
        filterMaxAmount,
        searchQuery,
    ].filter(Boolean).length;
    const isFilterActive = activeFilterCount > 0;

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsSearchExpanded(false);
            }
        };

        if (isSearchExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSearchExpanded, setIsSearchExpanded]);

    if (!isSearchExpanded) {
        return (
            <button
                onClick={() => setIsSearchExpanded(true)}
                data-floating-search-trigger="content-anchored"
                className={`pointer-events-auto relative flex h-10 items-center justify-center gap-2 rounded-xl border px-3 shadow-sm backdrop-blur-xl transition-colors active:scale-[0.97] ${
                    isFilterActive
                        ? 'border-indigo-500/30 bg-indigo-500 text-white'
                        : 'border-border/80 bg-surface/92 text-muted hover:border-indigo-500/25 hover:text-primary'
                }`}
                aria-label={isFilterActive ? `Buka pencarian, ${activeFilterCount} filter aktif` : 'Buka pencarian dan filter'}
            >
                <Search className="h-4 w-4" />
                <span className="hidden text-xs font-semibold sm:inline">Cari</span>
                {isFilterActive && (
                    <span className="flex min-w-[18px] items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold leading-[18px] text-white">
                        {activeFilterCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="pointer-events-none w-full flex justify-start" data-floating-search-anchor="composer-content-frame">
            <div
                ref={containerRef}
                className="pointer-events-auto relative max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-border/80 bg-surface/96 p-5 shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 lg:mx-0 lg:max-w-2xl sm:p-6"
            >
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                            Pencarian & filter
                        </p>
                        <h3 className="mt-1 text-base font-bold tracking-tight text-primary">
                            Temukan data lebih cepat
                        </h3>
                        {isFilterActive && <p className="mt-1 text-[11px] text-indigo-500">{activeFilterCount} filter aktif</p>}
                    </div>

                    <button
                        onClick={() => setIsSearchExpanded(false)}
                        className="shrink-0 rounded-xl p-2 text-muted transition-colors hover:bg-black/[0.04] hover:text-primary active:scale-95 dark:hover:bg-white/[0.06]"
                        aria-label="Tutup panel pencarian"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider px-1">
                            Search
                        </label>
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari isi atau tag..."
                                className="w-full rounded-xl border border-border/80 bg-background/65 py-3 pl-10 pr-4 text-sm text-primary outline-none transition focus:border-indigo-500/50 focus:bg-background focus:ring-4 focus:ring-indigo-500/10"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                                <Filter className="w-3 h-3" />
                                Filters
                            </label>

                            {isFilterActive && (
                                <button
                                    onClick={() => {
                                        setSelectedTag('');
                                        setFilterDate('');
                                        setFilterDateTo('');
                                        setFilterWallet('');
                                        setFilterTransactionType('');
                                        setFilterCategory('');
                                        setFilterMinAmount('');
                                        setFilterMaxAmount('');
                                        setSearchQuery('');
                                    }}
                                    className="text-[10px] text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors font-bold"
                                >
                                    Reset All
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide px-1">
                                    <Tag className="w-3 h-3" />
                                    Tag
                                </label>
                                <select
                                    value={selectedTag || ''}
                                    onChange={(e) => setSelectedTag(e.target.value)}
                                    className="w-full rounded-xl border border-border/80 bg-background/65 p-2.5 text-xs text-primary outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 transition-colors"
                                >
                                    <option value="">All Tags</option>
                                    {uniqueTags.map((tag) => (
                                        <option key={tag} value={tag}>
                                            {tag}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide px-1">
                                    <CalendarDays className="w-3 h-3" />
                                    Date Range
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        className="min-w-0 flex-1 rounded-xl border border-border/80 bg-background/65 p-2 text-[10px] text-primary outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 [color-scheme:dark]"
                                    />
                                    <span className="text-muted text-[10px]">to</span>
                                    <input
                                        type="date"
                                        value={filterDateTo}
                                        onChange={(e) => setFilterDateTo(e.target.value)}
                                        className="min-w-0 flex-1 rounded-xl border border-border/80 bg-background/65 p-2 text-[10px] text-primary outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 [color-scheme:dark]"
                                        min={filterDate}
                                    />
                                </div>
                            </div>
                        </div>

                        {isMoney && isTransactions && (
                            <div className="pt-4 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {filterTransactionType !== 'saving' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">
                                            Wallet
                                        </label>
                                        <select
                                            value={filterWallet}
                                            onChange={(e) => setFilterWallet(e.target.value)}
                                            className="w-full rounded-xl border border-border/80 bg-background/65 p-2.5 text-xs text-primary outline-none focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 transition-colors"
                                        >
                                            <option value="">All Wallets</option>
                                            <option value="undefined">Undefined</option>
                                            {wallets.map((w) => (
                                                <option key={w.id} value={w.name}>
                                                    {w.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">
                                        Category
                                    </label>
                                    <select
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="w-full rounded-xl border border-border/80 bg-background/65 p-2.5 text-xs text-primary outline-none focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 transition-colors"
                                    >
                                        <option value="">All Categories</option>
                                        <option value="uncategorized">Uncategorized</option>
                                        {budgetConfig.rules?.map((rule) => (
                                            <option key={rule.id} value={rule.id}>
                                                {rule.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">
                                        Type
                                    </label>
                                    <select
                                        value={filterTransactionType}
                                        onChange={(e) => setFilterTransactionType(e.target.value)}
                                        className="w-full rounded-xl border border-border/80 bg-background/65 p-2.5 text-xs text-primary outline-none focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 transition-colors"
                                    >
                                        <option value="">All Types</option>
                                        <option value="expense">Expense</option>
                                        <option value="income">Income</option>
                                        <option value="transfer">Transfer</option>
                                        <option value="saving">Saving</option>
                                        <option value="saving_withdrawal">Saving Withdrawal</option>
                                        <option value="loan_out">Money Lent</option>
                                        <option value="loan_in">Money Borrowed</option>
                                        <option value="loan_repayment_in">Repayment Received</option>
                                        <option value="loan_repayment_out">Repayment Paid</option>
                                        <option value="achieved_goal">Achieved Goals</option>
                                        <option value="shopping">Shopping</option>
                                    </select>
                                </div>

                                {filterTransactionType === 'saving' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">
                                            Saving Goal
                                        </label>
                                        <select
                                            value={filterCategory}
                                            onChange={(e) => setFilterCategory(e.target.value)}
                                            className="w-full rounded-xl border border-border/80 bg-background/65 p-2.5 text-xs text-primary outline-none focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 transition-colors"
                                        >
                                            <option value="">All Goals</option>
                                            {savingGoals.map((g) => (
                                                <option key={g.id} value={g.id}>
                                                    {g.content}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">
                                        Amount Range
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="Min"
                                            value={filterMinAmount}
                                            onChange={(e) => setFilterMinAmount(e.target.value)}
                                            className="w-full rounded-xl border border-border/80 bg-background/65 p-2.5 text-xs text-primary outline-none focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 transition-colors"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Max"
                                            value={filterMaxAmount}
                                            onChange={(e) => setFilterMaxAmount(e.target.value)}
                                            className="w-full rounded-xl border border-border/80 bg-background/65 p-2.5 text-xs text-primary outline-none focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border/30">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1 px-1">
                            <ArrowUpDown className="w-3 h-3" />
                            Sort By
                        </label>

                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'newest', label: 'Newest' },
                                { id: 'oldest', label: 'Oldest' },
                                ...(isMoney && isTransactions
                                    ? [
                                          { id: 'highest_amount', label: 'Highest' },
                                          { id: 'lowest_amount', label: 'Lowest' }
                                      ]
                                    : [])
                            ].map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setSortOrder(option.id as SortOrder)}
                                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                                        sortOrder === option.id
                                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                            : 'border border-border/80 bg-background/65 text-muted hover:border-indigo-500/25 hover:text-primary'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FloatingSearch;
