
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, ChevronRight, Pencil, Target, CheckCircle2, 
    ShoppingCart, AlertTriangle, ArrowRight, Wallet as WalletIcon, 
    EyeOff, Eye, ArrowUpRight, ArrowDownRight, Sprout, StickyNote,
    Plus, Zap, Coffee, TrendingUp
} from 'lucide-react';
import { BrainDumpItem, Skill, Wallet, BudgetConfig, ItemType, Tab, FinanceType } from '../../types';
import { getFocusMonthData, getSkillItems, getShoppingItems, getWalletStats, getFinanceItems } from '../../utils/selectors';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';
import Card from '../Card';

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
    setActiveTab: (tab: Tab) => void;
    setFocusSubTab: (tab: any) => void;
    showBalance: boolean;
    setShowBalance: (val: boolean) => void;
    
    // Handlers for Quick Actions
    handleOpenAddTask: (date?: string) => void;
    handleOpenAddShopping: (category?: string) => void;
    handleOpenAddExpense: () => void;
    handleOpenAddNote: () => void;
    handleUpdateItem: (id: string, content: string, tags: string[], amount?: number, date?: string, paymentMethod?: string, budgetCategory?: string, duration?: number, skillId?: string, toWallet?: string, financeType?: FinanceType, progress?: number, progressNotes?: string, shoppingCategory?: any, recurrenceDays?: number, quantity?: string, isRoutine?: boolean, routineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly', routineDaysOfWeek?: number[], routineDaysOfMonth?: number[], routineMonthsOfYear?: number[]) => void;
    handleDelete: (id: string) => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({
    items, skills, wallets, budgetConfig,
    themeNavDate, setThemeNavDate, monthlyThemes, onThemeEdit,
    handleToggleStatus, setActiveTab, setFocusSubTab,
    showBalance, setShowBalance,
    handleOpenAddTask, handleOpenAddShopping, handleOpenAddExpense, handleOpenAddNote,
    handleUpdateItem, handleDelete
}) => {
    // Swipe Logic
    const swipeHandlers = useSwipeTabs('summary', setActiveTab);

    // Date Swipe Logic
    const changeThemeMonth = (offset: number) => {
        const newDate = new Date(themeNavDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setThemeNavDate(newDate);
    };

    const dateSwipeHandlers = useSwipeDate(
        () => changeThemeMonth(-1),
        () => changeThemeMonth(1)
    );

    // --- Data Calculation ---
    
    // 1. Main Display Logic (Fallback Priority)
    const todayDate = new Date();
    const { pendingGroups } = getFocusMonthData(items, todayDate, '', '');
    const { urgent } = getShoppingItems(items);
    
    const { displayItems, displayTitle, displaySubtitle, isDoneState, icon: DisplayIcon } = useMemo(() => {
        // 1. Today's Focus (Tasks + Urgent Shopping)
        const todayItems = [
            ...urgent.map(i => ({ ...i, _isUrgentShopping: true })),
            ...pendingGroups.today
        ];
        if (todayItems.length > 0) {
            return { 
                displayItems: todayItems.slice(0, 5), 
                displayTitle: "Today's Focus",
                displaySubtitle: null,
                isDoneState: false,
                icon: <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            };
        }

        // 2. Tomorrow
        if (pendingGroups.tomorrow.length > 0) {
            return { 
                displayItems: pendingGroups.tomorrow.slice(0, 5), 
                displayTitle: "Tomorrow",
                displaySubtitle: "Get a head start on tomorrow's tasks.",
                isDoneState: false,
                icon: <ArrowRight className="w-5 h-5 text-blue-500" />
            };
        }

        // 3. Routine
        const pendingRoutines = pendingGroups.routines.filter(r => r.status === 'pending');
        if (pendingRoutines.length > 0) {
            return { 
                displayItems: pendingRoutines.slice(0, 5), 
                displayTitle: "Daily Rituals",
                displaySubtitle: "Keep your momentum going.",
                isDoneState: false,
                icon: <Coffee className="w-5 h-5 text-indigo-500" />
            };
        }

        // 4. Later
        if (pendingGroups.later.length > 0) {
            return { 
                displayItems: pendingGroups.later.slice(0, 5), 
                displayTitle: "Upcoming",
                displaySubtitle: "Tasks waiting for your attention.",
                isDoneState: false,
                icon: <Target className="w-5 h-5 text-purple-500" />
            };
        }

        // 5. Recent Done
        const recentDone = items
            .filter(i => i.type === 'TODO' && i.status === 'done' && i.completed_at)
            .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
            .slice(0, 3);
            
        if (recentDone.length > 0) {
            return { 
                displayItems: recentDone, 
                displayTitle: "Recently Completed",
                displaySubtitle: "Great job! You're all caught up.",
                isDoneState: true,
                icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            };
        }

        return { 
            displayItems: [], 
            displayTitle: "All Clear",
            displaySubtitle: "Take a break or plan ahead.",
            isDoneState: false,
            icon: <CheckCircle2 className="w-5 h-5 text-zinc-400" />
        };
    }, [items, pendingGroups, urgent]);

    // 2. Daily Rituals (Routines) - Only show if not already displayed in the main list
    const pendingRoutines = pendingGroups.routines.filter(r => r.status === 'pending');
    const showRitualsSection = pendingRoutines.length > 0 && displayTitle !== "Daily Rituals";

    // 3. Financial Snapshot
    // Use current month for financial snapshot
    const { totalExpense } = getFinanceItems(items, todayDate, budgetConfig, '', '', '', '', '', '', '', 'newest');
    const { totalNetWorth } = getWalletStats(items, wallets);
    
    // Calculate Total Budget Limits based on Rules
    const totalLimits = budgetConfig.rules.reduce((acc, rule) => acc + (rule.percentage / 100) * budgetConfig.monthlyIncome, 0);

    const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    const budgetPercent = totalLimits > 0 ? Math.min(100, (totalExpense / totalLimits) * 100) : 0;

    // 4. Theme Data
    const getThemeForDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        return { key, content: monthlyThemes[key] || '' };
    };

    const { content: themeContent } = getThemeForDate(themeNavDate);
    
    // Card Props for reuse
    const cardProps = {
        onToggleStatus: handleToggleStatus,
        onUpdate: handleUpdateItem,
        onDelete: handleDelete,
        enableCollapse: true,
        defaultCollapsed: true,
        skills,
        wallets,
        budgetRules: budgetConfig.rules,
        onResetRoutine: (id: string) => {} // Not needed for simple view
    };

    return (
        <div className="pb-24">
            {/* Top Container (Theme & Date) */}
            <motion.div 
                layoutId="top-container"
                className="bg-white dark:bg-zinc-100 text-black rounded-b-[32px] p-6 pt-12 shadow-sm mb-6 touch-pan-y"
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
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-sm font-bold opacity-60 uppercase tracking-wider">
                            <div className="w-2 h-2 rounded-full bg-black"></div>
                            Dashboard
                        </div>
                        <div 
                            className="flex items-center bg-black/5 rounded-full p-1 touch-pan-y"
                            onTouchStart={dateSwipeHandlers.onTouchStart}
                            onTouchMove={dateSwipeHandlers.onTouchMove}
                            onTouchEnd={dateSwipeHandlers.onTouchEnd}
                        >
                            <button onClick={() => changeThemeMonth(-1)} className="p-2 hover:bg-black/5 rounded-full"><ChevronLeft className="w-4 h-4" /></button>
                            <AnimatePresence mode="wait">
                                <motion.span 
                                    key={themeNavDate.toISOString()}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="px-2 text-sm font-bold min-w-[80px] text-center"
                                >
                                    {themeNavDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                </motion.span>
                            </AnimatePresence>
                            <button onClick={() => changeThemeMonth(1)} className="p-2 hover:bg-black/5 rounded-full"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold mb-1 tracking-tight leading-tight">
                                {themeContent ? `"${themeContent}"` : "Set a theme..."}
                            </h1>
                            <button onClick={() => onThemeEdit(themeContent)} className="text-sm font-medium opacity-50 hover:opacity-100 flex items-center gap-1 mt-2">
                                <Pencil className="w-3 h-3" /> Edit Theme
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="px-4 space-y-8"
            >
                {/* 1. Quick Actions */}
                <section>
                    <div className="grid grid-cols-4 gap-3">
                        <button onClick={() => handleOpenAddTask(new Date().toISOString().split('T')[0])} className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/20 group-active:scale-95 transition-transform">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Task</span>
                        </button>
                        <button onClick={() => handleOpenAddShopping()} className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 bg-white text-black border border-black/10 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Buy</span>
                        </button>
                        <button onClick={handleOpenAddNote} className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 bg-white text-black border border-black/10 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
                                <StickyNote className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Note</span>
                        </button>
                        <button onClick={handleOpenAddExpense} className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 bg-white text-black border border-black/10 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
                                <WalletIcon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Expense</span>
                        </button>
                    </div>
                </section>

                {/* 2. Dynamic Focus Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                {DisplayIcon}
                                {displayTitle}
                            </h2>
                            {displaySubtitle && (
                                <p className="text-xs opacity-50 font-medium mt-0.5">{displaySubtitle}</p>
                            )}
                        </div>
                        <button onClick={() => setActiveTab('focus')} className="text-xs font-bold opacity-50 hover:opacity-100 uppercase tracking-wider">
                            View All
                        </button>
                    </div>
                    
                    {displayItems.length > 0 ? (
                        <div className={`space-y-3 ${isDoneState ? 'opacity-60 grayscale' : ''}`}>
                            {displayItems.map(item => (
                                <Card key={item.id} item={item} {...cardProps} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                            <p className="text-muted font-medium">All clear!</p>
                            <p className="text-xs opacity-50 mt-1">Take a break or plan ahead.</p>
                        </div>
                    )}
                </section>

                {/* 3. Daily Rituals (Horizontal Scroll) */}
                {showRitualsSection && (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Coffee className="w-5 h-5 text-indigo-500" />
                                Rituals
                            </h2>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                            {pendingRoutines.map(routine => (
                                <button 
                                    key={routine.id}
                                    onClick={() => handleToggleStatus(routine.id)}
                                    className="flex-shrink-0 flex flex-col items-center gap-2 min-w-[72px]"
                                >
                                    <div className="w-16 h-16 bg-white dark:bg-zinc-800 border-2 border-indigo-500/20 rounded-full flex items-center justify-center transition-all hover:border-indigo-500 hover:bg-indigo-500/10">
                                        <CheckCircle2 className="w-6 h-6 text-indigo-500 opacity-50" />
                                    </div>
                                    <span className="text-[10px] font-medium text-center line-clamp-2 w-full opacity-70 leading-tight">
                                        {routine.content}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* 4. Financial Snapshot */}
                <section onClick={() => setActiveTab('money')} className="cursor-pointer group">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                            Financials
                        </h2>
                        <ArrowRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-[24px] p-5 relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 right-0 p-5 opacity-5 dark:opacity-10">
                            <WalletIcon className="w-24 h-24" />
                        </div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-sm font-medium opacity-60 mb-1">Net Worth</p>
                                    <div className="text-2xl font-bold flex items-center gap-2">
                                        {showBalance ? fmt(totalNetWorth) : '••••••••'}
                                        <button onClick={(e) => { e.stopPropagation(); setShowBalance(!showBalance); }} className="opacity-50 hover:opacity-100">
                                            {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <div className="flex justify-between text-xs font-medium mb-2 opacity-80">
                                    <span>Monthly Spending</span>
                                    <span>{budgetPercent.toFixed(0)}% of Budget</span>
                                </div>
                                <div className="h-2 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${budgetPercent > 100 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${budgetPercent}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[10px] mt-1 opacity-50">
                                    <span>{fmt(totalExpense)}</span>
                                    <span>{fmt(totalLimits)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </motion.div>
        </div>
    );
};

export default SummaryView;
