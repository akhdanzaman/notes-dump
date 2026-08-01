import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "motion/react";
import {
  EyeOff,
  Eye,
  TrendingUp,
  TrendingDown,
  Wallet as WalletIcon,
  List,
  PieChart,
  Pencil,
  Trash2,
  PiggyBank,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  Target,
  X,
  SearchX,
  WifiOff,
  ReceiptText,
  ArrowRightLeft,
  Banknote,
} from "lucide-react";
import {
  BrainDumpItem,
  Wallet,
  BudgetConfig,
  MoneyView,
  AppSettings,
  SortOrder,
  FinanceType,
  ItemType,
  Tab,
  Priority,
  ReceiptCaptureMeta,
} from "../../types";
import { getWalletStats, getFinanceItems } from "../../utils/selectors";
import Card from "../Card";
import { useSwipeTabs } from "../../hooks/useSwipeTabs";
import ActiveIndicator from "../../motion/ActiveIndicator";
import AnimatedNumber from "../../motion/AnimatedNumber";
import { useSwipeDate } from "../../hooks/useSwipeDate";
import { useLazyItems } from "../../hooks/useLazyItems";
import LoadMoreButton from "../LoadMoreButton";
import { contentSurface } from "../layout/contentSurface";
import {
  getBudgetCategoryAnalytics,
  getBudgetTrendAnalytics,
  getWeekBounds,
  type BudgetAnalyticsViewMode,
  type BudgetCommodityBreakdown,
} from "../../utils/budgetAnalytics";
import { getCanonicalOrRawItemValue } from "../../utils/canonicalization/accessors";
import { getTransactionCategoryIds } from "../../utils/transactionLineItems";
import {
  sanitizeTransactionLineItems,
  sumTransactionLineItems,
} from "../../utils/transactionLineItems";
import {
  budgetThresholdVariants,
  directionalLabelVariants,
} from "../../motion/variants";
import { motionTransition } from "../../motion/transitions";
import PresencePanel from "../../motion/PresencePanel";
import { getSavedAmountForGoal } from "../../utils/savingTransactionUtils";
import { getAppLocale, normalizeAppLanguage } from "../../utils/i18n";

interface MoneyViewProps {
  items: BrainDumpItem[];
  wallets: Wallet[];
  budgetConfig: BudgetConfig;
  moneyView: MoneyView;
  setMoneyView: (view: MoneyView) => void;
  financeDate: Date;
  setFinanceDate: (d: Date) => void;
  showBalance: boolean;
  setShowBalance: (val: boolean) => void;
  appSettings: AppSettings;

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
    newRoutineInterval?: "daily" | "weekly" | "monthly" | "yearly",
    newRoutineDaysOfWeek?: number[],
    newRoutineDaysOfMonth?: number[],
    newRoutineMonthsOfYear?: number[],
    newSavingGoalId?: string,
    newDedicatedWalletId?: string,
    newPriority?: Priority,
  ) => void;
  handleUpdateReceiptCapture: (id: string, capture: ReceiptCaptureMeta | null) => void;
  handleToggleStatus: (id: string) => void;
  handleOpenEditWallet: (w: Wallet) => void;
  handleOpenAddWallet: () => void;
  setDeleteId: (id: string) => void;
  setDeleteType: (type: "skill" | "wallet" | null) => void;
  setIsSettingsOpen: (val: boolean) => void;

  // Filters
  filterWallet: string;
  filterTransactionType: string;
  filterCategory: string;
  filterMinAmount: string;
  filterMaxAmount: string;
  selectedTag: string;
  searchQuery: string;
  sortOrder: SortOrder;
  syncError?: string | null;
  clearFinanceFilter?: (
    filter:
      | "wallet"
      | "type"
      | "category"
      | "amount"
      | "tag"
      | "search",
  ) => void;
  clearAllFinanceFilters?: () => void;
  savingGoals: BrainDumpItem[];
  setActiveTab: (tab: Tab) => void;
  onAddItem: (type: ItemType) => void;
}

