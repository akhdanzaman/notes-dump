import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ShoppingCart, PiggyBank, Pencil, Trash2, Plus, History, ChevronLeft, ChevronRight, Calendar, X, Sparkles, Timer, Flag, ShieldAlert, ListChecks, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { BrainDumpItem, PlanSubTab, Skill, AppSettings, FinanceType, Wallet, BudgetRule, Tab, Priority, ShoppingCategory } from '../../types';
import { getFocusMonthData, getShoppingItems } from '../../utils/selectors';
import { getDeepWorkChildren } from '../../utils/deepWorkTodoModel';
import Card from '../Card';
import ShoppingItem from '../ShoppingItem';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';
import { useLazyItems } from '../../hooks/useLazyItems';
import LoadMoreButton from '../LoadMoreButton';
import { contentSurface, responsiveModal } from '../layout/contentSurface';

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
    handleKeepRawTodo: (id: string) => void;
    handleRetriggerDeepWorkTodo: (id: string) => void;
    handleAcceptDeepWorkTodo: (id: string, subtasks?: string[]) => void;
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
    appSettings, handleToggleStatus, handleDelete, handleKeepRawTodo, handleRetriggerDeepWorkTodo, handleAcceptDeepWorkTodo, handleUpdateItem,
    handleOpenAddRoutine, handleOpenAddTask, handleOpenAddShopping, handleOpenEditSkill, handleOpenAddSkill, setDeleteId, setDeleteType,
    searchQuery, selectedTag,
    wallets, budgetRules, handleResetRoutine, onAddFunds, onCompleteGoal, setActiveTab
}) => {
    
    // Data Preparation
    const { summary, pendingGroups, doneList } = getFocusMonthData(items, focusDate, searchQuery, selectedTag);
    const { today, tomorrow, later, routines } = pendingGroups;
    const rootToday = today.filter(item => !item.meta.parentTodoId);
    const rootTomorrow = tomorrow.filter(item => !item.meta.parentTodoId);
    const rootLater = later.filter(item => !item.meta.parentTodoId);
    const rootRoutines = (routines || []).filter(item => !item.meta.parentTodoId);
    
    const { urgent, routine, normal, savings } = getShoppingItems(items);
    const isShoppingEmpty = urgent.length === 0 && routine.length === 0 && normal.length === 0;

    const taskResetKey = `plan-tasks-${focusDate.getFullYear()}-${focusDate.getMonth()}-${searchQuery}-${selectedTag}`;
    const shoppingResetKey = `plan-shopping-${searchQuery}-${selectedTag}`;

    const visibleToday = useLazyItems(rootToday, { resetKey: `${taskResetKey}-today-${rootToday.length}` });
    const visibleRoutines = useLazyItems(rootRoutines, { resetKey: `${taskResetKey}-routines-${rootRoutines.length}` });
    const visibleTomorrow = useLazyItems(rootTomorrow, { resetKey: `${taskResetKey}-tomorrow-${rootTomorrow.length}` });
    const visibleLater = useLazyItems(rootLater, { resetKey: `${taskResetKey}-later-${rootLater.length}` });
    const visibleUrgent = useLazyItems(urgent, { resetKey: `${shoppingResetKey}-urgent-${urgent.length}` });
    const visibleRoutineShopping = useLazyItems(routine, { resetKey: `${shoppingResetKey}-routine-${routine.length}` });
    const visibleNormalShopping = useLazyItems(normal, { resetKey: `${shoppingResetKey}-normal-${normal.length}` });
    const visibleSavings = useLazyItems(savings, { resetKey: `plan-savings-${savings.length}` });

    const [addFundsModal, setAddFundsModal] = useState<{ isOpen: boolean, goalId: string, goalName: string, defaultWallet?: string } | null>(null);
    const [fundAmount, setFundAmount] = useState('');
    const [fundWallet, setFundWallet] = useState('');
    const [fundDate, setFundDate] = useState(new Date().toISOString().split('T')[0]);
    const [expandedDeepWorkIds, setExpandedDeepWorkIds] = useState<string[]>([]);
    const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string[]>>({});

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

    const toggleDeepWorkExpanded = (id: string) => {
        setExpandedDeepWorkIds(prev => prev.includes(id) ? prev.filter(existing => existing !== id) : [...prev, id]);
    };

    const getSubtaskDraft = (item: BrainDumpItem, children: BrainDumpItem[]) => {
        return subtaskDrafts[item.id] || item.meta.subtasks || children.map(child => child.content) || [];
    };

    const updateSubtaskDraft = (itemId: string, index: number, value: string, fallback: string[]) => {
        const next = [...fallback];
        next[index] = value;
        setSubtaskDrafts(prev => ({ ...prev, [itemId]: next }));
    };

    const acceptDeepWorkPlan = (item: BrainDumpItem, children: BrainDumpItem[]) => {
        const draft = getSubtaskDraft(item, children).map(step => step.trim()).filter(Boolean);
        handleAcceptDeepWorkTodo(item.id, draft);
        setExpandedDeepWorkIds(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
    };

    const renderDeepWorkDetail = (icon: React.ReactNode, label: string, value?: string | number, tone = 'text-purple-500') => {
        if (value === undefined || value === null || value === '') return null;
        return (
            <div className="rounded-2xl border border-border/60 bg-surface/70 px-3 py-2">
                <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
                    {icon}
                    {label}
                </div>
                <div className="mt-1 text-sm font-medium text-primary leading-snug break-words">{value}</div>
            </div>
        );
    };

    const renderTaskCard = (item: BrainDumpItem) => {
        const children = getDeepWorkChildren(items, item.id);
        const isDeepWork = !!item.meta.deepWorkParent || children.length > 0;
        if (!isDeepWork) return <Card key={item.id} item={item} {...cardProps} />;

        const isExpanded = expandedDeepWorkIds.includes(item.id);
        const isSuggested = item.meta.deepWorkStatus === 'suggested';
        const isBlocked = item.meta.deepWorkBlockerStatus === 'blocked' || item.meta.deepWorkBlockerStatus === 'needs_input';
        const doneCount = children.filter(child => child.status === 'done').length;
        const draft = getSubtaskDraft(item, children);
        const totalSteps = children.length || draft.length || item.meta.deepWorkStepCount || 0;
        const progressPercent = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : (item.meta.progress || 0);

        return (
            <div key={item.id} className="space-y-2 rounded-[24px] border border-purple-500/15 bg-purple-500/[0.03] p-2">
                <Card item={item} {...cardProps} />
                <div className="px-2 pb-2 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 text-purple-500">
                            <Sparkles className="w-4 h-4" />
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider">Deep Work Transformer</div>
                                <div className="text-xs text-muted">Parent stays separate; steps only show progress toward the final output.</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-muted">
                            <span>{doneCount}/{totalSteps} steps</span>
                            <span>•</span>
                            <span>{progressPercent}%</span>
                        </div>
                    </div>

                    {totalSteps > 0 && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-purple-500/10">
                            <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${Math.max(progressPercent, doneCount > 0 ? 4 : 0)}%` }} />
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {renderDeepWorkDetail(<Flag className="w-3 h-3" />, 'Next action', item.meta.deepWorkNextAction)}
                        {renderDeepWorkDetail(<ListChecks className="w-3 h-3" />, 'Final output', item.meta.deepWorkFinalOutput)}
                        {renderDeepWorkDetail(<Timer className="w-3 h-3" />, 'Session estimate', item.meta.deepWorkSessionEstimateMinutes ? `${item.meta.deepWorkSessionEstimateMinutes} min${item.meta.deepWorkSessionEstimateConfidence ? ` • ${item.meta.deepWorkSessionEstimateConfidence}` : ''}` : undefined)}
                        {renderDeepWorkDetail(<ShieldAlert className="w-3 h-3" />, 'Blocker check', item.meta.deepWorkBlockerCheck, isBlocked ? 'text-amber-500' : 'text-emerald-500')}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {isSuggested && (
                            <button onClick={() => acceptDeepWorkPlan(item, children)} className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors">
                                Transform into steps
                            </button>
                        )}
                        <button onClick={() => toggleDeepWorkExpanded(item.id)} className="px-3 py-2 rounded-xl bg-purple-500/10 text-purple-500 text-xs font-bold hover:bg-purple-500/20 transition-colors flex items-center gap-1">
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isExpanded ? 'Hide steps' : `${isSuggested ? 'Preview/edit' : 'Show'} steps`}
                        </button>
                        <button onClick={() => handleKeepRawTodo(item.id)} className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 transition-colors">
                            Keep raw
                        </button>
                        <button onClick={() => handleRetriggerDeepWorkTodo(item.id)} className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 transition-colors flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Retrigger
                        </button>
                    </div>

                    <AnimatePresence initial={false}>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1 ml-1 border-l-2 border-purple-500/25 pl-3 space-y-2">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-purple-500/80">Optional subtasks</div>
                                    {isSuggested ? (
                                        <div className="space-y-2">
                                            {draft.map((step, index) => (
                                                <div key={`${item.id}-draft-${index}`} className="flex gap-2">
                                                    <div className="mt-3 h-5 w-5 shrink-0 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold flex items-center justify-center">{index + 1}</div>
                                                    <textarea
                                                        value={step}
                                                        onChange={(event) => updateSubtaskDraft(item.id, index, event.target.value, draft)}
                                                        className="min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-purple-500/60"
                                                    />
                                                    <button
                                                        onClick={() => setSubtaskDrafts(prev => ({ ...prev, [item.id]: draft.filter((_, draftIndex) => draftIndex !== index) }))}
                                                        className="self-center p-2 rounded-full text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                                        aria-label="Remove subtask"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <button onClick={() => setSubtaskDrafts(prev => ({ ...prev, [item.id]: [...draft, ''] }))} className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 transition-colors">
                                                    Add step
                                                </button>
                                                <button onClick={() => acceptDeepWorkPlan(item, children)} className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors">
                                                    Use these steps
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {children.map(child => (
                                                <Card key={child.id} item={child} {...cardProps} className="rounded-[14px]" />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    };

    return (
        <div className={contentSurface.pageShell}>
            {/* Top Container */}
            <motion.div 
                layoutId="top-container"
                className={contentSurface.headerHero}
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
                                <div>
                                    <div className="flex items-center justify-between mb-6">
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
                                    
                                    
                                </div>
                            )}
                            {planSubTab === 'shopping' && (
                                <div>
                                    <div className="flex items-center justify-between mb-6">
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
                                </div>
                            )}
                            {planSubTab === 'savings' && (
                                <div>
                                    <div className="flex items-center justify-between mb-6">
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
                    className={`w-full flex-shrink-0 ${contentSurface.contentPad}`}
                >
                    <div className="space-y-8">
                        {summary.todo > 0 ? (
                            <div className={contentSurface.workflowGrid}>
                                <section className={contentSurface.workflowPanel}>
                                    <div className="flex items-center justify-between mb-3 pl-1">
                                        <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider flex items-center gap-2">
                                            <span className="bg-red-500/10 p-1 rounded-md"><CheckCircle2 className="w-3 h-3" /></span> Today
                                        </h3>
                                        <button 
                                            onClick={() => handleOpenAddTask(new Date().toISOString().split('T')[0])} 
                                            className="p-1 hover:bg-red-500/10 text-red-500 rounded-md transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {rootToday.length > 0 ? (
                                        <div className={contentSurface.denseList}>
                                            {visibleToday.visibleItems.map(renderTaskCard)}
                                            <LoadMoreButton remainingCount={visibleToday.remainingCount} onClick={visibleToday.loadMore} />
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                                    )}
                                </section>

                                <section className={contentSurface.workflowPanel}>
                                    <div className="flex items-center justify-between mb-3 pl-1">
                                        <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2">
                                            <span className="bg-indigo-500/10 p-1 rounded-md"><CheckCircle2 className="w-3 h-3" /></span> Routines
                                        </h3>
                                        <button 
                                            onClick={handleOpenAddRoutine}
                                            className="p-1 hover:bg-indigo-500/10 text-indigo-500 rounded-md transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {rootRoutines.length > 0 ? (
                                        <div className={contentSurface.denseList}>
                                            {visibleRoutines.visibleItems.map(renderTaskCard)}
                                            <LoadMoreButton remainingCount={visibleRoutines.remainingCount} onClick={visibleRoutines.loadMore} />
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                                    )}
                                </section>

                                <section className={contentSurface.workflowPanel}>
                                    <div className="flex items-center justify-between mb-3 pl-1">
                                        <h3 className="text-sm font-bold text-acc-event uppercase tracking-wider">Tomorrow</h3>
                                        <button 
                                            onClick={() => handleOpenAddTask(new Date(Date.now() + 86400000).toISOString().split('T')[0])} 
                                            className="p-1 hover:bg-acc-event/10 text-acc-event rounded-md transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {rootTomorrow.length > 0 ? (
                                        <div className={contentSurface.denseList}>
                                            {visibleTomorrow.visibleItems.map(renderTaskCard)}
                                            <LoadMoreButton remainingCount={visibleTomorrow.remainingCount} onClick={visibleTomorrow.loadMore} />
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                                    )}
                                </section>

                                <section className={contentSurface.workflowPanel}>
                                    <div className="flex items-center justify-between mb-3 pl-1">
                                        <h3 className="text-sm font-bold text-muted uppercase tracking-wider">Later</h3>
                                        <button 
                                            onClick={() => handleOpenAddTask(new Date(Date.now() + 172800000).toISOString().split('T')[0])} 
                                            className="p-1 hover:bg-muted/10 text-muted rounded-md transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {rootLater.length > 0 ? (
                                        <div className={contentSurface.denseList}>
                                            {visibleLater.visibleItems.map(renderTaskCard)}
                                            <LoadMoreButton remainingCount={visibleLater.remainingCount} onClick={visibleLater.loadMore} />
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                                    )}
                                </section>
                            </div>
                        ) : (
                            summary.todo === 0 && (
                                <div className={`${contentSurface.emptyStateCard} flex flex-col items-center justify-center gap-4`}>
                                    <p className="text-muted font-medium">No pending tasks for this month.</p>
                                    <div className="flex gap-3">
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
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </motion.div>

                {/* VIEW: Shopping */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`w-full flex-shrink-0 ${contentSurface.contentPad}`}
                >
                    <div className={contentSurface.workflowGrid}>
                        <section className={contentSurface.workflowPanel}>
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
                                <div className="space-y-3">
                                    {visibleUrgent.visibleItems.map(item => <ShoppingItem key={item.id} item={item} onToggleStatus={handleToggleStatus} onUpdate={handleUpdateItem} onDelete={handleDelete} budgetRules={budgetRules} wallets={wallets} />)}
                                    <LoadMoreButton remainingCount={visibleUrgent.remainingCount} onClick={visibleUrgent.loadMore} />
                                </div>
                            ) : (
                                <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                            )}
                        </section>

                        <section className={contentSurface.workflowPanel}>
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
                                <div className="space-y-3">
                                    {visibleRoutineShopping.visibleItems.map(item => <ShoppingItem key={item.id} item={item} onToggleStatus={handleToggleStatus} onUpdate={handleUpdateItem} onDelete={handleDelete} budgetRules={budgetRules} wallets={wallets} onResetRoutine={handleResetRoutine} />)}
                                    <LoadMoreButton remainingCount={visibleRoutineShopping.remainingCount} onClick={visibleRoutineShopping.loadMore} />
                                </div>
                            ) : (
                                <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                            )}
                        </section>

                        <section className={contentSurface.workflowPanel}>
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
                                <div className="space-y-3">
                                    {visibleNormalShopping.visibleItems.map(item => <ShoppingItem key={item.id} item={item} onToggleStatus={handleToggleStatus} onUpdate={handleUpdateItem} onDelete={handleDelete} budgetRules={budgetRules} wallets={wallets} />)}
                                    <LoadMoreButton remainingCount={visibleNormalShopping.remainingCount} onClick={visibleNormalShopping.loadMore} />
                                </div>
                            ) : (
                                <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                            )}
                        </section>

                        {isShoppingEmpty && (
                            <div className={`${contentSurface.emptyStateCard} flex flex-col items-center justify-center gap-4`}>
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
                    className={`w-full flex-shrink-0 ${contentSurface.contentPad}`}
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
                        <div className={contentSurface.cardGrid}>
                            {visibleSavings.visibleItems.map(goal => renderGoalCard(goal))}
                            <LoadMoreButton remainingCount={visibleSavings.remainingCount} onClick={visibleSavings.loadMore} />
                        </div>
                    ) : (
                        <div className={`${contentSurface.emptyStateCard} flex flex-col items-center justify-center gap-4`}>
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
                    <div className={responsiveModal.sheetOverlay}>
                        <motion.div 
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            className={`${responsiveModal.sheetPanel} max-w-md lg:max-w-lg border border-border`}
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
