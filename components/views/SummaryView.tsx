import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Trophy,
  Image as ImageIcon,
  Circle,
  Check,
  BarChart3,
  Home,
  FileText,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  Banknote,
  ReceiptText,
  CircleDollarSign,
  PiggyBank,
  CreditCard,
  TrendingUp,
  TrendingDown,
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
  ReceiptReviewDraft,
  ReceiptCaptureMeta,
} from "../../types";
import {
  getFocusMonthData,
  getShoppingItems,
  getWalletStats,
  getFinanceItems,
  generateInsights,
  advanceRoutineDueDateToTodayOrFuture,
  advanceRecurringDueDateByDaysToTodayOrFuture,
} from "../../utils/selectors";
import { generateAIInsights, Insight } from "../../services/insightService";
import { useSwipeTabs } from "../../hooks/useSwipeTabs";
import AnimatedNumber from "../../motion/AnimatedNumber";
import AnimatedProgress from "../../motion/AnimatedProgress";
import {
  dashboardContainerVariants,
  collapseVariants,
  highlightedListItemVariants,
  popVariants,
  riseVariants,
  staggerContainerVariants,
} from "../../motion/variants";
import { motionSpring } from "../../motion/transitions";
import { useSwipeDate } from "../../hooks/useSwipeDate";
import Card from "../Card";
import ReviewCenterPanel from "../ReviewCenterPanel";
import { contentSurface } from "../layout/contentSurface";
import { buildSummaryFocusDisplay } from "../../utils/summaryFocusUtils";
import { getDeepWorkChildren, supportsNestedTodoSubtasks } from "../../utils/deepWorkTodoModel";
import { getShoppingDueDate } from "../../utils/shoppingDateUtils";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { getSavedAmountForGoal } from "../../utils/savingTransactionUtils";
import { getInvestmentMetrics } from "../../utils/investmentMetrics";
import { getLoanAccounts } from "../../utils/loanAccounts";

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
  handleUpdateReceiptCapture: (id: string, capture: ReceiptCaptureMeta | null) => void;
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
    start?: string,
    end?: string,
    hideFromCalendar?: boolean,
  ) => void;
  handleDelete: (id: string) => void;
  handleKeepRawTodo: (id: string) => void;
  handleRetriggerDeepWorkTodo: (id: string) => void;
  handleAcceptDeepWorkTodo: (id: string, subtasks?: string[]) => void;
  handleResetRoutine: (id: string) => void;
  pendingReviews?: { id: string; text: string; results: any[] }[];
  receiptReviews?: ReceiptReviewDraft[];
  onChangeReceiptReview?: (draft: ReceiptReviewDraft) => void;
  onApproveReceiptReview?: (draft: ReceiptReviewDraft) => void;
  onRejectReceiptReview?: (draft: ReceiptReviewDraft) => void;
  onViewDuplicateReceipt?: (item: BrainDumpItem) => void;
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

type TaskPanel = "edit" | "subtasks" | "editSubtasks" | "none";

const AI_INSIGHTS_CACHE_KEY = "braindump_ai_insights";
const AI_INSIGHTS_CACHE_DATE_KEY = "braindump_ai_insights_date";
const AI_INSIGHTS_CACHE_VERSION_KEY = "braindump_ai_insights_version";
const AI_INSIGHTS_CACHE_VERSION = "2026-05-behavior-drift-v1";

const isSummaryTaskItem = (item: BrainDumpItem) =>
  item.type === ItemType.TODO && !item.meta.isRoutine;
