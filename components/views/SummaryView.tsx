import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight,
    BookText,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Eye,
    EyeOff,
    StickyNote,
    Wallet as WalletIcon,
    Zap,
    AlertTriangle,
    Sparkles,
    Pencil
} from 'lucide-react';
import {
    BrainDumpItem,
    Skill,
    Wallet,
    BudgetConfig,
    Tab,
    FinanceType,
    Priority,
    ShoppingCategory,
    AppSettings,
    ItemType,
    ParsingTask
} from '../../types';
import {
    getFocusMonthData,
    getShoppingItems,
    getFinanceItems,
    generateInsights
} from '../../utils/selectors';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';
import Card from '../Card';
import PendingReviewList from '../PendingReviewList';

interface SummaryViewProps {
    items: BrainDumpItem[];
    skills: Skill[];
    wallets: Wallet[];
    budgetConfig: BudgetConfig;
    appSettings: AppSettings;
    themeNavDate: Date;
    setThemeNavDate: (d: Date) => void;
    monthlyThemes: Record<string, string>;
    onThemeEdit: (content: string) => void;
    handleToggleStatus: (id: string) => void;
    setActiveTab: (tab: Tab) => void;
    setPlanSubTab: (tab: any) => void;
    showBalance: boolean;
    setShowBalance: (val: boolean) => void;
    handleOpenAddTask: (date?: string) => void;
    handleOpenAddShopping: (category?: ShoppingCategory) => void;
    handleOpenAddExpense: () => void;
    handleOpenAddNote: () => void;
    onAddItem?: (type: ItemType) => void;
    handleUpdateItem: (
        id: string,
        content: string,
        tags: string[],
        amount?: number,
        date?: string,
        paymentMethod?: string,
        budgetCategory?: string,
        duration?: number,
        skillId?: string,
        toWallet?: string,
        financeType?: FinanceType,
        progress?: number,
        progressNotes?: string,
        shoppingCategory?: any,
        recurrenceDays?: number,
        quantity?: string,
        isRoutine?: boolean,
        routineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly',
        routineDaysOfWeek?: number[],
        routineDaysOfMonth?: number[],
        routineMonthsOfYear?: number[],
        savingGoalId?: string,
        dedicatedWalletId?: string,
        priority?: Priority
    ) => void;
    handleDelete: (id: string) => void;
    pendingReviews?: { id: string; text: string; results: any[] }[];
    handleApproveReview?: (id: string, updatedResults: any[]) => void;
    handleRejectReview?: (id: string) => void;
    parsingTasks?: ParsingTask[];
    retryParsing?: (id: string) => void;
    clearParsingTask?: (id: string) => void;
}

const fmt = (n: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
}).format(n);

const isSameDay = (dateA: Date, dateB: Date) => (
    dateA.getFullYear() === dateB.getFullYear()
    && dateA.getMonth() === dateB.getMonth()
    && dateA.getDate() === dateB.getDate()
);

const getGreeting = (date: Date) => {
    const hour = date.getHours();
    if (hour < 11) return 'Good morning';
    if (hour < 15) return 'Good afternoon';
    if (hour < 19) return 'Good evening';
    return 'Good night';
};

