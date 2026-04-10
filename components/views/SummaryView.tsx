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
    ChevronDown
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
    AppSettings
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
}

type PopupPosition = {
    top: number;
    left: number;
    width: number;
    transformOrigin: string;
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
    handleUpdateItem,
    handleDelete
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
        const todayItems = [
            ...urgent.map(i => ({ ...i, _isUrgentShopping: true })),
            ...pendingGroups.today
        ];

        if (todayItems.length > 0) {
            return {
                displayItems: todayItems.slice(0, 5),
                displayTitle: "Today's Focus",
                displaySubtitle: null,
                isDoneState: false
            };
        }

        if (pendingGroups.tomorrow.length > 0) {
            return {
                displayItems: pendingGroups.tomorrow.slice(0, 5),
                displayTitle: 'Tomorrow',
                displaySubtitle: "Get a head start on tomorrow's tasks.",
                isDoneState: false
            };
        }

        const pendingRoutines = pendingGroups.routines.filter(r => r.status === 'pending');
        if (pendingRoutines.length > 0) {
            return {
                displayItems: pendingRoutines.slice(0, 5),
                displayTitle: 'Daily Rituals',
                displaySubtitle: 'Keep your momentum going.',
                isDoneState: false
            };
        }

        if (pendingGroups.later.length > 0) {
            return {
                displayItems: pendingGroups.later.slice(0, 5),
                displayTitle: 'Upcoming',
                displaySubtitle: 'Tasks waiting for your attention.',
                isDoneState: false
            };
        }

        const recentDone = items
            .filter(i => i.type === 'TODO' && i.status === 'done' && i.completed_at)
            .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
            .slice(0, 3);

        if (recentDone.length > 0) {
            return {
                displayItems: recentDone,
                displayTitle: 'Recently Completed',
                displaySubtitle: "Great job! You're all caught up.",
                isDoneState: true
            };
        }

        return {
            displayItems: [],
            displayTitle: 'All Clear',
            displaySubtitle: 'Take a break or plan ahead.',
            isDoneState: false
        };
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

    const [aiInsights, setAiInsights] = useState<Insight[]>(() => {
        const saved = localStorage.getItem('braindump_ai_insights');
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

    useEffect(() => {
        if (isNotificationOpen) {
            return BackHandler.register(() => {
                setIsNotificationOpen(false);
                return true;
            });
        }
    }, [isNotificationOpen]);

    const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
    const popupRef = useRef<HTMLDivElement | null>(null);

    const [popupPosition, setPopupPosition] = useState<PopupPosition>({
        top: 72,
        left: 16,
        width: 380,
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
        const preferredWidth = 380;
        const minWidth = 280;

        const width = Math.min(
            preferredWidth,
            Math.max(minWidth, viewportWidth - horizontalMargin * 2)
        );

        let left = rect.right - width;
        left = Math.max(horizontalMargin, left);
        left = Math.min(left, viewportWidth - width - horizontalMargin);

        const estimatedHeight = Math.min(480, viewportHeight * 0.6);


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

    const fetchAIInsights = async (force = false) => {
        const lastFetched = localStorage.getItem('braindump_ai_insights_date');
        const today = new Date().toDateString();

        if (!force && (!appSettings.enableDailyInsight || lastFetched === today)) {
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
            localStorage.setItem('braindump_ai_insights', JSON.stringify(generated));
            localStorage.setItem('braindump_ai_insights_date', today);
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
        skills,
        wallets,
        budgetRules: budgetConfig.rules,
        onResetRoutine: (id: string) => {}
    };

    return (
        <div className="pb-24">
            <motion.div
                layoutId="top-container"
                className="bg-surface text-primary rounded-b-[32px] p-6 pt-12 shadow-sm mb-6 touch-pan-y"
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

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="px-4 space-y-8"
            >
                <section>
                    <div className="grid grid-cols-4 gap-3">
                        <button
                            onClick={() => handleOpenAddTask(new Date().toISOString().split('T')[0])}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/20 group-active:scale-95 transition-transform">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Task</span>
                        </button>

                        <button
                            onClick={() => handleOpenAddShopping()}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-14 h-14 bg-white text-black border border-black/10 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Buy</span>
                        </button>

                        <button
                            onClick={handleOpenAddNote}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-14 h-14 bg-white text-black border border-black/10 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
                                <StickyNote className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Note</span>
                        </button>

                        <button
                            onClick={handleOpenAddExpense}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-14 h-14 bg-white text-black border border-black/10 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
                                <WalletIcon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-medium opacity-70">Expense</span>
                        </button>
                    </div>
                </section>

                <section>
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

                        <button
                            onClick={() => setActiveTab('plan')}
                            className="text-xs font-bold opacity-50 hover:opacity-100 uppercase tracking-wider"
                        >
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

                {showRitualsSection && (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">Rituals</h2>
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                            {pendingRoutines.map(routine => (
                                <button
                                    key={routine.id}
                                    onClick={() => handleToggleStatus(routine.id)}
                                    className="flex-shrink-0 flex flex-col items-center gap-2 min-w-[72px]"
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

                <section onClick={() => setActiveTab('money')} className="cursor-pointer group">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            Financials
                        </h2>
                        <ArrowRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="bg-surface border border-border text-primary rounded-[24px] p-5 relative overflow-hidden shadow-sm">
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
                                </div>
                            </div>

                            <div className="mt-6">
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
                        </div>
                    </div>
                </section>

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
                                        className="fixed bg-surface border border-border rounded-3xl shadow-2xl z-[9999] overflow-hidden flex flex-col max-h-[60vh]"
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

                                        <div className="p-4 overflow-y-auto space-y-3">
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
                        </AnimatePresence>,
                        document.body
                    )}
            </motion.div>
        </div>
    );
};

export default SummaryView;