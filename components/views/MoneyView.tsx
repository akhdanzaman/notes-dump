import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Calculator,
  Plus,
  AlertCircle,
  Target,
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
  savingGoals,
  setActiveTab,
  onAddItem,
}) => {
  // Main Tab Swipe Logic
  const swipeHandlers = useSwipeTabs("money", setActiveTab);

  const [budgetViewMode, setBudgetViewMode] =
    useState<BudgetAnalyticsViewMode>("monthly");

  // Date Swipe Logic
  const changePeriod = (offset: number) => {
    const newDate = new Date(financeDate);
    if (moneyView === "budget" && budgetViewMode === "yearly") {
      newDate.setFullYear(newDate.getFullYear() + offset);
    } else if (moneyView === "budget" && budgetViewMode === "weekly") {
      newDate.setDate(newDate.getDate() + offset * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + offset);
    }
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

  const visibleWallets = useLazyItems(walletStats, {
    resetKey: `money-wallets-${walletStats.length}-${savingGoals.length}`,
  });
  const visibleTransactions = useLazyItems(list, {
    resetKey: `money-transactions-${budgetViewMode}-${financeDate.toISOString()}-${filterWallet}-${filterTransactionType}-${filterCategory}-${filterMinAmount}-${filterMaxAmount}-${selectedTag}-${searchQuery}-${sortOrder}-${list.length}`,
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);

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
        ? "Fixed Income (Yearly)"
        : budgetViewMode === "weekly"
          ? "Fixed Income (Weekly)"
          : "Fixed Income"
      : "Recorded Income";
  const monthUsagePercent =
    effectiveIncome > 0 ? (totalBudgetUsed / effectiveIncome) * 100 : 0;
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
        ? `${weekBounds.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${new Date(weekBounds.end.getTime() - 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : financeDate.toLocaleDateString(undefined, { month: "short" });
  const periodKicker =
    budgetViewMode === "yearly"
      ? "Year"
      : budgetViewMode === "weekly"
        ? financeDate.getFullYear().toString()
        : financeDate.getFullYear().toString();
  const hoveredTrendLabel = hoveredTrendPoint
    ? budgetViewMode === "yearly"
      ? `${hoveredTrendPoint.label} ${financeDate.getFullYear()}`
      : budgetViewMode === "weekly"
        ? `${hoveredTrendPoint.label}, ${new Date(weekBounds.start.getFullYear(), weekBounds.start.getMonth(), weekBounds.start.getDate() + (hoveredTrendIndex || 0)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : `${hoveredTrendPoint.label} ${financeDate.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
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
        title: `${overspent.length} category over budget`,
        detail: `${overspent[0].rule.name} leads by ${fmt(overspent[0].over)}.`,
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
        title: "Planned spend needs attention",
        detail: `${plannedRisk[0].rule.name} may exceed by ${fmt(plannedRisk[0].over)} including planned.`,
        tone: "amber",
      });
    }
    if (topSpendBreakdowns.commodities[0]) {
      cards.push({
        title: `${topSpendBreakdowns.commodities[0].name} is the biggest spend`,
        detail: `${topSpendBreakdowns.commodities[0].percentage.toFixed(0)}% of expenses in this period.`,
        tone: "indigo",
      });
    }
    if (projectedExpense > 0) {
      cards.push({
        title: "Planned is included",
        detail: `${fmt(projectedExpense)} planned spend is reflected in amber progress.`,
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
    hideMoney: appSettings.hideMoney,
    wallets,
    budgetRules: budgetConfig.rules,
    savingGoals,
    commodityOptions,
    noStrikethrough: true,
    noDarken: true,
  };

  return (
    <div className={contentSurface.pageShell}>
      {/* Top Container */}
      <motion.div
        layoutId="top-container"
        data-swipe-tabs="money"
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
          <div
            data-money-tabs="true"
            className="mb-5 flex w-full bg-black/5 dark:bg-white/20 rounded-2xl p-1"
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setMoneyView(tab)}
                className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${moneyView === tab ? "bg-surface text-primary" : "text-primary/40 hover:text-primary"}`}
              >
                {tab === "wallets" && <WalletIcon className="w-4 h-4" />}
                {tab === "transactions" && <List className="w-4 h-4" />}
                {tab === "budget" && <PieChart className="w-4 h-4" />}
                <span className="capitalize hidden sm:inline">
                  {tab === "transactions" ? "Transactions" : tab}
                </span>
              </button>
            ))}
          </div>

          <div className="lg:space-y-6" data-money-header-grid="true">
            <div className="mb-6 flex items-start justify-between gap-4 pb-2 lg:mb-0 lg:grid lg:grid-cols-8 lg:items-start lg:gap-4 lg:pb-3 xl:gap-5">
              <div className="min-w-0 lg:col-span-6 lg:pt-1">
                <div className="text-sm font-bold opacity-60 uppercase tracking-wider">
                  Total Net Worth
                </div>
                <div className="text-xs font-medium opacity-50">
                  Assets, debt, and savings across wallets
                </div>
                <div className="mt-2 flex min-w-0 items-center gap-3 lg:mt-3">
                  <div className="truncate text-4xl font-bold tracking-tight lg:text-5xl">
                    {showBalance ? fmt(totalNetWorth) : "••••••••"}
                  </div>
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label={showBalance ? "Hide balance" : "Show balance"}
                  >
                    {showBalance ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <div
                data-swipe-date="money-month"
                className="shrink-0 rounded-[20px] bg-black/5 px-2 py-2 touch-pan-y sm:px-3 lg:col-span-2 lg:w-full lg:rounded-[24px] lg:px-4 lg:py-3"
                onTouchStart={dateSwipeHandlers.onTouchStart}
                onTouchMove={dateSwipeHandlers.onTouchMove}
                onTouchEnd={dateSwipeHandlers.onTouchEnd}
              >
                <div className="flex items-center justify-between gap-1 lg:gap-2">
                  <button
                    onClick={() => changePeriod(-1)}
                    className="p-1 hover:bg-black/10 rounded-full transition-colors lg:p-2"
                    aria-label={
                      budgetViewMode === "yearly"
                        ? "Previous year"
                        : budgetViewMode === "weekly"
                          ? "Previous week"
                          : "Previous month"
                    }
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${budgetViewMode}-${financeDate.toISOString()}`}
                      data-money-month-label="true"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex min-w-16 flex-col items-center sm:min-w-20 lg:min-w-24"
                    >
                      <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider leading-none mb-1 lg:text-xs">
                        {periodKicker}
                      </span>
                      <span className="text-sm font-bold leading-none sm:text-base lg:text-lg">
                        {periodTitle}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                  <button
                    onClick={() => changePeriod(1)}
                    className="p-1 hover:bg-black/10 rounded-full transition-colors lg:p-2"
                    aria-label={
                      budgetViewMode === "yearly"
                        ? "Next year"
                        : budgetViewMode === "weekly"
                          ? "Next week"
                          : "Next month"
                    }
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {moneyView === "budget" && (
                  <div className="mt-2 grid grid-cols-3 bg-white/50 dark:bg-black/10 rounded-full p-1 cursor-pointer">
                    {(
                      [
                        ["monthly", "M"],
                        ["weekly", "W"],
                        ["yearly", "Y"],
                      ] as [BudgetAnalyticsViewMode, string][]
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => setBudgetViewMode(mode)}
                        className={`${budgetViewMode === mode ? "bg-surface text-primary shadow-sm dark:bg-white dark:text-black" : "text-primary/50 hover:text-primary"} rounded-full px-2 py-1 text-xs font-bold transition-colors`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-8 gap-3 mb-4 lg:mb-5 lg:gap-4 xl:gap-5">
              <div className="col-span-3 min-w-0 bg-black/5 rounded-[24px] px-3 py-4 lg:px-5 lg:py-5">
                <div className="flex items-center gap-1 text-xs font-bold opacity-60 uppercase tracking-wider mb-1 lg:mb-2">
                  <TrendingUp className="w-4 h-4 shrink-0 text-emerald-500" />{" "}
                  Income
                </div>
                <div className="truncate text-lg font-bold text-emerald-600 dark:text-emerald-500 lg:text-2xl">
                  {showBalance ? fmt(totalIncome) : "••••"}
                </div>
              </div>
              <div className="col-span-3 min-w-0 bg-black/5 rounded-[24px] px-3 py-4 lg:px-5 lg:py-5">
                <div className="flex items-center gap-1 text-xs font-bold opacity-60 uppercase tracking-wider mb-1 lg:mb-2">
                  <TrendingDown className="w-4 h-4 shrink-0 text-[#FF5722]" />{" "}
                  Expense
                </div>
                <div className="truncate text-lg font-bold text-[#FF5722] lg:text-2xl">
                  {showBalance ? fmt(totalExpense) : "••••"}
                </div>
              </div>
              <div className="col-span-2 min-w-0 bg-black/5 rounded-[24px] px-3 py-4 lg:px-5 lg:py-5">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold opacity-60 uppercase tracking-wider mb-1 lg:mb-2 lg:justify-start lg:text-xs">
                  <AlertCircle className="hidden w-4 h-4 shrink-0 text-amber-500 lg:block" />{" "}
                  Used
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
                      <span className="truncate text-sm font-semibold leading-tight text-amber-500 lg:text-base">{`${monthUsageWithPlannedPercent.toFixed(0)}%`}</span>
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
                  Assets:{" "}
                  <span className="text-emerald-600 dark:text-emerald-500 font-bold">
                    {showBalance ? fmt(totalAssets) : "••"}
                  </span>
                </div>
                <div className="text-sm font-medium opacity-80">
                  Debt:{" "}
                  <span className="text-[#FF5722] font-bold">
                    {showBalance ? fmt(totalDebt) : "••"}
                  </span>
                </div>
                <div className="text-sm font-medium opacity-80 flex items-center gap-1">
                  Savings:{" "}
                  <span className="text-[#6366F1] font-bold">
                    {showBalance ? fmt(walletTotalSavings || 0) : "••"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onAddItem(ItemType.FINANCE)}
                className="w-10 h-10 flex items-center justify-center bg-black dark:bg-zinc-800 text-white dark:text-white rounded-full hover:scale-110 active:scale-95 transition-all"
                aria-label="Add finance"
                title="Add finance"
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
          transition: { duration: 0.4, delay: 0.1 },
        }}
        className="touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <motion.div
          className="flex w-full will-change-transform"
          style={{
            transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
            transition: isDragging
              ? "none"
              : "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
          }}
        >
          {/* VIEW: Wallets */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`w-full flex-shrink-0 ${contentSurface.contentPad}`}
          >
            <div className={contentSurface.cardGrid}>
              {visibleWallets.visibleItems.map((wallet) => (
                <div
                  key={wallet.id}
                  className="bg-surface rounded-[24px] p-4 transition-all hover:bg-surface/80 relative group"
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
                        <span className="text-sm font-semibold capitalize text-primary opacity-70">
                          {wallet.type}
                        </span>
                      </div>

                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEditWallet(wallet)}
                          className="p-1.5 hover:bg-muted/10 rounded-xl text-muted hover:text-primary transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteId(wallet.id);
                            setDeleteType("wallet");
                          }}
                          className="p-1.5 hover:bg-red-900/30 rounded-xl text-muted hover:text-red-400 transition-colors"
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
                              Debt Account
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
                              (sum, g) => sum + (g.meta.savedAmount || 0),
                              0,
                            );

                          if (walletSavings > 0) {
                            return (
                              <div className="mt-1">
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Savings:{" "}
                                  {showBalance ? fmt(walletSavings) : "••••"}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className="text-base font-bold shrink-0 mt-0.5 text-primary">
                        {showBalance ? fmt(wallet.currentBalance) : "••••••••"}
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
                onClick={handleOpenAddWallet}
                className="w-full border border-dashed border-border rounded-3xl flex items-center justify-center p-4 hover:border-primary/30 hover:bg-surface/50 transition-all text-muted hover:text-primary gap-2"
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Add Wallet</span>
              </button>
            </div>
          </motion.div>

          {/* VIEW: Transactions */}
          <motion.div
            key={"transactions-" + financeDate.toISOString()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className={`w-full flex-shrink-0 ${contentSurface.contentPad}`}
          >
            <div
              className={contentSurface.moneyWorkspaceGrid}
              data-money-workspace="transactions"
            >
              {list.length === 0 ? (
                <div
                  className={`${contentSurface.emptyStateCard} ${contentSurface.moneyPrimaryPanel}`}
                >
                  No transactions recorded.
                </div>
              ) : (
                <div
                  className={`${contentSurface.denseList} ${contentSurface.moneyPrimaryPanel}`}
                  data-money-primary-column="true"
                >
                  {visibleTransactions.visibleItems.map((item) => {
                    const transactionCategoryIds = getTransactionCategoryIds(item);
                    const categoryName = transactionCategoryIds.length > 1
                      ? `${transactionCategoryIds.length} kategori`
                      : budgetConfig.rules.find(
                          (r) => r.id === (transactionCategoryIds[0] || item.meta.budgetCategory),
                        )?.name || transactionCategoryIds[0] || item.meta.budgetCategory;
                    return (
                      <Card
                        key={item.id}
                        item={item}
                        {...cardProps}
                        categoryName={categoryName}
                      />
                    );
                  })}
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
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-muted">
                  Filters
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <span>Wallet</span>
                    <strong className="text-primary">
                      {filterWallet || "All"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Type</span>
                    <strong className="text-primary capitalize">
                      {filterTransactionType || "All"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Category</span>
                    <strong className="text-primary">
                      {filterCategory || "All"}
                    </strong>
                  </div>
                  {(filterMinAmount || filterMaxAmount) && (
                    <div className="flex justify-between gap-3">
                      <span>Amount</span>
                      <strong className="text-primary">
                        {filterMinAmount || "0"} - {filterMaxAmount || "∞"}
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
                      <span>Search</span>
                      <strong className="text-primary truncate">
                        {searchQuery}
                      </strong>
                    </div>
                  )}
                </div>
                <div className="mt-4 border-t border-border pt-4 text-xs leading-relaxed">
                  Desktop keeps the same Floating Search filters; this panel
                  mirrors active state for scanability.
                </div>
              </aside>
            </div>
          </motion.div>

          {/* VIEW: Budget Dashboard */}
          <motion.div
            key={"budget-" + financeDate.toISOString()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className={`w-full flex-shrink-0 ${contentSurface.contentPad} pb-8`}
          >
            {effectiveIncome === 0 ? (
              <div className="text-center p-6 bg-surface border border-border rounded-3xl">
                <PiggyBank className="w-8 h-8 text-muted mx-auto mb-2" />
                <p className="text-sm text-muted">
                  Set a <strong>Monthly Income</strong> in Settings <br />
                  or record Income to see your budget breakdown.
                </p>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="mt-4 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-semibold hover:bg-primary/20"
                >
                  Set Income
                </button>
              </div>
            ) : (
              <div className="space-y-6 text-primary">
                <div className="bg-surface border border-border rounded-[32px] p-6 text-primary">
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight">
                        Spend Timeline
                      </h2>
                      <div className="mt-1 text-sm font-semibold text-muted">
                        {budgetViewMode === "yearly"
                          ? "Monthly income, expense, and net across the selected year"
                          : budgetViewMode === "weekly"
                            ? "Daily income, expense, and net across the selected week"
                            : "Daily income, expense, and net across the selected month"}
                      </div>
                    </div>
                    <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted dark:bg-white/10">
                      {budgetViewMode === "yearly" ? "Monthly" : "Daily"}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                        {budgetViewMode === "yearly"
                          ? "Year Trend"
                          : budgetViewMode === "weekly"
                            ? "Week Trend"
                            : "Month Trend"}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-primary">
                        {showBalance ? fmt(selectedPeriodTotal) : "••••"}
                      </div>
                      <div className="mt-2 text-xs leading-snug text-muted">
                        How much has been spent, earned, and left in this
                        period.
                      </div>
                      <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted">Income</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-500">
                            {showBalance ? fmt(totalIncome) : "••••"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted">Expense</span>
                          <span className="font-bold text-[#FF5722]">
                            {showBalance ? fmt(totalExpense) : "••••"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted">Net</span>
                          <span
                            className={`font-bold ${totalIncome - totalExpense >= 0 ? "text-[#6366F1]" : "text-[#FF5722]"}`}
                          >
                            {showBalance
                              ? fmt(totalIncome - totalExpense)
                              : "••••"}
                          </span>
                        </div>
                        {projectedBudgetUsed > 0 && (
                          <div className="text-right">
                            <div className="text-muted text-sm mb-1 font-medium">
                              Planned
                            </div>
                            <div className="text-xl font-bold text-amber-500">
                              {showBalance ? fmt(projectedBudgetUsed) : "••••"}
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
                            Income
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#FF5722]"></span>
                            Expense
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#6366F1]"></span>
                            Net
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
                          Peak{" "}
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
                                  <div className="mt-0.5 text-[10px] font-semibold text-amber-500">
                                    Prev spend{" "}
                                    {showBalance
                                      ? fmt(hoveredTrendPoint.previousTotal)
                                      : "••••"}
                                    {hoveredTrendPoint.previousIncome !==
                                    undefined
                                      ? ` · income ${showBalance ? fmt(hoveredTrendPoint.previousIncome) : "••••"}`
                                      : ""}
                                  </div>
                                )}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-600 dark:text-emerald-500">
                                {showBalance
                                  ? fmt(hoveredTrendPoint.income)
                                  : "••••"}
                              </div>
                              <div className="font-bold text-[#FF5722]">
                                {showBalance
                                  ? fmt(hoveredTrendPoint.total)
                                  : "••••"}
                              </div>
                              <div className="font-bold text-[#6366F1]">
                                {showBalance
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
                              Categories
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
                                        {showBalance
                                          ? fmt(category.total)
                                          : "••••"}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <div className="text-muted">
                                No category spend
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
                            <div
                              key={`${point.label}-${index}`}
                              onMouseEnter={() => setHoveredTrendIndex(index)}
                              onMouseLeave={() => setHoveredTrendIndex(null)}
                              className="group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
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
                                  className={`relative z-10 w-full max-w-2 rounded-t-sm bg-[#FF5722] transition-all group-hover:max-w-2.5 ${isHovered ? "shadow-sm" : ""}`}
                                  style={{ height: `${scale(point.total)}%` }}
                                />
                                <div
                                  className={`relative z-10 w-full max-w-2 rounded-t-sm bg-[#6366F1] transition-all group-hover:max-w-2.5 ${isHovered ? "shadow-sm" : ""}`}
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
                            </div>
                          );
                        })}
                      </div>
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
                          Budget Performance
                        </h2>
                        <div className="mt-1 text-sm font-semibold text-muted">
                          {budgetConfig.rules.length} categories with actual +
                          planned progress
                        </div>
                      </div>
                      <Target className="h-6 w-6 text-muted" />
                    </div>

                    {/* Basis Fixed Income & Planned Spending */}
                    <div className="flex justify-between items-end mb-8 pb-6 border-b border-border">
                      <div>
                        <div className="text-muted text-sm mb-1 font-medium">
                          Basis: {incomeLabel}
                        </div>
                        <div className="text-xl font-bold">
                          {showBalance ? fmt(effectiveIncome) : "••••"}
                        </div>
                      </div>
                      {projectedExpense > 0 && (
                        <div className="text-right">
                          <div className="text-muted text-sm mb-1 font-medium">
                            Planned
                          </div>
                          <div className="text-xl font-bold text-amber-500">
                            {showBalance ? fmt(projectedExpense) : "••••"}
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

                        // Calculate percentages relative to TOTAL income for the bars
                        const percentageOfTotalSpent =
                          effectiveIncome > 0
                            ? (spent / effectiveIncome) * 100
                            : 0;
                        const percentageOfTotalPlanned =
                          effectiveIncome > 0
                            ? (planned / effectiveIncome) * 100
                            : 0;

                        // Calculate percentage relative to CATEGORY limit for the text display
                        const percentageOfCategorySpent =
                          limit > 0 ? (spent / limit) * 100 : 0;
                        const percentageOfCategoryUsedPlanned =
                          limit > 0 ? ((spent + planned) / limit) * 100 : 0;

                        const textColorClass = rule.color
                          ? rule.color.replace("bg-", "text-")
                          : "text-gray-400";

                        return (
                          <div key={rule.id}>
                            <div
                              className={`flex items-center gap-2 text-sm font-semibold mb-1 ${textColorClass}`}
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${rule.color || "bg-gray-500"}`}
                              ></div>
                              {rule.name}
                            </div>
                            <div
                              className={`text-sm font-bold mb-2 ${textColorClass} flex items-center justify-between`}
                            >
                              <div>
                                <div>
                                  {percentageOfCategorySpent.toFixed(1)} %{" "}
                                  <span className="text-muted font-normal text-xs ml-1">
                                    ({showBalance ? fmt(spent) : "•••"} /{" "}
                                    {showBalance ? fmt(limit) : "•••"})
                                  </span>
                                </div>
                                {planned > 0 && (
                                  <div className="text-amber-500 font-semibold text-[11px] leading-tight mt-0.5">
                                    {percentageOfCategoryUsedPlanned.toFixed(1)}{" "}
                                    %
                                  </div>
                                )}
                              </div>
                              {planned > 0 && (
                                <div className="text-amber-500 font-medium text-[10px] uppercase tracking-wider">
                                  Planned: {showBalance ? fmt(planned) : "•••"}
                                </div>
                              )}
                            </div>
                            <div className="h-3 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex relative">
                              <div
                                className={`h-full ${rule.color || "bg-gray-500"}`}
                                style={{
                                  width: `${Math.min(percentageOfTotalSpent, 100)}%`,
                                }}
                              ></div>
                              {planned > 0 && (
                                <div
                                  className={`h-full ${rule.color || "bg-gray-500"} opacity-40 bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] dark:bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)]`}
                                  style={{
                                    width: `${Math.min(percentageOfTotalPlanned, 100 - Math.min(percentageOfTotalSpent, 100))}%`,
                                  }}
                                ></div>
                              )}
                              {/* Limit Marker at the rule's percentage of total */}
                              <div
                                className="h-full w-0.5 bg-zinc-400 dark:bg-white z-20 absolute top-0"
                                style={{ left: `${rule.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Uncategorized */}
                      {(uncategorized > 0 || projectedUncategorized > 0) && (
                        <div className="pt-4 border-t border-border mt-4">
                          <div className="flex items-center gap-2 text-sm font-semibold mb-1 text-gray-400">
                            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                            Other
                          </div>
                          <div className="text-sm font-bold mb-2 text-gray-400 flex items-center justify-between">
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
                                  ({showBalance ? fmt(uncategorized) : "•••"})
                                </span>
                              </div>
                              {projectedUncategorized > 0 && (
                                <div className="text-amber-500 font-semibold text-[11px] leading-tight mt-0.5">
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
                              <div className="text-amber-500 font-medium text-[10px] uppercase tracking-wider">
                                Planned:{" "}
                                {showBalance
                                  ? fmt(projectedUncategorized)
                                  : "•••"}
                              </div>
                            )}
                          </div>
                          <div className="h-3 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-gray-400"
                              style={{
                                width: `${Math.min((uncategorized / effectiveIncome) * 100, 100)}%`,
                              }}
                            ></div>
                            {projectedUncategorized > 0 && (
                              <div
                                className="h-full bg-gray-400 opacity-40 bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] dark:bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)]"
                                style={{
                                  width: `${Math.min((projectedUncategorized / effectiveIncome) * 100, 100 - Math.min((uncategorized / effectiveIncome) * 100, 100))}%`,
                                }}
                              ></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {budgetInsightCards.length > 0 && (
                      <div className="mt-8 border-t border-border pt-5">
                        <div className="mb-3 text-sm font-bold tracking-tight">
                          Budget Insights
                        </div>
                        <div className="space-y-2">
                          {budgetInsightCards.map((card) => (
                            <div
                              key={card.title}
                              className="flex items-start gap-3 rounded-2xl bg-black/[0.03] p-3 text-xs dark:bg-white/[0.04]"
                            >
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${card.tone === "red" ? "bg-[#FF5722]" : card.tone === "amber" ? "bg-amber-500" : card.tone === "emerald" ? "bg-emerald-500" : "bg-[#6366F1]"}`}
                              ></span>
                              <div className="min-w-0">
                                <div className="font-bold text-primary">
                                  {card.title}
                                </div>
                                <div className="mt-0.5 leading-snug text-muted">
                                  {showBalance
                                    ? card.detail
                                    : "Hidden while balance is private."}
                                </div>
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
                            Spend Anatomy
                          </h2>
                          <div className="mt-1 text-sm font-semibold text-muted">
                            Category → commodity → subcommodity
                          </div>
                        </div>
                        <PieChart className="h-6 w-6 text-muted" />
                      </div>

                      <div className="space-y-5">
                        {topSpendBreakdowns.commodities.length > 0 && (
                          <div>
                            <div className="mb-3 flex items-center justify-between gap-3 text-xs">
                              <span className="font-bold uppercase tracking-[0.16em] text-muted">
                                By Commodity
                              </span>
                              <span className="font-semibold text-muted">
                                Total{" "}
                                {showBalance ? fmt(totalBudgetUsed) : "••••"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {topSpendBreakdowns.commodities.map(
                                (item, index) => {
                                  const colors = [
                                    "bg-emerald-500",
                                    "bg-blue-500",
                                    "bg-violet-500",
                                    "bg-orange-500",
                                    "bg-amber-500",
                                    "bg-pink-500",
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
                                                {item.count} transactions
                                              </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                              <div className="font-bold text-primary">
                                                {item.percentage.toFixed(1)}%
                                              </div>
                                              <div className="font-semibold text-muted">
                                                {showBalance
                                                  ? fmt(item.total)
                                                  : "••••"}
                                              </div>
                                            </div>
                                          </div>

                                          {item.subcommodities.length > 0 && (
                                            <div className="border-t border-border pt-2">
                                              <div className="mb-1 font-bold uppercase tracking-[0.14em] text-muted">
                                                Sub commodities
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
                                                        {showBalance
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
                                                Transactions
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
                                                          {showBalance
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
                                                              undefined,
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
                                                  more transactions
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
                                        className={`${colors[index % colors.length]} min-h-24 w-full cursor-help rounded-2xl p-3 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isHovered ? "-translate-y-0.5 brightness-105" : ""}`}
                                        aria-label={`${item.name}: ${item.percentage.toFixed(1)}% with ${item.count} transactions`}
                                      >
                                        <div className="text-sm font-bold capitalize leading-tight">
                                          {item.name}
                                        </div>
                                        <div className="mt-2 text-2xl font-bold">
                                          {item.percentage.toFixed(0)}%
                                        </div>
                                        <div className="mt-1 text-[11px] font-semibold text-white/80">
                                          {showBalance
                                            ? fmt(item.total)
                                            : "••••"}{" "}
                                          · {item.count} tx
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
                              By Subcategory
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
                                      {showBalance ? fmt(item.total) : "••••"}
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
                                      className={`h-2 w-2 rounded-full ${category.color || "bg-gray-400"}`}
                                    ></span>
                                    <span className="truncate">
                                      {category.categoryName}
                                    </span>
                                  </div>
                                  <span className="shrink-0 font-semibold text-muted">
                                    {showBalance ? fmt(category.total) : "•••"}
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
                                              {showBalance
                                                ? fmt(hoveredCommodity.total)
                                                : "••••"}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 text-[11px]">
                                          <div>
                                            <div className="font-bold uppercase tracking-[0.12em] text-muted">
                                              Count
                                            </div>
                                            <div className="mt-0.5 font-semibold text-primary">
                                              {hoveredCommodity.count} tx
                                            </div>
                                          </div>
                                          <div>
                                            <div className="font-bold uppercase tracking-[0.12em] text-muted">
                                              Category share
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
                                              Subcategories
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
                                                      {showBalance
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
                                  <div className="flex h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                                    {category.commodities.map(
                                      (commodity, index) => {
                                        const isHovered =
                                          hoveredAnatomySegment?.categoryId ===
                                            category.categoryId &&
                                          hoveredAnatomySegment.commodityName ===
                                            commodity.name;
                                        return (
                                          <button
                                            key={`${category.categoryId}-${commodity.name}`}
                                            type="button"
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
                                            className={`${index % 2 === 0 ? category.color || "bg-gray-500" : "bg-amber-500"} ${index > 1 ? "opacity-50" : index === 1 ? "opacity-70" : ""} h-full cursor-help transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isHovered ? "brightness-110 ring-1 ring-white/80" : ""}`}
                                            style={{
                                              width: `${Math.max(commodity.percentage, 3)}%`,
                                            }}
                                            aria-label={`${commodity.name}: ${commodity.percentage.toFixed(1)}% of ${category.categoryName}`}
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
                                        <div
                                          key={`${category.categoryId}-${commodity.name}-detail`}
                                          className="rounded-2xl bg-white/60 p-3 text-xs dark:bg-white/5"
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
                                              Main subcategory: {topSubs}
                                            </div>
                                          )}
                                        </div>
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
    </div>
  );
};

export default MoneyViewComponent;
