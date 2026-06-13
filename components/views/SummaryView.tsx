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

  const topThreeToday = useMemo(
    () =>
      displayItems.slice(0, 3).map((item) => ({
        id: item.id,
        label: item.content,
        done: item.status === "done",
      })),
    [displayItems],
  );

  const getGoalNumbers = (item: BrainDumpItem) => {
    const meta = item.meta as any;
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
      meta.targetAmount || meta.goalAmount || meta.amount || meta.target || 0,
    );
    const savedAmount = Number(meta.savedAmount || linkedSavings || 0);
    const derivedProgress =
      targetAmount > 0 ? (savedAmount / targetAmount) * 100 : 0;

    return {
      savedAmount,
      targetAmount,
      progress: Math.max(
        0,
        Math.min(100, Number(meta.progress ?? derivedProgress)),
      ),
    };
  };

  const goalDashboardItems = useMemo(() => {
    const savingAndInvestmentGoals = items
      .filter(
        (item) =>
          item.type === ItemType.SHOPPING &&
          (item.meta.shoppingCategory === "saving" ||
            item.meta.shoppingCategory === "investment"),
      )
      .map((item) => {
        const numbers = getGoalNumbers(item);
        return {
          id: item.id,
          label: item.content,
          progress: numbers.progress,
          caption:
            numbers.targetAmount > 0
              ? `${fmt(numbers.savedAmount)} / ${fmt(numbers.targetAmount)}`
              : item.meta.shoppingCategory === "investment"
                ? "Investment target"
                : "Saving target",
          kind: item.meta.shoppingCategory,
        };
      });

    const startOfWeek = new Date(todayDate);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const skillGoals = skills
      .filter((skill) => Number(skill.weeklyTargetMinutes || 0) > 0)
      .map((skill) => {
        const loggedMinutes = items
          .filter((item) => {
            if (
              item.type !== ItemType.SKILL_LOG ||
              item.meta.skillId !== skill.id
            )
              return false;
            const itemDate = new Date(item.created_at);
            return !Number.isNaN(itemDate.getTime()) && itemDate >= startOfWeek;
          })
          .reduce(
            (sum, item) =>
              sum +
              Number(
                (item.meta as any).duration || item.meta.durationMinutes || 0,
              ),
            0,
          );
        const targetMinutes = Number(skill.weeklyTargetMinutes || 0);
        return {
          id: skill.id,
          label: skill.name,
          progress: Math.max(
            0,
            Math.min(100, (loggedMinutes / targetMinutes) * 100),
          ),
          caption: `${loggedMinutes}/${targetMinutes} min this week`,
          kind: "skill" as const,
        };
      });

    return [...savingAndInvestmentGoals, ...skillGoals]
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 4);
  }, [items, skills, todayDate.getTime()]);

  const routineDashboardItems = useMemo(
    () =>
      summaryPendingGroups.routines.slice(0, 5).map((item) => ({
        id: item.id,
        label: item.content,
        done: item.status === "done",
        sourceId: item.id,
      })),
    [summaryPendingGroups.routines],
  );

  const routineDoneCount = routineDashboardItems.filter(
    (item) => item.done,
  ).length;

  const getItemScheduleDate = (item: BrainDumpItem) => {
    const meta = item.meta as any;
    const rawDate =
      meta.dateTime ||
      meta.start ||
      meta.date ||
      meta.dueDate ||
      meta.scheduledAt;
    if (!rawDate) return null;
    const date = new Date(rawDate);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const nextUpItems = useMemo(() => {
    const todayStart = new Date(todayDate);
    todayStart.setHours(0, 0, 0, 0);

    return items
      .filter((item) => item.status !== "done")
      .map((item) => ({ item, date: getItemScheduleDate(item) }))
      .filter(({ date }) => date && date >= todayStart)
      .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
      .slice(0, 3)
      .map(({ item, date }) => {
        const isAllDay = date?.getHours() === 0 && date?.getMinutes() === 0;
        const time = date
          ? isAllDay
            ? date.toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
              })
            : date.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
          : "Today";
        return { id: item.id, time, label: item.content };
      });
  }, [items, todayDate.getTime()]);

  const completedThisWeek = useMemo(() => {
    const weekAgo = new Date(todayDate);
    weekAgo.setHours(0, 0, 0, 0);
    weekAgo.setDate(weekAgo.getDate() - 6);

    return items.filter((item) => {
      if (item.status !== "done") return false;
      const completedAt = new Date(item.completed_at || item.created_at);
      return !Number.isNaN(completedAt.getTime()) && completedAt >= weekAgo;
    });
  }, [items, todayDate.getTime()]);

  const weeklyWin = useMemo(() => {
    const routineCompletions = completedThisWeek.filter(
      (item) => item.meta.isRoutine,
    );
    const skillMinutes = completedThisWeek
      .filter((item) => item.type === ItemType.SKILL_LOG)
      .reduce(
        (sum, item) =>
          sum +
          Number((item.meta as any).duration || item.meta.durationMinutes || 0),
        0,
      );

    if (routineCompletions.length > 0) {
      return {
        title: `${routineCompletions.length} routine done`,
        subtitle: "Routine progress this week.",
      };
    }

    if (skillMinutes > 0) {
      return {
        title: `${skillMinutes} skill minutes`,
        subtitle: "Learning momentum this week.",
      };
    }

    if (completedThisWeek.length > 0) {
      return {
        title: `${completedThisWeek.length} item completed`,
        subtitle: "A real weekly win from your data.",
      };
    }

    return {
      title: "No weekly win yet",
      subtitle: "Complete one item to make this card yours.",
    };
  }, [completedThisWeek]);

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
  const hasThemeContent = themeContent.trim().length > 0;
  const hasThemeImage = themeHeroImage.trim().length > 0;
  const missionTitle = hasThemeContent
    ? themeContent
    : "Add this month mission";
  const missionSubtitle = hasThemeContent
    ? "Focus on what matters. Protect your time. Move with intention."
    : "Open Add Theme to set the mission and image URL for this month.";

  const dashboardShellClass = [
    "overflow-visible rounded-none border-0 bg-transparent p-0 text-slate-950 shadow-none",
    "dark:border-0 dark:bg-transparent dark:text-zinc-50 dark:shadow-none",
  ].join(" ");
  const dashboardCardClass = [
    "rounded-[1.5rem] border border-white/70 bg-white/90 shadow-[0_16px_40px_rgba(37,64,90,0.08)] backdrop-blur",
    "dark:border-white/10 dark:bg-zinc-900/82 dark:shadow-black/25",
  ].join(" ");
  const dashboardIconClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300";
  const dashboardSectionTitle =
    "text-sm font-black tracking-tight text-slate-950 dark:text-zinc-50";
  const dashboardKicker =
    "text-[11px] font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300";
  const dashboardMuted = "text-slate-500 dark:text-zinc-400";

  const renderDashboardEmptyState = (
    title: string,
    description: string,
    action?: { label: string; onClick: () => void },
  ) => (
    <div className="rounded-2xl border border-dashed border-blue-200/80 bg-blue-50/50 p-4 text-sm dark:border-blue-300/20 dark:bg-blue-400/5">
      <p className="font-bold text-slate-800 dark:text-zinc-100">{title}</p>
      <p className={`mt-1 text-xs leading-relaxed ${dashboardMuted}`}>
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 rounded-full bg-blue-700 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-blue-600 dark:bg-blue-400 dark:text-zinc-950 dark:hover:bg-blue-300"
        >
          {action.label}
        </button>
      )}
    </div>
  );

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

  const renderThemeImageSurface = () => (
    <div className="absolute inset-0">
      {hasThemeImage ? (
        <img
          src={themeHeroImage}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_78%_35%,rgba(191,219,254,0.9),transparent_34%),linear-gradient(135deg,#dbeafe_0%,#f8fafc_52%,#e0f2fe_100%)] dark:bg-[radial-gradient(circle_at_78%_35%,rgba(37,99,235,0.28),transparent_34%),linear-gradient(135deg,#0f172a_0%,#111827_52%,#020617_100%)]" />
      )}
    </div>
  );

  const renderThemeImageCta = () =>
    !hasThemeImage ? (
      <div className="pointer-events-none absolute bottom-6 right-6 hidden max-w-xs rounded-[2rem] border border-blue-200/70 bg-white/40 p-5 text-blue-700/80 backdrop-blur-md dark:border-blue-300/20 dark:bg-white/5 dark:text-blue-200/80 xl:block">
        <ImageIcon className="mb-3 h-9 w-9" />
        <div className="text-xs font-black uppercase tracking-[0.22em]">
          Add theme image
        </div>
        <div className="mt-1 text-xs font-semibold opacity-75">
          The image URL lives in Add Theme.
        </div>
      </div>
    ) : null;

  const renderHeroCard = (compact = false) => (
    <button
      type="button"
      onClick={openThemeEditor}
      className={`${dashboardCardClass} group relative block min-h-[16rem] w-full overflow-hidden text-left transition-transform active:scale-[0.995] ${
        compact ? "rounded-[1.75rem]" : "xl:min-h-[18.75rem]"
      }`}
    >
      {renderThemeImageSurface()}
      <div className="absolute inset-0 bg-gradient-to-r from-white/94 via-white/74 to-white/14 dark:from-zinc-950/92 dark:via-zinc-950/62 dark:to-zinc-950/18" />
      {renderThemeImageCta()}

      <div
        className={`relative z-10 flex min-h-[16rem] flex-col justify-center ${compact ? "p-6" : "p-7 xl:min-h-[18.75rem] xl:p-10"}`}
      >
        <h1
          className={`${compact ? "text-4xl" : "text-5xl xl:text-6xl"} max-w-3xl font-black leading-[1.03] tracking-tight text-[#10233f] dark:text-white`}
        >
          {missionTitle}
        </h1>

        <div className="mt-6 text-lg font-black text-blue-700 dark:text-blue-300">
          Mission of the Day
        </div>
        <p
          className={`mt-2 max-w-2xl text-sm font-medium leading-relaxed sm:text-base ${dashboardMuted}`}
        >
          {missionSubtitle}
        </p>

        <div className="mt-7 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700/80 opacity-100 transition-opacity dark:text-blue-300/80 xl:opacity-0 xl:group-hover:opacity-100">
          <Pencil className="h-3.5 w-3.5" />
          Add Theme
        </div>
      </div>
    </button>
  );

  const renderDateCard = () => (
    <div
      data-swipe-date="summary-theme-month"
      className={`${dashboardCardClass} flex min-h-[16rem] flex-col items-center justify-center p-5 text-center touch-pan-y xl:min-h-[18.75rem]`}
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
          type="button"
          onClick={() => changeThemeMonth(-1)}
          className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
          aria-label="Previous theme month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={openThemeEditor}
          className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/15"
        >
          Theme
        </button>
        <button
          type="button"
          onClick={() => changeThemeMonth(1)}
          className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
          aria-label="Next theme month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const renderTopThreeCard = () => (
    <section className={`${dashboardCardClass} p-5 xl:p-6`}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className={dashboardSectionTitle}>Top 3 Today</h2>
        <div className={dashboardIconClass}>
          <ClipboardCheck className="h-5 w-5" />
        </div>
      </div>

      {topThreeToday.length > 0 ? (
        <div className="space-y-4">
          {topThreeToday.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleToggleStatus(item.id)}
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
      ) : (
        renderDashboardEmptyState(
          "No focus items",
          "Add or schedule tasks to fill this card from real items.",
          {
            label: "Add task",
            onClick: () =>
              handleOpenAddTask(new Date().toISOString().split("T")[0]),
          },
        )
      )}
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

      {goalDashboardItems.length > 0 ? (
        <div className="space-y-4">
          {goalDashboardItems.map((goal, index) => (
            <div
              key={goal.id}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.75rem] items-center gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                {goal.kind === "investment" ? (
                  <BarChart3 className="h-4 w-4" />
                ) : goal.kind === "skill" ? (
                  <Target className="h-4 w-4" />
                ) : index === 0 ? (
                  <WalletIcon className="h-4 w-4" />
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
                <div
                  className={`mt-1 truncate text-[11px] font-semibold ${dashboardMuted}`}
                >
                  {goal.caption}
                </div>
              </div>

              <div className="text-right text-sm font-black text-slate-900 dark:text-zinc-50">
                {Math.round(goal.progress)}%
              </div>
            </div>
          ))}
        </div>
      ) : (
        renderDashboardEmptyState(
          "No goal tracked",
          "Saving, investment, and skill targets will appear here once you add them.",
          {
            label: "Open plan",
            onClick: () => {
              setPlanSubTab("savings");
              setActiveTab("plan");
            },
          },
        )
      )}
    </section>
  );

  const renderRoutineCard = () => (
    <section className={`${dashboardCardClass} p-5 xl:p-6`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className={dashboardSectionTitle}>Routine</h2>
        <div className={dashboardIconClass}>
          <CheckCircle2 className="h-5 w-5" />
        </div>
      </div>

      {routineDashboardItems.length > 0 ? (
        <>
          <div className="mb-4 flex items-end gap-2">
            <span className="text-4xl font-black text-blue-700 dark:text-blue-300">
              {routineDoneCount}
            </span>
            <span className="pb-1 text-2xl font-bold text-slate-500 dark:text-zinc-400">
              / {routineDashboardItems.length}
            </span>
            <span className={`pb-1 text-sm font-semibold ${dashboardMuted}`}>
              done today
            </span>
          </div>

          <div className="space-y-2.5">
            {routineDashboardItems.map((routine) => (
              <button
                key={routine.id}
                type="button"
                onClick={() => handleToggleStatus(routine.sourceId)}
                className="flex w-full items-center gap-2.5 text-left"
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    routine.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-blue-300 text-transparent dark:border-blue-300/40"
                  }`}
                >
                  <Check className="h-3 w-3" />
                </div>
                <span className="truncate text-sm font-medium text-slate-700 dark:text-zinc-200">
                  {routine.label}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        renderDashboardEmptyState(
          "No routine for today",
          "Daily, weekly, monthly, or yearly routine items will be shown here.",
          {
            label: "Open plan",
            onClick: () => {
              setPlanSubTab("tasks");
              setActiveTab("plan");
            },
          },
        )
      )}
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

      {nextUpItems.length > 0 ? (
        <div className="space-y-3">
          {nextUpItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(3.75rem,auto)_minmax(0,1fr)] items-center gap-4"
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
      ) : (
        renderDashboardEmptyState(
          "Nothing scheduled",
          "Add a dated task, event, or routine to fill the timeline.",
          {
            label: "Open calendar",
            onClick: () => setActiveTab("calendar" as Tab),
          },
        )
      )}
    </section>
  );

  const renderMoneyCard = () => (
    <section
      onClick={() => setActiveTab("money")}
      className={`${dashboardCardClass} cursor-pointer p-5 transition-transform active:scale-[0.995] xl:p-6`}
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className={dashboardSectionTitle}>Money Snapshot</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowBalance(!showBalance);
            }}
            className="rounded-full bg-blue-50 p-2 text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/15"
            aria-label={showBalance ? "Hide balance" : "Show balance"}
          >
            {showBalance ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
          <div className={dashboardIconClass}>
            <WalletIcon className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-slate-100 dark:sm:divide-white/10">
        <div className="sm:pr-4">
          <p className={`mb-2 text-xs font-semibold ${dashboardMuted}`}>
            Net Worth
          </p>
          <div className="truncate text-xl font-black text-blue-700 dark:text-blue-300">
            {netWorthLabel}
          </div>
        </div>

        <div className="sm:px-4">
          <p className={`mb-2 text-xs font-semibold ${dashboardMuted}`}>
            Monthly Spending
          </p>
          <div className="truncate text-xl font-black text-blue-700 dark:text-blue-300">
            {monthlySpendingLabel}
          </div>
        </div>

        <div className="sm:pl-4">
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
            {weeklyWin.title}
          </div>
          <div className={`text-lg font-medium ${dashboardMuted}`}>
            {weeklyWin.subtitle}
          </div>
        </div>
      </div>

      <div className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300 xl:flex">
        <Sprout className="h-10 w-10" />
      </div>
    </section>
  );

  const renderMantraCard = () => (
    <section
      className={`${dashboardCardClass} flex items-center justify-between gap-6 px-6 py-4`}
    >
      <div className="flex items-center gap-4">
        <div className={dashboardIconClass}>
          <StickyNote className="h-5 w-5" />
        </div>
        <div className="text-base font-bold text-slate-700 dark:text-zinc-200">
          Mantra
        </div>
      </div>
      <button
        type="button"
        onClick={openThemeEditor}
        className="min-w-0 truncate text-center text-lg font-black text-blue-700 transition-colors hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200 xl:text-xl"
      >
        {hasThemeContent ? themeContent : "Add a monthly mantra"}
      </button>
      <div className="hidden text-7xl font-black leading-none text-blue-100 dark:text-blue-400/10 xl:block">
        ”
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="xl:col-span-4">{renderHeroCard()}</div>
          <div className="xl:col-span-1">{renderDateCard()}</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {renderTopThreeCard()}
          {renderGoalsCard()}
          {renderRoutineCard()}
          {renderNextUpCard()}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="xl:col-span-2">{renderMoneyCard()}</div>
          <div className="xl:col-span-3">{renderWeeklyWinCard()}</div>
        </div>

        <div className="mt-4">{renderMantraCard()}</div>
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

          {renderHeroCard(true)}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="space-y-4 px-4"
      >
        {renderTopThreeCard()}
        {renderGoalsCard()}
        {renderRoutineCard()}
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
                Routine
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
        {renderMantraCard()}
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
