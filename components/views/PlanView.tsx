import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ShoppingCart, PiggyBank, Pencil, Trash2, Plus, History, ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { BrainDumpItem, PlanSubTab, Skill, AppSettings, FinanceType, Wallet, BudgetRule, Tab, Priority, ShoppingCategory, ItemType } from '../../types';
import { getFocusMonthData, getShoppingItems } from '../../utils/selectors';
import Card from '../Card';
import ShoppingItem from '../ShoppingItem';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';

interface PlanViewProps {
    items: BrainDumpItem[];
    skills: Skill[];
    planSubTab: PlanSubTab;
    setPlanSubTab: (tab: PlanSubTab) => void;
    
    focusDate: Date;
    setFocusDate: (d: Date) => void;
    
    appSettings: AppSettings;
    handleToggleStatus: (id: string) => void;
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
    handleOpenAddRoutine: () => void;
    handleOpenAddTask: (initialDate?: string) => void;
    handleOpenAddShopping: (category: ShoppingCategory) => void;
    handleOpenEditSkill: (id: string, name: string, target?: number) => void;
    handleOpenAddSkill: () => void;
    setDeleteId: (id: string) => void;
    setDeleteType: (type: 'skill' | 'wallet' | null) => void;
    
    searchQuery: string;
    selectedTag: string;
    
    // Context
    wallets: Wallet[];
    budgetRules: BudgetRule[];
    handleResetRoutine: (id: string) => void;
    onAddFunds: (amount: number, walletId: string, date: string, goalId: string, goalName: string) => void;
    onCompleteGoal: (goal: BrainDumpItem) => void;
    setActiveTab: (tab: Tab) => void;
}

