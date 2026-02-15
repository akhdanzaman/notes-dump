
import React from 'react';
import { ChevronLeft, Sparkles, ChevronRight, Pencil, Target, CheckCircle2, ShoppingCart, AlertTriangle, ArrowRight, Wallet as WalletIcon, EyeOff, Eye, ArrowUpRight, ArrowDownRight, Sprout, StickyNote } from 'lucide-react';
import { BrainDumpItem, Skill, Wallet, BudgetConfig, ItemType } from '../../types';
import { getFocusItems, getSkillItems, getShoppingItems, getWalletStats, getFinanceItems } from '../../utils/selectors';

interface SummaryViewProps {
    items: BrainDumpItem[];
    skills: Skill[];
    wallets: Wallet[];
    budgetConfig: BudgetConfig;
    themeNavDate: Date;
    setThemeNavDate: (d: Date) => void;
    monthlyThemes: Record<string, string>;
    onThemeEdit: (content: string) => void;
    handleToggleStatus: (id: string) => void;
    setActiveTab: (tab: any) => void;
    setFocusSubTab: (tab: any) => void;
    showBalance: boolean;
    setShowBalance: (val: boolean) => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({
    items, skills, wallets, budgetConfig,
    themeNavDate, setThemeNavDate, monthlyThemes, onThemeEdit,
    handleToggleStatus, setActiveTab, setFocusSubTab,
    showBalance, setShowBalance
}) => {
    // Calculate metrics
    const { today } = getFocusItems(items);
    const { stats } = getSkillItems(items, skills);
    const totalWeeklyHours = stats.reduce((acc, s) => acc + s.weeklyHours, 0);

    const { urgent } = getShoppingItems(items);
    
    const { totalNetWorth, totalAssets, totalDebt } = getWalletStats(items, wallets);
    // Use current date for summary finance view
    const { totalExpense, totalIncome, balance } = getFinanceItems(items, new Date(), budgetConfig, '', '', '', '', '', '', 'newest');
    
    const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    // Theme Data
    const changeThemeMonth = (offset: number) => {
        const newDate = new Date(themeNavDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setThemeNavDate(newDate);
    };

    const getThemeForDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        return { key, content: monthlyThemes[key] || '' };
    };

    const { content: themeContent } = getThemeForDate(themeNavDate);
    
    // Brain Bank count
    const noteCount = items.filter(i => i.type === ItemType.NOTE).length;

    return (
        <div className="space-y-4">
            {/* Monthly Theme Card */}
            <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 flex justify-between items-center transition-all group">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <button onClick={() => changeThemeMonth(-1)} className="p-0.5 text-muted hover:text-white"><ChevronLeft className="w-3 h-3" /></button>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> {themeNavDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} Theme
                        </span>
                        <button onClick={() => changeThemeMonth(1)} className="p-0.5 text-muted hover:text-white"><ChevronRight className="w-3 h-3" /></button>
                    </div>
                    <div onClick={() => onThemeEdit(themeContent)} className="cursor-pointer">
                        {themeContent ? (
                            <p className="text-sm font-medium text-white truncate pr-2 group-hover:text-indigo-200 transition-colors">"{themeContent}"</p>
                        ) : (
                            <p className="text-xs text-muted italic border-b border-dashed border-border/50 inline-block">Set a theme...</p>
                        )}
                    </div>
                </div>
                    <button 
                    onClick={() => onThemeEdit(themeContent)}
                    className="p-1.5 text-indigo-400/50 hover:text-indigo-300 rounded-md transition-colors"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* HERO SECTION: Action Center */}
            <div className="grid grid-cols-1 gap-4">
                    <div className="bg-gradient-to-br from-surface to-acc-todo/10 border-l-4 border-l-acc-todo rounded-r-xl border-y border-r border-border p-5 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Target className="w-24 h-24 text-acc-todo" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        Action Center
                    </h2>
                    
                    <div className="space-y-6 relative z-10">
                        {/* Today's Tasks */}
                        <div>
                            <div className="flex justify-between items-end mb-2 border-b border-white/10 pb-1">
                                <h3 className="text-sm font-bold text-acc-todo uppercase tracking-wider">Today's Focus</h3>
                                <span className="text-xs text-muted font-mono">{today.length} tasks</span>
                            </div>
                            {today.length > 0 ? (
                                <div className="space-y-2">
                                    {today.slice(0, 3).map(i => (
                                        <div key={i.id} className="flex items-start gap-2 text-sm text-gray-200">
                                            <button 
                                                onClick={() => handleToggleStatus(i.id)}
                                                className="mt-0.5 text-muted hover:text-acc-todo transition-colors"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                            <span className="truncate">{i.content}</span>
                                        </div>
                                    ))}
                                    {today.length > 3 && <div className="text-[10px] text-muted italic pl-6">+{today.length - 3} more...</div>}
                                </div>
                            ) : (
                                <p className="text-xs text-muted italic pl-1">No pending tasks for today.</p>
                            )}
                        </div>

                        {/* Urgent Shopping */}
                        {urgent.length > 0 && (
                            <div>
                                <div className="flex justify-between items-end mb-2 border-b border-white/10 pb-1">
                                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Urgent To Buy
                                    </h3>
                                    <span className="text-xs text-muted font-mono">{urgent.length} items</span>
                                </div>
                                <div className="space-y-2">
                                    {urgent.slice(0, 3).map(i => (
                                        <div key={i.id} className="flex items-start gap-2 text-sm text-gray-200">
                                            <button 
                                                onClick={() => handleToggleStatus(i.id)}
                                                className="mt-0.5 text-muted hover:text-red-400 transition-colors"
                                            >
                                                <ShoppingCart className="w-4 h-4" />
                                            </button>
                                            <span className="truncate">{i.content}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Quick Link */}
                        <div className="pt-2 flex justify-end">
                            <button onClick={() => setActiveTab('focus')} className="text-xs font-medium text-acc-todo hover:text-white flex items-center gap-1 transition-colors">
                                Go to Focus Mode <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                    </div>
            </div>

            {/* Money Card */}
            <div onClick={() => setActiveTab('money')} className="bg-gradient-to-br from-surface to-surface/50 border border-border p-5 rounded-xl transition-all cursor-pointer hover:border-emerald-500/30 group">
                    <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <WalletIcon className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Net Worth</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setShowBalance(!showBalance); }} className="text-muted hover:text-white transition-colors">
                        {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
                        <div className="text-3xl font-bold text-white">
                            {showBalance ? fmt(totalNetWorth) : '••••••••'}
                        </div>
                        
                        {/* Insight Badge */}
                        {balance !== 0 && (
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${
                                balance > 0 
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}>
                                {balance > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                <span>{showBalance ? fmt(Math.abs(balance)) : '•••'}</span>
                                <span className="opacity-70">this month</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-4 mt-3 pt-3 border-t border-white/5">
                        <div className="text-xs text-muted">
                        Assets: <span className="text-emerald-400 font-medium">{showBalance ? fmt(totalAssets) : '••'}</span>
                        </div>
                        <div className="text-xs text-muted">
                        Debt: <span className="text-red-400 font-medium">{showBalance ? fmt(totalDebt) : '••'}</span>
                        </div>
                    </div>
            </div>

            {/* Secondary Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                    {/* Skill Card */}
                    <div onClick={() => { setActiveTab('focus'); setFocusSubTab('skills'); }} className="bg-surface border border-border p-4 rounded-xl cursor-pointer hover:border-indigo-500/30 transition-all group flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Growth</span>
                                <Sprout className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">
                                {totalWeeklyHours}<span className="text-sm font-normal text-muted">h</span>
                            </div>
                            <div className="text-[10px] text-muted">Study time this week</div>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (totalWeeklyHours / 10) * 100)}%` }}></div>
                        </div>
                    </div>
                    
                    {/* Brain Bank */}
                    <div onClick={() => setActiveTab('notes')} className="bg-surface border border-border p-4 rounded-xl cursor-pointer hover:border-acc-note/30 transition-all group flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-acc-note uppercase tracking-wider">Brain Bank</span>
                            <StickyNote className="w-4 h-4 text-acc-note" />
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">
                            {noteCount}
                        </div>
                        <div className="text-[10px] text-muted">Captured thoughts</div>
                    </div>
            </div>
        </div>
    );
};

export default SummaryView;
