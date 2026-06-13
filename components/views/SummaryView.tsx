import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { BackHandler } from "../../utils/backHandler";
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
  CalendarDays,
  Clock3,
  Trophy,
  Image as ImageIcon,
  Circle,
  Check,
  BarChart3,
  Home,
  FileText,
  Settings,
} from "lucide-react";
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
} from "../../types";
import {
  getFocusMonthData,
  getShoppingItems,
  getWalletStats,
  getFinanceItems,
  generateInsights,
} from "../../utils/selectors";
import { generateAIInsights, Insight } from "../../services/insightService";
import { useSwipeTabs } from "../../hooks/useSwipeTabs";
import { useSwipeDate } from "../../hooks/useSwipeDate";
import Card from "../Card";
import ReviewCenterPanel from "../ReviewCenterPanel";
import { contentSurface } from "../layout/contentSurface";
import { buildSummaryFocusDisplay } from "../../utils/summaryFocusUtils";
import { getDeepWorkChildren } from "../../utils/deepWorkTodoModel";

interface SummaryViewProps {
  items: BrainDumpItem[];
  skills: Skill[];
  wallets: Wallet[];
  budgetConfig: BudgetConfig;
  appSettings: AppSettings;
  themeNavDate: Date;
  setThemeNavDate: (d: Date) => void;
  monthlyThemes: Record<string, string>;
  monthlyThemeImages?: Record<string, string>;
  onThemeEdit: (
    content: string,
    context?: {
      key: string;
      heroImage?: string;
    },
  ) => void;
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
    routineInterval?: "daily" | "weekly" | "monthly" | "yearly",
    routineDaysOfWeek?: number[],
    routineDaysOfMonth?: number[],
    routineMonthsOfYear?: number[],
    savingGoalId?: string,
    dedicatedWalletId?: string,
    priority?: Priority,
  ) => void;
  handleDelete: (id: string) => void;
  handleKeepRawTodo: (id: string) => void;
  handleRetriggerDeepWorkTodo: (id: string) => void;
  handleAcceptDeepWorkTodo: (id: string, subtasks?: string[]) => void;
  handleResetRoutine: (id: string) => void;
  pendingReviews?: { id: string; text: string; results: any[] }[];
  handleApproveReview?: (id: string, updatedResults: any[]) => void;
  handleRejectReview?: (id: string) => void;
  parsingTasks?: import("../../types").ParsingTask[];
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

type TaskPanel = "edit" | "subtasks" | "none";

const AI_INSIGHTS_CACHE_KEY = "braindump_ai_insights";
const AI_INSIGHTS_CACHE_DATE_KEY = "braindump_ai_insights_date";
const AI_INSIGHTS_CACHE_VERSION_KEY = "braindump_ai_insights_version";
const AI_INSIGHTS_CACHE_VERSION = "2026-05-behavior-drift-v1";

