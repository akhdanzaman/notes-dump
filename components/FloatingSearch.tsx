
import React from 'react';
import { Search, X, Filter, Tag, CalendarDays, Wallet as WalletIcon, ArrowDownUp, DollarSign, ArrowUpDown, CheckCircle2, PieChart } from 'lucide-react';
import { Tab, NotesSubTab, MoneyView, Wallet, SortOrder, BudgetConfig, BrainDumpItem } from '../types';

interface FloatingSearchProps {
    activeTab: Tab;
    notesSubTab: NotesSubTab;
    moneyView: MoneyView;
    isSearchExpanded: boolean;
    setIsSearchExpanded: (val: boolean) => void;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    
    // Filter & Sort State
    selectedTag: string;
    setSelectedTag: (val: string) => void;
    filterDate: string;
    setFilterDate: (val: string) => void;
    filterDateTo: string;
    setFilterDateTo: (val: string) => void;
    sortOrder: SortOrder;
    setSortOrder: (val: SortOrder) => void;

    // Money Filter State
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

    // Data for dropdowns
    uniqueTags: string[];
    wallets: Wallet[];
    budgetConfig: BudgetConfig;
    savingGoals?: BrainDumpItem[];
}

const FloatingSearch: React.FC<FloatingSearchProps> = ({
    activeTab, notesSubTab, moneyView,
    isSearchExpanded, setIsSearchExpanded,
    searchQuery, setSearchQuery,
    selectedTag, setSelectedTag,
    filterDate, setFilterDate,
    filterDateTo, setFilterDateTo,
    sortOrder, setSortOrder,
    filterWallet, setFilterWallet,
    filterTransactionType, setFilterTransactionType,
    filterCategory, setFilterCategory,
    filterMinAmount, setFilterMinAmount,
    filterMaxAmount, setFilterMaxAmount,
    uniqueTags, wallets, budgetConfig,
    savingGoals = []
}) => {

    // Show filters only for tabs that need them
    if (activeTab !== 'notes' && activeTab !== 'money') return null;
    if (activeTab === 'notes' && notesSubTab === 'journal') return null;
    
    const isMoney = activeTab === 'money';
    const isTransactions = moneyView === 'transactions';
    const isFilterActive = selectedTag || filterDate || filterDateTo || filterWallet || filterTransactionType || filterCategory || filterMinAmount || filterMaxAmount || searchQuery;


    // Collapsed State: Floating Action Button
    if (!isSearchExpanded) {
        return (
            <button 
                onClick={() => setIsSearchExpanded(true)}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${isFilterActive ? 'bg-indigo-500 text-white shadow-indigo-500/30' : 'bg-surface/80 backdrop-blur-md text-muted border border-border/50 hover:text-primary hover:bg-surface hover:scale-110 active:scale-95'}`}
            >
                <Search className="w-5 h-5" />
                {isFilterActive && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface"></div>}
            </button>
        );
    }

    // Expanded State: Floating Panel
    return (
         <div className="bg-surface/90 backdrop-blur-xl border border-white/20 rounded-[2.5rem] shadow-2xl p-6 relative w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 max-h-[85vh] overflow-y-auto scrollbar-hide">
             <button 
                onClick={() => setIsSearchExpanded(false)}
                className="absolute top-6 right-6 bg-background/50 border border-border rounded-full p-1.5 shadow-md text-muted hover:text-primary hover:scale-110 transition-all z-10"
            >
                <X className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col gap-6">
                 {/* Search Bar Section */}
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider px-1">Search</label>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search content, tags..."
                            className="w-full bg-background/50 border border-border/50 rounded-2xl pl-10 pr-4 py-3 text-sm text-primary focus:outline-none focus:bg-background focus:border-indigo-500/50 transition-all"
                        />
                    </div>
                </div>

                {/* Filter Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1"><Filter className="w-3 h-3" /> Filters</label>
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
                        {/* Tag Select */}
                        <div>
                            <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide px-1"><Tag className="w-3 h-3" /> Tag</label>
                            <select 
                                value={selectedTag || ''}
                                onChange={(e) => setSelectedTag(e.target.value)}
                                className="w-full bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                            >
                                <option value="">All Tags</option>
                                {uniqueTags.map(tag => (
                                    <option key={tag} value={tag}>{tag}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Date Range */}
                        <div>
                            <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide px-1"><CalendarDays className="w-3 h-3" /> Date Range</label>
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="date"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="min-w-0 flex-1 bg-background/50 border border-border/50 rounded-xl p-2 text-[10px] text-primary focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                                />
                                <span className="text-muted text-[10px]">to</span>
                                <input 
                                    type="date"
                                    value={filterDateTo}
                                    onChange={(e) => setFilterDateTo(e.target.value)}
                                    className="min-w-0 flex-1 bg-background/50 border border-border/50 rounded-xl p-2 text-[10px] text-primary focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                                    min={filterDate}
                                />
                            </div>
                        </div>
                    </div>

                    {/* MONEY SPECIFIC FILTERS */}
                    {isMoney && isTransactions && (
                        <div className="pt-4 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Wallet */}
                            {filterTransactionType !== 'saving' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">Wallet</label>
                                    <select 
                                        value={filterWallet}
                                        onChange={(e) => setFilterWallet(e.target.value)}
                                        className="w-full bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                                    >
                                        <option value="">All Wallets</option>
                                        <option value="undefined">Undefined</option>
                                        {wallets.map(w => (
                                            <option key={w.id} value={w.name}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Category */}
                            <div>
                                <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">Category</label>
                                <select 
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="w-full bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                                >
                                    <option value="">All Categories</option>
                                    <option value="uncategorized">Uncategorized</option>
                                    {budgetConfig.rules.map(rule => (
                                        <option key={rule.id} value={rule.id}>{rule.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">Type</label>
                                <select 
                                    value={filterTransactionType}
                                    onChange={(e) => setFilterTransactionType(e.target.value)}
                                    className="w-full bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                                >
                                    <option value="">All Types</option>
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                    <option value="transfer">Transfer</option>
                                    <option value="saving">Saving</option>
                                    <option value="shopping">Shopping</option>
                                </select>
                            </div>

                            {/* Saving Goal Filter */}
                            {filterTransactionType === 'saving' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">Saving Goal</label>
                                    <select 
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="w-full bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                                    >
                                        <option value="">All Goals</option>
                                        {savingGoals.map(g => (
                                            <option key={g.id} value={g.id}>{g.content}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Amount Range */}
                            <div>
                                <label className="block text-[10px] font-bold text-muted mb-1.5 uppercase tracking-wide px-1">Amount Range</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="number"
                                        placeholder="Min"
                                        value={filterMinAmount}
                                        onChange={(e) => setFilterMinAmount(e.target.value)}
                                        className="w-full bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                    <input 
                                        type="number"
                                        placeholder="Max"
                                        value={filterMaxAmount}
                                        onChange={(e) => setFilterMaxAmount(e.target.value)}
                                        className="w-full bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sort Section */}
                <div className="space-y-3 pt-4 border-t border-border/30">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1 px-1"><ArrowUpDown className="w-3 h-3" /> Sort By</label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'newest', label: 'Newest' },
                            { id: 'oldest', label: 'Oldest' },
                            ...(isMoney && isTransactions ? [
                                { id: 'highest_amount', label: 'Highest' },
                                { id: 'lowest_amount', label: 'Lowest' }
                            ] : [])
                        ].map(option => (
                            <button 
                                key={option.id}
                                onClick={() => setSortOrder(option.id as SortOrder)}
                                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${sortOrder === option.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-background/50 border border-border/50 text-muted hover:text-primary hover:bg-background'}`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
         </div>
    );
};

export default FloatingSearch;
