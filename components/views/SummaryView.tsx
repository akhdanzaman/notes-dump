import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { BackHandler } from '../../utils/backHandler';
import {
    ChevronLeft,
    ChevronRight,
    Pencil,
    Target,
    CheckCircle2,
    ShoppingCart,
    AlertTriangle,
    ArrowRight,
    Wallet as WalletIcon,
    EyeOff,
    Eye,
    Sprout,
    StickyNote,
    Plus,
    Zap,
    Coffee,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    ClipboardCheck,
    X,
    Sparkles,
    Timer,
    Flag,
    ShieldAlert,
    ListChecks,
    RotateCcw,
    TrendingUp,
    TrendingDown,
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
    ItemType
} from '../../types';
import {
    getFocusMonthData,
    getShoppingItems,
    getWalletStats,
    getFinanceItems,
    generateInsights
} from '../../utils/selectors';
import { generateAIInsights, Insight } from '../../services/insightService';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';
import Card from '../Card';
import ReviewCenterPanel from '../ReviewCenterPanel';
import { contentSurface } from '../layout/contentSurface';
import { buildSummaryFocusDisplay } from '../../utils/summaryFocusUtils';
import { getDeepWorkChildren } from '../../utils/deepWorkTodoModel';
import { getNarrativeHeadline, getSpendingSparkline, getWeeklyComparison, getCategoryBreakdown, getActiveGoals, getSkillProgress } from '../../utils/biEngine';
import { NarrativeHeadlineCard } from '../NarrativeHeadline';
import { WoWComparisonCards, CategoryBreakdownBars } from '../WoWMetrics';
import { GoalsProgressWidget, SkillProgressWidget } from '../GoalsSkillsWidget';

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
    handleKeepRawTodo: (id: string) => void;
    handleRetriggerDeepWorkTodo: (id: string) => void;
    handleAcceptDeepWorkTodo: (id: string, subtasks?: string[]) => void;
    handleResetRoutine: (id: string) => void;
    pendingReviews?: { id: string; text: string; results: any[] }[];
    handleApproveReview?: (id: string, updatedResults: any[]) => void;
    handleRejectReview?: (id: string) => void;
    parsingTasks?: import('../../types').ParsingTask[];
    retryParsing?: (id: string) => void;
    clearParsingTask?: (id: string) => void;
    undoParsingTask?: (id: string) => void;
    deleteParsingTaskEntries?: (id: string) => void;
}

type PopupPosition = {
    top: number;
    left: number;
    width: number;
    transformOrigin: string;
};

type TaskPanel = 'edit' | 'subtasks' | 'none';