const PlanView: React.FC<PlanViewProps> = ({
    items, skills, planSubTab, setPlanSubTab,
    focusDate, setFocusDate,
    appSettings, handleToggleStatus, handleDelete, handleUpdateItem,
    handleOpenAddRoutine, handleOpenAddTask, handleOpenAddShopping, handleOpenEditSkill, handleOpenAddSkill, setDeleteId, setDeleteType,
    searchQuery, selectedTag,
    wallets, budgetRules, handleResetRoutine, onAddFunds, onCompleteGoal, setActiveTab
}) => {
    
    // Data Preparation
    const { summary, pendingGroups, doneList } = getFocusMonthData(items, focusDate, searchQuery, selectedTag);
    const { today, tomorrow, later, routines } = pendingGroups;
    
    const { urgent, routine, normal, savings } = getShoppingItems(items);
    const isShoppingEmpty = urgent.length === 0 && routine.length === 0 && normal.length === 0;
    const [taskFocusFilter, setTaskFocusFilter] = useState<'all' | 'today' | 'overdue' | 'routine' | 'done'>('all');

    const overdue = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const loweredQuery = searchQuery.trim().toLowerCase();
        return items.filter(item => {
            if (item.status !== 'pending') return false;
            if (item.type !== ItemType.TODO && item.type !== ItemType.EVENT) return false;
            if (selectedTag && !(item.meta.tags || []).includes(selectedTag)) return false;
            if (loweredQuery) {
                const haystack = [
                    item.content,
                    ...(item.meta.tags || []),
                    item.meta.budgetCategory || '',
                    item.meta.paymentMethod || ''
                ].join(' ').toLowerCase();
                if (!haystack.includes(loweredQuery)) return false;
            }
            const dateValue = item.meta.start || item.meta.date || item.meta.dateTime;
            if (!dateValue) return false;
            const itemDate = new Date(dateValue);
            itemDate.setHours(0, 0, 0, 0);
            return itemDate < now;
        });
    }, [items, searchQuery, selectedTag]);

    const shoppingEstimatedTotal = [...urgent, ...routine, ...normal].reduce((sum, item) => sum + (item.meta.amount || 0), 0);
    const nextGoal = savings
        .map(goal => ({
            goal,
            target: goal.meta.amount || 0,
            saved: goal.meta.savedAmount || 0,
            remaining: Math.max(0, (goal.meta.amount || 0) - (goal.meta.savedAmount || 0))
        }))
        .sort((a, b) => a.remaining - b.remaining)[0];

    const taskSections = useMemo(() => {
        const sections = [
            {
                key: 'overdue',
                title: 'Overdue',
                tone: 'text-amber-500',
                hoverTone: 'hover:bg-amber-500/10',
                items: overdue,
                addAction: () => handleOpenAddTask(new Date().toISOString().split('T')[0]),
            },
            {
                key: 'today',
                title: 'Today',
                tone: 'text-red-500',
                hoverTone: 'hover:bg-red-500/10',
                items: today,
                addAction: () => handleOpenAddTask(new Date().toISOString().split('T')[0]),
            },
            {
                key: 'routine',
                title: 'Routines',
                tone: 'text-indigo-500',
                hoverTone: 'hover:bg-indigo-500/10',
                items: routines,
                addAction: handleOpenAddRoutine,
            },
            {
                key: 'tomorrow',
                title: 'Tomorrow',
                tone: 'text-acc-event',
                hoverTone: 'hover:bg-acc-event/10',
                items: tomorrow,
                addAction: () => handleOpenAddTask(new Date(Date.now() + 86400000).toISOString().split('T')[0]),
            },
            {
                key: 'later',
                title: 'Later',
                tone: 'text-muted',
                hoverTone: 'hover:bg-muted/10',
                items: later,
                addAction: () => handleOpenAddTask(new Date(Date.now() + 172800000).toISOString().split('T')[0]),
            },
        ];

        if (taskFocusFilter === 'today') return sections.filter(section => section.key === 'today');
        if (taskFocusFilter === 'overdue') return sections.filter(section => section.key === 'overdue');
        if (taskFocusFilter === 'routine') return sections.filter(section => section.key === 'routine');
        return sections;
    }, [overdue, today, routines, tomorrow, later, taskFocusFilter, handleOpenAddRoutine, handleOpenAddTask]);

    const taskEmptyMessage = useMemo(() => {
        switch (taskFocusFilter) {
            case 'today': return 'Nothing queued for today.';
            case 'overdue': return 'No overdue items. Nice.';
            case 'routine': return 'No routines yet.';
            case 'done': return 'No completed tasks match this filter yet.';
            default: return 'No pending tasks for this month.';
        }
    }, [taskFocusFilter]);

    const [addFundsModal, setAddFundsModal] = useState<{ isOpen: boolean, goalId: string, goalName: string, defaultWallet?: string } | null>(null);
    const [fundAmount, setFundAmount] = useState('');
    const [fundWallet, setFundWallet] = useState('');
    const [fundDate, setFundDate] = useState(new Date().toISOString().split('T')[0]);

    // Main Tab Swipe Logic
    const swipeHandlers = useSwipeTabs('plan', setActiveTab);

    // Date Swipe Logic
    const changeMonth = (offset: number) => {
        const newDate = new Date(focusDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setFocusDate(newDate);
    };

    const dateSwipeHandlers = useSwipeDate(
        () => changeMonth(-1),
        () => changeMonth(1)
    );

    // Sub-Tab Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartRef = React.useRef<{ x: number, y: number } | null>(null);
    const isHorizontalSwipe = React.useRef<boolean | null>(null);

    const tabs: PlanSubTab[] = ['tasks', 'shopping', 'savings'];
    const activeIndex = tabs.indexOf(planSubTab);

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
            if ((activeIndex === 0 && dx > 0) || (activeIndex === tabs.length - 1 && dx < 0)) {
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
            if (dragOffset < 0 && activeIndex < tabs.length - 1) {
                setPlanSubTab(tabs[activeIndex + 1]);
            }
            if (dragOffset > 0 && activeIndex > 0) {
                setPlanSubTab(tabs[activeIndex - 1]);
            }
        }
        
        setDragOffset(0);
        touchStartRef.current = null;
        isHorizontalSwipe.current = null;
    };

    const handleSaveFunds = () => {
        if (!addFundsModal || !fundAmount || !fundWallet) return;
        onAddFunds(Number(fundAmount), fundWallet, new Date(fundDate).toISOString(), addFundsModal.goalId, addFundsModal.goalName);
        setAddFundsModal(null);
        setFundAmount('');
        setFundWallet('');
        setFundDate(new Date().toISOString().split('T')[0]);
    };

    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editDedicatedWalletId, setEditDedicatedWalletId] = useState('');

    const handleSaveEdit = (goal: BrainDumpItem) => {
        handleUpdateItem(
            goal.id,
            editContent,
            goal.meta.tags || [],
            Number(editAmount),
            new Date(editDate).toISOString(),
            goal.meta.paymentMethod,
            goal.meta.budgetCategory,
            goal.meta.durationMinutes,
            goal.meta.skillId,
            goal.meta.toWallet,
            'saving',
            goal.meta.progress,
            goal.meta.progressNotes,
            goal.meta.shoppingCategory,
            goal.meta.recurrenceDays,
            goal.meta.quantity,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            editDedicatedWalletId
        );
        setExpandedGoalId(null);
    };

    const renderGoalCard = (goal: BrainDumpItem) => {
        const target = goal.meta.amount || 0;
        const saved = goal.meta.savedAmount || 0;
        const progress = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
        const isDone = goal.status === 'done';
        const isExpanded = expandedGoalId === goal.id;
        
        const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

        return (
            <motion.div 
                layout={!isDragging}
                transition={{ type: "tween", duration: 0.3 }}
                key={goal.id} 
                className={`bg-surface rounded-[24px] overflow-hidden ${isDone ? 'opacity-60' : ''}`}
            >
                <div 
                    className="p-5 cursor-pointer"
                    onClick={() => {
                        if (isExpanded) {
                            setExpandedGoalId(null);
                        } else {
                            setExpandedGoalId(goal.id);
                            setEditContent(goal.content);
                            setEditAmount(goal.meta.amount?.toString() || '');
                            setEditDate(goal.meta.date ? goal.meta.date.split('T')[0] : new Date().toISOString().split('T')[0]);
                            setEditDedicatedWalletId(goal.meta.dedicatedWalletId || '');
                        }
                    }}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <h4 className="font-bold text-lg text-primary">{goal.content}</h4>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xl font-bold text-indigo-500">{fmt(saved)}</span>
                                <span className="text-sm text-muted font-medium">/ {fmt(target)}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {isDone ? (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(goal.id); }}
                                    className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-colors"
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setAddFundsModal({ isOpen: true, goalId: goal.id, goalName: goal.content, defaultWallet: goal.meta.dedicatedWalletId });
                                            if (goal.meta.dedicatedWalletId) setFundWallet(goal.meta.dedicatedWalletId);
                                        }}
                                        className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl hover:bg-indigo-500/20 transition-colors"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                    {progress >= 100 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onCompleteGoal(goal); }}
                                            className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                                        >
                                            <CheckCircle2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="w-full h-3 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-1000 ease-out ${progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    <div className="flex justify-between items-center mt-3">
                        <span className="text-xs font-bold text-muted uppercase tracking-wider">{progress.toFixed(0)}% Complete</span>
                        {goal.meta.date && (
                            <span className="text-xs font-medium text-muted flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Target: {new Date(goal.meta.date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                            </span>
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border bg-black/5 dark:bg-white/10"
                        >
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Goal Name</label>
                                    <input 
                                        type="text"
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl p-3 text-sm text-primary focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Target Amount</label>
                                        <input 
                                            type="number"
                                            value={editAmount}
                                            onChange={e => setEditAmount(e.target.value)}
                                            className="w-full bg-background border border-border rounded-xl p-3 text-sm text-primary focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Target Date</label>
                                        <input 
                                            type="date"
                                            value={editDate}
                                            onChange={e => setEditDate(e.target.value)}
                                            className="w-full bg-background border border-border rounded-xl p-3 text-sm text-primary focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Dedicated Wallet (Optional)</label>
                                    <select 
                                        value={editDedicatedWalletId}
                                        onChange={e => setEditDedicatedWalletId(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl p-3 text-sm text-primary focus:outline-none focus:border-indigo-500 appearance-none"
                                    >
                                        <option value="">None</option>
                                        {wallets.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-muted mt-1">If set, funds can only be added from this wallet.</p>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button 
                                        onClick={() => handleDelete(goal.id)}
                                        className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleSaveEdit(goal)}
                                        className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

    const cardProps = {
        onToggleStatus: handleToggleStatus,
        onUpdate: handleUpdateItem,
        onDelete: handleDelete,
        enableCollapse: true,
        defaultCollapsed: appSettings.defaultCollapsed,
        hideMoney: appSettings.hideMoney,
        skills,
        wallets,
        budgetRules,
        onResetRoutine: handleResetRoutine
    };

    return (
        <div className="min-h-[50vh] overflow-hidden pb-20">
            {/* Top Container */}
            <motion.div 
                layoutId="top-container"
                className="bg-surface text-primary rounded-b-[32px] p-6 pt-12 mb-4 touch-pan-y"
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
                    <div className="flex bg-black/5 dark:bg-white/20 rounded-2xl p-1 mb-6">
                        <button 
                            onClick={() => setPlanSubTab('tasks')}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${planSubTab === 'tasks' ? 'bg-surface text-primary' : 'text-primary/40 hover:text-primary'}`}
                        >
                            <CheckCircle2 className="w-4 h-4" /> Tasks
                        </button>
                        <button 
                            onClick={() => setPlanSubTab('shopping')}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${planSubTab === 'shopping' ? 'bg-surface text-primary' : 'text-primary/40 hover:text-primary'}`}
                        >
                            <ShoppingCart className="w-4 h-4" /> Shopping
                        </button>
                        <button 
                            onClick={() => setPlanSubTab('savings')}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${planSubTab === 'savings' ? 'bg-surface text-primary' : 'text-primary/40 hover:text-primary'}`}
                        >
                            <PiggyBank className="w-4 h-4" /> Goals
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={planSubTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {planSubTab === 'tasks' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold tracking-tight">
                                                {focusDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                            </h2>
                                            <p className="text-sm text-muted font-medium flex items-center gap-2 mt-1">
                                                <span>{summary.todo} Pending</span>
                                                <span>•</span>
                                                <span className="text-emerald-500">{summary.done} Done</span>
                                                <span>•</span>
                                                <span className="text-indigo-500">{routines?.length || 0} Routines</span>
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => changeMonth(-1)} className="p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors">
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => changeMonth(1)} className="p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors">
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { key: 'today', label: 'Today', value: today.length, tone: 'text-red-500 bg-red-500/10' },
                                            { key: 'overdue', label: 'Overdue', value: overdue.length, tone: overdue.length > 0 ? 'text-amber-500 bg-amber-500/10' : 'text-primary/70 bg-black/5' },
                                            { key: 'routine', label: 'Routines', value: routines.length, tone: 'text-indigo-500 bg-indigo-500/10' },
                                            { key: 'done', label: 'Done', value: doneList.length, tone: 'text-emerald-500 bg-emerald-500/10' },
                                        ].map(stat => (
                                            <button
                                                key={stat.key}
                                                onClick={() => setTaskFocusFilter(stat.key as 'today' | 'overdue' | 'routine' | 'done')}
                                                className={`rounded-2xl p-3 text-left transition-all border ${taskFocusFilter === stat.key ? 'border-primary/30 bg-surface' : 'border-transparent bg-black/5 dark:bg-white/10 hover:border-primary/20'}`}
                                            >
                                                <div className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${stat.tone}`}>{stat.label}</div>
                                                <div className="mt-2 text-xl font-bold">{stat.value}</div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { key: 'all', label: 'All lanes' },
                                            { key: 'today', label: 'Today first' },
                                            { key: 'overdue', label: 'Needs rescue' },
                                            { key: 'routine', label: 'Routines only' },
                                            { key: 'done', label: 'Completed' },
                                        ].map(option => (
                                            <button
                                                key={option.key}
                                                onClick={() => setTaskFocusFilter(option.key as 'all' | 'today' | 'overdue' | 'routine' | 'done')}
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${taskFocusFilter === option.key ? 'bg-surface text-primary' : 'bg-black/5 dark:bg-white/10 text-primary/70 hover:text-primary'}`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {planSubTab === 'shopping' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold tracking-tight">Shopping List</h2>
                                            <p className="text-sm text-muted font-medium flex items-center gap-2 mt-1">
                                                <span className="text-red-500">{urgent.length} Urgent</span>
                                                <span>•</span>
                                                <span className="text-indigo-500">{routine.length} Routine</span>
                                                <span>•</span>
                                                <span>{normal.length} Normal</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl bg-black/5 dark:bg-white/10 p-3">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Total items</div>
                                            <div className="mt-2 text-xl font-bold">{urgent.length + routine.length + normal.length}</div>
                                        </div>
                                        <div className="rounded-2xl bg-black/5 dark:bg-white/10 p-3">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Est. total</div>
                                            <div className="mt-2 text-xl font-bold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(shoppingEstimatedTotal)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {planSubTab === 'savings' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold tracking-tight">Goals & Savings</h2>
                                            <p className="text-sm text-muted font-medium flex items-center gap-2 mt-1">
                                                <span>{savings.length} Goals</span>
                                                <span>•</span>
                                                <span className="text-emerald-500">
                                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(savings.reduce((acc, curr) => acc + (curr.meta.savedAmount || 0), 0))} Saved
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    {nextGoal && (
                                        <div className="rounded-[24px] bg-black/5 dark:bg-white/10 p-4">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Next milestone</div>
                                            <div className="mt-2 text-lg font-bold">{nextGoal.goal.content}</div>
                                            <p className="mt-1 text-sm text-primary/70">
                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(nextGoal.remaining)} left to reach the target.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
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
                {/* VIEW: Tasks */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex-shrink-0 px-4"
                >
                    <div className="space-y-8">
                        {taskFocusFilter === 'done' ? (
                            doneList.length > 0 ? (
                                <section>
                                    <div className="flex items-center justify-between mb-3 pl-1">
                                        <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                            <span className="bg-emerald-500/10 p-1 rounded-md"><CheckCircle2 className="w-3 h-3" /></span> Completed this month
                                        </h3>
                                    </div>
                                    <div className="space-y-3">{doneList.map(item => <Card key={item.id} item={item} {...cardProps} />)}</div>
                                </section>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-[32px] gap-4">
                                    <p className="text-muted font-medium">{taskEmptyMessage}</p>
                                    <button 
                                        onClick={() => setTaskFocusFilter('all')}
                                        className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 text-primary rounded-2xl text-sm font-bold transition-colors"
                                    >
                                        Show all lanes
                                    </button>
                                </div>
                            )
                        ) : taskSections.some(section => section.items.length > 0) ? (
                            <div className="space-y-8">
                                {taskSections.filter(section => section.items.length > 0 || taskFocusFilter !== 'all').map(section => (
                                    <section key={section.key}>
                                        <div className="flex items-center justify-between mb-3 pl-1">
                                            <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${section.tone}`}>
                                                <span className={`${section.tone.replace('text-', 'bg-').replace('acc-event', 'indigo-500')}/10 p-1 rounded-md`}><CheckCircle2 className="w-3 h-3" /></span>
                                                {section.title}
                                            </h3>
                                            <button 
                                                onClick={section.addAction}
                                                className={`p-1 ${section.hoverTone} ${section.tone} rounded-md transition-colors`}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {section.items.length > 0 ? (
                                            <div className="space-y-3">{section.items.map(item => <Card key={item.id} item={item} {...cardProps} />)}</div>
                                        ) : (
                                            <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                                        )}
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-[32px] gap-4">
                                <p className="text-muted font-medium">{taskEmptyMessage}</p>
                                <div className="flex gap-3 flex-wrap justify-center">
                                    <button 
                                        onClick={() => handleOpenAddTask()} 
                                        className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 text-primary rounded-2xl text-sm font-bold transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> Add Task
                                    </button>
                                    <button 
                                        onClick={handleOpenAddRoutine}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-2xl text-sm font-bold transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> Add Routine
                                    </button>
                                    {taskFocusFilter !== 'all' && (
                                        <button 
                                            onClick={() => setTaskFocusFilter('all')}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-2xl text-sm font-bold transition-colors"
                                        >
                                            Show all lanes
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* VIEW: Shopping */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex-shrink-0 px-4"
                >
                    <div className="space-y-8">
                        <section>
                            <div className="flex items-center justify-between mb-3 pl-1">
                                <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider flex items-center gap-2">
                                    <span className="bg-red-500/10 p-1 rounded-md"><ShoppingCart className="w-3 h-3" /></span> Urgent
                                </h3>
                                <button 
                                    onClick={() => handleOpenAddShopping('urgent')}
                                    className="p-1 hover:bg-red-500/10 text-red-500 rounded-md transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            {urgent.length > 0 ? (
                                <div className="space-y-3">{urgent?.map(item => <ShoppingItem key={item.id} item={item} onToggleStatus={handleToggleStatus} onUpdate={handleUpdateItem} onDelete={handleDelete} wallets={wallets} />)}</div>
                            ) : (
                                <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                            )}
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-3 pl-1">
                                <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2">
                                    <span className="bg-indigo-500/10 p-1 rounded-md"><History className="w-3 h-3" /></span> Routine
                                </h3>
                                <button 
                                    onClick={() => handleOpenAddShopping('routine')}
                                    className="p-1 hover:bg-indigo-500/10 text-indigo-500 rounded-md transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            {routine.length > 0 ? (
                                <div className="space-y-3">{routine?.map(item => <ShoppingItem key={item.id} item={item} onToggleStatus={handleToggleStatus} onUpdate={handleUpdateItem} onDelete={handleDelete} wallets={wallets} onResetRoutine={handleResetRoutine} />)}</div>
                            ) : (
                                <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                            )}
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-3 pl-1">
                                <h3 className="text-sm font-bold text-muted uppercase tracking-wider">Normal</h3>
                                <button 
                                    onClick={() => handleOpenAddShopping('not_urgent')}
                                    className="p-1 hover:bg-muted/10 text-muted rounded-md transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            {normal.length > 0 ? (
                                <div className="space-y-3">{normal?.map(item => <ShoppingItem key={item.id} item={item} onToggleStatus={handleToggleStatus} onUpdate={handleUpdateItem} onDelete={handleDelete} wallets={wallets} />)}</div>
                            ) : (
                                <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                            )}
                        </section>

                        {isShoppingEmpty && (
                            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-[32px] gap-4">
                                <p className="text-muted font-medium">Your shopping list is empty.</p>
                                <button 
                                    onClick={() => handleOpenAddShopping('not_urgent')} 
                                    className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 text-primary rounded-2xl text-sm font-bold transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add Item
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* VIEW: Savings */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex-shrink-0 px-4"
                >
                    <div className="flex items-center justify-between mb-4 pl-1">
                        <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider">Saving Goals</h3>
                        <button 
                            onClick={() => handleOpenAddShopping('saving')}
                            className="p-1 hover:bg-indigo-500/10 text-indigo-500 rounded-md transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {savings.length > 0 ? (
                        <div className="space-y-4">
                            {savings?.map(goal => renderGoalCard(goal))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-[32px] gap-4">
                            <p className="text-muted font-medium">No saving goals yet.</p>
                            <button 
                                onClick={() => handleOpenAddShopping('saving')} 
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-2xl text-sm font-bold transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Create Goal
                            </button>
                        </div>
                    )}
                </motion.div>
                </motion.div>
            </motion.div>

            {/* Add Funds Modal */}
            <AnimatePresence>
                {addFundsModal?.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            className="bg-surface border border-border rounded-t-[32px] sm:rounded-[32px] w-full max-w-md overflow-hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                                    <PiggyBank className="w-5 h-5 text-indigo-500" />
                                    Add Funds
                                </h3>
                                <button onClick={() => setAddFundsModal(null)} className="p-2 bg-muted/10 hover:bg-muted/20 rounded-full text-muted transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <p className="text-sm font-medium text-muted">Adding funds to: <span className="text-primary font-bold">{addFundsModal.goalName}</span></p>
                                
                                <div>
                                    <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Amount</label>
                                    <input 
                                        type="number"
                                        autoFocus
                                        value={fundAmount}
                                        onChange={e => setFundAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium text-2xl"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">From Wallet</label>
                                    <select 
                                        value={fundWallet}
                                        onChange={e => setFundWallet(e.target.value)}
                                        className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={!!addFundsModal.defaultWallet}
                                    >
                                        <option value="">Select Wallet</option>
                                        {wallets.map(w => (
                                            <option key={w.id} value={w.id}>{w.name} ({new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(w.initialBalance)})</option>
                                        ))}
                                    </select>
                                    {!!addFundsModal.defaultWallet && (
                                        <p className="text-xs text-muted mt-2">Locked to dedicated wallet for this goal.</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                        <input 
                                            type="date"
                                            value={fundDate}
                                            onChange={e => setFundDate(e.target.value)}
                                            className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-border shrink-0">
                                <button 
                                    onClick={handleSaveFunds}
                                    disabled={!fundAmount || !fundWallet}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Add Funds
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PlanView;