const SummaryView: React.FC<SummaryViewProps> = ({
  items,
  skills,
  wallets,
  budgetConfig,
  appSettings,
  themeNavDate,
  setThemeNavDate,
  monthlyThemes,
  monthlyThemeImages = {},
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
  deleteParsingTaskEntries,
}) => {
  const swipeHandlers = useSwipeTabs("summary", setActiveTab);

  const changeThemeMonth = (offset: number) => {
    const newDate = new Date(themeNavDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setThemeNavDate(newDate);
  };

  const dateSwipeHandlers = useSwipeDate(
    () => changeThemeMonth(-1),
    () => changeThemeMonth(1),
  );

  const todayDate = new Date();
  const { pendingGroups } = getFocusMonthData(items, todayDate, "", "");

  const shoppingGroups = useMemo(() => getShoppingItems(items), [items]);
  const { urgent, routine: routineShopping } = shoppingGroups;
  const summaryPendingGroups = useMemo(() => {
    const routineMap = new Map<string, BrainDumpItem>();

    pendingGroups.routines.forEach((item) => {
      routineMap.set(item.id, item);
    });

    routineShopping.forEach((item) => {
      routineMap.set(item.id, item);
    });

    return {
      ...pendingGroups,
      routines: Array.from(routineMap.values()),
    };
  }, [pendingGroups, routineShopping]);
  const { displayItems, displayTitle, displaySubtitle, isDoneState } =
    useMemo(() => {
      return buildSummaryFocusDisplay(items, summaryPendingGroups, urgent, 5);
    }, [items, summaryPendingGroups, urgent]);

  const pendingRoutines = summaryPendingGroups.routines.filter(
    (r) => r.status === "pending",
  );
  const showRitualsSection =
    pendingRoutines.length > 0 && displayTitle !== "Daily Rituals";

  const { totalExpense } = getFinanceItems(
    items,
    todayDate,
    budgetConfig,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "newest",
  );
  const { totalNetWorth } = getWalletStats(items, wallets);

  const totalLimits = budgetConfig.rules.reduce(
    (acc, rule) => acc + (rule.percentage / 100) * budgetConfig.monthlyIncome,
    0,
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);

  const budgetPercent =
    totalLimits > 0 ? Math.min(100, (totalExpense / totalLimits) * 100) : 0;

  const getThemeForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    return { key, content: monthlyThemes[key] || "" };
  };

  const { key: themeKey, content: themeContent } =
    getThemeForDate(themeNavDate);

  const localThemeImages = useMemo<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(
        localStorage.getItem("braindump_monthly_theme_images") || "{}",
      );
    } catch {
      return {};
    }
  }, [themeKey]);

  const themeHeroImage =
    monthlyThemeImages[themeKey] || localThemeImages[themeKey] || "";

  const openThemeEditor = () => {
    onThemeEdit(themeContent, {
      key: themeKey,
      heroImage: themeHeroImage,
    });
  };

  const localInsights = useMemo(
    () => generateInsights(items, budgetConfig, wallets, skills),
    [items, budgetConfig, wallets, skills],
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
    return localStorage.getItem("braindump_has_new_notification") === "true";
  });

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [taskCardCollapsed, setTaskCardCollapsed] = useState<
    Record<string, boolean>
  >({});
  const [activeTaskPanels, setActiveTaskPanels] = useState<
    Record<string, TaskPanel | undefined>
  >({});
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string[]>>(
    {},
  );

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
    transformOrigin: "top right",
  });

  const [reviewPopupPosition, setReviewPopupPosition] = useState<PopupPosition>(
    {
      top: 72,
      left: 16,
      width: 500,
      transformOrigin: "top right",
    },
  );

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
      Math.max(minWidth, viewportWidth - horizontalMargin * 2),
    );

    let left = rect.right - width;
    left = Math.max(horizontalMargin, left);
    left = Math.min(left, viewportWidth - width - horizontalMargin);

    const estimatedHeight = Math.min(
      viewportWidth >= 1024 ? 620 : 480,
      viewportHeight * (viewportWidth >= 1024 ? 0.7 : 0.6),
    );

    let top = rect.bottom + verticalGap + popupOffsetY;

    if (top + estimatedHeight > viewportHeight - 16) {
      top = Math.max(16, rect.top - estimatedHeight - verticalGap);
    }

    const originX = Math.min(
      width - 24,
      Math.max(24, rect.right - left - rect.width / 2),
    );
    const originY = top > rect.top ? 0 : estimatedHeight;

    setPopupPosition({
      top,
      left,
      width,
      transformOrigin: `${originX}px ${originY}px`,
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
      Math.max(minWidth, viewportWidth - horizontalMargin * 2),
    );

    let left = rect.right - width;
    left = Math.max(horizontalMargin, left);
    left = Math.min(left, viewportWidth - width - horizontalMargin);

    const estimatedHeight = Math.min(600, viewportHeight * 0.7);

    let top = rect.bottom + verticalGap + popupOffsetY;

    if (top + estimatedHeight > viewportHeight - 16) {
      top = Math.max(16, rect.top - estimatedHeight - verticalGap);
    }

    const originX = Math.min(
      width - 24,
      Math.max(24, rect.right - left - rect.width / 2),
    );
    const originY = top > rect.top ? 0 : estimatedHeight;

    setReviewPopupPosition({
      top,
      left,
      width,
      transformOrigin: `${originX}px ${originY}px`,
    });
  };

  const fetchAIInsights = async (force = false) => {
    const lastFetched = localStorage.getItem(AI_INSIGHTS_CACHE_DATE_KEY);
    const cachedVersion = localStorage.getItem(AI_INSIGHTS_CACHE_VERSION_KEY);
    const today = new Date().toDateString();

    if (
      !force &&
      (!appSettings.enableDailyInsight ||
        (lastFetched === today && cachedVersion === AI_INSIGHTS_CACHE_VERSION))
    ) {
      return;
    }

    setIsLoadingInsights(true);
    const generated = await generateAIInsights(
      items,
      budgetConfig,
      wallets,
      skills,
      appSettings.insightModel,
    );

    if (generated.length > 0) {
      setAiInsights(generated);
      localStorage.setItem(AI_INSIGHTS_CACHE_KEY, JSON.stringify(generated));
      localStorage.setItem(AI_INSIGHTS_CACHE_DATE_KEY, today);
      localStorage.setItem(
        AI_INSIGHTS_CACHE_VERSION_KEY,
        AI_INSIGHTS_CACHE_VERSION,
      );
      setHasNewNotification(true);
      localStorage.setItem("braindump_has_new_notification", "true");
    }

    setIsLoadingInsights(false);
  };

  const handleOpenNotification = () => {
    updatePopupPosition();
    setIsNotificationOpen(true);
    setHasNewNotification(false);
    localStorage.setItem("braindump_has_new_notification", "false");
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

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isNotificationOpen]);

  useLayoutEffect(() => {
    if (!isReviewOpen) return;

    updateReviewPopupPosition();

    const handleWindowChange = () => {
      updateReviewPopupPosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isReviewOpen]);

  useEffect(() => {
    if (items.length > 0) {
      fetchAIInsights();
    }

    const intervalId = setInterval(
      () => {
        if (items.length > 0) {
          fetchAIInsights();
        }
      },
      60 * 60 * 1000,
    );

    return () => clearInterval(intervalId);
  }, [
    items.length,
    budgetConfig,
    wallets,
    skills,
    appSettings.enableDailyInsight,
  ]);

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
    onResetRoutine: handleResetRoutine,
  };

  const isTaskCardExpanded = (id: string) => {
    const collapsed = taskCardCollapsed[id];
    return collapsed === undefined ? false : !collapsed;
  };

  const setTaskPanel = (id: string, panel: TaskPanel) => {
    setActiveTaskPanels((prev) => ({ ...prev, [id]: panel }));
  };

  const toggleTaskPanel = (
    id: string,
    panel: Exclude<TaskPanel, "none">,
    activePanel: TaskPanel,
  ) => {
    setTaskPanel(id, activePanel === panel ? "none" : panel);
  };

  const resetTaskPanel = (id: string) => {
    setActiveTaskPanels((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const getDefaultTaskPanel = (
    children: BrainDumpItem[],
    isDeepWork: boolean,
  ): TaskPanel => {
    return isDeepWork && children.length > 0 ? "subtasks" : "edit";
  };

  const getActiveTaskPanel = (
    item: BrainDumpItem,
    children: BrainDumpItem[],
    isDeepWork: boolean,
  ): TaskPanel => {
    return (
      activeTaskPanels[item.id] || getDefaultTaskPanel(children, isDeepWork)
    );
  };

  const taskPanelButtonClass = (
    active: boolean,
    tone: "edit" | "subtasks" = "edit",
  ) => {
    if (active && tone === "subtasks")
      return "px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors flex items-center gap-1";
    if (tone === "subtasks")
      return "px-3 py-2 rounded-xl bg-purple-500/10 text-purple-500 text-xs font-bold hover:bg-purple-500/20 transition-colors flex items-center gap-1";
    if (active)
      return "px-3 py-2 rounded-xl bg-primary text-background text-xs font-bold hover:opacity-90 transition-colors flex items-center gap-1";
    return "px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted hover:text-primary hover:bg-black/10 dark:hover:bg-white/15 text-xs font-bold transition-colors flex items-center gap-1";
  };

  const getTaskCardProps = (
    item: BrainDumpItem,
    activePanel: TaskPanel,
    editPanelControls: React.ReactNode,
    extraExpandedContent?: React.ReactNode,
  ) => ({
    ...cardProps,
    collapsibleEditPanel: true,
    editPanelExpanded: activePanel === "edit",
    editPanelControls,
    extraExpandedContent,
    onEditPanelExpandedChange: (id: string, expanded: boolean) => {
      if (expanded) setTaskPanel(id, "edit");
    },
    onCollapseChange: (id: string, collapsed: boolean) => {
      setTaskCardCollapsed((prev) => ({ ...prev, [id]: collapsed }));
      if (collapsed) resetTaskPanel(id);
    },
  });

  const getChildCardProps = () => cardProps;

  const getSubtaskDraft = (item: BrainDumpItem, children: BrainDumpItem[]) => {
    return (
      subtaskDrafts[item.id] ||
      item.meta.subtasks ||
      children.map((child) => child.content) ||
      []
    );
  };

  const updateSubtaskDraft = (
    itemId: string,
    index: number,
    value: string,
    fallback: string[],
  ) => {
    const next = [...fallback];
    next[index] = value;
    setSubtaskDrafts((prev) => ({ ...prev, [itemId]: next }));
  };

  const acceptDeepWorkPlan = (
    item: BrainDumpItem,
    children: BrainDumpItem[],
  ) => {
    const draft = getSubtaskDraft(item, children)
      .map((step) => step.trim())
      .filter(Boolean);
    if (draft.length === 0) return;
    handleAcceptDeepWorkTodo(item.id, draft);
    setTaskPanel(item.id, "subtasks");
  };

  const openManualSubtaskDraft = (item: BrainDumpItem) => {
    const draft = getSubtaskDraft(item, []);
    setSubtaskDrafts((prev) => ({
      ...prev,
      [item.id]: draft.length ? draft : [""],
    }));
    setTaskPanel(item.id, "subtasks");
  };

  const renderSubtaskDraftEditor = (
    item: BrainDumpItem,
    children: BrainDumpItem[],
    saveLabel: string,
  ) => {
    const draft = getSubtaskDraft(item, children);
    return (
      <div className="space-y-2">
        {draft.map((step, index) => (
          <div key={`${item.id}-draft-${index}`} className="flex gap-2">
            <div className="mt-3 h-5 w-5 shrink-0 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold flex items-center justify-center">
              {index + 1}
            </div>
            <textarea
              value={step}
              onChange={(event) =>
                updateSubtaskDraft(item.id, index, event.target.value, draft)
              }
              className="min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-purple-500/60"
              placeholder="Subtask..."
            />
            <button
              onClick={() =>
                setSubtaskDrafts((prev) => ({
                  ...prev,
                  [item.id]: draft.filter(
                    (_, draftIndex) => draftIndex !== index,
                  ),
                }))
              }
              className="self-center p-2 rounded-full text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
              aria-label="Remove subtask"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() =>
              setSubtaskDrafts((prev) => ({
                ...prev,
                [item.id]: [...draft, ""],
              }))
            }
            className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
          >
            Add step
          </button>
          <button
            onClick={() => acceptDeepWorkPlan(item, children)}
            className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              draft.map((step) => step.trim()).filter(Boolean).length === 0
            }
          >
            {saveLabel}
          </button>
        </div>
      </div>
    );
  };

  const renderDeepWorkDetail = (
    icon: React.ReactNode,
    label: string,
    value?: string | number,
    tone = "text-purple-500",
  ) => {
    if (value === undefined || value === null || value === "") return null;
    return (
      <div className="rounded-2xl border border-border/60 bg-surface/70 px-3 py-2">
        <div
          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}
        >
          {icon}
          {label}
        </div>
        <div className="mt-1 text-sm font-medium text-primary leading-snug break-words">
          {value}
        </div>
      </div>
    );
  };

  const renderSummaryFocusCard = (item: BrainDumpItem) => {
    const children = getDeepWorkChildren(items, item.id);
    const isDeepWork = !!item.meta.deepWorkParent || children.length > 0;
    const canUseManualSubtasks =
      item.type === ItemType.TODO && !item.meta.parentTodoId;
    const isCardExpanded = isTaskCardExpanded(item.id);
    const activePanel = getActiveTaskPanel(item, children, isDeepWork);
    const isSubtasksExpanded = activePanel === "subtasks";

    if (!isDeepWork) {
      const draft = getSubtaskDraft(item, children);
      const hasManualSubtasks =
        children.length > 0 || draft.some((step) => step.trim());
      const editPanelControls = isCardExpanded ? (
        <div className="flex flex-wrap gap-2 w-full">
          <button
            onClick={() => toggleTaskPanel(item.id, "edit", activePanel)}
            className={taskPanelButtonClass(activePanel === "edit")}
          >
            {activePanel === "edit" ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            Show edit
          </button>
          {canUseManualSubtasks && (
            <button
              onClick={() =>
                hasManualSubtasks
                  ? toggleTaskPanel(item.id, "subtasks", activePanel)
                  : openManualSubtaskDraft(item)
              }
              className={taskPanelButtonClass(isSubtasksExpanded, "subtasks")}
            >
              {isSubtasksExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              {hasManualSubtasks ? "Subtasks" : "Add subtask"}
            </button>
          )}
        </div>
      ) : null;
      const manualSubtaskPanel =
        canUseManualSubtasks && isCardExpanded && isSubtasksExpanded ? (
          <AnimatePresence initial={false}>
            {isSubtasksExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-border bg-background/70 p-3 space-y-3 lg:p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Manual subtasks
                  </div>
                  {renderSubtaskDraftEditor(
                    { ...item, meta: { ...item.meta, subtasks: draft } },
                    children,
                    "Create subtasks",
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ) : undefined;
      const taskCardProps = getTaskCardProps(
        item,
        activePanel,
        editPanelControls,
        manualSubtaskPanel,
      );
      return (
        <Card
          key={item.id}
          item={item}
          {...taskCardProps}
          editComfort="taskWorkspace"
        />
      );
    }

    const isSuggested = item.meta.deepWorkStatus === "suggested";
    const isBlocked =
      item.meta.deepWorkBlockerStatus === "blocked" ||
      item.meta.deepWorkBlockerStatus === "needs_input";
    const hasDeepWorkDetails = !!(
      item.meta.deepWorkNextAction ||
      item.meta.deepWorkFinalOutput ||
      item.meta.deepWorkSessionEstimateMinutes ||
      item.meta.deepWorkBlockerCheck ||
      item.meta.deepWorkStatus === "suggested"
    );
    const doneCount = children.filter(
      (child) => child.status === "done",
    ).length;
    const draft = getSubtaskDraft(item, children);
    const totalSteps =
      children.length || draft.length || item.meta.deepWorkStepCount || 0;
    const progressPercent =
      totalSteps > 0
        ? Math.round((doneCount / totalSteps) * 100)
        : item.meta.progress || 0;
    const deepWorkPanelControls = isCardExpanded ? (
      <div className="flex flex-wrap gap-2 w-full">
        <button
          onClick={() => toggleTaskPanel(item.id, "edit", activePanel)}
          className={taskPanelButtonClass(activePanel === "edit")}
        >
          {activePanel === "edit" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          Show edit
        </button>
        {isSuggested && (
          <button
            onClick={() => acceptDeepWorkPlan(item, children)}
            className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors"
          >
            Transform into steps
          </button>
        )}
        <button
          onClick={() => toggleTaskPanel(item.id, "subtasks", activePanel)}
          className={taskPanelButtonClass(isSubtasksExpanded, "subtasks")}
        >
          {isSubtasksExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          {isSuggested ? "Preview/edit steps" : "Subtasks"}
        </button>
        {hasDeepWorkDetails && (
          <>
            <button
              onClick={() => handleKeepRawTodo(item.id)}
              className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
            >
              Keep raw
            </button>
            <button
              onClick={() => handleRetriggerDeepWorkTodo(item.id)}
              className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 transition-colors flex items-center gap-1"
            >
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
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-border bg-background/70 p-3 space-y-3 lg:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                {hasDeepWorkDetails && (
                  <div className="flex items-center gap-2 text-purple-500">
                    <Sparkles className="w-4 h-4" />
                    <div className="text-[10px] font-bold uppercase tracking-wider">
                      Deep Work Transformer
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[11px] font-bold text-muted">
                  <span>
                    {doneCount}/{totalSteps} steps
                  </span>
                  <span>•</span>
                  <span>{progressPercent}%</span>
                </div>
              </div>

              {totalSteps > 0 && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-purple-500/10">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{
                      width: `${Math.max(progressPercent, doneCount > 0 ? 4 : 0)}%`,
                    }}
                  />
                </div>
              )}

              {hasDeepWorkDetails && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {renderDeepWorkDetail(
                    <Flag className="w-3 h-3" />,
                    "Next action",
                    item.meta.deepWorkNextAction,
                  )}
                  {renderDeepWorkDetail(
                    <ListChecks className="w-3 h-3" />,
                    "Final output",
                    item.meta.deepWorkFinalOutput,
                  )}
                  {renderDeepWorkDetail(
                    <Timer className="w-3 h-3" />,
                    "Session estimate",
                    item.meta.deepWorkSessionEstimateMinutes
                      ? `${item.meta.deepWorkSessionEstimateMinutes} min${item.meta.deepWorkSessionEstimateConfidence ? ` • ${item.meta.deepWorkSessionEstimateConfidence}` : ""}`
                      : undefined,
                  )}
                  {renderDeepWorkDetail(
                    <ShieldAlert className="w-3 h-3" />,
                    "Blocker check",
                    item.meta.deepWorkBlockerCheck,
                    isBlocked ? "text-amber-500" : "text-emerald-500",
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Optional subtasks
                </div>
                {isSuggested ? (
                  renderSubtaskDraftEditor(item, children, "Use these steps")
                ) : (
                  <div className="space-y-2">
                    {children.map((child) => (
                      <Card
                        key={child.id}
                        item={child}
                        {...getChildCardProps()}
                        editComfort="taskWorkspace"
                        className="rounded-[14px]"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ) : undefined;
    const taskCardProps = getTaskCardProps(
      item,
      activePanel,
      deepWorkPanelControls,
      deepWorkSubtaskPanel,
    );

    return (
      <Card
        key={item.id}
        item={item}
        {...taskCardProps}
        editComfort="taskWorkspace"
      />
    );
  };

  const topThreeToday = useMemo(() => {
    const fallback = [
      "Finish product sample",
      "Laundry sepatu",
      "Research new product ideas",
    ];

    const fromItems = displayItems.slice(0, 3).map((item) => ({
      id: item.id,
      label: item.content,
      done: item.status === "done",
    }));

    return [
      ...fromItems,
      ...fallback.slice(fromItems.length).map((label, index) => ({
        id: `fallback-top-${index}`,
        label,
        done: false,
      })),
    ].slice(0, 3);
  }, [displayItems]);

  const goalDashboardItems = useMemo(() => {
    const targets = items
      .filter(
        (item) =>
          item.type === ItemType.SHOPPING &&
          (item.meta.shoppingCategory === "saving" ||
            item.meta.shoppingCategory === "investment"),
      )
      .slice(0, 4)
      .map((item) => {
        const linkedSavings = items
          .filter(
            (candidate) =>
              candidate.type === ItemType.FINANCE &&
              candidate.meta.financeType === "saving" &&
              candidate.meta.savingGoalId === item.id &&
              (candidate.status === "done" || candidate.status === "pending"),
          )
          .reduce((sum, candidate) => sum + (candidate.meta.amount || 0), 0);

        const targetAmount = Number(
          item.meta.targetAmount ||
            item.meta.goalAmount ||
            item.meta.amount ||
            item.meta.target ||
            0,
        );
        const savedAmount = Number(item.meta.savedAmount || linkedSavings || 0);
        const derivedProgress =
          targetAmount > 0 ? (savedAmount / targetAmount) * 100 : 0;

        return {
          id: item.id,
          label: item.content,
          progress: Math.max(
            0,
            Math.min(100, Number(item.meta.progress ?? derivedProgress)),
          ),
        };
      });

    if (targets.length > 0) return targets;

    return [
      { id: "fallback-goal-1", label: "Financial Freedom", progress: 56 },
      { id: "fallback-goal-2", label: "Build Online Income", progress: 41 },
      { id: "fallback-goal-3", label: "Health & Fitness", progress: 63 },
      { id: "fallback-goal-4", label: "Learn & Grow", progress: 37 },
    ];
  }, [items]);

  const ritualDashboardItems = useMemo(() => {
    const fallback = [
      "Check balance",
      "Move body",
      "Journal",
      "No impulsive spending",
      "Review plan",
    ];

    const fromItems = summaryPendingGroups.routines.slice(0, 5).map((item) => ({
      id: item.id,
      label: item.content,
      done: item.status === "done",
      sourceId: item.id,
    }));

    return [
      ...fromItems,
      ...fallback.slice(fromItems.length).map((label, index) => ({
        id: `fallback-ritual-${index}`,
        label,
        done: index < 3,
        sourceId: undefined,
      })),
    ].slice(0, 5);
  }, [summaryPendingGroups.routines]);

  const ritualDoneCount = ritualDashboardItems.filter(
    (item) => item.done,
  ).length;

  const nextUpItems = useMemo(() => {
    const fallback = [
      { id: "fallback-next-1", time: "10:00", label: "Focus Work Block" },
      { id: "fallback-next-2", time: "13:00", label: "Product Research" },
      { id: "fallback-next-3", time: "19:00", label: "Review & Plan" },
    ];

    const datedItems = items
      .filter((item) => {
        if (item.status === "done") return false;
        return item.meta.date || item.meta.dueDate || item.meta.scheduledAt;
      })
      .map((item) => {
        const rawDate =
          item.meta.date || item.meta.dueDate || item.meta.scheduledAt;
        const date = rawDate ? new Date(rawDate) : null;
        return {
          item,
          date,
          time:
            date && !Number.isNaN(date.getTime())
              ? date.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })
              : "Today",
        };
      })
      .filter(({ date }) => date && !Number.isNaN(date.getTime()))
      .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
      .slice(0, 3)
      .map(({ item, time }) => ({
        id: item.id,
        time,
        label: item.content,
      }));

    return [...datedItems, ...fallback.slice(datedItems.length)].slice(0, 3);
  }, [items]);

  const savingsRate =
    budgetConfig.monthlyIncome > 0
      ? Math.max(
          0,
          Math.round(
            ((budgetConfig.monthlyIncome - totalExpense) /
              budgetConfig.monthlyIncome) *
              100,
          ),
        )
      : Math.max(0, Math.round(100 - budgetPercent));

  const monthlySpendingLabel = showBalance ? fmt(totalExpense) : "••••••";
  const netWorthLabel = showBalance ? fmt(totalNetWorth) : "••••••••";

  const dashboardShellClass =
    "rounded-[34px] bg-[#eaf3f8] p-4 text-slate-950 shadow-[0_22px_70px_rgba(37,64,90,0.16)] dark:bg-[#090d12] dark:text-zinc-50 dark:shadow-black/40 xl:p-5";
  const dashboardCardClass =
    "rounded-[24px] border border-white/70 bg-white/92 shadow-[0_16px_40px_rgba(37,64,90,0.08)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/82 dark:shadow-black/25";
  const dashboardIconClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300";
  const dashboardSectionTitle =
    "text-sm font-black tracking-tight text-slate-950 dark:text-zinc-50";
  const dashboardKicker =
    "text-[11px] font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300";
  const dashboardMuted = "text-slate-500 dark:text-zinc-400";

  const renderDashboardOverlays = () =>
    typeof window !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {isNotificationOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleCloseNotification}
                  className="fixed inset-0 z-[9998] bg-black/30"
                />

                <motion.div
                  ref={popupRef}
                  initial={{ opacity: 0, scale: 0.92, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="fixed z-[9999] flex max-h-[60vh] flex-col overflow-hidden rounded-3xl border border-border bg-surface lg:max-h-[70vh] lg:shadow-2xl"
                  style={{
                    top: popupPosition.top,
                    left: popupPosition.left,
                    width: popupPosition.width,
                    transformOrigin: popupPosition.transformOrigin,
                  }}
                >
                  <div className="flex items-center justify-between border-b border-border p-4">
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      <AlertTriangle className="h-5 w-5 text-blue-500" />
                      Notifications
                    </h3>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchAIInsights(true)}
                        disabled={isLoadingInsights}
                        className="rounded-full p-2 transition-colors hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                        aria-label="Refresh insights"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            isLoadingInsights ? "animate-spin" : ""
                          }`}
                        />
                      </button>

                      <button
                        onClick={handleCloseNotification}
                        className="rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label="Close notifications"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 overflow-y-auto p-4 lg:p-5">
                    {displayInsights.length > 0 ? (
                      displayInsights.map((insight, idx) => {
                        let bgColor = "bg-black/5 dark:bg-white/10";
                        let iconColor = "text-zinc-500";
                        let Icon = AlertTriangle;

                        if (insight.type === "warning") {
                          bgColor = "border border-red-500/20 bg-red-500/10";
                          iconColor = "text-red-500";
                          Icon = AlertTriangle;
                        } else if (insight.type === "success") {
                          bgColor =
                            "border border-emerald-500/20 bg-emerald-500/10";
                          iconColor = "text-emerald-500";
                          Icon = CheckCircle2;
                        } else {
                          bgColor = "border border-blue-500/20 bg-blue-500/10";
                          iconColor = "text-blue-500";
                          if (insight.iconType === "task") Icon = Target;
                          else if (insight.iconType === "finance")
                            Icon = WalletIcon;
                          else if (insight.iconType === "shopping")
                            Icon = ShoppingCart;
                          else if (insight.iconType === "skill") Icon = Sprout;
                        }

                        return (
                          <div
                            key={`${insight.title}-${idx}`}
                            className={`flex items-start gap-3 rounded-2xl p-4 ${bgColor}`}
                          >
                            <Icon
                              className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`}
                            />
                            <div>
                              <h3 className="mb-0.5 text-sm font-bold">
                                {insight.title}
                              </h3>
                              <p className="text-xs leading-relaxed opacity-70">
                                {insight.message}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center opacity-50">
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
                  className="fixed inset-0 z-[9998] bg-black/30"
                />

                <motion.div
                  ref={reviewPopupRef}
                  initial={{ opacity: 0, scale: 0.92, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="fixed z-[9999] flex max-h-[70vh] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
                  style={{
                    top: reviewPopupPosition.top,
                    left: reviewPopupPosition.left,
                    width: reviewPopupPosition.width,
                    transformOrigin: reviewPopupPosition.transformOrigin,
                  }}
                >
                  <div className="z-10 flex shrink-0 items-center justify-between border-b border-border bg-surface p-4">
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      <ClipboardCheck className="h-5 w-5 text-indigo-500" />
                      Review Center
                    </h3>

                    <div className="flex items-center gap-2">
                      {pendingReviews && pendingReviews.length > 0 && (
                        <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-bold text-indigo-600">
                          {pendingReviews.length} Pending
                        </span>
                      )}
                      <button
                        onClick={handleCloseReview}
                        className="ml-2 rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label="Close review center"
                      >
                        <ChevronDown className="h-5 w-5" />
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
          document.body,
        )
      : null;

  const renderTopThreeCard = () => (
    <section className={`${dashboardCardClass} p-5 xl:p-6`}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className={dashboardSectionTitle}>Top 3 Today</h2>
        <div className={dashboardIconClass}>
          <ClipboardCheck className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {topThreeToday.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (!item.id.startsWith("fallback")) handleToggleStatus(item.id);
            }}
            className="group flex w-full items-center gap-4 rounded-2xl py-1 text-left"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                item.done
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-blue-200 text-blue-600 group-hover:border-blue-500 dark:border-blue-400/30 dark:text-blue-300"
              }`}
            >
              {item.done && <Check className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {item.label}
            </div>
          </button>
        ))}
      </div>
    </section>
  );

  const renderGoalsCard = () => (
    <section className={`${dashboardCardClass} p-5 xl:p-6`}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className={dashboardSectionTitle}>Goals Progress</h2>
        <div className={dashboardIconClass}>
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {goalDashboardItems.map((goal, index) => (
          <div
            key={goal.id}
            className="grid grid-cols-[36px_minmax(0,1fr)_44px] items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
              {index === 0 ? (
                <WalletIcon className="h-4 w-4" />
              ) : index === 1 ? (
                <BarChart3 className="h-4 w-4" />
              ) : index === 2 ? (
                <Target className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-1 truncate text-sm font-semibold text-slate-700 dark:text-zinc-200">
                {goal.label}
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-blue-600 dark:bg-blue-400"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
            </div>

            <div className="text-right text-sm font-black text-slate-900 dark:text-zinc-50">
              {Math.round(goal.progress)}%
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderHabitsCard = () => (
    <section className={`${dashboardCardClass} p-5 xl:p-6`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className={dashboardSectionTitle}>Habits / Rituals</h2>
        <div className={dashboardIconClass}>
          <CheckCircle2 className="h-5 w-5" />
        </div>
      </div>

      <div className="mb-4 flex items-end gap-2">
        <span className="text-4xl font-black text-blue-700 dark:text-blue-300">
          {ritualDoneCount}
        </span>
        <span className="pb-1 text-2xl font-bold text-slate-500 dark:text-zinc-400">
          / {ritualDashboardItems.length}
        </span>
        <span className={`pb-1 text-sm font-semibold ${dashboardMuted}`}>
          done today
        </span>
      </div>

      <div className="space-y-2.5">
        {ritualDashboardItems.map((ritual) => (
          <button
            key={ritual.id}
            type="button"
            onClick={() => {
              if (ritual.sourceId) handleToggleStatus(ritual.sourceId);
            }}
            className="flex w-full items-center gap-2.5 text-left"
          >
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                ritual.done
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-blue-300 text-transparent dark:border-blue-300/40"
              }`}
            >
              <Check className="h-3 w-3" />
            </div>
            <span className="truncate text-sm font-medium text-slate-700 dark:text-zinc-200">
              {ritual.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  const renderNextUpCard = () => (
    <section className={`${dashboardCardClass} p-5 xl:p-6`}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className={dashboardSectionTitle}>Next Up</h2>
        <div className={dashboardIconClass}>
          <Clock3 className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-3">
        {nextUpItems.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-4"
          >
            <div className="rounded-2xl bg-slate-100 px-3 py-3 text-center text-base font-black text-slate-900 dark:bg-white/10 dark:text-zinc-50">
              {item.time}
            </div>
            <div className="min-w-0 truncate text-base font-semibold text-slate-800 dark:text-zinc-100">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderMoneyCard = () => (
    <section
      onClick={() => setActiveTab("money")}
      className={`${dashboardCardClass} cursor-pointer p-5 transition-transform active:scale-[0.995] xl:p-6`}
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className={dashboardSectionTitle}>Money Snapshot</h2>
        <div className={dashboardIconClass}>
          <WalletIcon className="h-5 w-5" />
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-white/10">
        <div className="pr-4">
          <p className={`mb-2 text-xs font-semibold ${dashboardMuted}`}>
            Net Worth
          </p>
          <div className="truncate text-xl font-black text-blue-700 dark:text-blue-300">
            {netWorthLabel}
          </div>
        </div>

        <div className="px-4">
          <p className={`mb-2 text-xs font-semibold ${dashboardMuted}`}>
            Monthly Spending
          </p>
          <div className="truncate text-xl font-black text-blue-700 dark:text-blue-300">
            {monthlySpendingLabel}
          </div>
        </div>

        <div className="pl-4">
          <p className={`mb-2 text-xs font-semibold ${dashboardMuted}`}>
            Savings Rate
          </p>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {savingsRate}%
          </div>
        </div>
      </div>
    </section>
  );

  const renderWeeklyWinCard = () => (
    <section
      className={`${dashboardCardClass} flex items-center justify-between gap-6 p-5 xl:p-6`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
          <Trophy className="h-7 w-7" />
        </div>
        <div>
          <div className={dashboardKicker}>Weekly Win</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-zinc-50">
            Stayed consistent.
          </div>
          <div className={`text-lg font-medium ${dashboardMuted}`}>
            Progress over perfection.
          </div>
        </div>
      </div>

      <div className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300 xl:flex">
        <Sprout className="h-10 w-10" />
      </div>
    </section>
  );

  const renderDesktopDashboard = () => (
    <motion.div
      data-swipe-tabs="summary"
      className="hidden lg:block"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={swipeHandlers.onTouchEnd}
      style={{ x: swipeHandlers.dragOffset }}
    >
      <div className={dashboardShellClass}>
        <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-4 xl:grid-cols-[minmax(0,1fr)_170px]">
          <button
            type="button"
            onClick={openThemeEditor}
            className={`${dashboardCardClass} group relative min-h-[270px] overflow-hidden text-left transition-transform active:scale-[0.995] xl:min-h-[300px]`}
          >
            {themeHeroImage ? (
              <img
                src={themeHeroImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_35%,rgba(191,219,254,0.9),transparent_34%),linear-gradient(135deg,#dbeafe_0%,#f8fafc_52%,#e0f2fe_100%)] dark:bg-[radial-gradient(circle_at_78%_35%,rgba(37,99,235,0.28),transparent_34%),linear-gradient(135deg,#0f172a_0%,#111827_52%,#020617_100%)]" />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-white/92 via-white/72 to-white/12 dark:from-zinc-950/90 dark:via-zinc-950/58 dark:to-zinc-950/15" />

            {!themeHeroImage && (
              <div className="absolute bottom-8 right-8 hidden h-44 w-72 items-center justify-center rounded-[32px] border border-blue-200/70 bg-white/35 text-blue-700/70 backdrop-blur-sm dark:border-blue-300/20 dark:bg-white/5 dark:text-blue-200/70 xl:flex">
                <div className="text-center">
                  <ImageIcon className="mx-auto mb-3 h-10 w-10" />
                  <div className="text-xs font-black uppercase tracking-[0.22em]">
                    Theme Image
                  </div>
                  <div className="mt-1 text-xs font-medium opacity-70">
                    Add from theme modal
                  </div>
                </div>
              </div>
            )}

            <div className="relative z-10 flex min-h-[270px] max-w-[680px] flex-col justify-center p-8 xl:min-h-[300px] xl:p-10">
              <h1 className="max-w-2xl text-5xl font-black leading-[1.02] tracking-tight text-[#10233f] dark:text-white xl:text-6xl">
                {themeContent || "Build today. Freedom tomorrow."}
              </h1>

              <div className="mt-6 text-xl font-black text-blue-700 dark:text-blue-300">
                Mission of the Day
              </div>
              <p
                className={`mt-2 max-w-xl text-base font-medium leading-relaxed ${dashboardMuted}`}
              >
                Focus on what matters. Protect your time. Move with intention.
              </p>

              <div className="mt-7 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700/80 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-300/80">
                <Pencil className="h-3.5 w-3.5" />
                Edit mission & image
              </div>
            </div>
          </button>

          <div
            data-swipe-date="summary-theme-month"
            className={`${dashboardCardClass} flex min-h-[270px] flex-col items-center justify-center p-5 text-center touch-pan-y xl:min-h-[300px]`}
            onTouchStart={dateSwipeHandlers.onTouchStart}
            onTouchMove={dateSwipeHandlers.onTouchMove}
            onTouchEnd={dateSwipeHandlers.onTouchEnd}
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
              <CalendarDays className="h-7 w-7" />
            </div>

            <div className="text-base font-semibold text-slate-700 dark:text-zinc-300">
              {todayDate.toLocaleDateString(undefined, { weekday: "long" })}
            </div>
            <div className="mt-1 text-6xl font-black leading-none text-blue-700 dark:text-blue-300">
              {String(todayDate.getDate()).padStart(2, "0")}
            </div>
            <div className="mt-3 text-base font-semibold text-blue-700 dark:text-blue-300">
              {themeNavDate.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </div>

            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => changeThemeMonth(-1)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
                aria-label="Previous theme month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={openThemeEditor}
                className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/15"
              >
                Theme
              </button>
              <button
                onClick={() => changeThemeMonth(1)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
                aria-label="Next theme month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-12 gap-4">
          <div className="col-span-3">{renderTopThreeCard()}</div>
          <div className="col-span-3">{renderGoalsCard()}</div>
          <div className="col-span-3">{renderHabitsCard()}</div>
          <div className="col-span-3">{renderNextUpCard()}</div>

          <div className="col-span-5">{renderMoneyCard()}</div>
          <div className="col-span-7">{renderWeeklyWinCard()}</div>

          <section
            className={`${dashboardCardClass} col-span-12 flex items-center justify-between gap-6 px-6 py-4`}
          >
            <div className="flex items-center gap-4">
              <div className={dashboardIconClass}>
                <StickyNote className="h-5 w-5" />
              </div>
              <div className="text-base font-bold text-slate-700 dark:text-zinc-200">
                Mantra
              </div>
            </div>
            <div className="text-center text-xl font-black text-blue-700 dark:text-blue-300">
              Discipline today. Freedom tomorrow.
            </div>
            <div className="hidden text-7xl font-black leading-none text-blue-100 dark:text-blue-400/10 xl:block">
              ”
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );

  const renderMobileDashboard = () => (
    <div className="lg:hidden">
      <motion.div
        layoutId="top-container"
        data-swipe-tabs="summary"
        className={`${contentSurface.headerHero} mb-6`}
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
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider opacity-60">
              <div className="h-2 w-2 rounded-full bg-black dark:bg-white"></div>
              Dashboard
            </div>

            <div className="flex items-center gap-2">
              <button
                ref={reviewButtonRef}
                onClick={handleOpenReview}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
                aria-label="Open review center"
              >
                <ClipboardCheck className="h-[18px] w-[18px]" strokeWidth={2} />
                {((pendingReviews && pendingReviews.length > 0) ||
                  (parsingTasks && parsingTasks.length > 0)) && (
                  <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full border border-surface bg-indigo-500"></span>
                )}
              </button>

              <button
                ref={notificationButtonRef}
                onClick={handleOpenNotification}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
                aria-label="Open notifications"
              >
                <AlertTriangle className="h-[18px] w-[18px]" />
                {hasNewNotification && (
                  <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full border border-surface bg-red-500"></span>
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={openThemeEditor}
            className="relative block min-h-[220px] w-full overflow-hidden rounded-[28px] text-left"
          >
            {themeHeroImage ? (
              <img
                src={themeHeroImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(191,219,254,0.9),transparent_34%),linear-gradient(135deg,#dbeafe_0%,#f8fafc_50%,#e0f2fe_100%)] dark:bg-[radial-gradient(circle_at_80%_30%,rgba(37,99,235,0.26),transparent_34%),linear-gradient(135deg,#0f172a_0%,#111827_52%,#020617_100%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/70 to-white/10 dark:from-zinc-950/90 dark:via-zinc-950/58 dark:to-zinc-950/15" />
            <div className="relative z-10 p-6">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
                Mission of the Day
              </div>
              <h1 className="text-4xl font-black leading-tight text-[#10233f] dark:text-white">
                {themeContent || "Build today. Freedom tomorrow."}
              </h1>
              <div className="mt-5 flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                <Pencil className="h-3.5 w-3.5" />
                Edit mission & image
              </div>
            </div>
          </button>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="space-y-4"
      >
        {renderTopThreeCard()}
        {renderGoalsCard()}
        {renderHabitsCard()}
        {renderNextUpCard()}
        {renderMoneyCard()}

        <section className={contentSurface.primaryColumn}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                {displayTitle}
              </h2>
              {displaySubtitle && (
                <p className="mt-0.5 text-xs font-medium opacity-50">
                  {displaySubtitle}
                </p>
              )}
            </div>

            <button
              onClick={() => setActiveTab("plan")}
              className="text-xs font-bold uppercase tracking-wider opacity-50 hover:opacity-100"
            >
              View All
            </button>
          </div>

          {displayItems.length > 0 ? (
            <div
              className={`${contentSurface.denseList} ${
                isDoneState ? "opacity-60 grayscale" : ""
              }`}
            >
              {displayItems.map((item) => renderSummaryFocusCard(item))}
            </div>
          ) : (
            <div className={contentSurface.emptyStateCard}>
              <p className="font-medium text-muted">All clear!</p>
              <p className="mt-1 text-xs opacity-50">
                Take a break or plan ahead.
              </p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-4 gap-3 rounded-[28px] border border-border bg-surface/70 p-4">
          <button
            onClick={() =>
              handleOpenAddTask(new Date().toISOString().split("T")[0])
            }
            className="flex flex-col items-center gap-2"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black">
              <Plus className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium opacity-70">Task</span>
          </button>

          <button
            onClick={() => handleOpenAddShopping()}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-black/10 bg-white text-black dark:border-white/10 dark:bg-white/10 dark:text-white">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium opacity-70">Buy</span>
          </button>

          <button
            onClick={handleOpenAddNote}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-black/10 bg-white text-black dark:border-white/10 dark:bg-white/10 dark:text-white">
              <StickyNote className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium opacity-70">Note</span>
          </button>

          <button
            onClick={handleOpenAddExpense}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-black/10 bg-white text-black dark:border-white/10 dark:bg-white/10 dark:text-white">
              <WalletIcon className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium opacity-70">Expense</span>
          </button>
        </div>

        {showRitualsSection && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                Rituals
              </h2>
            </div>

            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide">
              {pendingRoutines.map((routine) => (
                <button
                  key={routine.id}
                  onClick={() => handleToggleStatus(routine.id)}
                  className="flex min-w-[72px] flex-shrink-0 flex-col items-center gap-2"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-indigo-500/20 bg-surface transition-all hover:border-indigo-500 hover:bg-indigo-500/10">
                    <CheckCircle2 className="h-6 w-6 text-indigo-500 opacity-50" />
                  </div>
                  <span className="line-clamp-2 w-full text-center text-[10px] font-medium leading-tight opacity-70">
                    {routine.content}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {renderWeeklyWinCard()}

        <section
          className={`${dashboardCardClass} flex items-center justify-between gap-3 px-5 py-4`}
        >
          <div className="flex items-center gap-3">
            <StickyNote className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            <span className="font-bold">Mantra</span>
          </div>
          <span className="text-right font-black text-blue-700 dark:text-blue-300">
            Discipline today. Freedom tomorrow.
          </span>
        </section>
      </motion.div>
    </div>
  );

  return (
    <div className={contentSurface.pageShell}>
      {renderDesktopDashboard()}
      {renderMobileDashboard()}
      {renderDashboardOverlays()}
    </div>
  );
};

export default SummaryView;