const AI_INSIGHTS_CACHE_KEY = 'braindump_ai_insights';
const AI_INSIGHTS_CACHE_DATE_KEY = 'braindump_ai_insights_date';
const AI_INSIGHTS_CACHE_VERSION_KEY = 'braindump_ai_insights_version';
const AI_INSIGHTS_CACHE_VERSION = '2026-05-behavior-drift-v1';

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
    handleUpdateItem,
    handleDelete,
    handleKeepRawTodo,
    handleRetriggerDeepWorkTodo,
    handleAcceptDeepWorkTodo,
    handleResetRoutine,
    pendingReviews = [],
    handleApproveReview,
    handleRejectReview,
    parsingTasks = [],
    retryParsing,
    clearParsingTask,
    undoParsingTask,
    deleteParsingTaskEntries
}) => {
    const swipeHandlers = useSwipeTabs('summary', setActiveTab);

    const changeThemeMonth = (offset: number) => {
        const newDate = new Date(themeNavDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setThemeNavDate(newDate);
    };

    const dateSwipeHandlers = useSwipeDate(
        () => changeThemeMonth(-1),
        () => changeThemeMonth(1)
    );

    const todayDate = new Date();
    const { pendingGroups } = getFocusMonthData(items, todayDate, '', '');
    const { urgent } = getShoppingItems(items);

    const { displayItems, displayTitle, displaySubtitle, isDoneState } = useMemo(() => {
        return buildSummaryFocusDisplay(items, pendingGroups, urgent, 5);
    }, [items, pendingGroups, urgent]);

    const pendingRoutines = pendingGroups.routines.filter(r => r.status === 'pending');
    const showRitualsSection = pendingRoutines.length > 0 && displayTitle !== 'Daily Rituals';

    const { totalExpense } = getFinanceItems(
        items,
        todayDate,
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
    const { totalNetWorth } = getWalletStats(items, wallets);

    // Compute net worth delta: income minus expenses for current month
    const netWorthDelta = useMemo(() => {
        const now = new Date();
        const monthFinance = getFinanceItems(items, now, budgetConfig, '', '', '', '', '', '', '', 'newest');
        const monthIncome = monthFinance.list
            .filter(i => i.meta.financeType === 'income')
            .reduce((sum, i) => sum + (i.meta.amount || 0), 0);
        const monthExpense = monthFinance.totalExpense;
        return monthIncome - monthExpense;
    }, [items, budgetConfig]);

    const totalLimits = budgetConfig.rules.reduce(
        (acc, rule) => acc + (rule.percentage / 100) * budgetConfig.monthlyIncome,
        0
    );

    const fmt = (n: number) =>
        new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(n);

    const fmtCompact = (n: number) => {
        const abs = Math.abs(n);
        if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
        return String(n);
    };

    const budgetPercent = totalLimits > 0 ? Math.min(100, (totalExpense / totalLimits) * 100) : 0;

    const getThemeForDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        return { key, content: monthlyThemes[key] || '' };
    };

    const { content: themeContent } = getThemeForDate(themeNavDate);

    const localInsights = useMemo(
        () => generateInsights(items, budgetConfig, wallets, skills),
        [items, budgetConfig, wallets, skills]
    );

    const narrativeHeadline = useMemo(
        () => getNarrativeHeadline(items, budgetConfig, wallets, skills),
        [items, budgetConfig, wallets, skills]
    );

    const spendingSparkline = useMemo(
        () => getSpendingSparkline(items, 7),
        [items]
    );

    const weeklyComparison = useMemo(
        () => getWeeklyComparison(items, budgetConfig),
        [items, budgetConfig]
    );

    const categoryBreakdown = useMemo(
        () => getCategoryBreakdown(items, budgetConfig, 3),
        [items, budgetConfig]
    );

    const activeGoals = useMemo(
        () => getActiveGoals(items),
        [items]
    );

    const skillProgress = useMemo(
        () => getSkillProgress(items, skills),
        [items, skills]
    );

    const [aiInsights, setAiInsights] = useState<Insight[]>(() => {
        const saved = localStorage.getItem(AI_INSIGHTS_CACHE_KEY);
        const savedVersion = localStorage.getItem(AI_INSIGHTS_CACHE_VERSION_KEY);
        if (savedVersion !== AI_INSIGHTS_CACHE_VERSION) {
            return [];
        }
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [];
            }
        }
        return [];
    });

    const [isLoadingInsights, setIsLoadingInsights] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [hasNewNotification, setHasNewNotification] = useState(() => {
        return localStorage.getItem('braindump_has_new_notification') === 'true';
    });

    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [taskCardCollapsed, setTaskCardCollapsed] = useState<Record<string, boolean>>({});
    const [activeTaskPanels, setActiveTaskPanels] = useState<Record<string, TaskPanel | undefined>>({});
    const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (isNotificationOpen) {
            return BackHandler.register(() => {
                setIsNotificationOpen(false);
                return true;
            });
        }
    }, [isNotificationOpen]);

    useEffect(() => {
        if (isReviewOpen) {
            return BackHandler.register(() => {
                setIsReviewOpen(false);
                return true;
            });
        }
    }, [isReviewOpen]);

    const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
    const reviewButtonRef = useRef<HTMLButtonElement | null>(null);
    const popupRef = useRef<HTMLDivElement | null>(null);
    const reviewPopupRef = useRef<HTMLDivElement | null>(null);

    const [popupPosition, setPopupPosition] = useState<PopupPosition>({
        top: 72,
        left: 16,
        width: 380,
        transformOrigin: 'top right'
    });

    const [reviewPopupPosition, setReviewPopupPosition] = useState<PopupPosition>({
        top: 72,
        left: 16,
        width: 500,
        transformOrigin: 'top right'
    });

    const updatePopupPosition = () => {
        const buttonEl = notificationButtonRef.current;
        if (!buttonEl) return;

        const rect = buttonEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const horizontalMargin = 16;
        const verticalGap = 8;
        const popupOffsetY = -6;
        const preferredWidth = viewportWidth >= 1024 ? 520 : 380;
        const minWidth = viewportWidth >= 1024 ? 420 : 280;

        const width = Math.min(
            preferredWidth,
            Math.max(minWidth, viewportWidth - horizontalMargin * 2)
        );

        let left = rect.right - width;
        left = Math.max(horizontalMargin, left);
        left = Math.min(left, viewportWidth - width - horizontalMargin);

        const estimatedHeight = Math.min(viewportWidth >= 1024 ? 620 : 480, viewportHeight * (viewportWidth >= 1024 ? 0.7 : 0.6));


        let top = rect.bottom + verticalGap + popupOffsetY;

        if (top + estimatedHeight > viewportHeight - 16) {
            top = Math.max(16, rect.top - estimatedHeight - verticalGap);
        }

        const originX = Math.min(width - 24, Math.max(24, rect.right - left - rect.width / 2));
        const originY = top > rect.top ? 0 : estimatedHeight;

        setPopupPosition({
            top,
            left,
            width,
            transformOrigin: `${originX}px ${originY}px`
        });
    };

    const updateReviewPopupPosition = () => {
        const buttonEl = reviewButtonRef.current;
        if (!buttonEl) return;

        const rect = buttonEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const horizontalMargin = 16;
        const verticalGap = 8;
        const popupOffsetY = -6;
        const preferredWidth = 500;
        const minWidth = 320;

        const width = Math.min(
            preferredWidth,
            Math.max(minWidth, viewportWidth - horizontalMargin * 2)
        );

        let left = rect.right - width;
        left = Math.max(horizontalMargin, left);
        left = Math.min(left, viewportWidth - width - horizontalMargin);

        const estimatedHeight = Math.min(600, viewportHeight * 0.7);

        let top = rect.bottom + verticalGap + popupOffsetY;

        if (top + estimatedHeight > viewportHeight - 16) {
            top = Math.max(16, rect.top - estimatedHeight - verticalGap);
        }

        const originX = Math.min(width - 24, Math.max(24, rect.right - left - rect.width / 2));
        const originY = top > rect.top ? 0 : estimatedHeight;

        setReviewPopupPosition({
            top,
            left,
            width,
            transformOrigin: `${originX}px ${originY}px`
        });
    };

    const fetchAIInsights = async (force = false) => {
        const lastFetched = localStorage.getItem(AI_INSIGHTS_CACHE_DATE_KEY);
        const cachedVersion = localStorage.getItem(AI_INSIGHTS_CACHE_VERSION_KEY);
        const today = new Date().toDateString();

        if (!force && (!appSettings.enableDailyInsight || (lastFetched === today && cachedVersion === AI_INSIGHTS_CACHE_VERSION))) {
            return;
        }

        setIsLoadingInsights(true);
        const generated = await generateAIInsights(
            items,
            budgetConfig,
            wallets,
            skills,
            appSettings.insightModel
        );

        if (generated.length > 0) {
            setAiInsights(generated);
            localStorage.setItem(AI_INSIGHTS_CACHE_KEY, JSON.stringify(generated));
            localStorage.setItem(AI_INSIGHTS_CACHE_DATE_KEY, today);
            localStorage.setItem(AI_INSIGHTS_CACHE_VERSION_KEY, AI_INSIGHTS_CACHE_VERSION);
            setHasNewNotification(true);
            localStorage.setItem('braindump_has_new_notification', 'true');
        }

        setIsLoadingInsights(false);
    };

    const handleOpenNotification = () => {
        updatePopupPosition();
        setIsNotificationOpen(true);
        setHasNewNotification(false);
        localStorage.setItem('braindump_has_new_notification', 'false');
    };

    const handleCloseNotification = () => {
        setIsNotificationOpen(false);
    };

    const handleOpenReview = () => {
        updateReviewPopupPosition();
        setIsReviewOpen(true);
    };

    const handleCloseReview = () => {
        setIsReviewOpen(false);
    };

    useLayoutEffect(() => {
        if (!isNotificationOpen) return;

        updatePopupPosition();

        const handleWindowChange = () => {
            updatePopupPosition();
        };

        window.addEventListener('resize', handleWindowChange);
        window.addEventListener('scroll', handleWindowChange, true);

        return () => {
            window.removeEventListener('resize', handleWindowChange);
            window.removeEventListener('scroll', handleWindowChange, true);
        };
    }, [isNotificationOpen]);

    useLayoutEffect(() => {
        if (!isReviewOpen) return;

        updateReviewPopupPosition();

        const handleWindowChange = () => {
            updateReviewPopupPosition();
        };

        window.addEventListener('resize', handleWindowChange);
        window.addEventListener('scroll', handleWindowChange, true);

        return () => {
            window.removeEventListener('resize', handleWindowChange);
            window.removeEventListener('scroll', handleWindowChange, true);
        };
    }, [isReviewOpen]);

    useEffect(() => {
        if (items.length > 0) {
            fetchAIInsights();
        }

        const intervalId = setInterval(() => {
            if (items.length > 0) {
                fetchAIInsights();
            }
        }, 60 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [items.length, budgetConfig, wallets, skills, appSettings.enableDailyInsight]);

    const displayInsights = aiInsights.length > 0 ? aiInsights : localInsights;

    const cardProps = {
        onToggleStatus: handleToggleStatus,
        onUpdate: handleUpdateItem,
        onDelete: handleDelete,
        enableCollapse: true,
        defaultCollapsed: true,
        hideMoney: appSettings.hideMoney,
        skills,
        wallets,
        budgetRules: budgetConfig.rules,
        onResetRoutine: handleResetRoutine
    };

    const isTaskCardExpanded = (id: string) => {
        const collapsed = taskCardCollapsed[id];
        return collapsed === undefined ? false : !collapsed;
    };

    const setTaskPanel = (id: string, panel: TaskPanel) => {
        setActiveTaskPanels(prev => ({ ...prev, [id]: panel }));
    };

    const toggleTaskPanel = (id: string, panel: Exclude<TaskPanel, 'none'>, activePanel: TaskPanel) => {
        setTaskPanel(id, activePanel === panel ? 'none' : panel);
    };

    const resetTaskPanel = (id: string) => {
        setActiveTaskPanels(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const getDefaultTaskPanel = (children: BrainDumpItem[], isDeepWork: boolean): TaskPanel => {
        return isDeepWork && children.length > 0 ? 'subtasks' : 'edit';
    };

    const getActiveTaskPanel = (item: BrainDumpItem, children: BrainDumpItem[], isDeepWork: boolean): TaskPanel => {
        return activeTaskPanels[item.id] || getDefaultTaskPanel(children, isDeepWork);
    };

    const taskPanelButtonClass = (active: boolean, tone: 'edit' | 'subtasks' = 'edit') => {
        if (active && tone === 'subtasks') return 'px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors flex items-center gap-1';
        if (tone === 'subtasks') return 'px-3 py-2 rounded-xl bg-purple-500/10 text-purple-500 text-xs font-bold hover:bg-purple-500/20 transition-colors flex items-center gap-1';
        if (active) return 'px-3 py-2 rounded-xl bg-primary text-background text-xs font-bold hover:opacity-90 transition-colors flex items-center gap-1';
        return 'px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted hover:text-primary hover:bg-black/10 dark:hover:bg-white/15 text-xs font-bold transition-colors flex items-center gap-1';
    };

    const getTaskCardProps = (item: BrainDumpItem, activePanel: TaskPanel, editPanelControls: React.ReactNode, extraExpandedContent?: React.ReactNode) => ({
        ...cardProps,
        collapsibleEditPanel: true,
        editPanelExpanded: activePanel === 'edit',
        editPanelControls,
        extraExpandedContent,
        onEditPanelExpandedChange: (id: string, expanded: boolean) => {
            if (expanded) setTaskPanel(id, 'edit');
        },
        onCollapseChange: (id: string, collapsed: boolean) => {
            setTaskCardCollapsed(prev => ({ ...prev, [id]: collapsed }));
            if (collapsed) resetTaskPanel(id);
        }
    });

    const getChildCardProps = () => cardProps;

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
        if (draft.length === 0) return;
        handleAcceptDeepWorkTodo(item.id, draft);
        setTaskPanel(item.id, 'subtasks');
    };

    const openManualSubtaskDraft = (item: BrainDumpItem) => {
        const draft = getSubtaskDraft(item, []);
        setSubtaskDrafts(prev => ({ ...prev, [item.id]: draft.length ? draft : [''] }));
        setTaskPanel(item.id, 'subtasks');
    };

    const renderSubtaskDraftEditor = (item: BrainDumpItem, children: BrainDumpItem[], saveLabel: string) => {
        const draft = getSubtaskDraft(item, children);
        return (
            <div className="space-y-2">
                {draft.map((step, index) => (
                    <div key={`${item.id}-draft-${index}`} className="flex gap-2">
                        <div className="mt-3 h-5 w-5 shrink-0 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold flex items-center justify-center">{index + 1}</div>
                        <textarea
                            value={step}
                            onChange={(event) => updateSubtaskDraft(item.id, index, event.target.value, draft)}
                            className="min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-purple-500/60"
                            placeholder="Subtask..."
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
                    <button onClick={() => acceptDeepWorkPlan(item, children)} className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={draft.map(step => step.trim()).filter(Boolean).length === 0}>
                        {saveLabel}
                    </button>
                </div>
            </div>
        );
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

    const renderSummaryFocusCard = (item: BrainDumpItem) => {
        const children = getDeepWorkChildren(items, item.id);
        const isDeepWork = !!item.meta.deepWorkParent || children.length > 0;
        const canUseManualSubtasks = item.type === ItemType.TODO && !item.meta.parentTodoId;
        const isCardExpanded = isTaskCardExpanded(item.id);
        const activePanel = getActiveTaskPanel(item, children, isDeepWork);
        const isSubtasksExpanded = activePanel === 'subtasks';

        if (!isDeepWork) {
            const draft = getSubtaskDraft(item, children);
            const hasManualSubtasks = children.length > 0 || draft.some(step => step.trim());
            const editPanelControls = isCardExpanded ? (
                <div className="flex flex-wrap gap-2 w-full">
                    <button
                        onClick={() => toggleTaskPanel(item.id, 'edit', activePanel)}
                        className={taskPanelButtonClass(activePanel === 'edit')}
                    >
                        {activePanel === 'edit' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Show edit
                    </button>
                    {canUseManualSubtasks && (
                        <button
                            onClick={() => hasManualSubtasks ? toggleTaskPanel(item.id, 'subtasks', activePanel) : openManualSubtaskDraft(item)}
                            className={taskPanelButtonClass(isSubtasksExpanded, 'subtasks')}
                        >
                            {isSubtasksExpanded ? <ChevronUp className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            {hasManualSubtasks ? 'Subtasks' : 'Add subtask'}
                        </button>
                    )}
                </div>
            ) : null;
            const manualSubtaskPanel = canUseManualSubtasks && isCardExpanded && isSubtasksExpanded ? (
                <AnimatePresence initial={false}>
                    {isSubtasksExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="rounded-2xl border border-border bg-background/70 p-3 space-y-3 lg:p-4">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Manual subtasks</div>
                                {renderSubtaskDraftEditor({ ...item, meta: { ...item.meta, subtasks: draft } }, children, 'Create subtasks')}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            ) : undefined;
            const taskCardProps = getTaskCardProps(item, activePanel, editPanelControls, manualSubtaskPanel);
            return <Card key={item.id} item={item} {...taskCardProps} editComfort="taskWorkspace" />;
        }

        const isSuggested = item.meta.deepWorkStatus === 'suggested';
        const isBlocked = item.meta.deepWorkBlockerStatus === 'blocked' || item.meta.deepWorkBlockerStatus === 'needs_input';
        const hasDeepWorkDetails = !!(item.meta.deepWorkNextAction || item.meta.deepWorkFinalOutput || item.meta.deepWorkSessionEstimateMinutes || item.meta.deepWorkBlockerCheck || item.meta.deepWorkStatus === 'suggested');
        const doneCount = children.filter(child => child.status === 'done').length;
        const draft = getSubtaskDraft(item, children);
        const totalSteps = children.length || draft.length || item.meta.deepWorkStepCount || 0;
        const progressPercent = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : (item.meta.progress || 0);
        const deepWorkPanelControls = isCardExpanded ? (
            <div className="flex flex-wrap gap-2 w-full">
                <button
                    onClick={() => toggleTaskPanel(item.id, 'edit', activePanel)}
                    className={taskPanelButtonClass(activePanel === 'edit')}
                >
                    {activePanel === 'edit' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Show edit
                </button>
                {isSuggested && (
                    <button onClick={() => acceptDeepWorkPlan(item, children)} className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors">
                        Transform into steps
                    </button>
                )}
                <button onClick={() => toggleTaskPanel(item.id, 'subtasks', activePanel)} className={taskPanelButtonClass(isSubtasksExpanded, 'subtasks')}>
                    {isSubtasksExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isSuggested ? 'Preview/edit steps' : 'Subtasks'}
                </button>
                {hasDeepWorkDetails && (
                    <>
                        <button onClick={() => handleKeepRawTodo(item.id)} className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 transition-colors">
                            Keep raw
                        </button>
                        <button onClick={() => handleRetriggerDeepWorkTodo(item.id)} className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 transition-colors flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Retrigger
                        </button>
                    </>
                )}
            </div>
        ) : null;
        const deepWorkSubtaskPanel = isSubtasksExpanded ? (
            <AnimatePresence initial={false}>
                {isSubtasksExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-2xl border border-border bg-background/70 p-3 space-y-3 lg:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                {hasDeepWorkDetails && (
                                    <div className="flex items-center gap-2 text-purple-500">
                                        <Sparkles className="w-4 h-4" />
                                        <div className="text-[10px] font-bold uppercase tracking-wider">Deep Work Transformer</div>
                                    </div>
                                )}
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

                            {hasDeepWorkDetails && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                    {renderDeepWorkDetail(<Flag className="w-3 h-3" />, 'Next action', item.meta.deepWorkNextAction)}
                                    {renderDeepWorkDetail(<ListChecks className="w-3 h-3" />, 'Final output', item.meta.deepWorkFinalOutput)}
                                    {renderDeepWorkDetail(<Timer className="w-3 h-3" />, 'Session estimate', item.meta.deepWorkSessionEstimateMinutes ? `${item.meta.deepWorkSessionEstimateMinutes} min${item.meta.deepWorkSessionEstimateConfidence ? ` • ${item.meta.deepWorkSessionEstimateConfidence}` : ''}` : undefined)}
                                    {renderDeepWorkDetail(<ShieldAlert className="w-3 h-3" />, 'Blocker check', item.meta.deepWorkBlockerCheck, isBlocked ? 'text-amber-500' : 'text-emerald-500')}
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Optional subtasks</div>
                                {isSuggested ? (
                                    renderSubtaskDraftEditor(item, children, 'Use these steps')
                                ) : (
                                    <div className="space-y-2">
                                        {children.map(child => (
                                            <Card key={child.id} item={child} {...getChildCardProps()} editComfort="taskWorkspace" className="rounded-[14px]" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        ) : undefined;
        const taskCardProps = getTaskCardProps(item, activePanel, deepWorkPanelControls, deepWorkSubtaskPanel);

        return <Card key={item.id} item={item} {...taskCardProps} editComfort="taskWorkspace" />;
    };

    return (
        <div className={contentSurface.pageShell}>
            <motion.div
                layoutId="top-container"
                data-swipe-tabs="summary"
                className={`${contentSurface.headerHero} mb-6`}
                transition={{ type: 'tween', duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                onTouchStart={swipeHandlers.onTouchStart}
                onTouchMove={swipeHandlers.onTouchMove}
                onTouchEnd={swipeHandlers.onTouchEnd}
                style={{ x: swipeHandlers.dragOffset }}
            >
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'linear' }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-sm font-bold opacity-60 uppercase tracking-wider">
                            <div className="w-2 h-2 rounded-full bg-black"></div>
                            Dashboard
                        </div>

                        <div className="flex items-center gap-2">
                            <div
                                data-swipe-date="summary-theme-month"
                                className="flex items-center bg-black/5 rounded-full p-1 touch-pan-y"
                                onTouchStart={dateSwipeHandlers.onTouchStart}
                                onTouchMove={dateSwipeHandlers.onTouchMove}
                                onTouchEnd={dateSwipeHandlers.onTouchEnd}
                            >
                                <button
                                    onClick={() => changeThemeMonth(-1)}
                                    className="p-2 hover:bg-black/5 rounded-full"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>

                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={themeNavDate.toISOString()}
                                        data-theme-month-label="true"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="px-2 text-sm font-bold min-w-[80px] text-center"
                                    >
                                        {themeNavDate.toLocaleDateString(undefined, {
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </motion.span>
                                </AnimatePresence>

                                <button
                                    onClick={() => changeThemeMonth(1)}
                                    className="p-2 hover:bg-black/5 rounded-full"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                ref={reviewButtonRef}
                                onClick={handleOpenReview}
                                className="relative flex items-center justify-center bg-black/5 rounded-full h-[36px] w-[36px] hover:bg-black/10 transition-colors"
                                aria-label="Open review center"
                            >
                                <ClipboardCheck className="w-[18px] h-[18px]" strokeWidth={2} />
                                {((pendingReviews && pendingReviews.length > 0) || (parsingTasks && parsingTasks.length > 0)) && (
                                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border border-surface"></span>
                                )}
                            </button>

                            <button
                                ref={notificationButtonRef}
                                onClick={handleOpenNotification}
                                className="relative flex items-center justify-center bg-black/5 rounded-full h-[36px] w-[36px] hover:bg-black/10 transition-colors"
                                aria-label="Open notifications"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                                </svg>

                                {hasNewNotification && (
                                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-surface"></span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold mb-1 tracking-tight leading-tight">
                                {themeContent ? `"${themeContent}"` : 'Set a theme...'}
                            </h1>
                            <button
                                onClick={() => onThemeEdit(themeContent)}
                                className="text-sm font-medium opacity-50 hover:opacity-100 flex items-center gap-1 mt-2"
                            >
                                <Pencil className="w-3 h-3" /> Edit Theme
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            <div className="px-4 space-y-3 lg:px-0 lg:space-y-3">
                <NarrativeHeadlineCard data={narrativeHeadline} />
                <WoWComparisonCards data={weeklyComparison} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className={contentSurface.summaryDashboardGrid}
            >
                <section className={`${contentSurface.sideColumn} lg:order-2`}>
                    <div className="grid grid-cols-4 gap-3 lg:grid-cols-2 lg:gap-3 lg:rounded-[28px] lg:border lg:border-border lg:bg-surface/70 lg:p-4">
                        <div className="hidden lg:col-span-2 lg:flex lg:items-center lg:justify-between lg:pb-1">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-muted">Quick add</h2>
                                <p className="mt-1 text-xs text-muted">Most-used captures stay one click away.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleOpenAddTask(new Date().toISOString().split('T')[0])}
                            className="flex flex-col items-center gap-2 group lg:rounded-2xl lg:bg-background/70 lg:p-3 lg:hover:bg-background"
                        >
                            <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center group-active:scale-95 transition-transform">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Task</span>
                        </button>

                        <button
                            onClick={() => handleOpenAddShopping()}
                            className="flex flex-col items-center gap-2 group lg:rounded-2xl lg:bg-background/70 lg:p-3 lg:hover:bg-background"
                        >
                            <div className="w-14 h-14 bg-white text-black border border-black/10 rounded-2xl flex items-center justify-center group-active:scale-95 transition-transform">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Buy</span>
                        </button>

                        <button
                            onClick={handleOpenAddNote}
                            className="flex flex-col items-center gap-2 group lg:rounded-2xl lg:bg-background/70 lg:p-3 lg:hover:bg-background"
                        >
                            <div className="w-14 h-14 bg-white text-black border border-black/10 rounded-2xl flex items-center justify-center group-active:scale-95 transition-transform">
                                <StickyNote className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Note</span>
                        </button>

                        <button
                            onClick={handleOpenAddExpense}
                            className="flex flex-col items-center gap-2 group lg:rounded-2xl lg:bg-background/70 lg:p-3 lg:hover:bg-background"
                        >
                            <div className="w-14 h-14 bg-white text-black border border-black/10 rounded-2xl flex items-center justify-center group-active:scale-95 transition-transform">
                                <WalletIcon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Expense</span>
                        </button>
                    </div>
                </section>

                <section className={`${contentSurface.primaryColumn} lg:order-1 lg:row-span-2 lg:rounded-[28px] lg:border lg:border-border/70 lg:bg-surface/35 lg:p-5 lg:shadow-sm`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                {displayTitle}
                            </h2>
                            {displaySubtitle && (
                                <p className="text-xs opacity-50 font-medium mt-0.5">
                                    {displaySubtitle}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* mini week task stat */}
                            {(() => {
                                const now = new Date();
                                const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
                                const weekTasks = items.filter(i => i.type === ItemType.TODO && !i.meta.isRoutine && i.meta.date && new Date(i.meta.date) >= weekStart && new Date(i.meta.date) <= now);
                                const doneCount = weekTasks.filter(i => i.status === 'done').length;
                                const total = weekTasks.length;
                                if (total === 0) return null;
                                const pct = Math.round((doneCount / total) * 100);
                                const radius = 12; const circ = 2 * Math.PI * radius; const offset = circ * (1 - pct / 100);
                                return (
                                    <div className="flex items-center gap-1.5">
                                        <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
                                            <circle cx="14" cy="14" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-black/10 dark:text-white/10" />
                                            <circle cx="14" cy="14" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                                strokeDasharray={circ} strokeDashoffset={offset}
                                                transform="rotate(-90 14 14)"
                                                className={pct >= 75 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}
                                            />
                                        </svg>
                                        <span className="text-xs font-bold tabular-nums">{pct}%</span>
                                        <span className="text-[10px] text-muted">this week</span>
                                    </div>
                                );
                            })()}
                            <button
                                onClick={() => setActiveTab('plan')}
                                className="text-xs font-bold opacity-50 hover:opacity-100 uppercase tracking-wider"
                            >
                                View All
                            </button>
                        </div>
                    </div>

                    {displayItems.length > 0 ? (
                        <div className={`${contentSurface.denseList} ${isDoneState ? 'opacity-60 grayscale' : ''}`}>
                            {displayItems.map(item => renderSummaryFocusCard(item))}
                        </div>
                    ) : (
                        <div className={`${contentSurface.emptyStateCard} lg:text-left`}>
                            <p className="text-muted font-medium">All clear!</p>
                            <p className="text-xs opacity-50 mt-1">Take a break or plan ahead.</p>
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:justify-start">
                                <button
                                    onClick={() => handleOpenAddTask(new Date().toISOString().split('T')[0])}
                                    className="rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-600"
                                >
                                    Add task
                                </button>
                                <button
                                    onClick={handleOpenAddNote}
                                    className="rounded-2xl bg-black/5 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
                                >
                                    Capture note
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {showRitualsSection && (
                    <section className={`${contentSurface.sideColumn} lg:order-3`}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">Rituals</h2>
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:p-0">
                            {pendingRoutines.map(routine => (
                                <button
                                    key={routine.id}
                                    onClick={() => handleToggleStatus(routine.id)}
                                    className="flex-shrink-0 flex flex-col items-center gap-2 min-w-[72px] lg:min-w-0 lg:rounded-2xl lg:border lg:border-border/60 lg:bg-surface/70 lg:p-3"
                                >
                                    <div className="w-16 h-16 bg-surface border-2 border-indigo-500/20 rounded-full flex items-center justify-center transition-all hover:border-indigo-500 hover:bg-indigo-500/10">
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

                <section onClick={() => setActiveTab('money')} className={`${contentSurface.sideColumn} cursor-pointer group lg:order-4`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            Financials
                        </h2>
                        <ArrowRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="bg-surface text-primary rounded-[24px] border border-border/70 p-5 relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 right-0 p-5 opacity-5">
                            <WalletIcon className="w-24 h-24" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-sm font-medium opacity-60 mb-1">Net Worth</p>
                                    <div className="text-2xl font-bold flex items-center gap-2">
                                        {showBalance ? fmt(totalNetWorth) : '••••••••'}
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                setShowBalance(!showBalance);
                                            }}
                                            className="opacity-50 hover:opacity-100"
                                        >
                                            {showBalance ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    {showBalance && netWorthDelta !== 0 && (
                                        <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${netWorthDelta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {netWorthDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            {netWorthDelta > 0 ? '+' : ''}{fmtCompact(netWorthDelta)} this month
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-5">
                                <div className="flex justify-between text-xs font-medium mb-2 opacity-80">
                                    <span>Monthly Spending</span>
                                    <span>{budgetPercent.toFixed(0)}% of Budget</span>
                                </div>
                                <div className="h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${
                                            budgetPercent > 100 ? 'bg-red-500' : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${budgetPercent}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] mt-1 opacity-50">
                                    <span>{fmt(totalExpense)}</span>
                                    <span>{fmt(totalLimits)}</span>
                                </div>
                            </div>

                            {spendingSparkline.values.some(v => v > 0) && (
                                <div className="mt-4 pt-3 border-t border-border/50">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted">7-Day Spending</span>
                                        <span className="text-[10px] font-bold text-muted">{fmtCompact(spendingSparkline.total)}</span>
                                    </div>
                                    <svg
                                        viewBox={`0 0 ${spendingSparkline.values.length * 2 - 1} 20`}
                                        className="w-full h-8"
                                        preserveAspectRatio="none"
                                    >
                                        <defs>
                                            <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" className="text-indigo-500" />
                                                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        {/* fill area */}
                                        <path
                                            d={(() => {
                                                const max = spendingSparkline.max || 1;
                                                const vals = spendingSparkline.values;
                                                const w = vals.length * 2 - 1;
                                                const points = vals.map((v, i) => `${i * 2},${20 - (v / max) * 18}`);
                                                return `M0,20 ${points.map(p => `L${p}`).join(' ')} L${w - 1},20 Z`;
                                            })()}
                                            fill="url(#sparkline-fill)"
                                            className="text-indigo-500"
                                        />
                                        {/* line */}
                                        <polyline
                                            points={spendingSparkline.values
                                                .map((v, i) => `${i * 2},${20 - (v / (spendingSparkline.max || 1)) * 18}`)
                                                .join(' ')}
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="text-indigo-500"
                                        />
                                        {/* today dot */}
                                        <circle
                                            cx={(spendingSparkline.values.length - 1) * 2}
                                            cy={20 - ((spendingSparkline.values[spendingSparkline.values.length - 1] || 0) / (spendingSparkline.max || 1)) * 18}
                                            r="2"
                                            fill="currentColor"
                                            className="text-indigo-500"
                                        />
                                    </svg>
                                    <div className="flex justify-between text-[9px] mt-1 opacity-30">
                                        <span>{new Date(Date.now() - 6 * 86400000).toLocaleDateString('en', { weekday: 'short' })}</span>
                                        <span>Today</span>
                                    </div>
                                </div>
                            )}

                            <CategoryBreakdownBars
                                data={categoryBreakdown}
                                onClick={() => setActiveTab('money')}
                            />
                        </div>
                    </div>
                </section>

                <GoalsProgressWidget
                    goals={activeGoals}
                    onClick={() => { setActiveTab('plan'); setPlanSubTab('savings'); }}
                />

                <SkillProgressWidget skills={skillProgress} />

                {typeof window !== 'undefined' &&
                    createPortal(
                        <AnimatePresence>
                            {isNotificationOpen && (
                                <>
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={handleCloseNotification}
                                        className="fixed inset-0 bg-black/30 z-[9998]"
                                    />

                                    <motion.div
                                        ref={popupRef}
                                        initial={{ opacity: 0, scale: 0.92, y: -8 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.92, y: -8 }}
                                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                                        className="fixed bg-surface border border-border rounded-3xl z-[9999] overflow-hidden flex flex-col max-h-[60vh] lg:max-h-[70vh] lg:shadow-2xl"
                                        style={{
                                            top: popupPosition.top,
                                            left: popupPosition.left,
                                            width: popupPosition.width,
                                            transformOrigin: popupPosition.transformOrigin
                                        }}
                                    >
                                        <div className="flex items-center justify-between p-4 border-b border-border">
                                            <h3 className="font-bold text-lg flex items-center gap-2">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                                                </svg>
                                                Notifications
                                            </h3>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => fetchAIInsights(true)}
                                                    disabled={isLoadingInsights}
                                                    className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                                                >
                                                    <RefreshCw className={`w-4 h-4 ${isLoadingInsights ? 'animate-spin' : ''}`} />
                                                </button>

                                                <button
                                                    onClick={handleCloseNotification}
                                                    className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                                                >
                                                    <ChevronDown className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-4 lg:p-5 overflow-y-auto space-y-3">
                                            {displayInsights.length > 0 ? (
                                                displayInsights.map((insight, idx) => {
                                                    let bgColor = 'bg-black/5 dark:bg-white/10';
                                                    let iconColor = 'text-zinc-500';
                                                    let Icon = AlertTriangle;

                                                    if (insight.type === 'warning') {
                                                        bgColor = 'bg-red-500/10 border border-red-500/20';
                                                        iconColor = 'text-red-500';
                                                        Icon = AlertTriangle;
                                                    } else if (insight.type === 'success') {
                                                        bgColor = 'bg-emerald-500/10 border border-emerald-500/20';
                                                        iconColor = 'text-emerald-500';
                                                        Icon = CheckCircle2;
                                                    } else {
                                                        bgColor = 'bg-blue-500/10 border border-blue-500/20';
                                                        iconColor = 'text-blue-500';
                                                        if (insight.iconType === 'task') Icon = Target;
                                                        else if (insight.iconType === 'finance') Icon = WalletIcon;
                                                        else if (insight.iconType === 'shopping') Icon = ShoppingCart;
                                                        else if (insight.iconType === 'skill') Icon = Sprout;
                                                    }

                                                    return (
                                                        <div key={idx} className={`p-4 rounded-2xl flex items-start gap-3 ${bgColor}`}>
                                                            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} />
                                                            <div>
                                                                <h3 className="text-sm font-bold mb-0.5">{insight.title}</h3>
                                                                <p className="text-xs opacity-70 leading-relaxed">{insight.message}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="text-center py-8 opacity-50">
                                                    <p className="text-sm">No new notifications</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                            
                            {isReviewOpen && (
                                <>
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={handleCloseReview}
                                        className="fixed inset-0 bg-black/30 z-[9998]"
                                    />

                                    <motion.div
                                        ref={reviewPopupRef}
                                        initial={{ opacity: 0, scale: 0.92, y: -8 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.92, y: -8 }}
                                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                                        className="fixed bg-surface border border-border rounded-3xl z-[9999] overflow-hidden flex flex-col max-h-[70vh] shadow-2xl"
                                        style={{
                                            top: reviewPopupPosition.top,
                                            left: reviewPopupPosition.left,
                                            width: reviewPopupPosition.width,
                                            transformOrigin: reviewPopupPosition.transformOrigin
                                        }}
                                    >
                                        <div className="flex items-center justify-between p-4 border-b border-border bg-surface shrink-0 z-10">
                                            <h3 className="font-bold text-lg flex items-center gap-2">
                                                <ClipboardCheck className="w-5 h-5 text-indigo-500" />
                                                Review Center
                                            </h3>

                                            <div className="flex items-center gap-2">
                                                {pendingReviews && pendingReviews.length > 0 && (
                                                    <span className="text-xs bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                                                        {pendingReviews.length} Pending
                                                    </span>
                                                )}
                                                <button
                                                    onClick={handleCloseReview}
                                                    className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors ml-2"
                                                >
                                                    <ChevronDown className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        <ReviewCenterPanel
                                            parsingTasks={parsingTasks}
                                            pendingReviews={pendingReviews}
                                            onApproveReview={handleApproveReview}
                                            onRejectReview={handleRejectReview}
                                            retryParsing={retryParsing}
                                            clearParsingTask={clearParsingTask}
                                            undoParsingTask={undoParsingTask}
                                            deleteParsingTaskEntries={deleteParsingTaskEntries}
                                        />
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}
            </motion.div>
        </div>
    );
};

export default SummaryView;