const isSummaryShoppingItem = (item: BrainDumpItem) =>
  item.type === ItemType.SHOPPING && item.meta?.shoppingCategory !== "routine";

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
  handleUpdateReceiptCapture,
  handleDelete,
  handleKeepRawTodo,
  handleRetriggerDeepWorkTodo,
  handleAcceptDeepWorkTodo,
  handleResetRoutine,
  pendingReviews = [],
  receiptReviews = [],
  onChangeReceiptReview,
  onApproveReceiptReview,
  onRejectReceiptReview,
  onViewDuplicateReceipt,
  handleApproveReview,
  handleRejectReview,
  parsingTasks = [],
  retryParsing,
  clearParsingTask,
  undoParsingTask,
  deleteParsingTaskEntries,
}) => {
  const isDesktopDashboard = useMediaQuery("(min-width: 1024px)");
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

  const [systemNow, setSystemNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setSystemNow(new Date());
    }, 30 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  const todayDate = systemNow;
  const calendarDayKey = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const todayCalendarKey = calendarDayKey(todayDate);
  const isSameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const getRoutineDueDate = (item: BrainDumpItem, referenceDate: Date = todayDate) => {
    const rawDate =
      item.type === ItemType.SHOPPING
        ? getShoppingDueDate(item)
        : item.meta.date || item.meta.dateTime || item.meta.start;
    if (!rawDate) return null;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return null;

    const isShoppingRoutine = item.type === ItemType.SHOPPING && item.meta.shoppingCategory === "routine";
    const isScheduledRoutine = isShoppingRoutine || item.meta.isRoutine;
    if (!isScheduledRoutine) return date;

    if (isShoppingRoutine && !item.meta.routineInterval) {
      return advanceRecurringDueDateByDaysToTodayOrFuture(
        date,
        Math.max(Number(item.meta.recurrenceDays || 7), 1),
        referenceDate,
      );
    }

    return advanceRoutineDueDateToTodayOrFuture(
      date,
      item.meta.routineInterval || "daily",
      item.meta.routineDaysOfWeek,
      item.meta.routineDaysOfMonth,
      item.meta.routineMonthsOfYear,
      referenceDate,
    );
  };
  const isRoutineDueOnDate = (item: BrainDumpItem, date: Date) => {
    const dueDate = getRoutineDueDate(item, date);
    return !!dueDate && isSameCalendarDay(dueDate, date);
  };
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

  const routineDueToday = useMemo(
    () =>
      summaryPendingGroups.routines.filter((item) =>
        isRoutineDueOnDate(item, todayDate),
      ),
    [summaryPendingGroups.routines, todayCalendarKey],
  );

  const summaryFocusGroups = useMemo(
    () => ({
      today: summaryPendingGroups.today.filter(isSummaryTaskItem),
      tomorrow: summaryPendingGroups.tomorrow.filter(isSummaryTaskItem),
      later: summaryPendingGroups.later.filter(isSummaryTaskItem),
      routines: [],
    }),
    [summaryPendingGroups],
  );

  const summaryFocusItems = useMemo(
    () => items.filter(isSummaryTaskItem),
    [items],
  );

  const summaryUrgentShopping = useMemo(
    () => urgent.filter(isSummaryShoppingItem),
    [urgent],
  );

  const { displayItems, displayTitle, displaySubtitle, isDoneState } =
    useMemo(() => {
      return buildSummaryFocusDisplay(
        summaryFocusItems,
        summaryFocusGroups,
        summaryUrgentShopping,
        Math.max(summaryFocusItems.length + summaryUrgentShopping.length, 1),
        todayDate,
      );
    }, [summaryFocusItems, summaryFocusGroups, summaryUrgentShopping, todayCalendarKey]);

  const {
    list: periodTransactions,
    totalIncome,
    totalExpense,
    projectedExpense,
    totalSavings: periodSavings,
  } = getFinanceItems(
    items,
    themeNavDate,
    budgetConfig,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "newest",
    "monthly",
    wallets,
  );
  const previousPeriodDate = new Date(
    themeNavDate.getFullYear(),
    themeNavDate.getMonth() - 1,
    1,
  );
  const { totalExpense: previousPeriodExpense } = getFinanceItems(
    items,
    previousPeriodDate,
    budgetConfig,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "newest",
    "monthly",
    wallets,
  );
  const {
    totalNetWorth,
    totalAssets,
    totalDebt,
    totalSavings: walletTotalSavings,
  } = getWalletStats(items, wallets);

  const totalLimits = budgetConfig.rules.reduce(
    (acc, rule) => acc + (rule.percentage / 100) * budgetConfig.monthlyIncome,
    0,
  );
  const budgetBasis = budgetConfig.monthlyIncome || totalIncome;
  const budgetRemaining =
    budgetBasis - totalExpense - projectedExpense;
  const safeToSpend = Math.max(0, budgetRemaining);
  const cashFlow = totalIncome - totalExpense;
  const expenseChangePercent =
    previousPeriodExpense > 0
      ? ((totalExpense - previousPeriodExpense) / previousPeriodExpense) * 100
      : null;
  const recentTransactions = periodTransactions
    .filter((item) => item.status === "done")
    .slice(0, 4);
  const plannedTransactions = periodTransactions
    .filter((item) => item.status === "pending")
    .slice(0, 2);
  const loanAccounts = useMemo(
    () => getLoanAccounts(items, todayDate),
    [items, todayCalendarKey],
  );
  const upcomingLoanAccounts = loanAccounts
    .filter((account) => account.remainingAmount > 0 && account.dueDate)
    .slice(0, 3);

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
  const [isFinanceInsightDismissed, setIsFinanceInsightDismissed] =
    useState(false);
  useEffect(() => {
    setIsFinanceInsightDismissed(false);
  }, [themeKey]);
  const [taskCardCollapsed, setTaskCardCollapsed] = useState<
    Record<string, boolean>
  >({});
  const [activeTaskPanels, setActiveTaskPanels] = useState<
    Record<string, TaskPanel | undefined>
  >({});
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string[]>>(
    {},
  );
  const [goalDashboardVisibility, setGoalDashboardVisibility] = useState({
    savings: true,
    skills: false,
  });

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
  const hideSensitiveMoney = !showBalance || appSettings.hideMoney;
  const localizedDisplayInsights = displayInsights.map((insight) => {
    const titleMap: Record<string, string> = {
      "API Key Missing": "Kunci API belum diatur",
      "Daily Review": "Tinjauan harian",
      "Weekly Review": "Tinjauan mingguan",
      "Month over Month Review": "Perbandingan bulanan",
      "General Review": "Tinjauan umum",
      "Budget Critical": "Budget perlu ditangani",
      "Budget Warning": "Budget perlu dipantau",
      "Higher Spending": "Pengeluaran meningkat",
      "Great Savings": "Pengeluaran lebih hemat",
      "Category Spike": "Lonjakan kategori",
      "Tag Spending Spike": "Lonjakan tag pengeluaran",
      "Low Balance": "Saldo menipis",
      "Empty Wallet": "Saldo wallet kosong",
      "Overdue Tasks": "Tugas melewati tenggat",
      "Unfinished Business": "Item lama belum selesai",
      "Productivity Boost": "Produktivitas meningkat",
      "Productivity Dip": "Produktivitas menurun",
      "Heavy Workload": "Beban tugas tinggi",
      "Clear Schedule": "Jadwal hari ini kosong",
      "Urgent Purchases": "Belanja mendesak",
      "Skill Practice": "Latihan keterampilan",
      "Food Spend Drift": "Perubahan belanja makanan",
      "Wants Reactivated": "Belanja keinginan kembali aktif",
      "Task Throughput Drift": "Perubahan ritme tugas",
      "Skill Stagnation": "Keterampilan belum dilatih",
    };
    const percentMatch = insight.message.match(/(\d+(?:[.,]\d+)?)%/);
    const countMatch = insight.message.match(/\b(\d+)\b/);
    let message = insight.message;

    switch (insight.title) {
      case "API Key Missing":
        message =
          "Atur kunci API Gemini untuk mendapatkan insight berbasis AI.";
        break;
      case "Budget Critical":
        message = percentMatch
          ? `${percentMatch[1]}% budget bulanan sudah terpakai. Tinjau pengeluaran terdekat.`
          : "Budget bulanan hampir habis. Tinjau pengeluaran terdekat.";
        break;
      case "Budget Warning":
        message = percentMatch
          ? `${percentMatch[1]}% budget bulanan sudah terpakai. Pantau transaksi berikutnya.`
          : "Budget bulanan perlu dipantau.";
        break;
      case "Higher Spending":
        message = percentMatch
          ? `Pengeluaran bulan ini ${percentMatch[1]}% lebih tinggi dari bulan lalu.`
          : "Pengeluaran bulan ini lebih tinggi dari bulan lalu.";
        break;
      case "Great Savings":
        message =
          "Pengeluaran lebih rendah dari bulan lalu. Pertahankan ritme yang sesuai.";
        break;
      case "Overdue Tasks":
        message = countMatch
          ? `${countMatch[1]} tugas melewati tenggat. Jadwalkan ulang atau hapus jika tidak lagi relevan.`
          : "Ada tugas yang melewati tenggat. Tinjau jadwalnya.";
        break;
      case "Heavy Workload":
        message = countMatch
          ? `${countMatch[1]} tugas dijadwalkan hari ini. Tentukan prioritas utama.`
          : "Tugas hari ini cukup padat. Tentukan prioritas utama.";
        break;
      case "Clear Schedule":
        message =
          "Tidak ada tugas terjadwal hari ini. Gunakan ruang ini untuk istirahat atau membuat rencana.";
        break;
      case "Urgent Purchases":
        message = countMatch
          ? `${countMatch[1]} item belanja mendesak perlu ditinjau.`
          : "Ada item belanja mendesak yang perlu ditinjau.";
        break;
      default:
        if (
          /\b(the|your|you|this|last|month|week|day|spending|task|budget|review|wallet|please|configure|higher|lower|completed|practice|pending)\b/i.test(
            message,
          )
        ) {
          message =
            insight.type === "warning"
              ? "Ada perubahan yang perlu ditinjau. Buka area terkait untuk melihat sumber datanya."
              : insight.type === "success"
                ? "Data periode ini menunjukkan perkembangan yang positif."
                : "Tinjau perkembangan terbaru berdasarkan data Arkaiv.";
        }
    }

    const translatedTitle = titleMap[insight.title];
    const title =
      translatedTitle ||
      (/\b(review|budget|spending|task|wallet|skill|warning|success|missing|higher|lower)\b/i.test(
        insight.title,
      )
        ? insight.type === "warning"
          ? "Perlu ditinjau"
          : insight.type === "success"
            ? "Perkembangan positif"
            : "Insight terbaru"
        : insight.title);

    return { ...insight, title, message };
  });

  const cardProps = {
    onToggleStatus: handleToggleStatus,
    onUpdate: handleUpdateItem,
    onUpdateReceiptCapture: handleUpdateReceiptCapture,
    onDelete: handleDelete,
    enableCollapse: true,
    defaultCollapsed: true,
    hideMoney: hideSensitiveMoney,
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
    return isDeepWork && children.length > 0 ? "subtasks" : "none";
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
    return "px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted hover:text-primary hover:bg-black/10 dark:hover:bg-white/[0.09] text-xs font-bold transition-colors flex items-center gap-1";
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
    if (subtaskDrafts[item.id]) return subtaskDrafts[item.id];
    if (item.meta.subtasks?.length) return item.meta.subtasks;
    if (children.length > 0) return children.map((child) => child.content);
    const emptyStepCount = Math.min(item.meta.deepWorkStepCount || 0, 5);
    return emptyStepCount > 0 ? Array.from({ length: emptyStepCount }, () => "") : [];
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
    setSubtaskDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setTaskPanel(item.id, "subtasks");
  };

  const openManualSubtaskDraft = (item: BrainDumpItem, children: BrainDumpItem[] = []) => {
    const draft = getSubtaskDraft(item, children);
    setSubtaskDrafts((prev) => ({
      ...prev,
      [item.id]: draft.length ? draft : [""],
    }));
    setTaskPanel(item.id, "editSubtasks");
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
            className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/[0.09] transition-colors"
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
      supportsNestedTodoSubtasks(item) && !item.meta.parentTodoId;
    const isCardExpanded = isTaskCardExpanded(item.id);
    const activePanel = getActiveTaskPanel(item, children, isDeepWork);
    const isSubtasksExpanded = activePanel === "subtasks";

    if (!isDeepWork) {
      const draft = getSubtaskDraft(item, children);
      const isEditSubtasksExpanded = activePanel === "editSubtasks";
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
                activePanel === "editSubtasks"
                  ? setTaskPanel(item.id, "none")
                  : openManualSubtaskDraft(item)
              }
              className={taskPanelButtonClass(isEditSubtasksExpanded, "subtasks")}
            >
              {isEditSubtasksExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Add subtasks
            </button>
          )}
        </div>
      ) : null;
      const manualSubtaskPanel =
        canUseManualSubtasks && isCardExpanded && isEditSubtasksExpanded ? (
          <AnimatePresence initial={false}>
            {isEditSubtasksExpanded && (
              <motion.div
                variants={collapseVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="grid overflow-hidden"
              >
                <div className="min-h-0 overflow-hidden rounded-2xl border border-border bg-background/70 p-3 space-y-3 lg:p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Edit subtasks
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
    const hasSubtaskCards = children.length > 0;
    const isEditSubtasksExpanded = activePanel === "editSubtasks";
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
        {isSuggested && !hasSubtaskCards && (
          <button
            onClick={() => acceptDeepWorkPlan(item, children)}
            className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors"
          >
            Transform into steps
          </button>
        )}
        {hasSubtaskCards ? (
          <>
            <button
              onClick={() => toggleTaskPanel(item.id, "subtasks", activePanel)}
              className={taskPanelButtonClass(isSubtasksExpanded, "subtasks")}
            >
              {isSubtasksExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              Subtasks
            </button>
            <button
              onClick={() =>
                activePanel === "editSubtasks"
                  ? setTaskPanel(item.id, "none")
                  : openManualSubtaskDraft(item, children)
              }
              className={taskPanelButtonClass(isEditSubtasksExpanded, "subtasks")}
            >
              {isEditSubtasksExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <Pencil className="w-3 h-3" />
              )}
              Edit subtasks
            </button>
            <button
              onClick={() => handleKeepRawTodo(item.id)}
              className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-red-500/10 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Remove subtasks
            </button>
          </>
        ) : (
          <button
            onClick={() =>
              activePanel === "editSubtasks"
                ? setTaskPanel(item.id, "none")
                : openManualSubtaskDraft(item, children)
            }
            className={taskPanelButtonClass(isEditSubtasksExpanded, "subtasks")}
          >
            {isEditSubtasksExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            Add subtasks
          </button>
        )}
        {hasDeepWorkDetails && (
          <button
            onClick={() => handleRetriggerDeepWorkTodo(item.id)}
            className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/[0.09] transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Retrigger
          </button>
        )}
      </div>
    ) : null;
    const deepWorkSubtaskPanel = isSubtasksExpanded || isEditSubtasksExpanded ? (
      <AnimatePresence initial={false}>
        {(isSubtasksExpanded || isEditSubtasksExpanded) && (
          <motion.div
            variants={collapseVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="grid overflow-hidden"
          >
            <div className="min-h-0 overflow-hidden rounded-2xl border border-border bg-background/70 p-3 space-y-3 lg:p-4">
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
                  <AnimatedProgress
                    value={Math.max(progressPercent, doneCount > 0 ? 4 : 0)}
                    className="rounded-full bg-purple-500"
                    label={`${item.content} subtask progress`}
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
                  {isEditSubtasksExpanded ? "Edit subtasks" : "Optional subtasks"}
                </div>
                {isEditSubtasksExpanded ? (
                  renderSubtaskDraftEditor(
                    item,
                    children,
                    isSuggested
                      ? "Use these steps"
                      : hasSubtaskCards
                        ? "Update subtasks"
                        : "Save as todo subtasks",
                  )
                ) : hasSubtaskCards ? (
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
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
                    No todo subtask cards yet. Use Add subtasks to create them.
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

  const taskDashboardItems = useMemo(
    () =>
      displayItems.map((item) => ({
        id: item.id,
        label: item.content,
        done: item.status === "done",
      })),
    [displayItems],
  );

  const taskDashboardTitle = isDoneState
    ? "Selesai semua"
    : {
        "Today's Focus": "Fokus hari ini",
        Tomorrow: "Besok",
        "Daily Rituals": "Rutinitas harian",
        Upcoming: "Akan datang",
        "All Clear": "Semua beres",
      }[displayTitle] ||
      displayTitle ||
      "Tugas";
  const normalizedDisplaySubtitle = displaySubtitle?.replace(
    /\u00e2\u20ac\u201d/g,
    "—",
  );
  const taskDashboardSubtitle = normalizedDisplaySubtitle
    ? {
        "Get a head start on tomorrow's tasks.":
          "Mulai lebih awal untuk tugas besok.",
        "Keep your momentum going.": "Jaga ritmemu tetap berjalan.",
        "Tasks waiting for your attention.":
          "Tugas yang menunggu perhatianmu.",
        "No active tasks left — showing completed focus items.":
          "Tidak ada tugas aktif. Berikut fokus yang sudah selesai.",
        "Take a break or plan ahead.": "Istirahat sejenak atau susun rencana.",
      }[normalizedDisplaySubtitle] || normalizedDisplaySubtitle
    : null;

  const getGoalNumbers = (item: BrainDumpItem) => {
    const savedAmount = getSavedAmountForGoal(items, item.id);
    const targetAmount = Number(item.meta.amount || 0);
    const investmentMetrics = getInvestmentMetrics({
      ...item,
      meta: {
        ...item.meta,
        savedAmount,
      },
    });
    const derivedProgress =
      targetAmount > 0 ? (savedAmount / targetAmount) * 100 : 0;

    return {
      savedAmount,
      investedAmount: investmentMetrics.displayValue,
      hasMarketValue: investmentMetrics.ownedValue > 0,
      targetAmount,
      progress: Math.max(
        0,
        Math.min(100, Number(derivedProgress || item.meta.progress || 0)),
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
        const isInvestment = item.meta.shoppingCategory === "investment";

        return {
          id: item.id,
          label: item.content,
          progress: numbers.progress,
          caption: isInvestment
            ? numbers.hasMarketValue
              ? "Nilai saat ini"
              : "Total kontribusi"
            : numbers.targetAmount > 0
              ? !hideSensitiveMoney
                ? `${fmt(numbers.savedAmount)} / ${fmt(numbers.targetAmount)}`
                : "•••• / ••••"
              : "Target tabungan",
          valueLabel: isInvestment
            ? !hideSensitiveMoney
              ? fmt(numbers.investedAmount)
              : "••••"
            : `${Math.round(numbers.progress)}%`,
          showProgress: !isInvestment,
          kind: item.meta.shoppingCategory,
          done: item.status === "done",
        };
      })
      .filter(
        (goal) =>
          goal.kind !== "saving" || (!goal.done && goal.progress < 100),
      );

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
        const progress = Math.max(
          0,
          Math.min(100, (loggedMinutes / targetMinutes) * 100),
        );

        return {
          id: skill.id,
          label: skill.name,
          progress,
          caption: `${loggedMinutes}/${targetMinutes} menit minggu ini`,
          valueLabel: `${Math.round(progress)}%`,
          showProgress: true,
          kind: "skill" as const,
        };
      });

    return [...savingAndInvestmentGoals, ...skillGoals].sort((a, b) => {
      if (a.showProgress !== b.showProgress) return a.showProgress ? -1 : 1;
      return b.progress - a.progress;
    });
  }, [items, skills, hideSensitiveMoney, todayDate.getTime()]);

  const visibleGoalDashboardItems = useMemo(
    () =>
      goalDashboardItems.filter((goal) => {
        const isSavingsGoal =
          goal.kind === "saving" || goal.kind === "investment";
        return (
          (goalDashboardVisibility.savings && isSavingsGoal) ||
          (goalDashboardVisibility.skills && goal.kind === "skill")
        );
      }),
    [goalDashboardItems, goalDashboardVisibility],
  );

  const routineDashboardItems = useMemo(
    () =>
      routineDueToday.map((item) => ({
        id: item.id,
        label: item.content,
        done: item.status === "done",
        sourceId: item.id,
      })),
    [routineDueToday],
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
            ? date.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
              })
            : date.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
          : "Hari ini";
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
        title: `${routineCompletions.length} rutinitas selesai`,
        subtitle: "Progres rutinitas minggu ini.",
      };
    }

    if (skillMinutes > 0) {
      return {
        title: `${skillMinutes} menit belajar`,
        subtitle: "Momentum belajar minggu ini.",
      };
    }

    if (completedThisWeek.length > 0) {
      return {
        title: `${completedThisWeek.length} item selesai`,
        subtitle: "Pencapaian nyata dari aktivitasmu minggu ini.",
      };
    }

    return {
      title: "Belum ada pencapaian minggu ini",
      subtitle: "Selesaikan satu item untuk memulai.",
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

  const hasThemeContent = themeContent.trim().length > 0;
  const hasThemeImage = themeHeroImage.trim().length > 0;
  const missionTitle = hasThemeContent
    ? themeContent
    : "Tambahkan misi bulan ini";
  const missionSubtitle = hasThemeContent
    ? "Fokus pada yang penting, jaga waktumu, dan bergerak dengan tujuan."
    : "Buka Tambah Tema untuk mengatur misi dan gambar bulan ini.";
  const systemTimeLabel = systemNow.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const todayMonthYearLabel = todayDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
  const themeMonthYearLabel = themeNavDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
  const activePeriodLabel = themeNavDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
  const greeting =
    systemNow.getHours() < 11
      ? "Selamat pagi"
      : systemNow.getHours() < 15
        ? "Selamat siang"
        : systemNow.getHours() < 19
          ? "Selamat sore"
          : "Selamat malam";
  const budgetUsageWithPlan =
    budgetBasis > 0
      ? ((totalExpense + projectedExpense) / budgetBasis) * 100
      : 0;
  const budgetHealth =
    budgetBasis <= 0
      ? {
          label: "Butuh dasar budget",
          detail: "Atur pemasukan atau kategori budget",
          tone: "info" as const,
        }
      : budgetRemaining < 0
        ? {
            label: "Berpotensi melewati budget",
            detail: `${Math.abs(budgetRemaining / budgetBasis * 100).toFixed(0)}% di atas rencana`,
            tone: "warning" as const,
          }
        : budgetUsageWithPlan >= 85
          ? {
              label: "Perlu dipantau",
              detail: `${budgetUsageWithPlan.toFixed(0)}% terpakai termasuk rencana`,
              tone: "warning" as const,
            }
          : {
              label: "Masih sesuai rencana",
              detail: `${budgetUsageWithPlan.toFixed(0)}% terpakai termasuk rencana`,
              tone: "positive" as const,
            };
  const primaryFinanceInsight = budgetBasis <= 0
    ? {
        label: "Dasar perhitungan belum lengkap",
        reason:
          "Arkaiv membutuhkan pemasukan bulanan atau transaksi pemasukan untuk menghitung ruang belanja.",
        action: "Lengkapi di Money",
        tone: "info" as const,
      }
    : budgetRemaining < 0
      ? {
          label: "Rencana pengeluaran melewati budget",
          reason: !hideSensitiveMoney
            ? `${fmt(totalExpense)} sudah terpakai dan ${fmt(projectedExpense)} masih direncanakan.`
            : "Nominal disembunyikan. Rencana periode ini berada di atas budget.",
          action: "Tinjau budget",
          tone: "warning" as const,
        }
      : expenseChangePercent !== null && expenseChangePercent > 10
        ? {
            label: `Pengeluaran naik ${expenseChangePercent.toFixed(0)}%`,
            reason: !hideSensitiveMoney
              ? `Dibanding periode sebelumnya, pengeluaran bertambah ${fmt(totalExpense - previousPeriodExpense)}.`
              : "Nominal disembunyikan. Perbandingan menggunakan periode sebelumnya.",
            action: "Lihat pendorongnya",
            tone: "warning" as const,
          }
        : {
            label: "Ruang belanja masih terkendali",
            reason: !hideSensitiveMoney
              ? `Perkiraan aman dibelanjakan ${fmt(safeToSpend)} sampai akhir periode.`
              : "Nominal disembunyikan. Budget aktual dan rencana masih berada dalam batas.",
            action: "Buka ringkasan Money",
            tone: "positive" as const,
          };
  const visiblePrimaryFinanceInsight = hideSensitiveMoney
    ? {
        label: "Insight finansial disembunyikan",
        reason:
          "Tampilkan nominal untuk melihat observasi, alasan, dan saran berdasarkan periode ini.",
        action: "Buka Money",
        tone: "info" as const,
      }
    : primaryFinanceInsight;

  const dashboardShellClass = [
    "overflow-x-hidden overflow-y-visible rounded-none border-0 bg-transparent p-0 text-slate-950 shadow-none",
    "dark:border-0 dark:bg-transparent dark:text-zinc-50 dark:shadow-none",
  ].join(" ");
  const dashboardCardClass = [
    "rounded-[1.4rem] border border-border/75 bg-surface/88 shadow-sm backdrop-blur-xl",
    "transition-[border-color,box-shadow] duration-200 hover:border-border hover:shadow-md",
  ].join(" ");
  const dashboardIconClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300";
  const dashboardSectionTitle =
    "text-sm font-black tracking-tight text-slate-950 dark:text-zinc-50";
  const dashboardKicker =
    "text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300";
  const dashboardMuted = "text-slate-500 dark:text-zinc-400";
  const dashboardScrollbarClass = [
    "[scrollbar-width:thin]",
    "[scrollbar-color:rgba(148,163,184,0.45)_transparent]",
    "dark:[scrollbar-color:rgba(255,255,255,0.24)_transparent]",
    "[&::-webkit-scrollbar]:h-1.5",
    "[&::-webkit-scrollbar]:w-1.5",
    "[&::-webkit-scrollbar-track]:bg-transparent",
    "[&::-webkit-scrollbar-thumb]:rounded-full",
    "[&::-webkit-scrollbar-thumb]:bg-slate-300/60",
    "dark:[&::-webkit-scrollbar-thumb]:bg-white/20",
    "[&::-webkit-scrollbar-corner]:bg-transparent",
  ].join(" ");

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
                      <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                      Insight dan notifikasi
                    </h3>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchAIInsights(true)}
                        disabled={isLoadingInsights}
                        className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                        aria-label="Perbarui insight"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            isLoadingInsights ? "animate-spin" : ""
                          }`}
                        />
                      </button>

                      <button
                        onClick={handleCloseNotification}
                        className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label="Tutup insight dan notifikasi"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`space-y-3 overflow-y-auto p-4 lg:p-5 ${dashboardScrollbarClass}`}
                  >
                    {hideSensitiveMoney ? (
                      <div
                        className="rounded-2xl bg-surface-soft p-4"
                        role="status"
                      >
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                          <div>
                            <p className="text-sm font-semibold">
                              Insight finansial disembunyikan
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-muted">
                              Tampilkan nominal untuk membaca insight yang
                              memakai data keuangan periode ini.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : isLoadingInsights &&
                      localizedDisplayInsights.length === 0 ? (
                      <div
                        className="space-y-3"
                        role="status"
                        aria-live="polite"
                        aria-label="Sedang membuat insight AI"
                      >
                        {[0, 1, 2].map((index) => (
                          <div
                            key={index}
                            className="animate-pulse rounded-2xl border border-border bg-background/60 p-4"
                          >
                            <div className="h-3 w-1/3 rounded-full bg-muted/20" />
                            <div className="mt-3 h-2.5 w-full rounded-full bg-muted/15" />
                            <div className="mt-2 h-2.5 w-2/3 rounded-full bg-muted/15" />
                          </div>
                        ))}
                      </div>
                    ) : localizedDisplayInsights.length > 0 ? (
                      <motion.div
                        className="space-y-3"
                        variants={staggerContainerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                      {localizedDisplayInsights.map((insight, idx) => {
                        let bgColor = "bg-black/5 dark:bg-white/10";
                        let iconColor = "text-zinc-500";
                        let Icon = AlertTriangle;

                        if (insight.type === "warning") {
                          bgColor =
                            "border border-[#c94f3d]/25 bg-[#c94f3d]/10";
                          iconColor = "text-[#b74434] dark:text-[#ef8b79]";
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
                          <motion.div
                            key={`${insight.title}-${idx}`}
                            variants={riseVariants}
                            className={`flex items-start gap-3 rounded-2xl p-4 ${bgColor}`}
                          >
                            <Icon
                              className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`}
                            />
                            <div>
                              <h3 className="mb-0.5 text-sm font-bold">
                                {insight.title}
                              </h3>
                              <p className="text-xs leading-relaxed text-muted">
                                {insight.message}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                      </motion.div>
                    ) : (
                      <div className="py-8 text-center text-muted">
                        <p className="text-sm">Belum ada notifikasi baru</p>
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
                      Pusat pemeriksaan
                    </h3>

                    <div className="flex items-center gap-2">
                      {(pendingReviews.length + receiptReviews.length) > 0 && (
                        <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                          {pendingReviews.length + receiptReviews.length} menunggu
                        </span>
                      )}
                      <button
                        onClick={handleCloseReview}
                        className="ml-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label="Tutup pusat pemeriksaan"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <ReviewCenterPanel
                    parsingTasks={parsingTasks}
                    pendingReviews={pendingReviews}
                    receiptReviews={receiptReviews}
                    wallets={wallets}
                    budgetRules={budgetConfig.rules || []}
                    items={items}
                    onChangeReceiptReview={onChangeReceiptReview}
                    onApproveReceiptReview={onApproveReceiptReview}
                    onRejectReceiptReview={onRejectReceiptReview}
                    onViewDuplicateReceipt={onViewDuplicateReceipt}
                    onApproveReview={handleApproveReview}
                    onRejectReview={handleRejectReview}
                    retryParsing={retryParsing}
                    clearParsingTask={clearParsingTask}
                    undoParsingTask={undoParsingTask}
                    deleteParsingTaskEntries={deleteParsingTaskEntries}
                    hideMoney={hideSensitiveMoney}
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
        <div className="h-full w-full bg-indigo-50 dark:bg-indigo-400/[0.07]" />
      )}
    </div>
  );

  const renderThemeImageCta = () =>
    !hasThemeImage ? (
      <div className="pointer-events-none absolute bottom-6 right-6 hidden max-w-xs rounded-[2rem] border border-blue-200/70 bg-white/40 p-5 text-blue-700/80 backdrop-blur-md dark:border-blue-300/20 dark:bg-white/5 dark:text-blue-200/80 xl:block">
        <ImageIcon className="mb-3 h-9 w-9" />
        <div className="text-xs font-black uppercase tracking-[0.22em]">
          Tambahkan gambar tema
        </div>
        <div className="mt-1 text-xs font-semibold opacity-75">
          URL gambar dapat diatur lewat Tambah Tema.
        </div>
      </div>
    ) : null;

  const renderFinanceCommandHero = () => {
    const actualPercent =
      budgetBasis > 0 ? Math.min(100, (totalExpense / budgetBasis) * 100) : 0;
    const plannedPercent =
      budgetBasis > 0 ? Math.min(100, (projectedExpense / budgetBasis) * 100) : 0;
    const visiblePlannedPercent = Math.min(
      plannedPercent,
      Math.max(0, 100 - actualPercent),
    );
    const reviewCount =
      pendingReviews.length + receiptReviews.length + parsingTasks.length;
    const metrics = [
      {
        label: "Pemasukan",
        value: totalIncome,
        icon: TrendingUp,
        tone: "positive",
      },
      {
        label: "Pengeluaran",
        value: totalExpense,
        icon: TrendingDown,
        tone: "negative",
      },
      {
        label: "Tabungan",
        value: periodSavings,
        icon: PiggyBank,
        tone: "info",
      },
      {
        label: "Arus kas bersih",
        value: cashFlow,
        icon: cashFlow >= 0 ? ArrowUpRight : ArrowDownRight,
        tone: cashFlow >= 0 ? "positive" : "negative",
      },
    ] as const;

    return (
      <section
        data-finance-surface="hero"
        className="overflow-hidden rounded-[28px] bg-surface p-5 text-primary ring-1 ring-inset ring-border/55 sm:p-6 lg:p-8"
        aria-labelledby="home-financial-snapshot"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-muted">{greeting}</div>
            <h1
              id="home-financial-snapshot"
              className="mt-1 text-[clamp(1.65rem,4vw,2.4rem)] font-semibold leading-tight tracking-[-0.035em]"
            >
              Ringkasan uangmu, tanpa keruwetan.
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div
              data-swipe-date="summary-finance-month"
              className="flex min-h-11 items-center rounded-2xl bg-surface-soft p-1"
              onTouchStart={dateSwipeHandlers.onTouchStart}
              onTouchMove={dateSwipeHandlers.onTouchMove}
              onTouchEnd={dateSwipeHandlers.onTouchEnd}
            >
              <button
                type="button"
                onClick={() => changeThemeMonth(-1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-primary"
                aria-label="Periode sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[6.25rem] px-1 text-center text-[11px] font-semibold capitalize text-primary sm:min-w-[9.5rem] sm:px-2 sm:text-sm">
                {activePeriodLabel}
              </span>
              <button
                type="button"
                onClick={() => changeThemeMonth(1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-primary"
                aria-label="Periode berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              ref={reviewButtonRef}
              type="button"
              onClick={handleOpenReview}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-soft text-muted transition-colors hover:text-primary max-[420px]:hidden lg:hidden"
              aria-label={`${reviewCount} item perlu diperiksa`}
            >
              <ClipboardCheck className="h-[18px] w-[18px]" />
              {reviewCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                  {Math.min(reviewCount, 9)}
                </span>
              )}
            </button>
            <button
              ref={notificationButtonRef}
              type="button"
              onClick={handleOpenNotification}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-soft text-muted transition-colors hover:text-primary lg:hidden"
              aria-label="Buka insight dan notifikasi"
            >
              <AlertTriangle className="h-[18px] w-[18px]" />
              {hasNewNotification && (
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-surface-soft bg-[#c94f3d]" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-stretch">
          <div className="flex min-w-0 flex-col justify-between rounded-[24px] bg-[#121a16] p-5 text-white dark:bg-[#e9f2ed] dark:text-[#101713] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-white/60 dark:text-[#506058]">
                  Kekayaan bersih saat ini
                </div>
                <div
                  data-financial-amount="true"
                  className="mt-2 break-words text-[clamp(2rem,7vw,3.5rem)] font-semibold leading-none tracking-[-0.055em]"
                >
                  <AnimatedNumber
                    value={totalNetWorth}
                    formatter={fmt}
                    hidden={hideSensitiveMoney}
                    hiddenLabel="••••••••"
                    ariaLabel="Kekayaan bersih"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBalance(!showBalance)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/15 dark:bg-black/[0.07] dark:text-[#101713] dark:hover:bg-black/10"
                aria-label={hideSensitiveMoney ? "Tampilkan seluruh nominal" : "Sembunyikan seluruh nominal"}
                aria-pressed={hideSensitiveMoney}
              >
                {!hideSensitiveMoney ? (
                  <EyeOff className="h-[18px] w-[18px]" />
                ) : (
                  <Eye className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.07] p-3 dark:bg-black/[0.055]">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-white/60 dark:text-[#506058]">
                  <Landmark className="h-3.5 w-3.5" />
                  Total aset
                </div>
                <div data-financial-amount="true" className="mt-1 truncate text-base font-semibold">
                  <AnimatedNumber
                    value={totalAssets}
                    formatter={fmt}
                    hidden={hideSensitiveMoney}
                    hiddenLabel="••••"
                    ariaLabel="Total aset"
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.07] p-3 dark:bg-black/[0.055]">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-white/60 dark:text-[#506058]">
                  <CreditCard className="h-3.5 w-3.5" />
                  Total utang
                </div>
                <div data-financial-amount="true" className="mt-1 truncate text-base font-semibold">
                  <AnimatedNumber
                    value={totalDebt}
                    formatter={fmt}
                    hidden={hideSensitiveMoney}
                    hiddenLabel="••••"
                    ariaLabel="Total utang"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[24px] bg-surface-soft p-5 sm:p-6">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-muted">
                    Perkiraan aman dibelanjakan
                  </div>
                  <div
                    data-financial-amount="true"
                    className="mt-2 text-3xl font-semibold tracking-[-0.04em]"
                  >
                    <AnimatedNumber
                      value={safeToSpend}
                      formatter={fmt}
                      hidden={hideSensitiveMoney}
                      hiddenLabel="••••••"
                      ariaLabel="Perkiraan aman dibelanjakan"
                    />
                  </div>
                </div>
                <span
                  data-finance-status={budgetHealth.tone}
                  className="rounded-full bg-surface px-3 py-1.5 text-[11px] font-semibold shadow-sm"
                >
                  {budgetHealth.label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {budgetHealth.detail}. Perkiraan memakai budget aktual dan transaksi terencana.
              </p>
            </div>

            <div className="mt-7">
              <div
                className="relative flex h-3 overflow-hidden rounded-full bg-border/70"
                role="img"
                aria-label={`Budget terpakai ${actualPercent.toFixed(0)} persen, rencana ${plannedPercent.toFixed(0)} persen`}
              >
                <motion.div
                  initial={false}
                  animate={{ width: `${actualPercent}%` }}
                  className="h-full bg-indigo-600"
                />
                <motion.div
                  initial={false}
                  animate={{ width: `${visiblePlannedPercent}%` }}
                  data-planned-fill="true"
                  className="h-full bg-amber-600 text-amber-700 dark:bg-amber-400 dark:text-amber-200"
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-semibold text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  Aktual
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm border border-amber-700 bg-amber-200" />
                  Rencana
                </span>
                <span className="text-right">Sisa netral</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-border/70 pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Denyut arus kas</h2>
            <span className="text-[11px] text-muted">
              {expenseChangePercent === null
                ? "Belum ada pembanding"
                : `${expenseChangePercent >= 0 ? "Naik" : "Turun"} ${Math.abs(expenseChangePercent).toFixed(0)}% vs periode lalu`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="min-w-0 rounded-2xl bg-surface-soft/75 p-3.5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted">
                    <Icon className="h-3.5 w-3.5" data-finance-status={metric.tone} />
                    {metric.label}
                  </div>
                  <div
                    data-financial-amount="true"
                    data-finance-status={metric.tone}
                    className="mt-1.5 truncate text-base font-semibold"
                  >
                    <AnimatedNumber
                      value={metric.value}
                      formatter={fmt}
                      hidden={hideSensitiveMoney}
                      hiddenLabel="••••"
                      ariaLabel={metric.label}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-muted">
            Bersumber dari dompet, transaksi, dan budget Arkaiv · {activePeriodLabel}
          </p>
          <button
            type="button"
            onClick={handleOpenAddExpense}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Catat transaksi
          </button>
        </div>
      </section>
    );
  };

  const renderPrimaryFinanceInsight = () =>
    isFinanceInsightDismissed ? null : (
      <section
        className="relative overflow-hidden rounded-[24px] bg-indigo-50 p-5 ring-1 ring-inset ring-indigo-200/65 dark:bg-indigo-400/[0.08] dark:ring-indigo-300/15 sm:p-6"
        aria-labelledby="home-copilot-title"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">
                  Arkaiv Copilot · insight utama
                </div>
                <h2 id="home-copilot-title" className="mt-1 text-lg font-semibold tracking-tight">
                  {visiblePrimaryFinanceInsight.label}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFinanceInsightDismissed(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-white/70 hover:text-primary dark:hover:bg-white/[0.07]"
                aria-label="Abaikan insight ini"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {visiblePrimaryFinanceInsight.reason}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[10px] font-medium text-muted">
                Sumber: dompet, transaksi, dan budget · {activePeriodLabel}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("money")}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-200 transition-colors hover:bg-white dark:text-indigo-300 dark:ring-indigo-300/20 dark:hover:bg-white/[0.06]"
              >
                {visiblePrimaryFinanceInsight.action}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    );

  const renderUpcomingFinance = () => {
    const hasUpcoming =
      upcomingLoanAccounts.length > 0 ||
      plannedTransactions.length > 0 ||
      nextUpItems.length > 0;
    return (
      <section className={`${dashboardCardClass} p-5 sm:p-6`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className={dashboardSectionTitle}>Berikutnya</h2>
            <p className={`mt-1 text-xs ${dashboardMuted}`}>
              Jatuh tempo, rencana, dan agenda terdekat
            </p>
          </div>
          <div className={dashboardIconClass}>
            <CalendarDays className="h-5 w-5" />
          </div>
        </div>

        {hasUpcoming ? (
          <div className="space-y-2.5">
            {upcomingLoanAccounts.slice(0, 2).map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => {
                  setPlanSubTab("loans");
                  setActiveTab("plan");
                }}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface-soft p-3 text-left transition-colors hover:bg-border/55"
              >
                <span
                  data-finance-status={account.status === "overdue" ? "warning" : "info"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface"
                >
                  <Banknote className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {account.counterparty}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {account.direction === "payable"
                      ? "Uang yang kamu pinjam"
                      : "Uang yang kamu pinjamkan"}
                    {account.dueDate
                      ? ` · ${new Date(account.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`
                      : ""}
                  </span>
                </span>
                <span data-financial-amount="true" className="shrink-0 text-right text-xs font-semibold">
                  {!hideSensitiveMoney ? fmt(account.remainingAmount) : "••••"}
                </span>
              </button>
            ))}

            {plannedTransactions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab("money")}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface-soft p-3 text-left transition-colors hover:bg-border/55"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-amber-700 dark:text-amber-300">
                  <ReceiptText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.content}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">Pengeluaran terencana</span>
                </span>
                <span data-financial-amount="true" className="shrink-0 text-xs font-semibold">
                  {!hideSensitiveMoney ? fmt(item.meta.amount || 0) : "••••"}
                </span>
              </button>
            ))}

            {upcomingLoanAccounts.length === 0 &&
              plannedTransactions.length === 0 &&
              nextUpItems.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-surface-soft p-3">
                  <span className="w-12 shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                    {item.time}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                </div>
              ))}
          </div>
        ) : (
          renderDashboardEmptyState(
            "Tidak ada yang mendesak",
            "Jatuh tempo pinjaman, transaksi terencana, dan agenda terdekat akan tampil di sini.",
          )
        )}
      </section>
    );
  };

  const renderRecentTransactions = () => (
    <section className={`${dashboardCardClass} p-5 sm:p-6`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className={dashboardSectionTitle}>Transaksi terbaru</h2>
          <p className={`mt-1 text-xs ${dashboardMuted}`}>{activePeriodLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab("money")}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300"
        >
          Lihat semua
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {recentTransactions.length > 0 ? (
        <div className="divide-y divide-border/70">
          {recentTransactions.map((item) => {
            const financeType = item.meta.financeType || "expense";
            const isIncome =
              financeType === "income" ||
              financeType === "loan_in" ||
              financeType === "loan_repayment_in";
            const isTransfer =
              financeType === "transfer" ||
              financeType === "saving" ||
              financeType === "saving_withdrawal";
            const typeLabel =
              financeType === "income"
                ? "Pemasukan"
                : financeType === "transfer"
                  ? "Transfer"
                  : financeType === "saving"
                    ? "Tabungan"
                    : financeType === "saving_withdrawal"
                      ? "Penarikan tabungan"
                      : financeType === "loan_out"
                        ? "Dipinjamkan"
                        : financeType === "loan_in"
                          ? "Pinjaman masuk"
                          : financeType === "loan_repayment_in"
                            ? "Pelunasan masuk"
                            : financeType === "loan_repayment_out"
                              ? "Pelunasan keluar"
                              : "Pengeluaran";
            const Icon = isIncome
              ? ArrowDownRight
              : isTransfer
                ? ArrowRight
                : ArrowUpRight;
            const transactionDate = new Date(
              item.meta.date || item.completed_at || item.created_at,
            );
            const category =
              budgetConfig.rules.find((rule) => rule.id === item.meta.budgetCategory)?.name ||
              item.meta.budgetCategory ||
              item.meta.paymentMethod ||
              "Belum berkategori";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab("money")}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span
                  data-finance-status={isIncome ? "positive" : isTransfer ? "info" : "negative"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-soft"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {item.meta.merchant || item.content}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {typeLabel} · {category}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    data-financial-amount="true"
                    data-finance-status={isIncome ? "positive" : isTransfer ? "info" : "negative"}
                    className="block text-sm font-semibold"
                  >
                    {!hideSensitiveMoney
                      ? `${isIncome ? "+" : isTransfer ? "" : "−"}${fmt(item.meta.amount || 0)}`
                      : "••••"}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    {Number.isNaN(transactionDate.getTime())
                      ? ""
                      : transactionDate.toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        renderDashboardEmptyState(
          "Belum ada transaksi",
          "Catat transaksi pertama periode ini lewat composer atau tombol Catat transaksi.",
          { label: "Catat transaksi", onClick: handleOpenAddExpense },
        )
      )}
    </section>
  );

  const renderHeroCard = (compact = false) => (
    <button
      type="button"
      onClick={openThemeEditor}
      className={`${dashboardCardClass} group relative block h-full min-h-[16rem] w-full overflow-hidden text-left transition-transform active:scale-[0.995] ${
        compact ? "rounded-[1.75rem]" : "xl:min-h-[18.75rem]"
      }`}
    >
      {renderThemeImageSurface()}
      <div className="absolute inset-0 bg-white/82 dark:bg-[#101713]/82" />
      {renderThemeImageCta()}

      <div
        className={`relative z-10 flex h-full min-h-[16rem] flex-col justify-center ${compact ? "p-6" : "p-7 xl:min-h-[18.75rem] xl:p-10"}`}
      >
        <h1
          className={`${compact ? "text-3xl sm:text-4xl" : "text-4xl xl:text-5xl"} max-w-3xl font-extrabold leading-[1.05] tracking-[-0.035em] text-slate-950 dark:text-white`}
        >
          {missionTitle}
        </h1>

        <div className="mt-6 text-sm font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">
          Fokus bulan ini
        </div>
        <p
          className={`mt-2 max-w-2xl text-sm font-medium leading-relaxed sm:text-base ${dashboardMuted}`}
        >
          {missionSubtitle}
        </p>

        <div className="mt-7 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-600/80 opacity-100 transition-opacity dark:text-indigo-300/80 xl:opacity-0 xl:group-hover:opacity-100">
          <Pencil className="h-3.5 w-3.5" />
          Tambah tema
        </div>
      </div>
    </button>
  );

  const renderDateCard = () => (
    <div
      data-swipe-date="summary-theme-month"
      className={`${dashboardCardClass} flex h-full min-h-[16rem] flex-col items-center justify-center p-5 text-center touch-pan-y xl:min-h-[18.75rem]`}
      onTouchStart={dateSwipeHandlers.onTouchStart}
      onTouchMove={dateSwipeHandlers.onTouchMove}
      onTouchEnd={dateSwipeHandlers.onTouchEnd}
    >
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
        <CalendarDays className="h-7 w-7" />
      </div>

      <div className="text-base font-semibold text-slate-700 dark:text-zinc-300">
        {todayDate.toLocaleDateString("id-ID", { weekday: "long" })}
      </div>
      <div className="mt-1 text-6xl font-black leading-none text-blue-700 dark:text-blue-300">
        {String(todayDate.getDate()).padStart(2, "0")}
      </div>
      <div className="mt-3 text-base font-semibold text-blue-700 dark:text-blue-300">
        {todayMonthYearLabel}
      </div>
      <div className="mt-2 text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-zinc-50">
        {systemTimeLabel}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => changeThemeMonth(-1)}
          className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.09]"
          aria-label="Bulan tema sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={openThemeEditor}
          className="rounded-full bg-blue-50 px-3 py-2 text-center text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/15"
          aria-label={`Edit tema ${themeMonthYearLabel}`}
        >
          <span className="block text-[10px] font-black uppercase tracking-[0.16em]">
            Tema
          </span>
          <span className="mt-0.5 block text-[10px] font-bold normal-case tracking-normal">
            {themeMonthYearLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={() => changeThemeMonth(1)}
          className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.09]"
          aria-label="Bulan tema berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const renderTasksCard = () => (
    <section
      className={`${dashboardCardClass} flex max-h-[21rem] flex-col p-5 xl:p-6`}
    >
      <div className="mb-5 flex shrink-0 items-center justify-between">
        <div>
          <h2 className={dashboardSectionTitle}>{taskDashboardTitle}</h2>
          {taskDashboardSubtitle && !isDoneState && (
            <p className={`mt-1 text-xs font-semibold ${dashboardMuted}`}>
              {taskDashboardSubtitle}
            </p>
          )}
        </div>
        <div className={dashboardIconClass}>
          <ClipboardCheck className="h-5 w-5" />
        </div>
      </div>

      {taskDashboardItems.length > 0 ? (
        <div
          className={`min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 ${dashboardScrollbarClass}`}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {taskDashboardItems.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                layout="position"
                layoutDependency={`${item.done}-${item.label}`}
                variants={highlightedListItemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ layout: motionSpring.layout }}
                onClick={() => handleToggleStatus(item.id)}
                className="group flex w-full items-center gap-4 rounded-2xl py-1 text-left active:scale-[0.99]"
                aria-label={`${item.done ? "Tandai belum selesai" : "Tandai selesai"}: ${item.label}`}
                aria-pressed={item.done}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-[border-color,background-color,color,transform] duration-150 group-active:scale-90 ${
                    item.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-blue-200 text-blue-600 group-hover:border-blue-500 dark:border-blue-400/30 dark:text-blue-300"
                  }`}
                >
                  <AnimatePresence initial={false}>
                    {item.done && (
                      <motion.span
                        variants={popVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                      >
                        <Check className="h-5 w-5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className={`min-w-0 flex-1 truncate text-lg font-semibold transition-[color,opacity,text-decoration-color] duration-150 ${
                  item.done
                    ? "text-slate-500 line-through decoration-current dark:text-zinc-400"
                    : "text-slate-900 decoration-transparent dark:text-zinc-100"
                }`}>
                  {item.label}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center">
          {renderDashboardEmptyState(
            "Selesai semua",
            "Tidak ada tugas untuk hari ini, besok, atau nanti. Istirahat sejenak atau tambahkan tugas.",
            {
              label: "Tambah tugas",
              onClick: () =>
                handleOpenAddTask(new Date().toISOString().split("T")[0]),
            },
          )}
        </div>
      )}
    </section>
  );

  const renderGoalsCard = () => {
    const goalToggleClass = (active: boolean) =>
      `rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
        active
          ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-300 dark:text-[#101713]"
          : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-400/10 dark:text-indigo-300 dark:hover:bg-indigo-400/15"
      }`;

    return (
      <section
        className={`${dashboardCardClass} flex max-h-[21rem] flex-col p-5 xl:p-6`}
      >
        <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
          <h2 className={dashboardSectionTitle}>Progres tujuan</h2>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setGoalDashboardVisibility((prev) => ({
                    ...prev,
                    savings: !prev.savings,
                  }))
                }
                className={goalToggleClass(goalDashboardVisibility.savings)}
                aria-pressed={goalDashboardVisibility.savings}
              >
                Tabungan
              </button>
              <button
                type="button"
                onClick={() =>
                  setGoalDashboardVisibility((prev) => ({
                    ...prev,
                    skills: !prev.skills,
                  }))
                }
                className={goalToggleClass(goalDashboardVisibility.skills)}
                aria-pressed={goalDashboardVisibility.skills}
              >
                Keterampilan
              </button>
            </div>
            <div className={dashboardIconClass}>
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
        </div>

        {visibleGoalDashboardItems.length > 0 ? (
          <div
            className={`min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 ${dashboardScrollbarClass}`}
          >
            {visibleGoalDashboardItems.map((goal, index) => (
              <div
                key={goal.id}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300">
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
                  {goal.showProgress && (
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <AnimatedProgress
                        value={goal.progress}
                        className="rounded-full bg-indigo-600 dark:bg-indigo-400"
                        label={`Progres ${goal.label}`}
                      />
                    </div>
                  )}
                  <div
                    className={`mt-1 truncate text-[11px] font-semibold ${dashboardMuted}`}
                  >
                    {goal.caption}
                  </div>
                </div>

                <div
                  className={`text-right font-black text-slate-900 dark:text-zinc-50 ${
                    goal.kind === "investment"
                      ? "max-w-[8rem] truncate text-xs xl:text-sm"
                      : "text-sm"
                  }`}
                >
                  {goal.valueLabel}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center">
            {goalDashboardItems.length > 0
              ? renderDashboardEmptyState(
                  "Tujuan disembunyikan",
                  "Aktifkan Tabungan atau Keterampilan untuk menampilkan kelompok tujuan.",
                )
              : renderDashboardEmptyState(
                  "Belum ada tujuan",
                  "Target tabungan, investasi, dan keterampilan akan tampil setelah ditambahkan.",
                  {
                    label: "Buka Plan",
                    onClick: () => {
                      setPlanSubTab("savings");
                      setActiveTab("plan");
                    },
                  },
                )}
          </div>
        )}
      </section>
    );
  };

  const renderRoutineCard = () => (
    <section
      className={`${dashboardCardClass} flex max-h-[21rem] flex-col p-5 xl:p-6`}
    >
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2 className={dashboardSectionTitle}>Rutinitas</h2>
        <div className={dashboardIconClass}>
          <CheckCircle2 className="h-5 w-5" />
        </div>
      </div>

      {routineDashboardItems.length > 0 ? (
        <>
          <div className="mb-4 flex shrink-0 items-end gap-2">
            <span className="text-4xl font-black text-indigo-700 dark:text-indigo-300">
              {routineDoneCount}
            </span>
            <span className="pb-1 text-2xl font-bold text-slate-500 dark:text-zinc-400">
              / {routineDashboardItems.length}
            </span>
            <span className={`pb-1 text-sm font-semibold ${dashboardMuted}`}>
              selesai hari ini
            </span>
          </div>

          <div
            className={`min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 ${dashboardScrollbarClass}`}
          >
            <AnimatePresence initial={false} mode="popLayout">
            {routineDashboardItems.map((routine) => (
              <motion.button
                key={routine.id}
                type="button"
                layout="position"
                layoutDependency={`${routine.done}-${routine.label}`}
                variants={highlightedListItemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ layout: motionSpring.layout }}
                onClick={() => handleToggleStatus(routine.sourceId)}
                className="flex w-full items-center gap-2.5 rounded-xl text-left active:scale-[0.99]"
                aria-label={`${routine.done ? "Tandai rutinitas belum selesai" : "Selesaikan rutinitas"}: ${routine.label}`}
                aria-pressed={routine.done}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-[border-color,background-color,color,transform] duration-150 active:scale-90 ${
                    routine.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-blue-300 text-transparent dark:border-blue-300/40"
                  }`}
                >
                  <Check className="h-3 w-3" />
                </div>
                <span className={`truncate text-sm font-medium transition-[color,opacity,text-decoration-color] duration-150 ${
                  routine.done
                    ? "text-slate-500 line-through decoration-current dark:text-zinc-400"
                    : "text-slate-700 decoration-transparent dark:text-zinc-200"
                }`}>
                  {routine.label}
                </span>
              </motion.button>
            ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 items-center">
          {renderDashboardEmptyState(
            "Belum ada rutinitas hari ini",
            "Rutinitas harian, mingguan, bulanan, atau tahunan akan tampil di sini.",
            {
              label: "Buka Plan",
              onClick: () => {
                setPlanSubTab("tasks");
                setActiveTab("plan");
              },
            },
          )}
        </div>
      )}
    </section>
  );

  const renderMoneyCard = () => (
    <section
      onClick={() => setActiveTab("money")}
      className={`${dashboardCardClass} cursor-pointer p-5 transition-transform active:scale-[0.995] xl:p-6`}
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className={dashboardSectionTitle}>Ringkasan uang</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowBalance(!showBalance);
            }}
            className="rounded-full bg-blue-50 p-2 text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/15"
            aria-label={hideSensitiveMoney ? "Tampilkan saldo" : "Sembunyikan saldo"}
          >
            {!hideSensitiveMoney ? (
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
            Kekayaan bersih
          </p>
          <div className="truncate text-xl font-black text-blue-700 dark:text-blue-300">
            <AnimatedNumber
              value={totalNetWorth}
              formatter={fmt}
              hidden={hideSensitiveMoney}
              hiddenLabel="••••••••"
              ariaLabel="Kekayaan bersih"
            />
          </div>
        </div>

        <div className="sm:px-4">
          <p className={`mb-2 text-xs font-semibold ${dashboardMuted}`}>
            Pengeluaran bulanan
          </p>
          <div className="truncate text-xl font-black text-blue-700 dark:text-blue-300">
            <AnimatedNumber
              value={totalExpense}
              formatter={fmt}
              hidden={hideSensitiveMoney}
              hiddenLabel="••••••"
              ariaLabel="Pengeluaran bulanan"
            />
          </div>
        </div>

        <div className="sm:pl-4">
          <p className={`mb-2 text-xs font-semibold ${dashboardMuted}`}>
            Tingkat tabungan
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
          <div className={dashboardKicker}>Pencapaian mingguan</div>
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

  const renderDesktopDashboard = () => (
    <motion.div
      data-swipe-tabs="summary"
      className="hidden w-full min-w-0 max-w-full overflow-x-hidden lg:block lg:mt-6"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={swipeHandlers.onTouchEnd}
      style={{ x: swipeHandlers.dragOffset }}
      initial={false}
    >
      <div className={dashboardShellClass}>
        {renderFinanceCommandHero()}

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(19rem,0.75fr)] xl:items-start">
          <div className="min-w-0 space-y-4">
            {renderPrimaryFinanceInsight()}
            <div className="grid gap-4 2xl:grid-cols-2">
              {renderRecentTransactions()}
              {renderTasksCard()}
            </div>
          </div>
          <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Konteks keuangan dan tujuan">
            {renderUpcomingFinance()}
            {renderGoalsCard()}
          </aside>
        </div>

        <details className="group mt-4 rounded-[24px] bg-surface/70 ring-1 ring-inset ring-border/65">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-sm font-semibold marker:content-none">
            <span>
              Ruang personal
              <span className="ml-2 text-xs font-normal text-muted">
                Misi bulanan, rutinitas, dan progres mingguan
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-4 border-t border-border/65 p-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.7fr)]">
            {renderHeroCard(true)}
            <div className="space-y-4">
              {renderRoutineCard()}
              {renderWeeklyWinCard()}
            </div>
          </div>
        </details>
      </div>
    </motion.div>
  );

  const renderMobileDashboard = () => (
    <motion.div
      data-swipe-tabs="summary"
      className="mt-3 w-full min-w-0 max-w-full space-y-4 overflow-x-hidden lg:hidden"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={swipeHandlers.onTouchEnd}
      style={{ x: swipeHandlers.dragOffset }}
      initial={false}
    >
      {renderFinanceCommandHero()}
      {renderPrimaryFinanceInsight()}
      {renderUpcomingFinance()}
      {renderGoalsCard()}
      {renderTasksCard()}
      {renderRecentTransactions()}

      <details className="group rounded-[24px] bg-surface/70 ring-1 ring-inset ring-border/65">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-semibold marker:content-none">
          <span>Ruang personal</span>
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-border/65 p-3">
          {renderHeroCard(true)}
          {renderRoutineCard()}
          {renderWeeklyWinCard()}
        </div>
      </details>
    </motion.div>
  );

  return (
    <div className={contentSurface.summaryPageShell}>
      {isDesktopDashboard ? renderDesktopDashboard() : renderMobileDashboard()}
      {renderDashboardOverlays()}
    </div>
  );
};

export default SummaryView;
