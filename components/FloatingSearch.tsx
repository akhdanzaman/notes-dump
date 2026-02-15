
import React from 'react';
import { Search, X, Filter, Tag, CalendarDays, Wallet as WalletIcon, ArrowDownUp, DollarSign, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { Tab, NotesSubTab, MoneyView, Wallet, SortOrder } from '../types';

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
    filterMinAmount: string;
    setFilterMinAmount: (val: string) => void;
    filterMaxAmount: string;
    setFilterMaxAmount: (val: string) => void;

    // Data for dropdowns
    uniqueTags: string[];
    wallets: Wallet[];
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
    filterMinAmount, setFilterMinAmount,
    filterMaxAmount, setFilterMaxAmount,
    uniqueTags, wallets
}) => {

    // Show filters only for tabs that need them
    if (activeTab !== 'notes' && activeTab !== 'money') return null;
    if (activeTab === 'notes' && notesSubTab === 'journal') return null;
    
    const isMoney = activeTab === 'money';
    const isTransactions = moneyView === 'transactions';
    const isFilterActive = selectedTag || filterDate || filterDateTo || filterWallet || filterTransactionType || filterMinAmount || filterMaxAmount || searchQuery;

    // Collapsed State: Floating Action Button
    if (!isSearchExpanded) {
        return (
            <button 
                onClick={() => setIsSearchExpanded(true)}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-2xl border transition-all ${isFilterActive ? 'bg-acc-note text-white border-acc-note' : 'bg-surface text-muted border-border hover:text-primary hover:border-primary/30'}`}
            >
                <Search className="w-5 h-5" />
                {isFilterActive && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-surface"></div>}
            </button>
        );
    }

    // Expanded State: Floating Panel
    return (
         <div className="bg-surface border border-border rounded-2xl shadow-2xl p-3 relative w-full max-w-xl mx-auto">
             <button 
                onClick={() => setIsSearchExpanded(false)}
                className="absolute -top-3 left-3 bg-surface border border-border rounded-full p-1.5 shadow-lg text-muted hover:text-primary hover:border-primary/30"
            >
                <X className="w-3.5 h-3.5" />
            </button>
            
            <div className="flex flex-col gap-3 mt-2">
                 {/* Search Bar */}
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        autoFocus
                        className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-primary focus:outline-none focus:border-acc-note transition-colors"
                    />
                </div>
                
                {/* Actions Row */}
                <div className="flex gap-2">
                    {/* Filter Button */}
                    <div className="relative flex-1">
                        <button 
                            onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                            className={`w-full py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${showFilterMenu || (isFilterActive && !searchQuery) ? 'bg-acc-note/20 border-acc-note text-acc-note' : 'bg-background border-border text-muted hover:text-primary'}`}
                        >
                            <Filter className="w-3.5 h-3.5" /> Filters
                            {(selectedTag || filterDate || filterDateTo || filterWallet || filterTransactionType || filterMinAmount || filterMaxAmount) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-acc-note"></span>
                            )}
                        </button>
                         {showFilterMenu && (
                            <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)}></div>
                            <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[90vw] bg-surface border border-border rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <h4 className="text-xs font-bold text-primary mb-3 uppercase tracking-wider flex justify-between items-center">
                                    Filters
                                    {(selectedTag || filterDate || filterDateTo || filterWallet || filterTransactionType || filterMinAmount || filterMaxAmount) && (
                                        <button 
                                            onClick={() => {
                                                setSelectedTag('');
                                                setFilterDate('');
                                                setFilterDateTo('');
                                                setFilterWallet('');
                                                setFilterTransactionType('');
                                                setFilterMinAmount('');
                                                setFilterMaxAmount('');
                                            }}
                                            className="text-[10px] text-red-400 hover:underline"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </h4>
                                
                                {/* Tag Select */}
                                <div className="mb-3">
                                    <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><Tag className="w-3 h-3" /> Tag</label>
                                    <select 
                                        value={selectedTag || ''}
                                        onChange={(e) => setSelectedTag(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-note"
                                    >
                                        <option value="">All Tags</option>
                                        {uniqueTags.map(tag => (
                                            <option key={tag} value={tag}>{tag}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Date Range Input */}
                                <div className="mb-3">
                                    <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Date Range</label>
                                    <div className="flex gap-1 items-center">
                                        <input 
                                            type="date"
                                            value={filterDate}
                                            onChange={(e) => setFilterDate(e.target.value)}
                                            className="min-w-0 flex-1 bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-note [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                            placeholder="From"
                                        />
                                        <span className="text-muted text-xs">-</span>
                                        <input 
                                            type="date"
                                            value={filterDateTo}
                                            onChange={(e) => setFilterDateTo(e.target.value)}
                                            className="min-w-0 flex-1 bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-note [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                            placeholder="To"
                                            min={filterDate}
                                        />
                                        {(filterDate || filterDateTo) && (
                                            <button onClick={() => { setFilterDate(''); setFilterDateTo(''); }} className="p-2 bg-primary/10 rounded-lg hover:bg-primary/20 text-primary shrink-0">
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* MONEY SPECIFIC FILTERS */}
                                {isMoney && isTransactions && (
                                    <div className="pt-2 border-t border-border mt-2">
                                        <h5 className="text-[10px] font-bold text-emerald-400 mb-2 uppercase tracking-wider">Money Filters</h5>
                                        
                                        {/* Wallet */}
                                        <div className="mb-2">
                                            <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><WalletIcon className="w-3 h-3" /> Wallet</label>
                                            <select 
                                                value={filterWallet}
                                                onChange={(e) => setFilterWallet(e.target.value)}
                                                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-note"
                                            >
                                                <option value="">All Wallets</option>
                                                {wallets.map(w => (
                                                    <option key={w.id} value={w.name}>{w.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Type */}
                                        <div className="mb-2">
                                            <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><ArrowDownUp className="w-3 h-3" /> Type</label>
                                            <select 
                                                value={filterTransactionType}
                                                onChange={(e) => setFilterTransactionType(e.target.value)}
                                                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-note"
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
                                            <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Amount Range</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number"
                                                    placeholder="Min"
                                                    value={filterMinAmount}
                                                    onChange={(e) => setFilterMinAmount(e.target.value)}
                                                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-note"
                                                />
                                                <input 
                                                    type="number"
                                                    placeholder="Max"
                                                    value={filterMaxAmount}
                                                    onChange={(e) => setFilterMaxAmount(e.target.value)}
                                                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-note"
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
                            className={`w-full py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${showSortMenu ? 'bg-primary/20 border-primary text-primary' : 'bg-background border-border text-muted hover:text-primary'}`}
                        >
                            <ArrowUpDown className="w-3.5 h-3.5" /> Sort
                        </button>
                         {showSortMenu && (
                             <>
                             <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
                             <div className="absolute right-0 bottom-full mb-2 w-44 bg-surface border border-border rounded-xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <h4 className="text-xs font-bold text-primary mb-2 uppercase tracking-wider px-2">Sort By</h4>
                                <button 
                                    onClick={() => { setSortOrder('newest'); setShowSortMenu(false); }}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${sortOrder === 'newest' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-primary hover:bg-primary/5'}`}
                                >
                                    Newest First
                                    {sortOrder === 'newest' && <CheckCircle2 className="w-3 h-3 text-acc-todo" />}
                                </button>
                                <button 
                                    onClick={() => { setSortOrder('oldest'); setShowSortMenu(false); }}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${sortOrder === 'oldest' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-primary hover:bg-primary/5'}`}
                                >
                                    Oldest First
                                    {sortOrder === 'oldest' && <CheckCircle2 className="w-3 h-3 text-acc-todo" />}
                                </button>
                                
                                {isMoney && isTransactions && (
                                    <>
                                        <div className="h-px bg-border my-1"></div>
                                        <button 
                                            onClick={() => { setSortOrder('highest_amount'); setShowSortMenu(false); }}
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${sortOrder === 'highest_amount' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-primary hover:bg-primary/5'}`}
                                        >
                                            Highest Amount
                                            {sortOrder === 'highest_amount' && <CheckCircle2 className="w-3 h-3 text-acc-todo" />}
                                        </button>
                                        <button 
                                            onClick={() => { setSortOrder('lowest_amount'); setShowSortMenu(false); }}
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${sortOrder === 'lowest_amount' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-primary hover:bg-primary/5'}`}
                                        >
                                            Lowest Amount
                                            {sortOrder === 'lowest_amount' && <CheckCircle2 className="w-3 h-3 text-acc-todo" />}
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
