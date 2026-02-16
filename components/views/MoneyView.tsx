import React, { useState, useRef } from 'react';
import { EyeOff, Eye, TrendingUp, TrendingDown, Wallet as WalletIcon, List, PieChart, Pencil, Trash2, PiggyBank, CreditCard, ChevronLeft, ChevronRight, Calculator, Plus, AlertCircle } from 'lucide-react';
import { BrainDumpItem, Wallet, BudgetConfig, MoneyView, AppSettings, SortOrder, FinanceType } from '../../types';
import { getWalletStats, getFinanceItems } from '../../utils/selectors';
import Card from '../Card';

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
    handleUpdateItem: (id: string, newContent: string, newTags: string[], newAmount?: number, newDate?: string, newPaymentMethod?: string, newBudgetCategory?: string, newDuration?: number, newSkillId?: string, newToWallet?: string, newFinanceType?: FinanceType, newProgress?: number, newProgressNotes?: string) => void;
    handleOpenEditWallet: (w: Wallet) => void;
    handleOpenAddWallet: () => void;
    setDeleteId: (id: string) => void;
    setDeleteType: (type: 'skill' | 'wallet' | null) => void;
    setIsSettingsOpen: (val: boolean) => void;

    // Filters
    filterWallet: string;
    filterTransactionType: string;
    filterMinAmount: string;
    filterMaxAmount: string;
    selectedTag: string;
    searchQuery: string;
    sortOrder: SortOrder;
}

