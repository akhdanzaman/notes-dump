
import React from 'react';
import { Search, X, Filter, Tag, CalendarDays, Wallet as WalletIcon, ArrowDownUp, DollarSign, ArrowUpDown, CheckCircle2, PieChart } from 'lucide-react';
import { Tab, NotesSubTab, MoneyView, Wallet, SortOrder, BudgetConfig } from '../types';

interface FloatingSearchProps {
    activeTab: Tab;
    notesSubTab: NotesSubTab;
    moneyView: MoneyView;
    isSearchExpanded: boolean;
    setIsSearchExpanded: (val: boolean) => void;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    
    // Filter & Sort State
    showFilterMenu: boolean;
    setShowFilterMenu: (val: boolean) => void;
    showSortMenu: boolean;
    setShowSortMenu: (val: boolean) => void;
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
}

const FloatingSearch: React.FC<FloatingSearchProps> = ({
    activeTab, notesSubTab, moneyView,
    isSearchExpanded, setIsSearchExpanded,
    searchQuery, setSearchQuery,
    showFilterMenu, setShowFilterMenu,
    showSortMenu, setShowSortMenu,
    selectedTag, setSelectedTag,
    filterDate, setFilterDate,
    filterDateTo, setFilterDateTo,
    sortOrder, setSortOrder,
    filterWallet, setFilterWallet,
    filterTransactionType, setFilterTransactionType,
    filterCategory, setFilterCategory,
    filterMinAmount, setFilterMinAmount,
    filterMaxAmount, setFilterMaxAmount,
    uniqueTags, wallets, budgetConfig
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
         <div className="bg-surface/80 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl p-4 relative w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
             <button 
                onClick={() => setIsSearchExpanded(false)}
                className="absolute -top-3 left-4 bg-surface border border-border rounded-full p-1.5 shadow-md text-muted hover:text-primary hover:scale-110 transition-all z-10"
            >
                <X className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col gap-3 mt-1">
                 {/* Search Bar */}
                 <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        autoFocus
                        className="w-full bg-background/50 border border-border/50 rounded-2xl pl-10 pr-4 py-3 text-sm text-primary focus:outline-none focus:bg-background focus:border-indigo-500/50 transition-all"
                    />
                </div>
                
                {/* Actions Row */}
                <div className="flex gap-2">
                    {/* Filter Button */}
                    <div className="relative flex-1">
                        <button 
                            onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                            className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 ${showFilterMenu || (isFilterActive && !searchQuery) ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500' : 'bg-background/50 border-border/50 text-muted hover:text-primary hover:bg-background'}`}
                        >
                            <Filter className="w-3.5 h-3.5" /> Filters
                            {(selectedTag || filterDate || filterDateTo || filterWallet || filterTransactionType || filterCategory || filterMinAmount || filterMaxAmount) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            )}
                        </button>
                         {showFilterMenu && (
                            <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)}></div>
                            <div className="absolute left-0 bottom-full mb-3 w-80 max-w-[85vw] bg-surface/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <h4 className="text-xs font-bold text-muted mb-4 uppercase tracking-wider flex justify-between items-center">
                                    Filters
                                    {(selectedTag || filterDate || filterDateTo || filterWallet || filterTransactionType || filterCategory || filterMinAmount || filterMaxAmount) && (
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
                                            }}
                                            className="text-[10px] text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </h4>
                                
                                {/* Tag Select */}
                                <div className="mb-4">
                                    <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide"><Tag className="w-3 h-3" /> Tag</label>
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
                                
                                {/* Date Range Input */}
                                <div className="mb-4">
                                    <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide"><CalendarDays className="w-3 h-3" /> Date Range</label>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="date"
                                            value={filterDate}
                                            onChange={(e) => setFilterDate(e.target.value)}
                                            className="min-w-0 flex-1 bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-indigo-500 [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                            placeholder="From"
                                        />
                                        <span className="text-muted text-xs font-medium">to</span>
                                        <input 
                                            type="date"
                                            value={filterDateTo}
                                            onChange={(e) => setFilterDateTo(e.target.value)}
                                            className="min-w-0 flex-1 bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-indigo-500 [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                            placeholder="To"
                                            min={filterDate}
                                        />
                                        {(filterDate || filterDateTo) && (
                                            <button onClick={() => { setFilterDate(''); setFilterDateTo(''); }} className="p-2.5 bg-background/50 border border-border/50 rounded-xl hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-muted shrink-0 transition-colors">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* MONEY SPECIFIC FILTERS */}
                                {isMoney && isTransactions && (
                                    <div className="pt-4 border-t border-border/50 mt-2">
                                        <h5 className="text-[10px] font-bold text-emerald-500 mb-3 uppercase tracking-wider flex items-center gap-1"><DollarSign className="w-3 h-3" /> Money Filters</h5>
                                        
                                        {/* Wallet */}
                                        <div className="mb-3">
                                            <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide">Wallet</label>
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

                                        {/* Category */}
                                        <div className="mb-3">
                                            <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide">Category</label>
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
                                        <div className="mb-3">
                                            <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide">Type</label>
                                            <select 
                                                value={filterTransactionType}
                                                onChange={(e) => setFilterTransactionType(e.target.value)}
                                                className="w-full bg-background/50 border border-border/50 rounded-xl p-2.5 text-xs text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                                            >
                                                <option value="">All Types</option>
                                                <option value="expense">Expense</option>
                                                <option value="income">Income</option>
                                                <option value="transfer">Transfer</option>
                                                <option value="lending">Lending</option>
                                                <option value="reimbursement">Reimbursement</option>
                                                <option value="shopping">Shopping</option>
                                            </select>
                                        </div>

                                        {/* Amount Range */}
                                        <div>
                                            <label className="block text-[10px] font-bold text-muted mb-1.5 flex items-center gap-1 uppercase tracking-wide">Amount Range</label>
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
                            </>
                        )}
                    </div>

                    {/* Sort Button */}
                    <div className="relative flex-1">
                        <button 
                            onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                            className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 ${showSortMenu ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500' : 'bg-background/50 border-border/50 text-muted hover:text-primary hover:bg-background'}`}
                        >
                            <ArrowUpDown className="w-3.5 h-3.5" /> Sort
                        </button>
                         {showSortMenu && (
                             <>
                             <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
                             <div className="absolute right-0 bottom-full mb-3 w-48 bg-surface/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <h4 className="text-xs font-bold text-muted mb-2 uppercase tracking-wider px-3 py-1">Sort By</h4>
                                <button 
                                    onClick={() => { setSortOrder('newest'); setShowSortMenu(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${sortOrder === 'newest' ? 'bg-indigo-500/10 text-indigo-500 font-semibold' : 'text-muted hover:text-primary hover:bg-background/50'}`}
                                >
                                    Newest First
                                    {sortOrder === 'newest' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>
                                <button 
                                    onClick={() => { setSortOrder('oldest'); setShowSortMenu(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${sortOrder === 'oldest' ? 'bg-indigo-500/10 text-indigo-500 font-semibold' : 'text-muted hover:text-primary hover:bg-background/50'}`}
                                >
                                    Oldest First
                                    {sortOrder === 'oldest' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>
                                
                                {isMoney && isTransactions && (
                                    <>
                                        <div className="h-px bg-border/50 my-1 mx-2"></div>
                                        <button 
                                            onClick={() => { setSortOrder('highest_amount'); setShowSortMenu(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${sortOrder === 'highest_amount' ? 'bg-indigo-500/10 text-indigo-500 font-semibold' : 'text-muted hover:text-primary hover:bg-background/50'}`}
                                        >
                                            Highest Amount
                                            {sortOrder === 'highest_amount' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </button>
                                        <button 
                                            onClick={() => { setSortOrder('lowest_amount'); setShowSortMenu(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${sortOrder === 'lowest_amount' ? 'bg-indigo-500/10 text-indigo-500 font-semibold' : 'text-muted hover:text-primary hover:bg-background/50'}`}
                                        >
                                            Lowest Amount
                                            {sortOrder === 'lowest_amount' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </>
                                )}
                             </div>
                             </>
                        )}
                    </div>
                </div>
            </div>
         </div>
    );
};

export default FloatingSearch;