const SummaryView: React.FC<SummaryViewProps> = ({
    items,
    skills,
    wallets,
    budgetConfig,
    appSettings,
    themeNavDate,
    setThemeNavDate,
    monthlyThemes,
    onThemeEdit,
    handleToggleStatus,
    setActiveTab,
    setPlanSubTab,
    showBalance,
    setShowBalance,
    handleOpenAddTask,
    handleOpenAddShopping,
    handleOpenAddExpense,
    handleOpenAddNote,
    onAddItem,
    handleUpdateItem,
    handleDelete,
    pendingReviews = [],
    handleApproveReview,
    handleRejectReview,
    parsingTasks = [],
    retryParsing,
    clearParsingTask
}) => {
    const swipeHandlers = useSwipeTabs('summary', setActiveTab);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [signalExpanded, setSignalExpanded] = useState(false);

    const changeThemeMonth = (offset: number) => {
        const next = new Date(themeNavDate);
        next.setMonth(next.getMonth() + offset);
        setThemeNavDate(next);
    };

    const dateSwipeHandlers = useSwipeDate(
        () => changeThemeMonth(-1),
        () => changeThemeMonth(1)
    );

    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];
    const { pendingGroups } = getFocusMonthData(items, today, '', '');
    const { urgent } = getShoppingItems(items);
    const routines = pendingGroups.routines.filter(item => item.status === 'pending');
    const todayTasks = pendingGroups.today;
    const tomorrowItems = pendingGroups.tomorrow;

    const todaySpend = useMemo(() => {
        return items.reduce((sum, item) => {
            const isDirectExpense = item.type === ItemType.FINANCE && item.meta.financeType === 'expense';
            const isImplicitExpense = (item.type === ItemType.SHOPPING || item.type === ItemType.TODO)
                && item.status === 'done'
                && !item.meta.isRoutine
                && !!item.meta.amount;

            if (!isDirectExpense && !isImplicitExpense) return sum;
            const rawDate = item.meta.date || item.completed_at || item.created_at;
            const date = new Date(rawDate);
            if (Number.isNaN(date.getTime()) || !isSameDay(date, today)) return sum;
            return sum + (item.meta.amount || 0);
        }, 0);
    }, [items, today]);

    const { totalExpense } = getFinanceItems(
        items,
        today,
        budgetConfig,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'newest'
    );

    const totalBudgetLimit = budgetConfig.rules.reduce(
        (acc, rule) => acc + ((rule.percentage / 100) * budgetConfig.monthlyIncome),
        0
    );
    const budgetPercent = totalBudgetLimit > 0 ? (totalExpense / totalBudgetLimit) * 100 : 0;

    const localInsights = useMemo(
        () => generateInsights(items, budgetConfig, wallets, skills),
        [items, budgetConfig, wallets, skills]
    );

    const themeKey = `${themeNavDate.getFullYear()}-${String(themeNavDate.getMonth() + 1).padStart(2, '0')}`;
    const themeContent = monthlyThemes[themeKey] || '';
    const themeMonthLabel = themeNavDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const focusFeed = useMemo(() => {
        const queue: BrainDumpItem[] = [];
        const seen = new Set<string>();
        const pushUnique = (item: BrainDumpItem) => {
            if (seen.has(item.id)) return;
            seen.add(item.id);
            queue.push(item);
        };

        urgent.forEach(pushUnique);
        todayTasks.forEach(pushUnique);
        routines.forEach(pushUnique);
        if (queue.length === 0) tomorrowItems.forEach(pushUnique);

        return queue.slice(0, 3);
    }, [urgent, todayTasks, routines, tomorrowItems]);

    const hero = useMemo(() => {
        const urgentCount = urgent.length;
        const todayCount = todayTasks.length;
        const routineCount = routines.length;
        const totalAttention = urgentCount + todayCount;

        const spendLine = todaySpend > 0
            ? `Spend today ${showBalance ? fmt(todaySpend) : '••••'}`
            : budgetPercent >= 75
                ? `Month spend at ${budgetPercent.toFixed(0)}% of budget`
                : 'Month spend is on track';

        if (totalAttention > 0) {
            return {
                title: `${totalAttention} thing${totalAttention > 1 ? 's' : ''} need you today`,
                support: [
                    todayCount > 0 ? `${todayCount} task${todayCount > 1 ? 's' : ''}` : null,
                    urgentCount > 0 ? `${urgentCount} urgent purchase${urgentCount > 1 ? 's' : ''}` : null,
                ].filter(Boolean).join(' • '),
                metric: spendLine,
                primaryLabel: 'Open Today',
                onPrimary: () => {
                    setActiveTab('plan');
                    setPlanSubTab(todayCount > 0 ? 'tasks' : 'shopping');
                },
                secondaryLabel: '+ Capture',
                onSecondary: handleOpenAddNote,
            };
        }

        if (routineCount > 0) {
            return {
                title: `You’re mostly clear today`,
                support: `Only ${routineCount} routine${routineCount > 1 ? 's' : ''} left`,
                metric: spendLine,
                primaryLabel: 'See Routine',
                onPrimary: () => {
                    setActiveTab('plan');
                    setPlanSubTab('tasks');
                },
                secondaryLabel: '+ Capture',
                onSecondary: handleOpenAddNote,
            };
        }

        return {
            title: 'Nothing urgent right now',
            support: 'Good time to plan or capture ideas',
            metric: budgetPercent >= 75 ? spendLine : null,
            primaryLabel: '+ New Note',
            onPrimary: handleOpenAddNote,
            secondaryLabel: 'View Plan',
            onSecondary: () => {
                setActiveTab('plan');
                setPlanSubTab('tasks');
            },
        };
    }, [urgent.length, todayTasks.length, routines.length, todaySpend, showBalance, budgetPercent, handleOpenAddNote, setActiveTab, setPlanSubTab]);

    const reviewCount = pendingReviews.length + parsingTasks.length;
    const primaryInsight = localInsights[0];

    const signal = useMemo(() => {
        if (reviewCount > 0) {
            return {
                kind: 'review' as const,
                eyebrow: 'Signal',
                title: `${reviewCount} item${reviewCount > 1 ? 's' : ''} need review`,
                body: pendingReviews.length > 0
                    ? `${pendingReviews.length} parser draft${pendingReviews.length > 1 ? 's' : ''} waiting for approval`
                    : `${parsingTasks.length} parsing task${parsingTasks.length > 1 ? 's are' : ' is'} blocked or still processing`,
                cta: signalExpanded ? 'Hide review' : 'Open review',
                icon: <ClipboardCheck className="h-4 w-4" />,
            };
        }

        if (budgetPercent >= 75 && totalBudgetLimit > 0) {
            return {
                kind: 'budget' as const,
                eyebrow: 'Signal',
                title: `${themeMonthLabel} spend is at ${budgetPercent.toFixed(0)}% of budget`,
                body: `${showBalance ? fmt(totalExpense) : '••••'} used${budgetConfig.monthlyIncome > 0 ? ` out of ${showBalance ? fmt(totalBudgetLimit) : '••••'}` : ''}`,
                cta: 'Open Money',
                icon: <AlertTriangle className="h-4 w-4" />,
            };
        }

        if (primaryInsight) {
            return {
                kind: 'insight' as const,
                eyebrow: 'Signal',
                title: primaryInsight.title,
                body: primaryInsight.message,
                cta: primaryInsight.iconType === 'finance' ? 'Open Money' : primaryInsight.iconType === 'skill' ? 'Open Library' : 'Open Plan',
                icon: <Sparkles className="h-4 w-4" />,
            };
        }

        if (themeContent) {
            return {
                kind: 'theme' as const,
                eyebrow: `${themeMonthLabel} theme`,
                title: themeContent,
                body: 'Keep this close while planning the month.',
                cta: 'Edit',
                icon: <Pencil className="h-4 w-4" />,
            };
        }

        return null;
    }, [reviewCount, pendingReviews.length, parsingTasks.length, signalExpanded, budgetPercent, totalBudgetLimit, themeMonthLabel, showBalance, totalExpense, budgetConfig.monthlyIncome, primaryInsight, themeContent]);

    const cardProps = {
        onUpdate: handleUpdateItem,
        onDelete: handleDelete,
        onToggleStatus: handleToggleStatus,
        enableCollapse: true,
        defaultCollapsed: appSettings.defaultCollapsed,
        hideMoney: appSettings.hideMoney,
        wallets,
        budgetRules: budgetConfig.rules,
        noStrikethrough: false,
        noDarken: false,
        className: 'mb-0',
    };

    const openSignal = () => {
        if (!signal) return;

        if (signal.kind === 'review') {
            setSignalExpanded(current => !current);
            return;
        }

        if (signal.kind === 'budget') {
            setActiveTab('money');
            return;
        }

        if (signal.kind === 'insight') {
            if (primaryInsight?.iconType === 'finance') {
                setActiveTab('money');
            } else if (primaryInsight?.iconType === 'skill') {
                setActiveTab('library');
            } else {
                setActiveTab('plan');
                setPlanSubTab(primaryInsight?.iconType === 'shopping' ? 'shopping' : 'tasks');
            }
            return;
        }

        if (signal.kind === 'theme') {
            onThemeEdit(themeContent);
        }
    };

    const renderFocusMeta = (item: BrainDumpItem) => {
        if (urgent.some(entry => entry.id === item.id)) return 'Shopping • urgent';
        if (routines.some(entry => entry.id === item.id)) return 'Routine';
        if (tomorrowItems.some(entry => entry.id === item.id)) return 'Tomorrow';
        if (item.type === ItemType.EVENT) return 'Event • today';
        return 'Task • today';
    };

    return (
        <div className="pb-24" onTouchStart={swipeHandlers.onTouchStart} onTouchMove={swipeHandlers.onTouchMove} onTouchEnd={swipeHandlers.onTouchEnd}>
            <motion.div style={swipeHandlers.style} className="will-change-transform">
                <div className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 pb-4 pt-safe backdrop-blur">
                    <div className="pb-5 pt-4">
                        <p className="text-sm font-medium text-primary/65">{getGreeting(today)}</p>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary">{hero.title}</h1>
                        <p className="mt-2 text-sm text-primary/65">{hero.support}</p>
                        {hero.metric && <p className="mt-1 text-sm text-primary/55">{hero.metric}</p>}
                        <div className="mt-4 flex items-center gap-2">
                            <button
                                onClick={hero.onPrimary}
                                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                            >
                                {hero.primaryLabel}
                            </button>
                            <button
                                onClick={hero.onSecondary}
                                className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-surface px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-background"
                            >
                                {hero.secondaryLabel}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {[
                            { label: 'Note', icon: <StickyNote className="h-4 w-4" />, onClick: handleOpenAddNote },
                            { label: 'Task', icon: <CheckCircle2 className="h-4 w-4" />, onClick: () => handleOpenAddTask(todayIso) },
                            { label: 'Expense', icon: <WalletIcon className="h-4 w-4" />, onClick: handleOpenAddExpense },
                            { label: 'Journal', icon: <BookText className="h-4 w-4" />, onClick: () => onAddItem ? onAddItem(ItemType.JOURNAL) : handleOpenAddNote() },
                        ].map(action => (
                            <button
                                key={action.label}
                                onClick={action.onClick}
                                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/80 bg-surface px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-background"
                            >
                                {action.icon}
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-6 px-4 pt-4">
                    <section>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-semibold text-primary">Today</h2>
                                <p className="mt-1 text-sm text-primary/65">Top things worth your attention right now.</p>
                            </div>
                            <button
                                onClick={() => {
                                    setActiveTab('plan');
                                    setPlanSubTab('tasks');
                                }}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-primary/70 transition-colors hover:text-primary"
                            >
                                View all <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>

                        {focusFeed.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-border px-6 py-10 text-center">
                                <p className="text-sm text-primary/65">Nothing urgent here. Good moment to capture something or line up the next task.</p>
                                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                    <button
                                        onClick={handleOpenAddNote}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                                    >
                                        <StickyNote className="h-4 w-4" /> New Note
                                    </button>
                                    <button
                                        onClick={() => {
                                            setActiveTab('plan');
                                            setPlanSubTab('tasks');
                                        }}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-surface px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-background"
                                    >
                                        View Plan
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/70 rounded-3xl border border-border/80 bg-surface shadow-sm shadow-black/5">
                                {focusFeed.map(item => {
                                    const isExpanded = expandedItemId === item.id;
                                    return (
                                        <div key={item.id} className={`px-4 py-4 transition-colors first:pt-5 last:pb-5 ${isExpanded ? 'bg-surface/80' : ''}`}>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedItemId(current => current === item.id ? null : item.id)}
                                                className="w-full text-left"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-primary line-clamp-1">{item.content}</p>
                                                        <p className="mt-1 text-xs text-primary/65">{renderFocusMeta(item)}</p>
                                                    </div>
                                                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary/50" />
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
                                                        <div className="mt-3 border-t border-border/80 pt-3">
                                                            <Card item={item} {...cardProps} enableCollapse={false} embedded />
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {signal && (
                        <section>
                            <div className="rounded-3xl border border-border/80 bg-surface p-4 shadow-sm shadow-black/5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">
                                            {signal.icon}
                                            {signal.eyebrow}
                                        </p>
                                        <h3 className="mt-2 text-base font-semibold text-primary">{signal.title}</h3>
                                        <p className="mt-1 text-sm text-primary/65">{signal.body}</p>
                                    </div>
                                    {signal.kind === 'budget' && (
                                        <button
                                            onClick={() => setShowBalance(!showBalance)}
                                            className="rounded-2xl border border-border/80 bg-surface p-2 text-primary/65 transition-colors hover:bg-background hover:text-primary"
                                        >
                                            {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    )}
                                </div>

                                {signal.kind === 'theme' && (
                                    <div
                                        className="mt-3 flex items-center gap-2 text-sm text-primary/65"
                                        onTouchStart={dateSwipeHandlers.onTouchStart}
                                        onTouchMove={dateSwipeHandlers.onTouchMove}
                                        onTouchEnd={dateSwipeHandlers.onTouchEnd}
                                    >
                                        <button onClick={() => changeThemeMonth(-1)} className="rounded-full border border-transparent p-1 text-primary/60 transition-colors hover:border-border/70 hover:bg-background hover:text-primary">
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <span>{themeMonthLabel}</span>
                                        <button onClick={() => changeThemeMonth(1)} className="rounded-full border border-transparent p-1 text-primary/60 transition-colors hover:border-border/70 hover:bg-background hover:text-primary">
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={openSignal}
                                    className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-surface px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-background"
                                >
                                    {signal.cta}
                                </button>

                                {signal.kind === 'review' && signalExpanded && (
                                    <div className="mt-4 space-y-3">
                                        {parsingTasks.length > 0 && (
                                            <div className="space-y-2">
                                                {parsingTasks.map(task => (
                                                    <div key={task.id} className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-medium text-primary">{task.text}</p>
                                                                <p className="mt-1 text-xs text-primary/65">
                                                                    {task.status === 'failed'
                                                                        ? (task.error || 'Parsing failed')
                                                                        : task.status === 'pending'
                                                                            ? 'Still processing'
                                                                            : 'Processed'}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {task.status === 'failed' && retryParsing && (
                                                                    <button onClick={() => retryParsing(task.id)} className="text-xs font-semibold text-indigo-500">Retry</button>
                                                                )}
                                                                {clearParsingTask && (
                                                                    <button onClick={() => clearParsingTask(task.id)} className="text-xs font-semibold text-primary/60 transition-colors hover:text-primary">Dismiss</button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {pendingReviews.length > 0 && handleApproveReview && handleRejectReview && (
                                            <div className="-mx-4">
                                                <PendingReviewList
                                                    reviews={pendingReviews}
                                                    onApprove={handleApproveReview}
                                                    onReject={handleRejectReview}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default SummaryView;
