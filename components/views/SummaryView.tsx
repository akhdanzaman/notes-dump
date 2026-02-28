
import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Sparkles, ChevronRight, Pencil, Target, CheckCircle2, ShoppingCart, AlertTriangle, ArrowRight, Wallet as WalletIcon, EyeOff, Eye, ArrowUpRight, ArrowDownRight, Sprout, StickyNote } from 'lucide-react';
import { BrainDumpItem, Skill, Wallet, BudgetConfig, ItemType, Tab } from '../../types';
import { getFocusItems, getSkillItems, getShoppingItems, getWalletStats, getFinanceItems } from '../../utils/selectors';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';

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
}

const SummaryView: React.FC<SummaryViewProps> = ({
    items, skills, wallets, budgetConfig,
    themeNavDate, setThemeNavDate, monthlyThemes, onThemeEdit,
    handleToggleStatus, setActiveTab, setFocusSubTab,
    showBalance, setShowBalance
}) => {
    // Swipe Logic
    const swipeHandlers = useSwipeTabs('summary', setActiveTab);

    // Calculate metrics
    const { today } = getFocusItems(items);
    const { stats } = getSkillItems(items, skills);
    const totalWeeklyHours = stats.reduce((acc, s) => acc + s.weeklyHours, 0);

    const { urgent } = getShoppingItems(items);
    
    const { totalNetWorth, totalAssets, totalDebt } = getWalletStats(items, wallets);
    // Use current date for summary finance view
    const { totalExpense, totalIncome, balance } = getFinanceItems(items, new Date(), budgetConfig, '', '', '', '', '', '', '', 'newest');
    
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
        <div className="pb-20">
            {/* Top Container */}
            <motion.div 
                layoutId="top-container"
                className="bg-white dark:bg-zinc-100 text-black rounded-b-[32px] p-6 pt-12 shadow-sm mb-4 touch-pan-y"
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
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <div className="w-2 h-2 rounded-full bg-black"></div>
                            Overview
                        </div>
                        <button onClick={() => onThemeEdit(themeContent)} className="p-2 bg-black/5 rounded-full hover:bg-black/10 transition-colors">
                            <Pencil className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <h1 className="text-3xl font-bold mb-2 tracking-tight">
                        {themeContent ? `"${themeContent}"` : "Set a theme..."}
                    </h1>
                    <p className="text-lg font-medium mb-6 opacity-80">
                        {today.length} tasks and {urgent.length} urgent items today
                    </p>

                    <div className="flex gap-2">
                        <button onClick={() => setActiveTab('focus')} className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-bold hover:opacity-90 transition-opacity">
                            Focus Mode
                        </button>
                        <div className="flex items-center bg-black/5 rounded-full p-1">
                            <button onClick={() => changeThemeMonth(-1)} className="p-2 hover:bg-black/5 rounded-full"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="px-2 text-sm font-bold">{themeNavDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                            <button onClick={() => changeThemeMonth(1)} className="p-2 hover:bg-black/5 rounded-full"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* Lower Cards */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="px-4 space-y-3"
            >
                <div onClick={() => setActiveTab('money')} className="bg-[#FF5722] text-white rounded-[24px] p-5 cursor-pointer hover:opacity-90 transition-opacity">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-sm font-bold opacity-90">
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                            Net Worth
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setShowBalance(!showBalance); }} className="opacity-80 hover:opacity-100">
                            {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="text-3xl font-bold">
                        {showBalance ? fmt(totalNetWorth) : '••••••••'}
                    </div>
                </div>

                <div onClick={() => { setActiveTab('focus'); setFocusSubTab('skills'); }} className="bg-[#3BA4D8] text-white rounded-[24px] p-5 cursor-pointer hover:opacity-90 transition-opacity">
                    <div className="flex items-center gap-2 text-sm font-bold mb-2 opacity-90">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                        Growth
                    </div>
                    <div className="text-3xl font-bold">
                        {totalWeeklyHours}<span className="text-xl font-normal opacity-80">h</span>
                    </div>
                </div>

                <div onClick={() => setActiveTab('notes')} className="bg-[#2A2A2E] text-white rounded-[24px] p-5 cursor-pointer hover:opacity-90 transition-opacity">
                    <div className="flex items-center gap-2 text-sm font-bold mb-2 opacity-90">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                        Brain Bank
                    </div>
                    <div className="text-3xl font-bold">
                        {noteCount} <span className="text-xl font-normal opacity-80">notes</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default SummaryView;