const MoneyViewComponent: React.FC<MoneyViewProps> = ({
  items,
  wallets,
  budgetConfig,
  moneyView,
  setMoneyView,
  financeDate,
  setFinanceDate,
  showBalance,
  setShowBalance,
  appSettings,
  handleDelete,
  handleUpdateItem,
  handleUpdateReceiptCapture,
  handleToggleStatus,
  handleOpenEditWallet,
  handleOpenAddWallet,
  setDeleteId,
  setDeleteType,
  setIsSettingsOpen,
  filterWallet,
  filterTransactionType,
  filterCategory,
  filterMinAmount,
  filterMaxAmount,
  selectedTag,
  searchQuery,
  sortOrder,
  syncError,
  clearFinanceFilter,
  clearAllFinanceFilters,
  savingGoals,
  setActiveTab,
  onAddItem,
}) => {
  const isEnglish = normalizeAppLanguage(appSettings.language) === "en";
  const moneyCopy = isEnglish ? {
    sections: "Money sections", wallets: "Wallets", transactions: "Transactions", budget: "Budget",
    netWorth: "Current net worth", netWorthHelper: "Assets minus debt and active savings allocations",
    showAmounts: "Show all amounts", hideAmounts: "Hide all amounts", income: "Income", expense: "Expense", used: "Used",
    assets: "Assets", debt: "Debt", savings: "Savings", recordTransaction: "Record transaction",
    previousMonth: "Previous month", nextMonth: "Next month", previousWeek: "Previous week", nextWeek: "Next week",
    previousYear: "Previous year", nextYear: "Next year", monthly: "Month", weekly: "Week", yearly: "Year",
    offline: "Offline mode", offlineHelper: "Showing data saved on this device. Changes will sync when the connection returns.",
    syncCheck: "Sync needs attention", totalNetWorth: "Total net worth", totalIncome: "Total income", totalExpense: "Total expense",
    totalAssets: "Total assets", totalDebt: "Total debt", totalSavings: "Total savings",
  } : {
    sections: "Bagian Uang", wallets: "Wallet", transactions: "Transaksi", budget: "Budget",
    netWorth: "Kekayaan bersih saat ini", netWorthHelper: "Aset dikurangi utang dan alokasi tabungan aktif",
    showAmounts: "Tampilkan seluruh nominal", hideAmounts: "Sembunyikan seluruh nominal", income: "Pemasukan", expense: "Pengeluaran", used: "Terpakai",
    assets: "Aset", debt: "Utang", savings: "Tabungan", recordTransaction: "Catat transaksi",
    previousMonth: "Bulan sebelumnya", nextMonth: "Bulan berikutnya", previousWeek: "Minggu sebelumnya", nextWeek: "Minggu berikutnya",
    previousYear: "Tahun sebelumnya", nextYear: "Tahun berikutnya", monthly: "Bulan", weekly: "Minggu", yearly: "Tahun",
    offline: "Mode offline", offlineHelper: "Menampilkan data yang tersimpan di perangkat. Perubahan akan disinkronkan saat koneksi kembali.",
    syncCheck: "Sinkronisasi perlu diperiksa", totalNetWorth: "Total kekayaan bersih", totalIncome: "Total pemasukan", totalExpense: "Total pengeluaran",
    totalAssets: "Total aset", totalDebt: "Total utang", totalSavings: "Total tabungan",
  };
  const locale = getAppLocale(appSettings.language);
  // Main Tab Swipe Logic
  const swipeHandlers = useSwipeTabs("money", setActiveTab);
  const reduceMotion = useReducedMotion();

  const [budgetViewMode, setBudgetViewMode] =
    useState<BudgetAnalyticsViewMode>("monthly");
  const [periodDirection, setPeriodDirection] = useState(0);

  // Date Swipe Logic
  const changePeriod = (offset: number) => {
    const newDate = new Date(financeDate);
    const requestedDay = newDate.getDate();
    if (moneyView === "budget" && budgetViewMode === "yearly") {
      newDate.setDate(1);
      newDate.setFullYear(newDate.getFullYear() + offset);
      const lastDay = new Date(
        newDate.getFullYear(),
        newDate.getMonth() + 1,
        0,
      ).getDate();
      newDate.setDate(Math.min(requestedDay, lastDay));
    } else if (moneyView === "budget" && budgetViewMode === "weekly") {
      newDate.setDate(newDate.getDate() + offset * 7);
    } else {
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + offset);
      const lastDay = new Date(
        newDate.getFullYear(),
        newDate.getMonth() + 1,
        0,
      ).getDate();
      newDate.setDate(Math.min(requestedDay, lastDay));
    }
    setPeriodDirection(Math.sign(offset));
    setFinanceDate(newDate);
  };

  const dateSwipeHandlers = useSwipeDate(
    () => changePeriod(-1), // Swipe Right -> Prev Period
    () => changePeriod(1), // Swipe Left -> Next Period
  );

  // Sub-Tab Swipe State
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(
    null,
  );
  const [hoveredAnatomySegment, setHoveredAnatomySegment] = useState<{
    categoryId: string;
    commodityName: string;
  } | null>(null);
  const [hoveredCommodityBox, setHoveredCommodityBox] = useState<string | null>(
    null,
  );
  const [selectedTransaction, setSelectedTransaction] =
    useState<BrainDumpItem | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (
      selectedTransaction &&
      !items.some((item) => item.id === selectedTransaction.id)
    ) {
      setSelectedTransaction(null);
    }
  }, [items, selectedTransaction]);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const tabs: MoneyView[] = ["wallets", "transactions", "budget"];
  const activeIndex = tabs.indexOf(moneyView);

  // Calculate Data for All Views
  const {
    walletStats,
    totalNetWorth,
    totalAssets,
    totalDebt,
    totalSavings: walletTotalSavings,
  } = getWalletStats(items, wallets);

  const {
    list,
    totalIncome,
    totalExpense,
    projectedExpense,
    totalSavings: periodSavings,
    totalBudgetUsed,
    projectedBudgetUsed,
    budgetMap,
    plannedBudgetMap,
    uncategorized,
    projectedUncategorized,
  } = getFinanceItems(
    items,
    financeDate,
    budgetConfig,
    filterWallet,
    filterTransactionType,
    filterCategory,
    filterMinAmount,
    filterMaxAmount,
    selectedTag,
    searchQuery,
    sortOrder,
    budgetViewMode,
    wallets,
  );
  const previousComparableDate = new Date(financeDate);
  const comparableDay = previousComparableDate.getDate();
  if (budgetViewMode === "yearly") {
    previousComparableDate.setDate(1);
    previousComparableDate.setFullYear(previousComparableDate.getFullYear() - 1);
    const lastComparableDay = new Date(
      previousComparableDate.getFullYear(),
      previousComparableDate.getMonth() + 1,
      0,
    ).getDate();
    previousComparableDate.setDate(Math.min(comparableDay, lastComparableDay));
  } else if (budgetViewMode === "weekly") {
    previousComparableDate.setDate(previousComparableDate.getDate() - 7);
  } else {
    previousComparableDate.setDate(1);
    previousComparableDate.setMonth(previousComparableDate.getMonth() - 1);
    const lastComparableDay = new Date(
      previousComparableDate.getFullYear(),
      previousComparableDate.getMonth() + 1,
      0,
    ).getDate();
    previousComparableDate.setDate(Math.min(comparableDay, lastComparableDay));
  }
  const { totalExpense: previousComparableExpense } = getFinanceItems(
    items,
    previousComparableDate,
    budgetConfig,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "newest",
    budgetViewMode,
    wallets,
  );

  const visibleWallets = useLazyItems(walletStats, {
    resetKey: "money-wallets",
  });
  const visibleTransactions = useLazyItems(list, {
    resetKey: `money-transactions-${budgetViewMode}-${financeDate.toISOString()}-${filterWallet}-${filterTransactionType}-${filterCategory}-${filterMinAmount}-${filterMaxAmount}-${selectedTag}-${searchQuery}-${sortOrder}`,
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);
  const canShowAmounts = showBalance && !appSettings.hideMoney;
  const walletTypeLabel: Record<Wallet["type"], string> = {
    cash: isEnglish ? "Cash" : "Tunai",
    bank: isEnglish ? "Bank account" : "Rekening bank",
    ewallet: isEnglish ? "Digital wallet" : "Dompet digital",
    cc: isEnglish ? "Credit card" : "Kartu kredit",
    investment: isEnglish ? "Investment" : "Investasi",
  };
  const financeTypeLabel: Record<FinanceType, string> = {
    expense: moneyCopy.expense,
    income: moneyCopy.income,
    transfer: "Transfer",
    saving: moneyCopy.savings,
    saving_withdrawal: isEnglish ? "Savings withdrawal" : "Penarikan tabungan",
    loan_out: isEnglish ? "Money lent" : "Dana dipinjamkan",
    loan_in: isEnglish ? "Loan received" : "Pinjaman diterima",
    loan_repayment_in: isEnglish ? "Repayment received" : "Pelunasan diterima",
    loan_repayment_out: isEnglish ? "Repayment paid" : "Pelunasan dibayar",
    achieved_goal: isEnglish ? "Goal achieved" : "Target tercapai",
  };

  const effectiveIncome =
    budgetConfig.monthlyIncome > 0
      ? budgetViewMode === "yearly"
        ? budgetConfig.monthlyIncome * 12
        : budgetViewMode === "weekly"
          ? (budgetConfig.monthlyIncome * 12) / 52
          : budgetConfig.monthlyIncome
      : totalIncome;
  const incomeLabel =
    budgetConfig.monthlyIncome > 0
      ? budgetViewMode === "yearly"
        ? (isEnglish ? "Fixed yearly income" : "Pemasukan tetap tahunan")
        : budgetViewMode === "weekly"
          ? (isEnglish ? "Fixed weekly income" : "Pemasukan tetap mingguan")
          : (isEnglish ? "Fixed income" : "Pemasukan tetap")
      : (isEnglish ? "Recorded income" : "Pemasukan tercatat");
  const activeFilters = [
    filterWallet
      ? { key: "wallet" as const, label: `Wallet: ${filterWallet}` }
      : null,
    filterTransactionType
      ? {
          key: "type" as const,
          label: `Tipe: ${
            financeTypeLabel[filterTransactionType as FinanceType] ||
            filterTransactionType
          }`,
        }
      : null,
    filterCategory
      ? { key: "category" as const, label: `Kategori: ${filterCategory}` }
      : null,
    filterMinAmount || filterMaxAmount
      ? {
          key: "amount" as const,
          label: canShowAmounts
            ? `Nominal: ${filterMinAmount || "0"} sampai ${
                filterMaxAmount || "tanpa batas"
              }`
            : "Nominal: ••••",
        }
      : null,
    selectedTag
      ? { key: "tag" as const, label: `#${selectedTag}` }
      : null,
    searchQuery
      ? { key: "search" as const, label: `Cari: ${searchQuery}` }
      : null,
  ].filter(
    (
      filter,
    ): filter is {
      key: "wallet" | "type" | "category" | "amount" | "tag" | "search";
      label: string;
    } => !!filter,
  );
  const hasActiveTransactionFilters = activeFilters.length > 0;

  const walletGroups = useMemo(() => {
    const groups = [
      {
        id: "cash",
        label: "Kas & e-wallet",
        helper: "Dana yang siap digunakan",
        wallets: walletStats.filter(
          (wallet) => wallet.type === "cash" || wallet.type === "ewallet",
        ),
      },
      {
        id: "bank",
        label: "Rekening bank",
        helper: "Saldo pada rekening utama",
        wallets: walletStats.filter((wallet) => wallet.type === "bank"),
      },
      {
        id: "investment",
        label: "Tabungan & investasi",
        helper: "Dana khusus dan nilai investasi",
        wallets: walletStats.filter((wallet) => wallet.type === "investment"),
      },
      {
        id: "credit",
        label: "Kredit & utang",
        helper: "Kewajiban yang perlu diselesaikan",
        wallets: walletStats.filter((wallet) => wallet.type === "cc"),
      },
    ];
    const visibleIds = new Set(
      visibleWallets.visibleItems.map((wallet) => wallet.id),
    );
    return groups
      .map((group) => ({
        ...group,
        wallets: group.wallets.filter((wallet) => visibleIds.has(wallet.id)),
      }))
      .filter((group) => group.wallets.length > 0);
  }, [visibleWallets.visibleItems, walletStats]);

  const transactionGroups = useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
    const groups = new Map<
      string,
      { label: string; date: Date; items: BrainDumpItem[] }
    >();

    visibleTransactions.visibleItems.forEach((item) => {
      const date = new Date(
        item.meta.date || item.completed_at || item.created_at,
      );
      const safeDate = Number.isNaN(date.getTime()) ? new Date(0) : date;
      const key = `${safeDate.getFullYear()}-${safeDate.getMonth()}-${safeDate.getDate()}`;
      const label =
        key === todayKey
          ? "Hari ini"
          : key === yesterdayKey
            ? "Kemarin"
            : safeDate.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });
      const current = groups.get(key) || { label, date: safeDate, items: [] };
      current.items.push(item);
      groups.set(key, current);
    });

    return Array.from(groups.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
  }, [visibleTransactions.visibleItems]);

  const periodBounds = useMemo(() => {
    if (budgetViewMode === "yearly") {
      return {
        start: new Date(financeDate.getFullYear(), 0, 1),
        end: new Date(financeDate.getFullYear() + 1, 0, 1),
      };
    }
    if (budgetViewMode === "weekly") return getWeekBounds(financeDate);
    return {
      start: new Date(financeDate.getFullYear(), financeDate.getMonth(), 1),
      end: new Date(financeDate.getFullYear(), financeDate.getMonth() + 1, 1),
    };
  }, [budgetViewMode, financeDate]);
  const periodElapsedPercent = (() => {
    const now = Date.now();
    const start = periodBounds.start.getTime();
    const end = periodBounds.end.getTime();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return ((now - start) / Math.max(end - start, 1)) * 100;
  })();
  const budgetRemaining =
    effectiveIncome - totalBudgetUsed - projectedBudgetUsed;
  const safeToSpend = Math.max(0, budgetRemaining);
  const actualUsagePercent =
    effectiveIncome > 0 ? (totalBudgetUsed / effectiveIncome) * 100 : 0;
  const plannedUsagePercent =
    effectiveIncome > 0 ? (projectedBudgetUsed / effectiveIncome) * 100 : 0;
  const expenseComparisonPercent =
    previousComparableExpense > 0
      ? ((totalExpense - previousComparableExpense) /
          previousComparableExpense) *
        100
      : null;
  const budgetDecision =
    effectiveIncome <= 0
      ? {
          label: "Belum dapat dihitung",
          detail: "Tambahkan pemasukan agar status budget dapat dijelaskan.",
          tone: "info" as const,
        }
      : budgetRemaining < 0
        ? {
            label: "Berpotensi melewati budget",
            detail: canShowAmounts
              ? `${fmt(Math.abs(budgetRemaining))} di atas batas termasuk rencana.`
              : "Nominal disembunyikan. Aktual dan rencana melewati batas.",
            tone: "warning" as const,
          }
        : actualUsagePercent + plannedUsagePercent >
            periodElapsedPercent + 15
          ? {
              label: "Laju pengeluaran lebih cepat",
              detail: `${(actualUsagePercent + plannedUsagePercent).toFixed(0)}% budget terpakai saat ${periodElapsedPercent.toFixed(0)}% periode berjalan.`,
              tone: "warning" as const,
            }
          : {
              label: "Masih sesuai rencana",
              detail: `${(actualUsagePercent + plannedUsagePercent).toFixed(0)}% budget terpakai saat ${periodElapsedPercent.toFixed(0)}% periode berjalan.`,
              tone: "positive" as const,
            };
  const monthUsagePercent =
    effectiveIncome > 0 ? (totalBudgetUsed / effectiveIncome) * 100 : 0;
  const previousBudgetUsageRef = useRef<number | null>(null);
  const [budgetAttentionSequence, setBudgetAttentionSequence] = useState(0);

  useEffect(() => {
    const previous = previousBudgetUsageRef.current;
    if (previous !== null && previous < 100 && monthUsagePercent >= 100) {
      setBudgetAttentionSequence((sequence) => sequence + 1);
    }
    previousBudgetUsageRef.current = monthUsagePercent;
  }, [monthUsagePercent]);

  const monthUsageWithPlannedPercent =
    effectiveIncome > 0
      ? Math.min(
          999,
          ((totalBudgetUsed + projectedBudgetUsed) / effectiveIncome) * 100,
        )
      : 0;
  const budgetCategoryAnalytics = useMemo(
    () =>
      getBudgetCategoryAnalytics(
        items,
        financeDate,
        budgetConfig,
        budgetViewMode,
      ),
    [items, financeDate, budgetConfig, budgetViewMode],
  );
  const budgetTrendAnalytics = useMemo(
    () =>
      getBudgetTrendAnalytics(items, financeDate, budgetViewMode, budgetConfig),
    [items, financeDate, budgetViewMode, budgetConfig],
  );
  const selectedPeriodTotal = budgetTrendAnalytics.reduce(
    (sum, point) => sum + point.total,
    0,
  );
  const previousPeriodTotal = budgetTrendAnalytics.reduce(
    (sum, point) => sum + (point.previousTotal || 0),
    0,
  );
  const peakTrendPoint = budgetTrendAnalytics.reduce(
    (peak, point) => (point.total > peak.total ? point : peak),
    budgetTrendAnalytics[0] || {
      label: "—",
      total: 0,
      income: 0,
      percentage: 0,
      categories: [],
    },
  );
  const hoveredTrendPoint =
    hoveredTrendIndex !== null
      ? budgetTrendAnalytics[hoveredTrendIndex]
      : undefined;
  const weekBounds = useMemo(() => getWeekBounds(financeDate), [financeDate]);
  const periodTitle =
    budgetViewMode === "yearly"
      ? String(financeDate.getFullYear())
      : budgetViewMode === "weekly"
        ? `${weekBounds.start.toLocaleDateString(locale, { month: "short", day: "numeric" })}–${new Date(weekBounds.end.getTime() - 86400000).toLocaleDateString(locale, { month: "short", day: "numeric" })}`
        : financeDate.toLocaleDateString(locale, { month: "short" });
  const periodKicker =
    budgetViewMode === "yearly"
      ? moneyCopy.yearly
      : budgetViewMode === "weekly"
        ? financeDate.getFullYear().toString()
        : financeDate.getFullYear().toString();
  const hoveredTrendLabel = hoveredTrendPoint
    ? budgetViewMode === "yearly"
      ? `${hoveredTrendPoint.label} ${financeDate.getFullYear()}`
      : budgetViewMode === "weekly"
        ? `${hoveredTrendPoint.label}, ${new Date(weekBounds.start.getFullYear(), weekBounds.start.getMonth(), weekBounds.start.getDate() + (hoveredTrendIndex || 0)).toLocaleDateString(locale, { month: "short", day: "numeric" })}`
        : `${hoveredTrendPoint.label} ${financeDate.toLocaleDateString(locale, { month: "short", year: "numeric" })}`
    : undefined;
  const hoveredTrendTooltipLeft =
    hoveredTrendIndex !== null && budgetTrendAnalytics.length > 0
      ? Math.min(
          86,
          Math.max(
            14,
            ((hoveredTrendIndex + 0.5) / budgetTrendAnalytics.length) * 100,
          ),
        )
      : 50;
  const trendMaxAmount = Math.max(
    ...budgetTrendAnalytics.flatMap((point) => [
      point.total,
      point.income,
      Math.abs(point.income - point.total),
      point.previousTotal || 0,
      point.previousIncome || 0,
    ]),
    0,
  );
  const topSpendBreakdowns = useMemo(() => {
    const commodityTotals = new Map<
      string,
      {
        total: number;
        count: number;
        subcommodities: Map<string, { total: number; count: number }>;
        transactions: BudgetCommodityBreakdown["transactions"];
      }
    >();
    const subcommodityTotals = new Map<string, number>();
    budgetCategoryAnalytics.forEach((category) => {
      category.commodities.forEach((commodity) => {
        const current = commodityTotals.get(commodity.name) || {
          total: 0,
          count: 0,
          subcommodities: new Map<string, { total: number; count: number }>(),
          transactions: [],
        };
        current.total += commodity.total;
        current.count += commodity.count;
        current.transactions.push(...commodity.transactions);
        commodity.subcommodities.forEach((sub) => {
          current.subcommodities.set(sub.name, {
            total:
              (current.subcommodities.get(sub.name)?.total || 0) + sub.total,
            count:
              (current.subcommodities.get(sub.name)?.count || 0) + sub.count,
          });
          subcommodityTotals.set(
            sub.name,
            (subcommodityTotals.get(sub.name) || 0) + sub.total,
          );
        });
        commodityTotals.set(commodity.name, current);
      });
    });
    const commodities = Array.from(commodityTotals.entries())
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        count: stats.count,
        percentage:
          totalBudgetUsed > 0 ? (stats.total / totalBudgetUsed) * 100 : 0,
        subcommodities: Array.from(stats.subcommodities.entries())
          .map(([subName, subStats]) => ({
            name: subName,
            total: subStats.total,
            count: subStats.count,
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 4),
        transactions: stats.transactions
          .slice()
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 6),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    const subcommodities = Array.from(subcommodityTotals.entries())
      .map(([name, total]) => ({
        name,
        total,
        percentage: totalBudgetUsed > 0 ? (total / totalBudgetUsed) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    return { commodities, subcommodities };
  }, [budgetCategoryAnalytics, totalBudgetUsed]);
  const commodityOptions = useMemo(() => {
    const optionMap = new Map<string, Set<string>>();
    items.forEach((item) => {
      const isTransactionLike =
        item.type === ItemType.FINANCE ||
        item.type === ItemType.SHOPPING ||
        item.type === ItemType.TODO;
      if (!isTransactionLike) return;
      const commodity =
        getCanonicalOrRawItemValue(item, "commodity") || item.meta.commodity;
      const subcommodity =
        getCanonicalOrRawItemValue(item, "subcommodity") ||
        item.meta.subcommodity;
      if (!commodity) return;
      if (!optionMap.has(commodity)) optionMap.set(commodity, new Set());
      if (subcommodity) optionMap.get(commodity)!.add(subcommodity);
    });

    return Array.from(optionMap.entries()).map(([name, subcommodities]) => ({
      name,
      subcommodities: Array.from(subcommodities).sort((a, b) =>
        a.localeCompare(b),
      ),
    }));
  }, [items]);
  const budgetInsightCards = useMemo(() => {
    const cards: {
      title: string;
      detail: string;
      tone: "red" | "amber" | "emerald" | "indigo";
    }[] = [];
    const overspent = budgetConfig.rules
      .map((rule) => {
        const limit = effectiveIncome * (rule.percentage / 100);
        const spent = budgetMap.get(rule.id) || 0;
        return { rule, limit, spent, over: spent - limit };
      })
      .filter((row) => row.limit > 0 && row.over > 0)
      .sort((a, b) => b.over - a.over);
    if (overspent[0]) {
      cards.push({
        title: `${overspent.length} kategori melewati budget`,
        detail: `${overspent[0].rule.name} paling tinggi, melewati ${fmt(overspent[0].over)}.`,
        tone: "red",
      });
    }
    const plannedRisk = budgetConfig.rules
      .map((rule) => {
        const limit = effectiveIncome * (rule.percentage / 100);
        const spent = budgetMap.get(rule.id) || 0;
        const planned = plannedBudgetMap.get(rule.id) || 0;
        return { rule, limit, spent, planned, over: spent + planned - limit };
      })
      .filter((row) => row.limit > 0 && row.planned > 0 && row.over > 0)
      .sort((a, b) => b.over - a.over);
    if (plannedRisk[0]) {
      cards.push({
        title: "Pengeluaran terencana perlu dipantau",
        detail: `${plannedRisk[0].rule.name} berpotensi melewati ${fmt(plannedRisk[0].over)} termasuk rencana.`,
        tone: "amber",
      });
    }
    if (topSpendBreakdowns.commodities[0]) {
      cards.push({
        title: `${topSpendBreakdowns.commodities[0].name} menjadi pendorong terbesar`,
        detail: `${topSpendBreakdowns.commodities[0].percentage.toFixed(0)}% dari pengeluaran periode ini.`,
        tone: "indigo",
      });
    }
    if (projectedExpense > 0) {
      cards.push({
        title: "Rencana sudah diperhitungkan",
        detail: `${fmt(projectedExpense)} pengeluaran terencana ditampilkan dengan pola amber.`,
        tone: "emerald",
      });
    }
    return cards.slice(0, 3);
  }, [
    budgetConfig.rules,
    budgetMap,
    effectiveIncome,
    fmt,
    plannedBudgetMap,
    projectedExpense,
    topSpendBreakdowns.commodities,
  ]);
  const getAnatomySegmentLeft = (
    commodities: BudgetCommodityBreakdown[],
    index: number,
  ) => {
    const previousWidth = commodities
      .slice(0, index)
      .reduce((sum, commodity) => sum + commodity.percentage, 0);
    const center = previousWidth + (commodities[index]?.percentage || 0) / 2;
    return Math.min(88, Math.max(12, center));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
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
      if ((activeIndex === 0 && dx > 0) || (activeIndex === 2 && dx < 0)) {
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
      if (dragOffset < 0 && activeIndex < 2) {
        setMoneyView(tabs[activeIndex + 1]);
      }
      if (dragOffset > 0 && activeIndex > 0) {
        setMoneyView(tabs[activeIndex - 1]);
      }
    }

    setDragOffset(0);
    touchStartRef.current = null;
    isHorizontalSwipe.current = null;
  };

  const cardProps = {
    onUpdate: handleUpdateItem,
    onUpdateReceiptCapture: handleUpdateReceiptCapture,
    onDelete: handleDelete,
    onToggleStatus: handleToggleStatus,
    enableCollapse: true,
    defaultCollapsed: appSettings.defaultCollapsed,
    hideMoney: !canShowAmounts,
    wallets,
    budgetRules: budgetConfig.rules,
    savingGoals,
    commodityOptions,
    noStrikethrough: true,
    noDarken: true,
  };

  const renderMoneyTabs = () => {
    const tabConfig: Array<{
      id: MoneyView;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = [
      { id: "wallets", label: moneyCopy.wallets, icon: WalletIcon },
      { id: "transactions", label: moneyCopy.transactions, icon: List },
      { id: "budget", label: moneyCopy.budget, icon: PieChart },
    ];
    return (
      <LayoutGroup id="money-subtabs">
        <div
          data-money-tabs="true"
          className={contentSurface.workspaceTabList}
          role="tablist"
          aria-label={moneyCopy.sections}
        >
          {tabConfig.map((tab) => {
            const isActive = moneyView === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`money-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`money-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setMoneyView(tab.id)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                    return;
                  event.preventDefault();
                  const direction = event.key === "ArrowRight" ? 1 : -1;
                  const nextIndex =
                    (tabs.indexOf(tab.id) + direction + tabs.length) %
                    tabs.length;
                  setMoneyView(tabs[nextIndex]);
                  window.requestAnimationFrame(() =>
                    document
                      .getElementById(`money-tab-${tabs[nextIndex]}`)
                      ?.focus(),
                  );
                }}
                className={`${contentSurface.workspaceTabButton} flex-1 ${
                  isActive
                    ? "text-primary"
                    : "text-muted hover:bg-black/[0.035] hover:text-primary dark:hover:bg-white/[0.055]"
                }`}
              >
                {isActive && (
                  <ActiveIndicator className={contentSurface.workspaceTabIndicator} />
                )}
                <span className="relative z-10 flex min-w-0 items-center gap-1 sm:gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    );
  };

  const renderBudgetDecisionSummary = () => (
    <section
      className="rounded-[28px] bg-surface p-5 shadow-sm ring-1 ring-inset ring-border/70 sm:p-6"
      aria-labelledby="budget-decision-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
            Status budget · {periodTitle} {periodKicker}
          </div>
          <h2
            id="budget-decision-title"
            className="mt-1 text-xl font-semibold tracking-[-0.025em] sm:text-2xl"
          >
            Apakah pengeluaran periode ini masih terkendali?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {budgetDecision.detail}
          </p>
        </div>
        <span
          data-finance-status={budgetDecision.tone}
          className="rounded-full bg-surface-soft px-3 py-2 text-xs font-semibold"
        >
          {budgetDecision.label}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          {
            label: "Aktual",
            value: totalBudgetUsed,
            tone: "negative",
            helper: `${actualUsagePercent.toFixed(0)}% dari dasar`,
          },
          {
            label: "Terencana",
            value: projectedBudgetUsed,
            tone: "warning",
            helper: `${plannedUsagePercent.toFixed(0)}% dari dasar`,
          },
          {
            label: "Sisa budget",
            value: budgetRemaining,
            tone: budgetRemaining >= 0 ? "positive" : "negative",
            helper: budgetRemaining >= 0 ? "Setelah rencana" : "Melewati batas",
          },
          {
            label: "Aman dibelanjakan",
            value: safeToSpend,
            tone: "info",
            helper: "Perkiraan konservatif",
          },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl bg-surface-soft p-3.5 sm:p-4">
            <div className="text-[11px] font-semibold text-muted">{metric.label}</div>
            <div
              data-financial-amount="true"
              data-finance-status={metric.tone}
              className="mt-1 truncate text-lg font-semibold sm:text-xl"
            >
              <AnimatedNumber
                value={metric.value}
                formatter={fmt}
                hidden={!canShowAmounts}
                hiddenLabel="••••"
                ariaLabel={metric.label}
              />
            </div>
            <div className="mt-1 text-[10px] text-muted">{metric.helper}</div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div
          className="flex h-3 overflow-hidden rounded-full bg-border/65"
          role="img"
          aria-label={`Pengeluaran aktual ${actualUsagePercent.toFixed(0)} persen, terencana ${plannedUsagePercent.toFixed(0)} persen, periode berjalan ${periodElapsedPercent.toFixed(0)} persen`}
        >
          <motion.div
            initial={false}
            animate={{ width: `${Math.min(actualUsagePercent, 100)}%` }}
            transition={
              reduceMotion
                ? motionTransition.instant
                : motionTransition.standard
            }
            className="h-full bg-indigo-600"
          />
          <motion.div
            initial={false}
            animate={{
              width: `${Math.min(
                plannedUsagePercent,
                Math.max(0, 100 - Math.min(actualUsagePercent, 100)),
              )}%`,
            }}
            transition={
              reduceMotion
                ? motionTransition.instant
                : motionTransition.standard
            }
            data-planned-fill="true"
            className="h-full bg-amber-500 text-amber-700 dark:bg-amber-400 dark:text-amber-100"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted">
          <span>
            <strong className="font-semibold text-primary">
              {periodElapsedPercent.toFixed(0)}%
            </strong>{" "}
            waktu periode telah berjalan
          </span>
          {expenseComparisonPercent !== null && (
            <span
              data-finance-status={
                expenseComparisonPercent > 0 ? "warning" : "positive"
              }
              className="font-semibold"
            >
              Pengeluaran {expenseComparisonPercent >= 0 ? "naik" : "turun"}{" "}
              {Math.abs(expenseComparisonPercent).toFixed(0)}% dibanding periode
              lalu
            </span>
          )}
          <span>
            Dasar: {incomeLabel}
          </span>
        </div>
      </div>
    </section>
  );

  return (
    <div className={contentSurface.pageShell}>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 dark:bg-amber-400/[0.08] dark:text-amber-200 dark:ring-amber-300/15"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">{moneyCopy.offline}</div>
            <div className="mt-0.5 text-xs opacity-80">
              {moneyCopy.offlineHelper}
            </div>
          </div>
        </div>
      )}
      {syncError && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-inset ring-red-200 dark:bg-red-400/[0.08] dark:text-red-200 dark:ring-red-300/15"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">{moneyCopy.syncCheck}</div>
            <div className="mt-0.5 line-clamp-2 text-xs opacity-80">{syncError}</div>
          </div>
        </div>
      )}
      {/* Top Container */}
      <motion.div
        data-swipe-tabs="money"
        className={`${contentSurface.headerHero} bg-surface`}
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
          {renderMoneyTabs()}
          <div className="lg:space-y-6" data-money-header-grid="true">
            <div className="mb-6 grid grid-cols-1 gap-4 pb-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start lg:mb-0 lg:grid-cols-8 lg:gap-4 lg:pb-3 xl:gap-5">
              <div className="min-w-0 lg:col-span-6 lg:pt-1">
                <div className="text-xs font-semibold text-muted">{moneyCopy.netWorth}</div>
                <div className="mt-1 text-xs text-muted">
                  {moneyCopy.netWorthHelper}
                </div>
                <div className="mt-2 flex min-w-0 items-center gap-3 lg:mt-3">
                  <div data-financial-amount="true" className="truncate text-3xl font-semibold tracking-[-0.045em] sm:text-4xl lg:text-[2.75rem]">
                    <AnimatedNumber
                      value={totalNetWorth}
                      formatter={fmt}
                      hidden={!canShowAmounts}
                      hiddenLabel="••••••••"
                      ariaLabel={moneyCopy.totalNetWorth}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBalance(!canShowAmounts)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-soft text-muted transition-colors hover:text-primary"
                    aria-label={canShowAmounts ? moneyCopy.hideAmounts : moneyCopy.showAmounts}
                    aria-pressed={!canShowAmounts}
                  >
                    {canShowAmounts ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <div
                data-swipe-date="money-month"
                className={`${contentSurface.workspacePeriodControl} lg:col-span-2 lg:w-full`}
                onTouchStart={dateSwipeHandlers.onTouchStart}
                onTouchMove={dateSwipeHandlers.onTouchMove}
                onTouchEnd={dateSwipeHandlers.onTouchEnd}
              >
                <div className="flex items-center justify-between gap-1 lg:gap-2">
                  <button
                    onClick={() => changePeriod(-1)}
                    className={contentSurface.workspacePeriodButton}
                    aria-label={
                      budgetViewMode === "yearly"
                        ? moneyCopy.previousYear
                        : budgetViewMode === "weekly"
                          ? moneyCopy.previousWeek
                          : moneyCopy.previousMonth
                    }
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <AnimatePresence mode="wait" custom={periodDirection} initial={false}>
                    <motion.div
                      key={`${budgetViewMode}-${financeDate.toISOString()}`}
                      data-money-month-label="true"
                      custom={periodDirection}
                      variants={directionalLabelVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className={contentSurface.workspacePeriodLabel}
                    >
                      <span className={contentSurface.workspacePeriodKicker}>
                        {periodKicker}
                      </span>
                      <span className={contentSurface.workspacePeriodTitle}>
                        {periodTitle}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                  <button
                    onClick={() => changePeriod(1)}
                    className={contentSurface.workspacePeriodButton}
                    aria-label={
                      budgetViewMode === "yearly"
                        ? moneyCopy.nextYear
                        : budgetViewMode === "weekly"
                          ? moneyCopy.nextWeek
                          : moneyCopy.nextMonth
                    }
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {moneyView === "budget" && (
                  <div className="mt-2 grid cursor-pointer grid-cols-3 gap-1 rounded-lg bg-surface-soft/80 p-1">
                    {(
                      [
                        ["monthly", moneyCopy.monthly],
                        ["weekly", moneyCopy.weekly],
                        ["yearly", moneyCopy.yearly],
                      ] as [BudgetAnalyticsViewMode, string][]
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setPeriodDirection(0);
                          setBudgetViewMode(mode);
                        }}
                        aria-pressed={budgetViewMode === mode}
                        className={`${budgetViewMode === mode ? "bg-indigo-600 text-white shadow-sm" : "text-muted hover:text-primary"} min-h-11 rounded-md px-2 py-1 text-xs font-semibold transition-colors`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-8 gap-3 mb-4 lg:mb-5 lg:gap-4 xl:gap-5">
              <div className="col-span-3 min-w-0 rounded-2xl border border-border/70 bg-background/55 px-3 py-4 lg:px-5 lg:py-5">
                <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted lg:mb-2">
                  <TrendingUp className="w-4 h-4 shrink-0 text-emerald-500" />{" "}
                  {moneyCopy.income}
                </div>
                <div data-financial-amount="true" data-finance-status="positive" className="truncate text-lg font-semibold lg:text-2xl">
                  <AnimatedNumber
                    value={totalIncome}
                    formatter={fmt}
                    hidden={!canShowAmounts}
                    hiddenLabel="••••"
                    ariaLabel={moneyCopy.totalIncome}
                  />
                </div>
              </div>
              <div className="col-span-3 min-w-0 rounded-2xl border border-border/70 bg-background/55 px-3 py-4 lg:px-5 lg:py-5">
                <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted lg:mb-2">
                  <TrendingDown className="w-4 h-4 shrink-0" data-finance-status="negative" />{" "}
                  {moneyCopy.expense}
                </div>
                <div data-financial-amount="true" data-finance-status="negative" className="truncate text-lg font-semibold lg:text-2xl">
                  <AnimatedNumber
                    value={totalExpense}
                    formatter={fmt}
                    hidden={!canShowAmounts}
                    hiddenLabel="••••"
                    ariaLabel={moneyCopy.totalExpense}
                  />
                </div>
              </div>
              <div className="relative col-span-2 min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-background/55 px-3 py-4 lg:px-5 lg:py-5">
                {budgetAttentionSequence > 0 && (
                  <motion.span
                    key={budgetAttentionSequence}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-amber-500/70"
                    variants={budgetThresholdVariants}
                    initial="hidden"
                    animate="visible"
                  />
                )}
                <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-muted lg:mb-2 lg:justify-start lg:text-xs">
                  <AlertCircle className="hidden w-4 h-4 shrink-0 text-amber-700 dark:text-amber-300 lg:block" />{" "}
                  {moneyCopy.used}
                </div>
                <div className="flex items-baseline justify-center gap-1 truncate lg:justify-start">
                  <span className="truncate text-lg font-bold text-primary lg:text-2xl">
                    {effectiveIncome > 0
                      ? `${monthUsagePercent.toFixed(0)}%`
                      : "—"}
                  </span>
                  {effectiveIncome > 0 && projectedBudgetUsed > 0 && (
                    <>
                      <span className="text-sm font-bold text-muted/50 lg:text-base">
                        |
                      </span>
                      <span className="truncate text-sm font-semibold leading-tight text-amber-700 dark:text-amber-300 lg:text-base">{`${monthUsageWithPlannedPercent.toFixed(0)}%`}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div
              className="flex flex-wrap gap-4 pt-4 border-t border-border items-center justify-between"
              data-money-header-side-card="true"
            >
              <div className="flex gap-4">
                <div className="text-sm font-medium opacity-80">
                  {moneyCopy.assets}:{" "}
                  <span className="text-emerald-600 dark:text-emerald-500 font-bold">
                    <AnimatedNumber value={totalAssets} formatter={fmt} hidden={!canShowAmounts} hiddenLabel="••" ariaLabel={moneyCopy.totalAssets} />
                  </span>
                </div>
                <div className="text-sm font-medium opacity-80">
                  {moneyCopy.debt}:{" "}
                  <span className="font-bold text-red-700 dark:text-red-300">
                    <AnimatedNumber value={totalDebt} formatter={fmt} hidden={!canShowAmounts} hiddenLabel="••" ariaLabel={moneyCopy.totalDebt} />
                  </span>
                </div>
                <div className="text-sm font-medium opacity-80 flex items-center gap-1">
                  {moneyCopy.savings}:{" "}
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                    <AnimatedNumber value={walletTotalSavings || 0} formatter={fmt} hidden={!canShowAmounts} hiddenLabel="••" ariaLabel={moneyCopy.totalSavings} />
                  </span>
                </div>
              </div>
              <button
                onClick={() => onAddItem(ItemType.FINANCE)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm transition-colors hover:bg-indigo-500"
                aria-label={moneyCopy.recordTransaction}
                title={moneyCopy.recordTransaction}
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Sliding Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: motionTransition.standard,
        }}
        className="touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <motion.div
          className={`flex w-full ${isDragging ? "will-change-transform" : ""}`}
          style={{
            transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
            transition: isDragging
              ? "none"
              : "transform 0.22s cubic-bezier(0.2, 0, 0, 1)",
          }}
        >
          {/* VIEW: Wallets */}
          <motion.div
            id="money-panel-wallets"
            role="tabpanel"
            aria-labelledby="money-tab-wallets"
            aria-hidden={moneyView !== "wallets"}
            inert={moneyView !== "wallets"}
            initial={false}
            className={`w-full flex-shrink-0 ${contentSurface.contentPad} ${moneyView !== "wallets" ? "pointer-events-none" : ""}`}
          >
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Kelompok wallet">
              {walletGroups.map((group) => (
                <span
                  key={group.id}
                  className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-surface px-3 text-[11px] font-semibold text-muted ring-1 ring-inset ring-border/70"
                >
                  {group.label} · {group.wallets.length}
                </span>
              ))}
            </div>
            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 no-scrollbar lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 xl:grid-cols-3">
              {visibleWallets.visibleItems.map((wallet) => (
                <div
                  key={wallet.id}
                  className="group relative min-w-[82%] snap-center rounded-[24px] bg-surface p-4 shadow-sm ring-1 ring-inset ring-border/65 transition-colors hover:bg-surface/80 sm:min-w-[46%] lg:min-w-0"
                >
                  <div className="flex flex-col gap-1">
                    {/* Header */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 rounded-full ${wallet.color} flex items-center justify-center text-white`}
                        >
                          {wallet.type === "bank" ? (
                            <PiggyBank className="w-3 h-3" />
                          ) : wallet.type === "cc" ? (
                            <CreditCard className="w-3 h-3" />
                          ) : wallet.type === "ewallet" ? (
                            <WalletIcon className="w-3 h-3" />
                          ) : (
                            <WalletIcon className="w-3 h-3" />
                          )}
                        </div>
                        <span className="text-sm font-semibold text-primary opacity-70">
                          {walletTypeLabel[wallet.type]}
                        </span>
                      </div>

                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleOpenEditWallet(wallet)}
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-muted/10 hover:text-primary"
                          aria-label={`Ubah wallet ${wallet.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteId(wallet.id);
                            setDeleteType("wallet");
                          }}
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                          aria-label={`Hapus wallet ${wallet.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex justify-between items-start gap-4 mt-1">
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="text-base font-medium text-primary truncate">
                          {wallet.name}
                        </div>
                        {wallet.type === "cc" && (
                          <div className="mt-1">
                            <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Akun utang
                            </span>
                          </div>
                        )}
                        {(() => {
                          const walletSavings = savingGoals
                            .filter((g) => g.status !== "done")
                            .filter(
                              (g) => g.meta.dedicatedWalletId === wallet.id,
                            )
                            .reduce(
                              (sum, goal) =>
                                sum + getSavedAmountForGoal(items, goal.id),
                              0,
                            );

                          if (walletSavings > 0) {
                            return (
                              <div className="mt-1">
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Tabungan:{" "}
                                  {canShowAmounts ? fmt(walletSavings) : "••••"}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {wallet.lentAmount > 0 && (
                          <div className="mt-1">
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                              Dipinjamkan:{" "}
                              {canShowAmounts ? fmt(wallet.lentAmount) : "••••"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div data-financial-amount="true" className="mt-0.5 shrink-0 text-base font-semibold text-primary">
                        {canShowAmounts ? fmt(wallet.currentBalance) : "••••••••"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <LoadMoreButton
                remainingCount={visibleWallets.remainingCount}
                onClick={visibleWallets.loadMore}
              />

              <button
                type="button"
                onClick={handleOpenAddWallet}
                className="flex min-h-14 min-w-[82%] snap-center items-center justify-center gap-2 rounded-[24px] border border-dashed border-border p-4 text-muted transition-colors hover:border-primary/30 hover:bg-surface/50 hover:text-primary sm:min-w-[46%] lg:min-w-0"
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Tambah wallet</span>
              </button>
            </div>
          </motion.div>

          {/* VIEW: Transactions */}
          <motion.div
            key={"transactions-" + financeDate.toISOString()}
            id="money-panel-transactions"
            role="tabpanel"
            aria-labelledby="money-tab-transactions"
            aria-hidden={moneyView !== "transactions"}
            inert={moneyView !== "transactions"}
            initial={false}
            className={`w-full flex-shrink-0 ${contentSurface.contentPad} ${moneyView !== "transactions" ? "pointer-events-none" : ""}`}
          >
            <div
              className={contentSurface.moneyWorkspaceGrid}
              data-money-workspace="transactions"
            >
              {list.length === 0 ? (
                <div
                  className={`${contentSurface.emptyStateCard} ${contentSurface.moneyPrimaryPanel}`}
                >
                  {hasActiveTransactionFilters ? (
                    <>
                      <SearchX className="mx-auto h-7 w-7 text-muted" />
                      <h2 className="mt-3 text-base font-semibold">
                        Tidak ada hasil yang cocok
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        Ubah kata kunci atau hapus beberapa filter aktif.
                      </p>
                      {clearAllFinanceFilters && (
                        <button
                          type="button"
                          onClick={clearAllFinanceFilters}
                          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
                        >
                          Hapus semua filter
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <ReceiptText className="mx-auto h-7 w-7 text-muted" />
                      <h2 className="mt-3 text-base font-semibold">
                        Belum ada transaksi
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        Catat transaksi pertama lewat composer atau tombol tambah.
                      </p>
                      <button
                        type="button"
                        onClick={() => onAddItem(ItemType.FINANCE)}
                        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
                      >
                        <Plus className="h-4 w-4" />
                        Catat transaksi
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div
                  className={`${contentSurface.denseList} ${contentSurface.moneyPrimaryPanel}`}
                  data-money-primary-column="true"
                >
                  <div className="space-y-5">
                    {transactionGroups.map((group) => (
                      <section key={group.label} aria-labelledby={`transaction-group-${group.date.getTime()}`}>
                        <div className="mb-2 flex items-center justify-between gap-3 px-1">
                          <h2
                            id={`transaction-group-${group.date.getTime()}`}
                            className="text-xs font-semibold capitalize text-muted"
                          >
                            {group.label}
                          </h2>
                          <span className="text-[10px] text-muted">
                            {group.items.length} transaksi
                          </span>
                        </div>
                        <div className="overflow-hidden rounded-[24px] bg-surface shadow-sm ring-1 ring-inset ring-border/65">
                          {group.items.map((item) => {
                            const financeType = item.meta.financeType || "expense";
                            const transactionCategoryIds =
                              getTransactionCategoryIds(item);
                            const categoryName =
                              transactionCategoryIds.length > 1
                                ? `${transactionCategoryIds.length} kategori`
                                : budgetConfig.rules.find(
                                    (rule) =>
                                      rule.id ===
                                      (transactionCategoryIds[0] ||
                                        item.meta.budgetCategory),
                                  )?.name ||
                                  transactionCategoryIds[0] ||
                                  item.meta.budgetCategory ||
                                  "Belum berkategori";
                            const lineItems = sanitizeTransactionLineItems(
                              item.meta.transactionLineItems,
                            );
                            const amount = lineItems.length
                              ? sumTransactionLineItems(lineItems)
                              : item.meta.amount || 0;
                            const sourceWallet = wallets.find(
                              (wallet) =>
                                wallet.id === item.meta.paymentMethod ||
                                wallet.name.toLowerCase() ===
                                  item.meta.paymentMethod?.toLowerCase(),
                            );
                            const isIncome =
                              financeType === "income" ||
                              financeType === "loan_in" ||
                              financeType === "loan_repayment_in";
                            const isTransfer =
                              financeType === "transfer" ||
                              financeType === "saving" ||
                              financeType === "saving_withdrawal";
                            const isLoan = financeType.startsWith("loan_");
                            const TransactionIcon = isIncome
                              ? TrendingUp
                              : isTransfer
                                ? ArrowRightLeft
                                : isLoan
                                  ? Banknote
                                  : TrendingDown;
                            const typeLabel =
                              financeTypeLabel[financeType as FinanceType] ||
                              "Pengeluaran";
                            const needsCategory =
                              !isIncome &&
                              !isTransfer &&
                              !isLoan &&
                              transactionCategoryIds.length === 0;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedTransaction(item)}
                                className="group flex min-h-[72px] w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left last:border-b-0 sm:px-4"
                                aria-label={`Buka detail ${item.meta.merchant || item.content}`}
                              >
                                <span
                                  data-finance-status={
                                    isIncome
                                      ? "positive"
                                      : isTransfer
                                        ? "info"
                                        : "negative"
                                  }
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-soft"
                                >
                                  <TransactionIcon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold">
                                    {item.meta.merchant || item.content}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                                    {categoryName}
                                    {" · "}
                                    {sourceWallet?.name ||
                                      item.meta.paymentMethod ||
                                      "Wallet belum dipilih"}
                                  </span>
                                  <span className="mt-1 flex flex-wrap gap-1.5">
                                    <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[9px] font-semibold text-muted">
                                      {typeLabel}
                                    </span>
                                    {item.status === "pending" && (
                                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-800 dark:text-amber-300">
                                        Terencana
                                      </span>
                                    )}
                                    {item.meta.receiptCapture && (
                                      <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[9px] font-semibold text-indigo-700 dark:text-indigo-300">
                                        Ada nota
                                      </span>
                                    )}
                                    {needsCategory && (
                                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold text-red-700 dark:text-red-300">
                                        Perlu kategori
                                      </span>
                                    )}
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span
                                    data-financial-amount="true"
                                    data-finance-status={
                                      isIncome
                                        ? "positive"
                                        : isTransfer
                                          ? "info"
                                          : "negative"
                                    }
                                    className="block text-sm font-semibold"
                                  >
                                    {canShowAmounts
                                      ? `${isIncome ? "+" : isTransfer ? "" : "−"}${fmt(amount)}`
                                      : "••••"}
                                  </span>
                                  <span className="mt-1 block text-[10px] text-muted">
                                    Detail
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                  <LoadMoreButton
                    remainingCount={visibleTransactions.remainingCount}
                    onClick={visibleTransactions.loadMore}
                    className="mt-4"
                  />
                </div>
              )}
              <aside
                className={contentSurface.moneySideCard}
                data-money-side-card="filters"
              >
                <div className="mb-3 text-xs font-semibold text-primary">
                  Filter transaksi
                </div>
                {activeFilters.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {activeFilters.map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => clearFinanceFilter?.(filter.key)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-surface px-3 text-left text-xs font-semibold text-primary ring-1 ring-inset ring-border/70"
                        aria-label={`Hapus filter ${filter.label}`}
                      >
                        <span className="truncate">{filter.label}</span>
                        <X className="h-3.5 w-3.5 shrink-0 text-muted" />
                      </button>
                    ))}
                    {clearAllFinanceFilters && (
                      <button
                        type="button"
                        onClick={clearAllFinanceFilters}
                        className="min-h-11 w-full rounded-xl text-xs font-semibold text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-300"
                      >
                        Hapus semua
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <span>Wallet</span>
                    <strong className="text-primary">
                      {filterWallet || "Semua"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Tipe</span>
                    <strong className="text-primary capitalize">
                      {filterTransactionType
                        ? financeTypeLabel[
                            filterTransactionType as FinanceType
                          ] || filterTransactionType
                        : "Semua"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Kategori</span>
                    <strong className="text-primary">
                      {filterCategory || "Semua"}
                    </strong>
                  </div>
                  {(filterMinAmount || filterMaxAmount) && (
                    <div className="flex justify-between gap-3">
                      <span>Nominal</span>
                      <strong className="text-primary">
                        {canShowAmounts
                          ? `${filterMinAmount || "0"} sampai ${
                              filterMaxAmount || "tanpa batas"
                            }`
                          : "••••"}
                      </strong>
                    </div>
                  )}
                  {selectedTag && (
                    <div className="flex justify-between gap-3">
                      <span>Tag</span>
                      <strong className="text-primary">#{selectedTag}</strong>
                    </div>
                  )}
                  {searchQuery && (
                    <div className="flex justify-between gap-3">
                      <span>Pencarian</span>
                      <strong className="text-primary truncate">
                        {searchQuery}
                      </strong>
                    </div>
                  )}
                </div>
                <div className="mt-4 border-t border-border pt-4 text-xs leading-relaxed">
                  Gunakan tombol pencarian mengambang untuk mengubah filter.
                </div>
              </aside>
            </div>
          </motion.div>

          {/* VIEW: Budget Dashboard */}
          <motion.div
            key={"budget-" + financeDate.toISOString()}
            id="money-panel-budget"
            role="tabpanel"
            aria-labelledby="money-tab-budget"
            aria-hidden={moneyView !== "budget"}
            inert={moneyView !== "budget"}
            initial={false}
            className={`w-full flex-shrink-0 ${contentSurface.contentPad} pb-8 ${moneyView !== "budget" ? "pointer-events-none" : ""}`}
          >
            {effectiveIncome === 0 ? (
              <div className="text-center p-6 bg-surface border border-border rounded-3xl">
                <PiggyBank className="w-8 h-8 text-muted mx-auto mb-2" />
                <p className="text-sm text-muted">
                  Atur <strong>pemasukan bulanan</strong> di Pengaturan <br />
                  atau catat pemasukan untuk melihat kondisi budget.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="mt-4 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-semibold hover:bg-primary/20"
                >
                  Atur pemasukan
                </button>
              </div>
            ) : (
              <div className="space-y-6 text-primary">
                {renderBudgetDecisionSummary()}
                <div className="bg-surface border border-border rounded-[32px] p-6 text-primary">
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight">
                        Bagaimana arus kas berubah dalam periode ini?
                      </h2>
                      <div className="mt-1 text-sm font-semibold text-muted">
                        {budgetViewMode === "yearly"
                          ? "Pemasukan, pengeluaran, dan arus bersih per bulan"
                          : budgetViewMode === "weekly"
                            ? "Pemasukan, pengeluaran, dan arus bersih per hari"
                            : "Pemasukan, pengeluaran, dan arus bersih per hari"}
                      </div>
                    </div>
                    <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted dark:bg-white/10">
                      {budgetViewMode === "yearly" ? "Per bulan" : "Per hari"}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                        {budgetViewMode === "yearly"
                          ? "Tren tahunan"
                          : budgetViewMode === "weekly"
                            ? "Tren mingguan"
                            : "Tren bulanan"}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-primary">
                        {canShowAmounts ? fmt(selectedPeriodTotal) : "••••"}
                      </div>
                      <div className="mt-2 text-xs leading-snug text-muted">
                        Ringkasan pemasukan, pengeluaran, dan sisa pada periode
                        ini.
                      </div>
                      <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted">Pemasukan</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-500">
                            {canShowAmounts ? fmt(totalIncome) : "••••"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted">Pengeluaran</span>
                          <span className="font-bold text-red-700 dark:text-red-300">
                            {canShowAmounts ? fmt(totalExpense) : "••••"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted">Arus bersih</span>
                          <span
                            className={`font-bold ${totalIncome - totalExpense >= 0 ? "text-indigo-700 dark:text-indigo-300" : "text-red-700 dark:text-red-300"}`}
                          >
                            {canShowAmounts
                              ? fmt(totalIncome - totalExpense)
                              : "••••"}
                          </span>
                        </div>
                        {projectedBudgetUsed > 0 && (
                          <div className="text-right">
                            <div className="text-muted text-sm mb-1 font-medium">
                              Terencana
                            </div>
                            <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                              {canShowAmounts ? fmt(projectedBudgetUsed) : "••••"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative min-h-64 rounded-3xl border border-border bg-white/60 p-4 dark:bg-black/10">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-4 font-semibold text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                            Pemasukan
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-400"></span>
                            Pengeluaran
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                            Arus bersih
                          </span>
                          {budgetViewMode === "yearly" &&
                            previousPeriodTotal > 0 && (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-amber-400/70"></span>
                                {financeDate.getFullYear() - 1}
                              </span>
                            )}
                        </div>
                        <div className="font-semibold text-muted">
                          Puncak{" "}
                          <span className="text-primary">
                            {peakTrendPoint.label}
                          </span>
                        </div>
                      </div>

                      {hoveredTrendPoint && (
                        <div
                          className="pointer-events-none absolute top-12 z-20 w-64 -translate-x-1/2 rounded-2xl border border-border bg-surface/95 p-3 text-xs shadow-xl shadow-black/10 backdrop-blur dark:shadow-black/30"
                          style={{ left: `${hoveredTrendTooltipLeft}%` }}
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-primary">
                                {hoveredTrendLabel}
                              </div>
                              {budgetViewMode === "yearly" &&
                                hoveredTrendPoint.previousTotal !==
                                  undefined && (
                                  <div className="mt-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                    Pengeluaran sebelumnya{" "}
                                    {canShowAmounts
                                      ? fmt(hoveredTrendPoint.previousTotal)
                                      : "••••"}
                                    {hoveredTrendPoint.previousIncome !==
                                    undefined
                                      ? ` · pemasukan ${canShowAmounts ? fmt(hoveredTrendPoint.previousIncome) : "••••"}`
                                      : ""}
                                  </div>
                                )}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-600 dark:text-emerald-500">
                                {canShowAmounts
                                  ? fmt(hoveredTrendPoint.income)
                                  : "••••"}
                              </div>
                              <div className="font-bold text-red-700 dark:text-red-300">
                                {canShowAmounts
                                  ? fmt(hoveredTrendPoint.total)
                                  : "••••"}
                              </div>
                              <div className="font-bold text-indigo-700 dark:text-indigo-300">
                                {canShowAmounts
                                  ? fmt(
                                      hoveredTrendPoint.income -
                                        hoveredTrendPoint.total,
                                    )
                                  : "••••"}
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-border pt-2">
                            <div className="mb-1 font-bold uppercase tracking-[0.14em] text-muted">
                              Kategori
                            </div>
                            {hoveredTrendPoint.categories.length > 0 ? (
                              <div className="space-y-1">
                                {hoveredTrendPoint.categories.map(
                                  (category) => (
                                    <div
                                      key={`${hoveredTrendLabel}-${category.name}`}
                                      className="flex items-center justify-between gap-2"
                                    >
                                      <span className="truncate text-muted">
                                        {category.name}
                                      </span>
                                      <span className="shrink-0 font-bold text-primary">
                                        {canShowAmounts
                                          ? fmt(category.total)
                                          : "••••"}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <div className="text-muted">
                                Tidak ada pengeluaran kategori
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="relative flex h-44 items-end gap-1 overflow-hidden px-1 pb-5 pt-4">
                        <div className="pointer-events-none absolute inset-x-0 top-4 h-px border-t border-dashed border-border"></div>
                        <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px border-t border-dashed border-border"></div>
                        <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px border-t border-dashed border-border"></div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-5 h-px border-t border-border"></div>
                        {budgetTrendAnalytics.map((point, index) => {
                          const showLabel =
                            budgetViewMode === "yearly" ||
                            budgetViewMode === "weekly" ||
                            index === 0 ||
                            index ===
                              Math.floor(budgetTrendAnalytics.length / 2) ||
                            index === budgetTrendAnalytics.length - 1;
                          const isHovered = hoveredTrendIndex === index;
                          const netAmount = point.income - point.total;
                          const scale = (amount: number) =>
                            trendMaxAmount > 0
                              ? Math.max(
                                  Math.min(
                                    (Math.abs(amount) / trendMaxAmount) * 100,
                                    100,
                                  ),
                                  amount !== 0 ? 4 : 0,
                                )
                              : 0;
                          return (
                            <button
                              key={`${point.label}-${index}`}
                              type="button"
                              onMouseEnter={() => setHoveredTrendIndex(index)}
                              onMouseLeave={() => setHoveredTrendIndex(null)}
                              onFocus={() => setHoveredTrendIndex(index)}
                              onBlur={() => setHoveredTrendIndex(null)}
                              onClick={() =>
                                setHoveredTrendIndex((current) =>
                                  current === index ? null : index,
                                )
                              }
                              aria-pressed={isHovered}
                              aria-label={
                                canShowAmounts
                                  ? `${point.label}: pemasukan ${fmt(point.income)}, pengeluaran ${fmt(point.total)}, arus bersih ${fmt(netAmount)}`
                                  : `${point.label}: nominal disembunyikan`
                              }
                              className="group relative flex min-h-44 min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                            >
                              <div className="relative flex h-32 w-full items-end justify-center gap-0.5">
                                {budgetViewMode === "yearly" &&
                                  point.previousTotal !== undefined &&
                                  point.previousTotal > 0 && (
                                    <div
                                      className={`absolute bottom-0 w-full max-w-5 rounded-t-sm bg-amber-400/30 transition-all ${isHovered ? "bg-amber-400/60" : ""}`}
                                      style={{
                                        height: `${scale(point.previousTotal)}%`,
                                      }}
                                    />
                                  )}
                                <div
                                  className={`relative z-10 w-full max-w-2 rounded-t-sm bg-emerald-500 transition-all group-hover:max-w-2.5 ${isHovered ? "shadow-sm" : ""}`}
                                  style={{ height: `${scale(point.income)}%` }}
                                />
                                <div
                                  className={`relative z-10 w-full max-w-2 rounded-t-sm bg-red-600 transition-all group-hover:max-w-2.5 dark:bg-red-400 ${isHovered ? "shadow-sm" : ""}`}
                                  style={{ height: `${scale(point.total)}%` }}
                                />
                                <div
                                  className={`relative z-10 w-full max-w-2 rounded-t-sm bg-indigo-600 transition-all group-hover:max-w-2.5 ${isHovered ? "shadow-sm" : ""}`}
                                  style={{
                                    height: `${scale(netAmount)}%`,
                                    opacity: netAmount === 0 ? 0.25 : 1,
                                  }}
                                />
                              </div>
                              <div
                                className={`h-3 text-[9px] font-bold uppercase leading-none ${showLabel || isHovered ? "text-muted" : "text-transparent"}`}
                              >
                                {point.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p
                        className="mt-3 rounded-2xl bg-surface-soft p-3 text-xs leading-relaxed text-muted"
                        aria-live="polite"
                      >
                        {hoveredTrendPoint
                          ? canShowAmounts
                            ? `${hoveredTrendLabel}: pemasukan ${fmt(hoveredTrendPoint.income)}, pengeluaran ${fmt(hoveredTrendPoint.total)}, arus bersih ${fmt(hoveredTrendPoint.income - hoveredTrendPoint.total)}.`
                            : `${hoveredTrendLabel}: nominal disembunyikan.`
                          : canShowAmounts
                            ? `Total pengeluaran ${fmt(selectedPeriodTotal)}. Titik tertinggi berada pada ${peakTrendPoint.label}. Pilih batang untuk rincian.`
                            : `Titik pengeluaran tertinggi berada pada ${peakTrendPoint.label}. Pilih batang untuk rincian.`}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`grid gap-6 ${budgetCategoryAnalytics.length > 0 ? "lg:grid-cols-2 lg:items-start" : ""}`}
                >
                  <div className="bg-surface border border-border rounded-[32px] p-6 text-primary">
                    {/* Header */}
                    <div className="mb-8 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight">
                          Kategori mana yang perlu perhatian?
                        </h2>
                        <div className="mt-1 text-sm font-semibold text-muted">
                          {budgetConfig.rules.length} kategori · aktual solid, rencana berpola
                        </div>
                      </div>
                      <Target className="h-6 w-6 text-muted" />
                    </div>

                    {/* Basis Fixed Income & Planned Spending */}
                    <div className="flex justify-between items-end mb-8 pb-6 border-b border-border">
                      <div>
                        <div className="text-muted text-sm mb-1 font-medium">
                          Dasar: {incomeLabel}
                        </div>
                        <div className="text-xl font-bold">
                          {canShowAmounts ? fmt(effectiveIncome) : "••••"}
                        </div>
                      </div>
                      {projectedExpense > 0 && (
                        <div className="text-right">
                          <div className="text-muted text-sm mb-1 font-medium">
                            Terencana
                          </div>
                          <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                            {canShowAmounts ? fmt(projectedExpense) : "••••"}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Categories List */}
                    <div className="space-y-6">
                      {budgetConfig.rules?.map((rule) => {
                        const spent = budgetMap.get(rule.id) || 0;
                        const planned = plannedBudgetMap.get(rule.id) || 0;
                        const limit = effectiveIncome * (rule.percentage / 100);

                        const percentageOfCategorySpent =
                          limit > 0 ? (spent / limit) * 100 : 0;
                        const percentageOfCategoryPlanned =
                          limit > 0 ? (planned / limit) * 100 : 0;
                        const percentageOfCategoryUsedPlanned =
                          limit > 0 ? ((spent + planned) / limit) * 100 : 0;
                        const overAmount = Math.max(0, spent + planned - limit);

                        return (
                          <div key={rule.id}>
                            <div
                              className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary"
                            >
                              <div
                                className={`h-2 w-2 rounded-full ${rule.color || "bg-slate-500"}`}
                              ></div>
                              {rule.name}
                            </div>
                            <div
                              className="mb-2 flex items-center justify-between text-sm font-semibold text-primary"
                            >
                              <div>
                                <div>
                                  {percentageOfCategorySpent.toFixed(1)} %{" "}
                                  <span className="text-muted font-normal text-xs ml-1">
                                    ({canShowAmounts ? fmt(spent) : "•••"} /{" "}
                                    {canShowAmounts ? fmt(limit) : "•••"})
                                  </span>
                                </div>
                                {planned > 0 && (
                                  <div className="mt-0.5 text-[11px] font-semibold leading-tight text-amber-700 dark:text-amber-300">
                                    {percentageOfCategoryUsedPlanned.toFixed(1)}{" "}
                                    %
                                  </div>
                                )}
                                {overAmount > 0 && (
                                  <div className="mt-1 text-[11px] font-semibold text-red-700 dark:text-red-300">
                                    Melebihi {canShowAmounts ? fmt(overAmount) : "••••"} · {percentageOfCategoryUsedPlanned.toFixed(0)}%
                                  </div>
                                )}
                              </div>
                              {planned > 0 && (
                                <div className="text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                  Terencana: {canShowAmounts ? fmt(planned) : "••••"}
                                </div>
                              )}
                            </div>
                            <div
                              className="relative flex h-3 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
                              role="img"
                              aria-label={`${rule.name}: aktual ${percentageOfCategorySpent.toFixed(0)} persen, termasuk rencana ${percentageOfCategoryUsedPlanned.toFixed(0)} persen`}
                            >
                              <motion.div
                                className={`h-full ${rule.color || "bg-slate-500"}`}
                                initial={false}
                                animate={{
                                  width: `${Math.min(percentageOfCategorySpent, 100)}%`,
                                }}
                                transition={reduceMotion ? motionTransition.instant : motionTransition.standard}
                              />
                              {planned > 0 && (
                                <motion.div
                                  data-planned-fill="true"
                                  className={`h-full ${rule.color || "bg-slate-500"} opacity-40 bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] dark:bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)]`}
                                  initial={false}
                                  animate={{
                                    width: `${Math.min(percentageOfCategoryPlanned, 100 - Math.min(percentageOfCategorySpent, 100))}%`,
                                  }}
                                  transition={reduceMotion ? motionTransition.instant : motionTransition.standard}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Uncategorized */}
                      {(uncategorized > 0 || projectedUncategorized > 0) && (
                        <div className="pt-4 border-t border-border mt-4">
                          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted">
                            <div className="h-2 w-2 rounded-full bg-slate-500"></div>
                            Belum berkategori
                          </div>
                          <div className="mb-2 flex items-center justify-between text-sm font-bold text-muted">
                            <div>
                              <div>
                                {effectiveIncome > 0
                                  ? (
                                      (uncategorized / effectiveIncome) *
                                      100
                                    ).toFixed(1)
                                  : 0}{" "}
                                %{" "}
                                <span className="text-muted font-normal text-xs ml-1">
                                  ({canShowAmounts ? fmt(uncategorized) : "•••"})
                                </span>
                              </div>
                              {projectedUncategorized > 0 && (
                                <div className="mt-0.5 text-[11px] font-semibold leading-tight text-amber-700 dark:text-amber-300">
                                  {effectiveIncome > 0
                                    ? (
                                        ((uncategorized +
                                          projectedUncategorized) /
                                          effectiveIncome) *
                                        100
                                      ).toFixed(1)
                                    : 0}{" "}
                                  %
                                </div>
                              )}
                            </div>
                            {projectedUncategorized > 0 && (
                              <div className="text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                Terencana:{" "}
                                {canShowAmounts
                                  ? fmt(projectedUncategorized)
                                  : "•••"}
                              </div>
                            )}
                          </div>
                          <div className="h-3 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex">
                            <motion.div
                              className="h-full bg-slate-500"
                              initial={false}
                              animate={{
                                width: `${Math.min((uncategorized / effectiveIncome) * 100, 100)}%`,
                              }}
                              transition={reduceMotion ? motionTransition.instant : motionTransition.standard}
                            />
                            {projectedUncategorized > 0 && (
                              <motion.div
                                data-planned-fill="true"
                                className="h-full bg-slate-500 opacity-40 bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] dark:bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)]"
                                initial={false}
                                animate={{
                                  width: `${Math.min((projectedUncategorized / effectiveIncome) * 100, 100 - Math.min((uncategorized / effectiveIncome) * 100, 100))}%`,
                                }}
                                transition={reduceMotion ? motionTransition.instant : motionTransition.standard}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {budgetInsightCards.length > 0 && (
                      <div className="mt-8 border-t border-border pt-5">
                        <div className="mb-3 text-sm font-bold tracking-tight">
                          Tindakan yang disarankan
                        </div>
                        <div className="space-y-2">
                          {budgetInsightCards.map((card) => (
                            <div
                              key={card.title}
                              className="flex items-start gap-3 rounded-2xl bg-black/[0.03] p-3 text-xs dark:bg-white/[0.04]"
                            >
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${card.tone === "red" ? "bg-red-600 dark:bg-red-400" : card.tone === "amber" ? "bg-amber-500" : card.tone === "emerald" ? "bg-emerald-500" : "bg-indigo-600"}`}
                              ></span>
                              <div className="min-w-0">
                                <div className="font-bold text-primary">
                                  {card.title}
                                </div>
                                <div className="mt-0.5 leading-snug text-muted">
                                  {canShowAmounts
                                    ? card.detail
                                    : "Nominal disembunyikan dalam mode privasi."}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setMoneyView("transactions")}
                                  className="mt-2 min-h-11 rounded-lg px-3 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-300"
                                >
                                  Tinjau transaksi
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {budgetCategoryAnalytics.length > 0 && (
                    <div className="bg-surface border border-border rounded-[32px] p-6 text-primary">
                      <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-3xl font-bold tracking-tight">
                            Apa yang paling mendorong pengeluaran?
                          </h2>
                          <div className="mt-1 text-sm font-semibold text-muted">
                            Kategori → komoditas → subkomoditas
                          </div>
                        </div>
                        <PieChart className="h-6 w-6 text-muted" />
                      </div>

                      <div className="space-y-5">
                        {topSpendBreakdowns.commodities.length > 0 && (
                          <div>
                            <div className="mb-3 flex items-center justify-between gap-3 text-xs">
                              <span className="font-bold uppercase tracking-[0.16em] text-muted">
                                Berdasarkan komoditas
                              </span>
                              <span className="font-semibold text-muted">
                                Total{" "}
                                {canShowAmounts ? fmt(totalBudgetUsed) : "••••"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {topSpendBreakdowns.commodities.map(
                                (item, index) => {
                                  const colors = [
                                    "bg-emerald-700",
                                    "bg-indigo-700",
                                    "bg-slate-700",
                                    "bg-teal-700",
                                    "bg-amber-700",
                                    "bg-sky-700",
                                  ];
                                  const isHovered =
                                    hoveredCommodityBox === item.name;
                                  return (
                                    <div
                                      key={`commodity-${item.name}`}
                                      className="relative"
                                    >
                                      {isHovered && (
                                        <div className="pointer-events-none absolute left-1/2 top-0 z-30 w-72 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-2xl border border-border bg-surface/95 p-3 text-xs text-primary shadow-xl shadow-black/10 backdrop-blur dark:shadow-black/30">
                                          <div className="mb-2 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <div className="truncate font-bold capitalize text-primary">
                                                {item.name}
                                              </div>
                                              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                                                {item.count} transaksi
                                              </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                              <div className="font-bold text-primary">
                                                {item.percentage.toFixed(1)}%
                                              </div>
                                              <div className="font-semibold text-muted">
                                                {canShowAmounts
                                                  ? fmt(item.total)
                                                  : "••••"}
                                              </div>
                                            </div>
                                          </div>

                                          {item.subcommodities.length > 0 && (
                                            <div className="border-t border-border pt-2">
                                              <div className="mb-1 font-bold uppercase tracking-[0.14em] text-muted">
                                                Subkomoditas
                                              </div>
                                              <div className="space-y-1">
                                                {item.subcommodities
                                                  .slice(0, 4)
                                                  .map((sub) => (
                                                    <div
                                                      key={`${item.name}-${sub.name}`}
                                                      className="flex items-center justify-between gap-2"
                                                    >
                                                      <span className="truncate text-muted capitalize">
                                                        {sub.name} · {sub.count}
                                                        x
                                                      </span>
                                                      <span className="shrink-0 font-bold text-primary">
                                                        {canShowAmounts
                                                          ? fmt(sub.total)
                                                          : "••••"}
                                                      </span>
                                                    </div>
                                                  ))}
                                              </div>
                                            </div>
                                          )}

                                          {item.transactions.length > 0 && (
                                            <div className="mt-2 border-t border-border pt-2">
                                              <div className="mb-1 font-bold uppercase tracking-[0.14em] text-muted">
                                                Transaksi
                                              </div>
                                              <div className="max-h-40 space-y-1 overflow-hidden">
                                                {item.transactions
                                                  .slice(0, 5)
                                                  .map((transaction) => (
                                                    <div
                                                      key={`${item.name}-${transaction.id}`}
                                                      className="rounded-xl bg-black/[0.03] px-2 py-1.5 dark:bg-white/[0.04]"
                                                    >
                                                      <div className="flex items-start justify-between gap-2">
                                                        <span className="min-w-0 flex-1 truncate font-semibold text-primary">
                                                          {transaction.content}
                                                        </span>
                                                        <span className="shrink-0 font-bold text-primary">
                                                          {canShowAmounts
                                                            ? fmt(
                                                                transaction.amount,
                                                              )
                                                            : "••••"}
                                                        </span>
                                                      </div>
                                                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted">
                                                        <span className="truncate capitalize">
                                                          {
                                                            transaction.subcommodity
                                                          }
                                                        </span>
                                                        {transaction.date && (
                                                          <span className="shrink-0">
                                                            {new Date(
                                                              transaction.date,
                                                            ).toLocaleDateString(
                                                              "id-ID",
                                                              {
                                                                month: "short",
                                                                day: "numeric",
                                                              },
                                                            )}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ))}
                                              </div>
                                              {item.transactions.length > 5 && (
                                                <div className="mt-1 text-[10px] font-semibold text-muted">
                                                  +
                                                  {item.transactions.length - 5}{" "}
                                                  transaksi lainnya
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onMouseEnter={() =>
                                          setHoveredCommodityBox(item.name)
                                        }
                                        onMouseLeave={() =>
                                          setHoveredCommodityBox(null)
                                        }
                                        onFocus={() =>
                                          setHoveredCommodityBox(item.name)
                                        }
                                        onBlur={() =>
                                          setHoveredCommodityBox(null)
                                        }
                                        onClick={() =>
                                          setHoveredCommodityBox((current) =>
                                            current === item.name
                                              ? null
                                              : item.name,
                                          )
                                        }
                                        className={`${colors[index % colors.length]} min-h-24 w-full cursor-help rounded-2xl p-3 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isHovered ? "-translate-y-0.5 brightness-105" : ""}`}
                                        aria-pressed={isHovered}
                                        aria-label={`${item.name}: ${item.percentage.toFixed(1)} persen, ${item.count} transaksi`}
                                      >
                                        <div className="text-sm font-bold capitalize leading-tight">
                                          {item.name}
                                        </div>
                                        <div className="mt-2 text-2xl font-bold">
                                          {item.percentage.toFixed(0)}%
                                        </div>
                                        <div className="mt-1 text-[11px] font-semibold text-white/80">
                                          {canShowAmounts
                                            ? fmt(item.total)
                                            : "••••"}{" "}
                                          · {item.count} transaksi
                                        </div>
                                      </button>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        )}

                        {topSpendBreakdowns.subcommodities.length > 0 && (
                          <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                            <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                              Berdasarkan subkategori
                            </div>
                            <div className="space-y-2">
                              {topSpendBreakdowns.subcommodities
                                .slice(0, 4)
                                .map((item) => (
                                  <div
                                    key={`subcommodity-${item.name}`}
                                    className="flex items-center justify-between gap-3 text-xs"
                                  >
                                    <span className="truncate font-semibold text-primary capitalize">
                                      {item.name}
                                    </span>
                                    <span className="shrink-0 text-muted">
                                      {item.percentage.toFixed(0)}% ·{" "}
                                      {canShowAmounts ? fmt(item.total) : "••••"}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-4 border-t border-border pt-5">
                          {budgetCategoryAnalytics
                            .slice(0, 3)
                            .map((category) => (
                              <div
                                key={category.categoryId}
                                className="space-y-2"
                              >
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <div className="flex min-w-0 items-center gap-2 font-bold text-primary">
                                    <span
                                      className={`h-2 w-2 rounded-full ${category.color || "bg-slate-500"}`}
                                    ></span>
                                    <span className="truncate">
                                      {category.categoryName}
                                    </span>
                                  </div>
                                  <span className="shrink-0 font-semibold text-muted">
                                    {canShowAmounts ? fmt(category.total) : "•••"}
                                  </span>
                                </div>
                                <div className="relative">
                                  {(() => {
                                    const hoveredCommodityIndex =
                                      category.commodities.findIndex(
                                        (commodity) =>
                                          hoveredAnatomySegment?.categoryId ===
                                            category.categoryId &&
                                          hoveredAnatomySegment.commodityName ===
                                            commodity.name,
                                      );
                                    const hoveredCommodity =
                                      hoveredCommodityIndex >= 0
                                        ? category.commodities[
                                            hoveredCommodityIndex
                                          ]
                                        : undefined;
                                    return hoveredCommodity ? (
                                      <div
                                        className="pointer-events-none absolute -top-3 z-20 w-64 -translate-x-1/2 -translate-y-full rounded-2xl border border-border bg-surface/95 p-3 text-xs shadow-xl shadow-black/10 backdrop-blur dark:shadow-black/30"
                                        style={{
                                          left: `${getAnatomySegmentLeft(category.commodities, hoveredCommodityIndex)}%`,
                                        }}
                                      >
                                        <div className="mb-2 flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="truncate font-bold capitalize text-primary">
                                              {hoveredCommodity.name}
                                            </div>
                                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                                              {category.categoryName}
                                            </div>
                                          </div>
                                          <div className="shrink-0 text-right">
                                            <div className="font-bold text-primary">
                                              {hoveredCommodity.percentage.toFixed(
                                                1,
                                              )}
                                              %
                                            </div>
                                            <div className="font-semibold text-muted">
                                              {canShowAmounts
                                                ? fmt(hoveredCommodity.total)
                                                : "••••"}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 text-[11px]">
                                          <div>
                                            <div className="font-bold uppercase tracking-[0.12em] text-muted">
                                              Jumlah
                                            </div>
                                            <div className="mt-0.5 font-semibold text-primary">
                                              {hoveredCommodity.count} transaksi
                                            </div>
                                          </div>
                                          <div>
                                            <div className="font-bold uppercase tracking-[0.12em] text-muted">
                                              Porsi kategori
                                            </div>
                                            <div className="mt-0.5 font-semibold text-primary">
                                              {hoveredCommodity.percentage.toFixed(
                                                0,
                                              )}
                                              %
                                            </div>
                                          </div>
                                        </div>
                                        {hoveredCommodity.subcommodities
                                          .length > 0 && (
                                          <div className="mt-2 border-t border-border pt-2">
                                            <div className="mb-1 font-bold uppercase tracking-[0.14em] text-muted">
                                              Subkategori
                                            </div>
                                            <div className="space-y-1">
                                              {hoveredCommodity.subcommodities
                                                .slice(0, 3)
                                                .map((sub) => (
                                                  <div
                                                    key={`${category.categoryId}-${hoveredCommodity.name}-${sub.name}`}
                                                    className="flex items-center justify-between gap-2"
                                                  >
                                                    <span className="truncate text-muted capitalize">
                                                      {sub.name}
                                                    </span>
                                                    <span className="shrink-0 font-bold text-primary">
                                                      {canShowAmounts
                                                        ? fmt(sub.total)
                                                        : "••••"}
                                                    </span>
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : null;
                                  })()}
                                  <div
                                    className="flex h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
                                    aria-hidden="true"
                                  >
                                    {category.commodities.map(
                                      (commodity, index) => {
                                        const isHovered =
                                          hoveredAnatomySegment?.categoryId ===
                                            category.categoryId &&
                                          hoveredAnatomySegment.commodityName ===
                                            commodity.name;
                                        return (
                                          <span
                                            key={`${category.categoryId}-${commodity.name}`}
                                            className={`${index % 2 === 0 ? category.color || "bg-slate-500" : "bg-amber-500"} ${index > 1 ? "opacity-50" : index === 1 ? "opacity-70" : ""} h-full transition-all ${isHovered ? "brightness-110 ring-1 ring-white/80" : ""}`}
                                            style={{
                                              width: `${Math.max(commodity.percentage, 3)}%`,
                                            }}
                                          />
                                        );
                                      },
                                    )}
                                  </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {category.commodities
                                    .slice(0, 2)
                                    .map((commodity) => {
                                      const topSubs = commodity.subcommodities
                                        .slice(0, 2)
                                        .map((sub) => sub.name)
                                        .join(" + ");
                                      return (
                                        <button
                                          type="button"
                                          key={`${category.categoryId}-${commodity.name}-detail`}
                                          onMouseEnter={() =>
                                            setHoveredAnatomySegment({
                                              categoryId: category.categoryId,
                                              commodityName: commodity.name,
                                            })
                                          }
                                          onMouseLeave={() =>
                                            setHoveredAnatomySegment(null)
                                          }
                                          onFocus={() =>
                                            setHoveredAnatomySegment({
                                              categoryId: category.categoryId,
                                              commodityName: commodity.name,
                                            })
                                          }
                                          onBlur={() =>
                                            setHoveredAnatomySegment(null)
                                          }
                                          onClick={() =>
                                            setHoveredAnatomySegment((current) =>
                                              current?.categoryId ===
                                                category.categoryId &&
                                              current.commodityName ===
                                                commodity.name
                                                ? null
                                                : {
                                                    categoryId:
                                                      category.categoryId,
                                                    commodityName:
                                                      commodity.name,
                                                  },
                                            )
                                          }
                                          aria-pressed={
                                            hoveredAnatomySegment?.categoryId ===
                                              category.categoryId &&
                                            hoveredAnatomySegment.commodityName ===
                                              commodity.name
                                          }
                                          aria-label={`${commodity.name}: ${commodity.percentage.toFixed(1)} persen dari ${category.categoryName}`}
                                          className="min-h-11 rounded-2xl bg-white/60 p-3 text-left text-xs transition-colors hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:bg-white/5"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-primary capitalize">
                                              {commodity.name}
                                            </span>
                                            <span className="font-semibold text-muted">
                                              {commodity.percentage.toFixed(0)}%
                                            </span>
                                          </div>
                                          {topSubs && (
                                            <div className="mt-1 text-[11px] leading-snug text-muted">
                                              Subkategori utama: {topSubs}
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>

      <PresencePanel
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        presentation="sheet"
        overlayClassName="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 backdrop-blur-sm lg:items-stretch lg:justify-end"
        panelClassName="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-2xl ring-1 ring-inset ring-border/70 sm:max-w-2xl lg:h-full lg:max-h-none lg:max-w-xl lg:rounded-none"
        ariaLabel="Detail transaksi"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
              Detail transaksi
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              {selectedTransaction?.meta.merchant ||
                selectedTransaction?.content ||
                "Transaksi"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSelectedTransaction(null)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-soft hover:text-primary"
            aria-label="Tutup detail transaksi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {selectedTransaction && (
            <Card
              item={selectedTransaction}
              {...cardProps}
              enableCollapse={false}
              defaultCollapsed={false}
              categoryName={
                (() => {
                  const categoryIds =
                    getTransactionCategoryIds(selectedTransaction);
                  return categoryIds.length > 1
                    ? `${categoryIds.length} kategori`
                    : budgetConfig.rules.find(
                        (rule) =>
                          rule.id ===
                          (categoryIds[0] ||
                            selectedTransaction.meta.budgetCategory),
                      )?.name ||
                        categoryIds[0] ||
                        selectedTransaction.meta.budgetCategory;
                })()
              }
              className="border-0 shadow-none ring-0"
            />
          )}
        </div>
      </PresencePanel>
    </div>
  );
};

export default MoneyViewComponent;
