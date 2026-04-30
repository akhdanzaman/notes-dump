import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShoppingCart,
    PiggyBank,
    Trash2,
    Plus,
    ChevronLeft,
    ChevronRight,
    X,
    ListTodo,
    ArrowRight,
    MoreHorizontal
} from 'lucide-react';
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
    wallets: Wallet[];
    budgetRules: BudgetRule[];
    handleResetRoutine: (id: string) => void;
    onAddFunds: (amount: number, walletId: string, date: string, goalId: string, goalName: string) => void;
    onCompleteGoal: (goal: BrainDumpItem) => void;
    setActiveTab: (tab: Tab) => void;
}

const fmt = (n: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
}).format(n);

const formatDueLine = (item: BrainDumpItem) => {
    if (!item.meta.date) return item.meta.isRoutine ? 'Routine' : 'No date';
    const date = new Date(item.meta.date);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86400000;
    const itemStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    if (item.meta.isRoutine) return 'Routine';
    if (itemStart < todayStart) return item.type === ItemType.EVENT ? 'Event • overdue' : 'Task • overdue';
    if (itemStart < tomorrowStart) return item.type === ItemType.EVENT ? 'Event • today' : 'Task • today';
    return `${item.type === ItemType.EVENT ? 'Event' : 'Task'} • ${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
};

const PlanView: React.FC<PlanViewProps> = ({
    items, skills, planSubTab, setPlanSubTab,
    focusDate, setFocusDate,
    appSettings, handleToggleStatus, handleDelete, handleUpdateItem,
    handleOpenAddRoutine, handleOpenAddTask, handleOpenAddShopping, handleOpenEditSkill, handleOpenAddSkill, setDeleteId, setDeleteType,
    searchQuery, selectedTag,
    wallets, budgetRules, handleResetRoutine, onAddFunds, onCompleteGoal, setActiveTab
}) => {
    void skills;
    void handleOpenEditSkill;
    void handleOpenAddSkill;
    void setDeleteId;
    void setDeleteType;

    const swipeHandlers = useSwipeTabs('plan', setActiveTab);
    const [taskFocusFilter, setTaskFocusFilter] = useState<'all' | 'today' | 'overdue' | 'routine' | 'done'>('all');
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [expandedShoppingId, setExpandedShoppingId] = useState<string | null>(null);
    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
    const [addFundsModal, setAddFundsModal] = useState<{ isOpen: boolean, goalId: string, goalName: string, defaultWallet?: string } | null>(null);
    const [fundAmount, setFundAmount] = useState('');
    const [fundWallet, setFundWallet] = useState('');
    const [fundDate, setFundDate] = useState(new Date().toISOString().split('T')[0]);
    const [editContent, setEditContent] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editDedicatedWalletId, setEditDedicatedWalletId] = useState('');

    const changeMonth = (offset: number) => {
        const next = new Date(focusDate);
        next.setMonth(next.getMonth() + offset);
        setFocusDate(next);
    };

    const dateSwipeHandlers = useSwipeDate(
        () => changeMonth(-1),
        () => changeMonth(1)
    );

    const { summary, pendingGroups, doneList } = getFocusMonthData(items, focusDate, searchQuery, selectedTag);
    const { today, tomorrow, later, routines } = pendingGroups;
    const routinePending = routines.filter(item => item.status === 'pending');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const overdueItems = today.filter(item => {
        if (!item.meta.date || item.meta.isRoutine || item.status !== 'pending') return false;
        return new Date(item.meta.date).getTime() < todayStart;
    });
    const todayItems = today.filter(item => !overdueItems.some(overdue => overdue.id === item.id));

    const taskSections = useMemo(() => {
        if (taskFocusFilter === 'done') {
            return doneList.length > 0 ? [{ title: 'Completed', items: doneList.slice(0, 10), tone: 'done' as const }] : [];
        }
        if (taskFocusFilter === 'overdue') {
            return overdueItems.length > 0 ? [{ title: 'Overdue', items: overdueItems, tone: 'urgent' as const }] : [];
        }
        if (taskFocusFilter === 'today') {
            return todayItems.length > 0 ? [{ title: 'Today', items: todayItems, tone: 'default' as const }] : [];
        }
        if (taskFocusFilter === 'routine') {
            return routinePending.length > 0 ? [{ title: 'Routine', items: routinePending, tone: 'muted' as const }] : [];
        }

        const sections: { title: string; items: BrainDumpItem[]; tone: 'urgent' | 'default' | 'muted' | 'done' }[] = [];
        if (overdueItems.length > 0) sections.push({ title: 'Overdue', items: overdueItems, tone: 'urgent' });
        if (todayItems.length > 0) sections.push({ title: 'Today', items: todayItems, tone: 'default' });
        if (routinePending.length > 0) sections.push({ title: 'Routine', items: routinePending, tone: 'muted' });
        if (sections.length === 0 && tomorrow.length > 0) sections.push({ title: 'Tomorrow', items: tomorrow, tone: 'default' });
        if (sections.length < 2 && later.length > 0) sections.push({ title: sections.length === 0 ? 'Upcoming' : 'Later', items: later.slice(0, 6), tone: 'muted' });
        return sections;
    }, [taskFocusFilter, doneList, overdueItems, todayItems, routinePending, tomorrow, later]);

    const { urgent, routine, normal, savings } = getShoppingItems(items);
    const shoppingSections = [
        { title: 'Urgent', items: urgent, tone: 'urgent' as const },
        { title: 'Routine', items: routine, tone: 'muted' as const },
        { title: 'Later', items: normal, tone: 'default' as const },
    ].filter(section => section.items.length > 0);

    const shoppingEstimatedTotal = [...urgent, ...routine, ...normal].reduce((sum, item) => sum + (item.meta.amount || 0), 0);
    const totalShoppingItems = urgent.length + routine.length + normal.length;

    const savingsGoals = useMemo(() => {
        return [...savings].sort((a, b) => {
            const aTarget = a.meta.amount || 0;
            const bTarget = b.meta.amount || 0;
            const aProgress = aTarget > 0 ? (a.meta.savedAmount || 0) / aTarget : 0;
            const bProgress = bTarget > 0 ? (b.meta.savedAmount || 0) / bTarget : 0;
            if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
            return bProgress - aProgress;
        });
    }, [savings]);

    const totalSaved = savingsGoals.reduce((sum, goal) => sum + (goal.meta.savedAmount || 0), 0);
    const nearTargetCount = savingsGoals.filter(goal => {
        const target = goal.meta.amount || 0;
        if (!target) return false;
        return ((goal.meta.savedAmount || 0) / target) >= 0.75 && goal.status !== 'done';
    }).length;

    const monthLabel = focusDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const taskHeroSupport = overdueItems.length > 0
        ? `${summary.todo} pending • ${overdueItems.length} overdue`
        : todayItems.length > 0
            ? `${summary.todo} pending • ${todayItems.length} due today`
            : routinePending.length > 0
                ? `${summary.todo} pending • ${routinePending.length} routine left`
                : `${summary.todo} pending • ${doneList.length} done recently`;

    const handleSaveFunds = () => {
        if (!addFundsModal || !fundAmount || !fundWallet) return;
        onAddFunds(Number(fundAmount), fundWallet, new Date(fundDate).toISOString(), addFundsModal.goalId, addFundsModal.goalName);
        setAddFundsModal(null);
        setFundAmount('');
        setFundWallet('');
        setFundDate(new Date().toISOString().split('T')[0]);
    };

    const handleSaveGoalEdit = (goal: BrainDumpItem) => {
        handleUpdateItem(
            goal.id,
            editContent,
            goal.meta.tags || [],
            Number(editAmount),
            editDate ? new Date(editDate).toISOString() : undefined,
            goal.meta.paymentMethod,
            goal.meta.budgetCategory,
            goal.meta.durationMinutes,
            goal.meta.skillId,
            goal.meta.toWallet,
            goal.meta.financeType,
            goal.meta.progress,
            goal.meta.progressNotes,
            goal.meta.shoppingCategory,
            goal.meta.recurrenceDays,
            goal.meta.quantity,
            goal.meta.isRoutine,
            goal.meta.routineInterval,
            goal.meta.routineDaysOfWeek,
            goal.meta.routineDaysOfMonth,
            goal.meta.routineMonthsOfYear,
            undefined,
            editDedicatedWalletId
        );
        setExpandedGoalId(null);
    };

    const cardProps = {
        onUpdate: handleUpdateItem,
        onDelete: handleDelete,
        onToggleStatus: handleToggleStatus,
        enableCollapse: true,
        defaultCollapsed: appSettings.defaultCollapsed,
        hideMoney: appSettings.hideMoney,
        wallets,
        budgetRules,
        noStrikethrough: false,
        noDarken: false,
        className: 'mb-0',
    };

    const renderTaskSection = (title: string, sectionItems: BrainDumpItem[], tone: 'urgent' | 'default' | 'muted' | 'done') => {
        const titleClass = tone === 'urgent'
            ? 'text-red-500'
            : tone === 'muted'
                ? 'text-muted'
                : tone === 'done'
                    ? 'text-muted'
                    : 'text-primary';

        return (
            <section key={title}>
                <div className="mb-3 flex items-center justify-between">
                    <h3 className={`text-sm font-semibold uppercase tracking-[0.14em] ${titleClass}`}>{title}</h3>
                    <span className="text-xs text-muted">{sectionItems.length}</span>
                </div>
                <div className="divide-y divide-border/70 rounded-3xl border border-border/70 bg-surface">
                    {sectionItems.map(item => {
                        const isExpanded = expandedTaskId === item.id;
                        return (
                            <div key={item.id} className="px-4 py-4 first:pt-5 last:pb-5">
                                <button type="button" onClick={() => setExpandedTaskId(current => current === item.id ? null : item.id)} className="w-full text-left">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-medium line-clamp-1 ${tone === 'done' ? 'text-muted line-through' : 'text-primary'}`}>{item.content}</p>
                                            <p className="mt-1 text-xs text-muted">{formatDueLine(item)}</p>
                                        </div>
                                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                                    </div>
                                </button>
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.18 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pt-3">
                                                <Card item={item} {...cardProps} enableCollapse={false} embedded />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    };

    const renderShoppingSection = (title: string, sectionItems: BrainDumpItem[], tone: 'urgent' | 'default' | 'muted') => {
        const headingClass = tone === 'urgent' ? 'text-red-500' : tone === 'muted' ? 'text-indigo-500' : 'text-primary';
        return (
            <section key={title}>
                <div className="mb-3 flex items-center justify-between">
                    <h3 className={`text-sm font-semibold uppercase tracking-[0.14em] ${headingClass}`}>{title}</h3>
                    <span className="text-xs text-muted">{sectionItems.length}</span>
                </div>
                <div className="divide-y divide-border/70 rounded-3xl border border-border/70 bg-surface">
                    {sectionItems.map(item => {
                        const isExpanded = expandedShoppingId === item.id;
                        return (
                            <div key={item.id} className="px-4 py-4 first:pt-5 last:pb-5">
                                <button type="button" onClick={() => setExpandedShoppingId(current => current === item.id ? null : item.id)} className="w-full text-left">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-primary line-clamp-1">{item.content}</p>
                                            <p className="mt-1 text-xs text-muted">
                                                {item.meta.quantity || (title === 'Routine' ? 'Routine restock' : title === 'Urgent' ? 'Need this soon' : 'Not urgent')}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            {item.meta.amount ? <p className="text-sm font-semibold text-primary">{fmt(item.meta.amount)}</p> : <p className="text-xs text-muted">Detail</p>}
                                        </div>
                                    </div>
                                </button>
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.18 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pt-3">
                                                <ShoppingItem
                                                    item={item}
                                                    onToggleStatus={handleToggleStatus}
                                                    onDelete={handleDelete}
                                                    onUpdate={handleUpdateItem}
                                                    wallets={wallets}
                                                    budgetRules={budgetRules}
                                                    onResetRoutine={handleResetRoutine}
                                                    embedded
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    };

    const renderSavingsList = () => {
        if (savingsGoals.length === 0) {
            return (
                <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                    <p className="text-sm text-muted">No saving goals yet.</p>
                    <button
                        onClick={() => handleOpenAddShopping('saving')}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                    >
                        <Plus className="h-4 w-4" /> Create Goal
                    </button>
                </div>
            );
        }

        return (
            <div className="divide-y divide-border/70 rounded-3xl border border-border/70 bg-surface">
                {savingsGoals.map(goal => {
                    const target = goal.meta.amount || 0;
                    const saved = goal.meta.savedAmount || 0;
                    const progress = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
                    const isExpanded = expandedGoalId === goal.id;
                    const isDone = goal.status === 'done';

                    return (
                        <div key={goal.id} className={`px-4 py-4 first:pt-5 last:pb-5 ${isDone ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isExpanded) {
                                            setExpandedGoalId(null);
                                            return;
                                        }
                                        setExpandedGoalId(goal.id);
                                        setEditContent(goal.content);
                                        setEditAmount(goal.meta.amount?.toString() || '');
                                        setEditDate(goal.meta.date ? goal.meta.date.split('T')[0] : '');
                                        setEditDedicatedWalletId(goal.meta.dedicatedWalletId || '');
                                    }}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-primary line-clamp-1">{goal.content}</p>
                                            <p className="mt-1 text-xs text-muted">{fmt(saved)} / {fmt(target)}</p>
                                        </div>
                                        <p className="shrink-0 text-sm font-semibold text-primary">{progress.toFixed(0)}%</p>
                                    </div>
                                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
                                        <div className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} />
                                    </div>
                                </button>
                                <div className="flex shrink-0 items-center gap-2">
                                    {!isDone && (
                                        <button
                                            onClick={() => {
                                                setAddFundsModal({ isOpen: true, goalId: goal.id, goalName: goal.content, defaultWallet: goal.meta.dedicatedWalletId });
                                                setFundWallet(goal.meta.dedicatedWalletId || '');
                                            }}
                                            className="rounded-xl bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                                        >
                                            Add funds
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setExpandedGoalId(current => current === goal.id ? null : goal.id)}
                                        className="rounded-xl p-2 text-muted transition-colors hover:bg-muted/10 hover:text-primary"
                                    >
                                        <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence initial={false}>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.18 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-3 pt-4">
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted">Goal name</label>
                                                <input
                                                    type="text"
                                                    value={editContent}
                                                    onChange={e => setEditContent(e.target.value)}
                                                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary focus:border-indigo-500 focus:outline-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted">Target</label>
                                                    <input
                                                        type="number"
                                                        value={editAmount}
                                                        onChange={e => setEditAmount(e.target.value)}
                                                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary focus:border-indigo-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted">Target date</label>
                                                    <input
                                                        type="date"
                                                        value={editDate}
                                                        onChange={e => setEditDate(e.target.value)}
                                                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary focus:border-indigo-500 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted">Dedicated wallet</label>
                                                <select
                                                    value={editDedicatedWalletId}
                                                    onChange={e => setEditDedicatedWalletId(e.target.value)}
                                                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary focus:border-indigo-500 focus:outline-none"
                                                >
                                                    <option value="">None</option>
                                                    {wallets.map(wallet => (
                                                        <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 pt-1">
                                                <button onClick={() => handleDelete(goal.id)} className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10">
                                                    <Trash2 className="h-4 w-4" /> Delete
                                                </button>
                                                <div className="flex items-center gap-2">
                                                    {!isDone && progress >= 100 && (
                                                        <button onClick={() => onCompleteGoal(goal)} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90">
                                                            Complete
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleSaveGoalEdit(goal)} className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90">
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        );
    };

    const emptyTaskState = taskFocusFilter === 'today'
        ? {
            text: 'Nothing due today. Good room for proactive work.',
            actionLabel: 'Add Task',
            action: () => handleOpenAddTask(new Date().toISOString().split('T')[0]),
        }
        : taskFocusFilter === 'overdue'
            ? {
                text: 'No overdue items. Nice — keep it that way.',
                actionLabel: 'Add Task',
                action: () => handleOpenAddTask(new Date().toISOString().split('T')[0]),
            }
            : taskFocusFilter === 'routine'
                ? {
                    text: 'No routine items left in this view.',
                    actionLabel: 'Add Routine',
                    action: handleOpenAddRoutine,
                }
                : taskFocusFilter === 'done'
                    ? {
                        text: 'Nothing completed yet in this month view.',
                        actionLabel: 'Add Task',
                        action: () => handleOpenAddTask(new Date().toISOString().split('T')[0]),
                    }
                    : {
                        text: 'Nothing pending in this month view.',
                        actionLabel: 'Add Task',
                        action: () => handleOpenAddTask(new Date().toISOString().split('T')[0]),
                    };

    const hero = planSubTab === 'shopping'
        ? {
            title: 'Shopping',
            support: `${totalShoppingItems} item${totalShoppingItems === 1 ? '' : 's'}${shoppingEstimatedTotal > 0 ? ` • Est. total ${fmt(shoppingEstimatedTotal)}` : ''}`,
            primaryLabel: '+ Add Item',
            onPrimary: () => handleOpenAddShopping('not_urgent' as ShoppingCategory),
            secondaryLabel: null as string | null,
            secondaryAction: null as (() => void) | null,
        }
        : planSubTab === 'savings'
            ? {
                title: 'Savings',
                support: `${fmt(totalSaved)} saved${nearTargetCount > 0 ? ` • ${nearTargetCount} near target` : ''}`,
                primaryLabel: '+ Create Goal',
                onPrimary: () => handleOpenAddShopping('saving'),
                secondaryLabel: null as string | null,
                secondaryAction: null as (() => void) | null,
            }
            : {
                title: 'Today in focus',
                support: taskHeroSupport,
                primaryLabel: '+ Add Task',
                onPrimary: () => handleOpenAddTask(new Date().toISOString().split('T')[0]),
                secondaryLabel: '+ Routine',
                secondaryAction: handleOpenAddRoutine,
            };

    return (
        <div className="pb-24" onTouchStart={swipeHandlers.onTouchStart} onTouchMove={swipeHandlers.onTouchMove} onTouchEnd={swipeHandlers.onTouchEnd}>
            <motion.div style={swipeHandlers.style} className="will-change-transform">
                <div className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 pb-4 pt-safe backdrop-blur">
                    <div className="pb-4 pt-4">
                        {planSubTab === 'tasks' && (
                            <div className="mb-3 flex items-center gap-3 text-sm text-muted" onTouchStart={dateSwipeHandlers.onTouchStart} onTouchMove={dateSwipeHandlers.onTouchMove} onTouchEnd={dateSwipeHandlers.onTouchEnd}>
                                <button onClick={() => changeMonth(-1)} className="rounded-full p-1.5 transition-colors hover:bg-muted/10 hover:text-primary">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="font-semibold uppercase tracking-[0.14em]">{monthLabel}</span>
                                <button onClick={() => changeMonth(1)} className="rounded-full p-1.5 transition-colors hover:bg-muted/10 hover:text-primary">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-primary">{hero.title}</h1>
                                <p className="mt-2 text-sm text-muted">{hero.support}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {hero.secondaryLabel && hero.secondaryAction && (
                                    <button onClick={hero.secondaryAction} className="inline-flex items-center gap-2 rounded-2xl bg-muted/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted/20">
                                        {hero.secondaryLabel}
                                    </button>
                                )}
                                <button onClick={hero.onPrimary} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90">
                                    {hero.primaryLabel}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex rounded-2xl bg-black/5 p-1 dark:bg-white/10">
                        {[
                            { id: 'tasks' as PlanSubTab, label: 'Tasks', icon: <ListTodo className="h-4 w-4" /> },
                            { id: 'shopping' as PlanSubTab, label: 'Shopping', icon: <ShoppingCart className="h-4 w-4" /> },
                            { id: 'savings' as PlanSubTab, label: 'Savings', icon: <PiggyBank className="h-4 w-4" /> },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setPlanSubTab(tab.id);
                                    setExpandedTaskId(null);
                                    setExpandedShoppingId(null);
                                    setExpandedGoalId(null);
                                }}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${planSubTab === tab.id ? 'bg-surface text-primary shadow-sm' : 'text-primary/50 hover:text-primary'}`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {planSubTab === 'tasks' && (
                        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                            {[
                                { label: 'All', value: 'all' as const },
                                { label: 'Today', value: 'today' as const },
                                { label: 'Overdue', value: 'overdue' as const },
                                { label: 'Routine', value: 'routine' as const },
                                { label: 'Done', value: 'done' as const },
                            ].map(chip => (
                                <button
                                    key={chip.value}
                                    onClick={() => setTaskFocusFilter(chip.value)}
                                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${taskFocusFilter === chip.value ? 'bg-indigo-500 text-white' : 'bg-muted/10 text-muted hover:text-primary'}`}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-5 px-4 pt-4">
                    {planSubTab === 'tasks' && (
                        taskSections.length > 0 ? taskSections.map(section => renderTaskSection(section.title, section.items, section.tone)) : (
                            <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                                <p className="text-sm text-muted">{emptyTaskState.text}</p>
                                <button onClick={emptyTaskState.action} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-muted/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted/20">
                                    <Plus className="h-4 w-4" /> {emptyTaskState.actionLabel}
                                </button>
                            </div>
                        )
                    )}

                    {planSubTab === 'shopping' && (
                        shoppingSections.length > 0 ? shoppingSections.map(section => renderShoppingSection(section.title, section.items, section.tone)) : (
                            <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                                <p className="text-sm text-muted">Shopping queue is clear. Add the next thing before it slips.</p>
                                <button onClick={() => handleOpenAddShopping('not_urgent')} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-muted/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted/20">
                                    <Plus className="h-4 w-4" /> Add Item
                                </button>
                            </div>
                        )
                    )}

                    {planSubTab === 'savings' && renderSavingsList()}
                </div>
            </motion.div>

            <AnimatePresence>
                {addFundsModal?.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            className="flex w-full max-w-md flex-col overflow-hidden rounded-t-[32px] border border-border bg-surface sm:rounded-[32px]"
                        >
                            <div className="flex items-center justify-between border-b border-border p-6">
                                <h3 className="flex items-center gap-2 text-xl font-bold text-primary">
                                    <PiggyBank className="h-5 w-5 text-indigo-500" />
                                    Add Funds
                                </h3>
                                <button onClick={() => setAddFundsModal(null)} className="rounded-full bg-muted/10 p-2 text-muted transition-colors hover:bg-muted/20">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4 p-6">
                                <p className="text-sm font-medium text-muted">Adding funds to <span className="font-bold text-primary">{addFundsModal.goalName}</span></p>
                                <div>
                                    <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.14em] text-muted">Amount</label>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={fundAmount}
                                        onChange={e => setFundAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full rounded-2xl border border-border bg-background p-4 text-2xl font-medium text-primary focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.14em] text-muted">Wallet</label>
                                    <select
                                        value={fundWallet}
                                        onChange={e => setFundWallet(e.target.value)}
                                        className="w-full rounded-2xl border border-border bg-background p-4 text-sm text-primary focus:border-indigo-500 focus:outline-none"
                                        disabled={!!addFundsModal.defaultWallet}
                                    >
                                        <option value="">Choose wallet</option>
                                        {wallets.map(wallet => (
                                            <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                                        ))}
                                    </select>
                                    {addFundsModal.defaultWallet && <p className="mt-2 text-xs text-muted">Locked to dedicated wallet for this goal.</p>}
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.14em] text-muted">Date</label>
                                    <input
                                        type="date"
                                        value={fundDate}
                                        onChange={e => setFundDate(e.target.value)}
                                        className="w-full rounded-2xl border border-border bg-background p-4 text-sm text-primary focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <button onClick={handleSaveFunds} className="w-full rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
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