const MoneyViewComponent: React.FC<MoneyViewProps> = ({
    items, wallets, budgetConfig, moneyView, setMoneyView,
    financeDate, setFinanceDate, showBalance, setShowBalance, appSettings,
    handleDelete, handleUpdateItem, handleOpenEditWallet, handleOpenAddWallet,
    setDeleteId, setDeleteType, setIsSettingsOpen,
    filterWallet, filterTransactionType, filterMinAmount, filterMaxAmount, selectedTag, searchQuery, sortOrder
}) => {
    
    // Calculate Data for All Views
    const { walletStats, totalNetWorth, totalAssets, totalDebt } = getWalletStats(items, wallets);
    
    const { 
        list, totalIncome, totalExpense, projectedExpense, 
        budgetMap, plannedBudgetMap, uncategorized, projectedUncategorized 
    } = getFinanceItems(
        items, financeDate, budgetConfig, 
        filterWallet, filterTransactionType, filterMinAmount, filterMaxAmount, selectedTag, searchQuery, sortOrder
    );

    const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
               
    const effectiveIncome = budgetConfig.monthlyIncome > 0 ? budgetConfig.monthlyIncome : totalIncome;
    const incomeLabel = budgetConfig.monthlyIncome > 0 ? 'Fixed Income' : 'Recorded Income';

    const changeMonth = (offset: number) => {
        const newDate = new Date(financeDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setFinanceDate(newDate);
    };

    // Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const isHorizontalSwipe = useRef<boolean | null>(null);

    const tabs: MoneyView[] = ['wallets', 'transactions', 'budget'];
    const activeIndex = tabs.indexOf(moneyView);

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
        noStrikethrough: true
    };

    return (
        <div className="min-h-[60vh] overflow-hidden">
            {/* Total Net Worth Header (Fixed) */}
            <div className="bg-surface border border-border rounded-xl p-4 mb-4 shadow-lg">
                <div className="flex justify-between items-start">
                    <div className="text-sm text-muted mb-1">Total Net Worth</div>
                    <button onClick={() => setShowBalance(!showBalance)} className="text-muted hover:text-primary transition-colors">
                        {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <div className={`text-2xl font-bold mb-4 text-primary`}>{showBalance ? fmt(totalNetWorth) : '••••••••'}</div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/10 dark:bg-black/20 rounded-lg p-2 px-3">
                        <div className="flex items-center gap-1 text-xs text-muted mb-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> Income (Mo)</div>
                        <div className="font-semibold text-emerald-500">{showBalance ? fmt(totalIncome) : '••••'}</div>
                    </div>
                    <div className="bg-black/10 dark:bg-black/20 rounded-lg p-2 px-3">
                        <div className="flex items-center gap-1 text-xs text-muted mb-1"><TrendingDown className="w-3 h-3 text-red-500" /> Expense (Mo)</div>
                        <div className="font-semibold text-red-500">{showBalance ? fmt(totalExpense) : '••••'}</div>
                    </div>
                </div>
                <div className="flex gap-4 mt-2 pt-2 border-t border-border/30">
                        <div className="text-xs text-muted">
                        Assets: <span className="text-emerald-500 font-medium">{showBalance ? fmt(totalAssets) : '••'}</span>
                        </div>
                        <div className="text-xs text-muted">
                        Debt: <span className="text-red-500 font-medium">{showBalance ? fmt(totalDebt) : '••'}</span>
                        </div>
                </div>
            </div>
            
            {/* Submenu Toggle */}
            <div className="flex bg-surface rounded-lg p-1 mb-4 border border-border">
                {tabs.map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setMoneyView(tab)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${moneyView === tab ? 'bg-background text-primary shadow-sm' : 'text-muted hover:text-primary'}`}
                    >
                        {tab === 'wallets' && <WalletIcon className="w-3.5 h-3.5" />}
                        {tab === 'transactions' && <List className="w-3.5 h-3.5" />}
                        {tab === 'budget' && <PieChart className="w-3.5 h-3.5" />}
                        <span className="capitalize">{tab === 'transactions' ? 'Trans.' : tab}</span>
                    </button>
                ))}
            </div>

            {/* Sliding Container */}
            <div
                className="touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div 
                    className="flex w-full will-change-transform"
                    style={{
                        transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
                        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                    {/* VIEW: Wallets */}
                    <div className="w-full flex-shrink-0 px-1">
                        <div className="space-y-4">
                            {walletStats.map(wallet => (
                                <div key={wallet.id} className="bg-surface border border-border p-4 rounded-xl relative group hover:border-border transition-colors">
                                    <div className="absolute top-3 right-3 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleOpenEditWallet(wallet)}
                                            className="p-1.5 hover:bg-muted/10 rounded-md text-muted hover:text-primary transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                            onClick={() => { setDeleteId(wallet.id); setDeleteType('wallet'); }}
                                            className="p-1.5 hover:bg-red-900/30 rounded-md text-muted hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 rounded-full ${wallet.color} flex items-center justify-center text-white`}>
                                            {wallet.type === 'bank' ? <PiggyBank className="w-5 h-5" /> : 
                                                wallet.type === 'cc' ? <CreditCard className="w-5 h-5" /> : 
                                                wallet.type === 'ewallet' ? <WalletIcon className="w-5 h-5" /> :
                                                <WalletIcon className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-primary">{wallet.name}</div>
                                            <div className="text-[10px] text-muted uppercase tracking-wider">{wallet.type}</div>
                                        </div>
                                    </div>
                                    <div className="text-xl font-bold text-primary tracking-tight flex items-center gap-2">
                                        {showBalance ? fmt(wallet.currentBalance) : '••••••••'}
                                        {wallet.type === 'cc' && <span className="text-xs font-normal text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">Debt</span>}
                                    </div>
                                </div>
                            ))}

                            <button onClick={handleOpenAddWallet} className="w-full border border-dashed border-border rounded-xl flex items-center justify-center p-4 hover:border-primary/30 hover:bg-surface/50 transition-all text-muted hover:text-primary gap-2">
                                <Plus className="w-5 h-5" />
                                <span className="text-sm font-medium">Add Wallet</span>
                            </button>
                        </div>
                    </div>

                    {/* VIEW: Transactions */}
                    <div className="w-full flex-shrink-0 px-1">
                        <div>
                            <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 mb-4">
                                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-muted/10 rounded-full text-muted hover:text-primary"><ChevronLeft className="w-5 h-5" /></button>
                                <span className="font-semibold text-primary">
                                    {financeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                </span>
                                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-muted/10 rounded-full text-muted hover:text-primary"><ChevronRight className="w-5 h-5" /></button>
                            </div>

                            {list.length === 0 ? <div className="text-center text-muted py-10">No transactions recorded.</div> : (
                                <div className="space-y-3">
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
                    </div>

                    {/* VIEW: Budget Dashboard */}
                    <div className="w-full flex-shrink-0 px-1">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 mb-4">
                                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-muted/10 rounded-full text-muted hover:text-primary"><ChevronLeft className="w-5 h-5" /></button>
                                <span className="font-semibold text-primary">
                                    {financeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                </span>
                                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-muted/10 rounded-full text-muted hover:text-primary"><ChevronRight className="w-5 h-5" /></button>
                            </div>

                            {/* Projected/Planned Card Moved Here */}
                            {projectedExpense > 0 && (
                                <div className="bg-surface/50 border border-dashed border-border rounded-xl p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-muted">
                                        <Calculator className="w-4 h-4" />
                                        <span className="text-xs font-medium">Planned Spending (Pending)</span>
                                    </div>
                                    <span className="text-sm font-bold text-amber-500">{showBalance ? fmt(projectedExpense) : '••••'}</span>
                                </div>
                            )}

                            {effectiveIncome === 0 ? (
                                <div className="text-center p-6 bg-surface border border-border rounded-xl">
                                    <PiggyBank className="w-8 h-8 text-muted mx-auto mb-2" />
                                    <p className="text-sm text-muted">Set a <strong>Monthly Income</strong> in Settings <br/>or record Income to see your budget breakdown.</p>
                                    <button onClick={() => setIsSettingsOpen(true)} className="mt-4 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-semibold hover:bg-primary/20">
                                        Set Income
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <span className="text-xs font-medium text-muted">Basis: {incomeLabel}</span>
                                        <span className="text-sm font-bold text-primary">{showBalance ? fmt(effectiveIncome) : '••••'}</span>
                                    </div>

                                    {/* Dynamic Budget Categories */}
                                    {budgetConfig.rules.map(rule => {
                                        const spent = budgetMap.get(rule.id) || 0;
                                        const planned = plannedBudgetMap.get(rule.id) || 0;
                                        const limit = effectiveIncome * (rule.percentage / 100);
                                        
                                        const barColor = rule.color || 'bg-gray-500';

                                        return (
                                            <div key={rule.id} className="mb-5">
                                                <div className="flex justify-between items-end mb-1">
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-semibold text-primary`}>{rule.name} <span className="text-xs font-normal text-muted opacity-70">({rule.percentage}%)</span></span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-primary font-medium">
                                                            {showBalance ? fmt(spent) : '•••'} <span className="text-muted/60">/ {showBalance ? fmt(limit) : '•••'}</span>
                                                        </div>
                                                        {planned > 0 && (
                                                            <div className="text-[10px] text-amber-500">
                                                                +{showBalance ? fmt(planned) : '•••'} planned
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Stacked Bar Chart */}
                                                <div className="h-4 w-full bg-surface rounded-full overflow-hidden border border-border relative flex mt-1">
                                                    {/* Actual Spending */}
                                                    <div 
                                                        className={`h-full ${barColor}`} 
                                                        style={{ width: `${Math.min(100, (spent / effectiveIncome) * 100)}%` }}
                                                    ></div>
                                                    
                                                    {/* Planned Spending (Stacked) */}
                                                    <div 
                                                        className={`h-full ${barColor} opacity-40 bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)]`} 
                                                        style={{ width: `${Math.min(100 - ((spent / effectiveIncome) * 100), (planned / effectiveIncome) * 100)}%` }}
                                                    ></div>
                                                    
                                                    {/* Limit Marker */}
                                                    <div 
                                                        className="h-full w-0.5 bg-primary z-20 absolute top-0 shadow-[0_0_4px_rgba(0,0,0,0.5)]"
                                                        style={{ left: `${rule.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Uncategorized */}
                                    {(uncategorized > 0 || projectedUncategorized > 0) && (
                                        <div className="pt-4 border-t border-border mt-4">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-muted">Uncategorized / Others</span>
                                                <div className="text-right">
                                                    <span className="text-xs text-primary">{showBalance ? fmt(uncategorized) : '•••'}</span>
                                                    {projectedUncategorized > 0 && (
                                                        <span className="text-[10px] text-amber-500 ml-1">+{showBalance ? fmt(projectedUncategorized) : '•••'}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden flex border border-border">
                                                    <div className="h-full bg-gray-500 opacity-50 flex-1"></div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MoneyViewComponent;