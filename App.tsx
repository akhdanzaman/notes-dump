import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { v4 as uuidv4 } from "uuid";

import { motion, AnimatePresence } from "framer-motion";
import {
  BrainDumpItem,
  BudgetConfig,
  Skill,
  Wallet,
  AppSettings,
  Tab,
  PlanSubTab,
  LibrarySubTab,
  MoneyView,
  SortOrder,
  ItemType,
  ShoppingCategory,
} from "./types";
import { useBrainDumpData } from "./hooks/useBrainDumpData";
import { getShoppingItems } from "./utils/selectors";
import {
  clearSpreadsheetConfig,
  encryptSecurityPassword,
  fetchSecurityPasswordHash,
  saveSecurityPasswordHash,
  verifySecurityPassword,
} from "./services/spreadsheetService";
import { BackHandler } from "./utils/backHandler";
import {
  LocalSecuritySettings,
  SecurityPasswordRequestOptions,
  loadLocalSecuritySettings,
  saveLocalSecuritySettings,
} from "./utils/securitySettings";

import InputBar from "./components/InputBar";
import SkillModal from "./components/SkillModal";
import WalletModal from "./components/WalletModal";
import ConfirmDialog from "./components/ConfirmDialog";

import BottomNav from "./components/BottomNav";
import FloatingSearch from "./components/FloatingSearch";
import ControlCenter from "./components/ControlCenter";

import SummaryView from "./components/views/SummaryView";
import PlanView from "./components/views/PlanView";
import LibraryView from "./components/views/LibraryView";
import MoneyViewComponent from "./components/views/MoneyView";
import CalendarView from "./components/views/CalendarView";
import RoutineTaskModal from "./components/RoutineTaskModal";
import AddTaskModal from "./components/AddTaskModal";
import AddShoppingModal from "./components/AddShoppingModal";
import AddExpenseModal from "./components/AddExpenseModal";
import AddNoteModal from "./components/AddNoteModal";
import FloatingChatBox from "./components/FloatingChatBox";
import ReviewCenterPanel from "./components/ReviewCenterPanel";
import Onboarding from "./components/Onboarding";
import FeatureTutorialPopup from "./components/FeatureTutorialPopup";
import DesktopNavRail from "./components/layout/DesktopNavRail";
import {
  getResponsiveShellContentVariant,
  responsiveShellClass,
  responsiveShellComposerContentClass,
  responsiveShellContentClass,
} from "./components/layout/responsiveShell";
import {
  History,
  X,
  ClipboardCheck,
  ChevronDown,
  Image as ImageIcon,
} from "lucide-react";
import {
  LATEST_CHANGELOG,
  LATEST_CHANGELOG_VERSION,
  SEEN_CHANGELOG_STORAGE_KEY,
} from "./utils/changelog";
import {
  FEATURE_TUTORIALS,
  FEATURE_TUTORIALS_DISABLED_KEY,
  FEATURE_TUTORIALS_STORAGE_KEY,
  FeatureTutorialKey,
  getFeatureTutorialKey,
  parseSeenFeatureTutorials,
} from "./utils/featureTutorials";
import { classifyText } from "./services/geminiService";

const getThemeMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

type SkillModalPayload = {
  name: string;
  description?: string;
  imageUrl?: string;
  weeklyTargetMinutes?: number;
  schedule?: Skill['schedule'];
};

const parseSkillTime = (value?: string) => {
  const [hourRaw, minuteRaw] = String(value || '').split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return {
    hour: Number.isFinite(hour) ? Math.min(Math.max(hour, 0), 23) : 9,
    minute: Number.isFinite(minute) ? Math.min(Math.max(minute, 0), 59) : 0,
  };
};

const setDateTimeFromSkillTime = (date: Date, time?: string) => {
  const next = new Date(date);
  const { hour, minute } = parseSkillTime(time);
  next.setHours(hour, minute, 0, 0);
  return next;
};

const getSkillScheduleDurationMinutes = (schedule?: Skill['schedule']) => {
  if (!schedule?.enabled) return 0;
  const start = parseSkillTime(schedule.startTime);
  const end = parseSkillTime(schedule.endTime);
  let startMinutes = start.hour * 60 + start.minute;
  let endMinutes = end.hour * 60 + end.minute;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return Math.max(endMinutes - startMinutes, 1);
};

const skillScheduleMatchesDate = (schedule: NonNullable<Skill['schedule']>, date: Date) => {
  if (!schedule.enabled) return false;
  if (schedule.interval === 'daily') return true;
  if (schedule.interval === 'weekly') return (schedule.daysOfWeek?.length ? schedule.daysOfWeek : [date.getDay()]).includes(date.getDay());
  if (schedule.interval === 'monthly') return (schedule.daysOfMonth?.length ? schedule.daysOfMonth : [date.getDate()]).includes(date.getDate());
  if (schedule.interval === 'yearly') return (schedule.monthsOfYear?.length ? schedule.monthsOfYear : [date.getMonth()]).includes(date.getMonth()) && date.getDate() === 1;
  return false;
};

const getNextSkillScheduleStart = (schedule: NonNullable<Skill['schedule']>, fromDate = new Date()) => {
  for (let offset = 0; offset <= 370; offset += 1) {
    const day = new Date(fromDate);
    day.setDate(fromDate.getDate() + offset);
    const start = setDateTimeFromSkillTime(day, schedule.startTime);
    if (skillScheduleMatchesDate(schedule, start) && start.getTime() >= fromDate.getTime()) return start;
  }
  return setDateTimeFromSkillTime(fromDate, schedule.startTime);
};

const isSkillRoutineItem = (item: BrainDumpItem) => item.type === ItemType.SKILLS && item.meta.isRoutine && !!item.meta.skillId;

const buildSkillRoutineItem = (skill: Skill, existing?: BrainDumpItem): BrainDumpItem | null => {
  if (!skill.schedule?.enabled) return null;

  const start = getNextSkillScheduleStart(skill.schedule);
  const durationMinutes = getSkillScheduleDurationMinutes(skill.schedule);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return {
    id: existing?.id || `skill-routine-${skill.id}`,
    type: ItemType.SKILLS,
    content: skill.name,
    status: existing?.status || 'pending',
    created_at: existing?.created_at || new Date().toISOString(),
    completed_at: existing?.completed_at,
    meta: {
      ...(existing?.meta || {}),
      tags: Array.from(new Set([...(existing?.meta.tags || []), 'skills', 'routine'])),
      skillId: skill.id,
      skillName: skill.name,
      skillRoutineId: existing?.meta.skillRoutineId || existing?.id || `skill-routine-${skill.id}`,
      durationMinutes,
      isRoutine: true,
      routineInterval: skill.schedule.interval,
      routineDaysOfWeek: skill.schedule.daysOfWeek,
      routineDaysOfMonth: skill.schedule.daysOfMonth,
      routineMonthsOfYear: skill.schedule.monthsOfYear,
      recurrenceDays: 1,
      date: existing?.status === 'done' && existing.meta.date ? existing.meta.date : start.toISOString(),
      start: existing?.status === 'done' && existing.meta.start ? existing.meta.start : start.toISOString(),
      end: existing?.status === 'done' && existing.meta.end ? existing.meta.end : end.toISOString(),
      priority: existing?.meta.priority || 'normal',
    },
  };
};

const syncSkillRoutineItems = (items: BrainDumpItem[], skills: Skill[]) => {
  const skillsById = new Map(skills.map(skill => [skill.id, skill]));
  const existingRoutineBySkillId = new Map(
    items
      .filter(isSkillRoutineItem)
      .map(item => [item.meta.skillId as string, item])
  );

  const cleanedItems = items.filter(item => {
    if (!isSkillRoutineItem(item)) return true;
    const skill = skillsById.get(item.meta.skillId as string);
    return !!skill?.schedule?.enabled;
  });

  const withoutOldSkillRoutines = cleanedItems.filter(item => !isSkillRoutineItem(item));
  const routineItems = skills
    .map(skill => buildSkillRoutineItem(skill, existingRoutineBySkillId.get(skill.id)))
    .filter((item): item is BrainDumpItem => !!item);

  return [...routineItems, ...withoutOldSkillRoutines];
};

const App: React.FC = () => {
  // Data Logic Hook
  const {
    items,
    setItems,
    budgetConfig,
    setBudgetConfig,
    skills,
    setSkills,
    wallets,
    setWallets,
    customPrompt,
    setCustomPrompt,
    monthlyThemes,
    setMonthlyThemes,
    monthlyThemeImages,
    setMonthlyThemeImages,
    appSettings,
    setAppSettings,
    chatHistory,
    setChatHistory,
    loading,
    error,
    pendingCount,
    parsingTasks,
    enrichmentTasks,
    pendingReviews,
    canonicalRules,
    saveStatus,
    saveProgress,
    fetchProgress,
    fetchStatus,
    saveAndSync,
    handleSend,
    handleToggleStatus,
    handleDelete,
    handleUpdateItem,
    loadData,
    runCanonicalBackfill,
    toggleCanonicalRuleDisabled,
    handleAddRoutineTask,
    handleAddTask,
    handleAddShoppingItem,
    handleAddSavingTransaction,
    handleKeepRawTodo,
    handleRetriggerDeepWorkTodo,
    handleAcceptDeepWorkTodo,
    handleResetRoutine,
    handleAddTransaction,
    handleAddNote,
    handleUpsertSkillSessionLog,
    retryParsing,
    clearParsingTask,
    undoSuccessfulParsingTask,
    deleteSuccessfulParsingTaskEntries,
    handleApproveReview,
    handleRejectReview,
  } = useBrainDumpData();

  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem("braindump_onboarding_completed") !== "true";
  });

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [planSubTab, setPlanSubTab] = useState<
    "tasks" | "shopping" | "savings"
  >("tasks");
  const [librarySubTab, setLibrarySubTab] = useState<
    "general" | "skills" | "journal"
  >("general");
  const [showBalance, setShowBalance] = useState(false);
  const [securitySettings, setSecuritySettingsState] = useState<LocalSecuritySettings>(() =>
    loadLocalSecuritySettings(),
  );
  const [lockedSecurityPopup, setLockedSecurityPopup] = useState<{
    target: keyof LocalSecuritySettings;
    message: string;
  } | null>(null);
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [showChangelogPopup, setShowChangelogPopup] = useState(false);
  const [seenFeatureTutorials, setSeenFeatureTutorials] = useState<
    FeatureTutorialKey[]
  >(() =>
    parseSeenFeatureTutorials(
      localStorage.getItem(FEATURE_TUTORIALS_STORAGE_KEY),
    ),
  );
  const [activeFeatureTutorialKey, setActiveFeatureTutorialKey] =
    useState<FeatureTutorialKey | null>(null);
  const [featureTutorialsDisabled, setFeatureTutorialsDisabled] = useState(
    () => localStorage.getItem(FEATURE_TUTORIALS_DISABLED_KEY) === "true",
  );
  const [themeNavDate, setThemeNavDate] = useState(new Date());

  // Focus View State
  const [focusDate, setFocusDate] = useState(new Date());

  // Modal States
  const [skillModal, setSkillModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    skillId?: string;
    initialSkill?: Skill;
  }>({ isOpen: false, mode: "add" });
  const [walletModal, setWalletModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    walletId?: string;
    initialData?: Wallet;
  }>({ isOpen: false, mode: "add" });
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [addTaskModal, setAddTaskModal] = useState<{
    isOpen: boolean;
    initialDate?: string;
  }>({ isOpen: false });
  const [addShoppingModal, setAddShoppingModal] = useState<{
    isOpen: boolean;
    initialCategory?: ShoppingCategory;
  }>({ isOpen: false });
  const [addExpenseModalOpen, setAddExpenseModalOpen] = useState(false);
  const [addNoteModalOpen, setAddNoteModalOpen] = useState(false);
  const [addNoteModalType, setAddNoteModalType] = useState<
    ItemType.NOTE | ItemType.JOURNAL
  >(ItemType.NOTE);
  const [themeEditMode, setThemeEditMode] = useState(false);
  const [themeEditKey, setThemeEditKey] = useState<string | null>(null);
  const [tempThemeContent, setTempThemeContent] = useState("");
  const [tempThemeImageUrl, setTempThemeImageUrl] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"skill" | "wallet" | null>(null);

  // Filter & Sort State
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [filterDate, setFilterDate] = useState<string>(""); // YYYY-MM-DD
  const [filterDateTo, setFilterDateTo] = useState<string>(""); // YYYY-MM-DD
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Advanced Money Filters
  const [filterWallet, setFilterWallet] = useState<string>("");
  const [filterTransactionType, setFilterTransactionType] =
    useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterMinAmount, setFilterMinAmount] = useState<string>("");
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>("");

  // Finance Date Filter
  const [financeDate, setFinanceDate] = useState(new Date());
  const [moneyView, setMoneyView] = useState<MoneyView>("transactions");
  const activeShellContentVariant = useMemo(
    () =>
      getResponsiveShellContentVariant({
        activeTab,
        planSubTab,
        librarySubTab,
        moneyView,
      }),
    [activeTab, planSubTab, librarySubTab, moneyView],
  );

  const setSecuritySettings = (next: LocalSecuritySettings) => {
    setSecuritySettingsState(next);
    saveLocalSecuritySettings(next);
  };

  const secureAppSettings = useMemo<AppSettings>(
    () => ({
      ...appSettings,
      hideMoney: appSettings.hideMoney || securitySettings.forceHideMoneyValue,
    }),
    [appSettings, securitySettings.forceHideMoneyValue],
  );
  const effectiveShowBalance = showBalance && !securitySettings.forceHideMoneyValue;

  const openLockedSecurityPopup = (target: keyof LocalSecuritySettings, message: string) => {
    setLockedSecurityPopup({ target, message });
  };

  const handleSetActiveTab = (tab: Tab) => {
    if (tab === 'money' && securitySettings.lockTabTransaction) {
      openLockedSecurityPopup('lockTabTransaction', 'Money tab is locked on this device.');
      return;
    }
    setActiveTab(tab);
  };

  const handleSetShowBalance = (value: boolean) => {
    if (securitySettings.forceHideMoneyValue && value) {
      openLockedSecurityPopup('forceHideMoneyValue', 'Money values are locked and hidden on this device.');
      return;
    }
    setShowBalance(value);
  };

  const handleSetMoneyView = (view: MoneyView) => {
    if (securitySettings.lockTabTransaction) {
      openLockedSecurityPopup('lockTabTransaction', 'Money tab is locked on this device.');
      return;
    }
    setMoneyView(view);
  };

  // Input Focus State
  const [isMobileKeyboardOpen, setIsMobileKeyboardOpen] = useState(false);
  const fixedBottomRef = useRef<HTMLDivElement>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newChatMessage, setNewChatMessage] = useState<{
    text: string;
    id: string;
  } | null>(null);

  // Review Center nudge above the input bar
  const [isReviewCenterOpen, setIsReviewCenterOpen] = useState(false);
  const [lastReviewCenterOpenedAt, setLastReviewCenterOpenedAt] = useState(0);

  const latestParsingTaskAt = useMemo(() => {
    const latestParsing = parsingTasks.reduce(
      (latest, task) =>
        Math.max(latest, task.createdAt || 0, task.completedAt || 0),
      0,
    );
    return enrichmentTasks.reduce(
      (latest, task) =>
        Math.max(latest, task.createdAt || 0, task.completedAt || 0),
      latestParsing,
    );
  }, [enrichmentTasks, parsingTasks]);

  const hasRunningProcess = useMemo(() => {
    return (
      pendingCount > 0 ||
      parsingTasks.some((task) => task.status === "pending") ||
      enrichmentTasks.some(
        (task) => task.status === "pending" || task.status === "running",
      ) ||
      saveStatus === "saving" ||
      fetchStatus === "syncing"
    );
  }, [enrichmentTasks, fetchStatus, parsingTasks, pendingCount, saveStatus]);

  const noisyEnrichmentCount = enrichmentTasks.filter(
    (task) =>
      task.status === "failed" ||
      task.reviewCount ||
      (task.appliedFields?.length || 0) > 0,
  ).length;
  const showReviewCenterNudge =
    (parsingTasks.length > 0 ||
      pendingReviews.length > 0 ||
      noisyEnrichmentCount > 0) &&
    latestParsingTaskAt > lastReviewCenterOpenedAt;
  const reviewCenterBadgeCount =
    pendingReviews.length + parsingTasks.length + noisyEnrichmentCount;

  const openReviewCenterFromInput = () => {
    setLastReviewCenterOpenedAt(Date.now());
    setIsReviewCenterOpen(true);
  };

  const closeReviewCenterFromInput = () => {
    setIsReviewCenterOpen(false);
  };

  const handleUpdateChatHistory = (
    newHistory: import("./types").ChatMessage[],
  ) => {
    setChatHistory(newHistory);
  };

  const handleResetChat = () => {
    handleUpdateChatHistory([]);
  };

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const replyText = params.get("reply");
    if (!replyText) return;

    const replyKey = `braindump-open-reply:${replyText}`;
    if (sessionStorage.getItem(replyKey) === "handled") return;
    sessionStorage.setItem(replyKey, "handled");

    handleSendRef.current(replyText);
    params.delete("reply");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      const { type, text } = event.data || {};
      if (type === "NOTIFICATION_REPLY" && text) {
        handleSendRef.current(text);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
    };
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, tokens, error } = event.data || {};

      if (type === "GOOGLE_OAUTH_SUCCESS") {
        try {
          // simpan session
          localStorage.setItem(
            "braindump_google_session",
            JSON.stringify({
              ...tokens,
              expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
            }),
          );

          console.log("Google login success");

          // kalau mau, lanjut fetch profile / config di sini
          // const profile = await fetchGoogleProfile(tokens.access_token);
          // const config = await loadConfigFromDrive(tokens.access_token);

          loadData(); // atau trigger refresh state
        } catch (e) {
          console.error("Failed to process OAuth success", e);
        }
      }

      if (type === "GOOGLE_OAUTH_ERROR") {
        console.error("Google login failed:", error);
        alert(`Login gagal: ${error}`);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [loadData]);

  // --- Persistent Notification Effect ---
  useEffect(() => {
    import("./utils/notificationHandler").then(
      ({ updatePersistentNotification }) => {
        updatePersistentNotification(!!appSettings.persistentNotification);
      },
    );
  }, [appSettings.persistentNotification]);

  useEffect(() => {
    if (showOnboarding) return;
    try {
      const seenVersion = localStorage.getItem(SEEN_CHANGELOG_STORAGE_KEY);
      if (seenVersion !== LATEST_CHANGELOG_VERSION) {
        setShowChangelogPopup(true);
      }
    } catch (e) {
      console.warn("Failed to read changelog seen version", e);
    }
  }, [showOnboarding]);

  const handleCloseChangelogPopup = () => {
    try {
      localStorage.setItem(
        SEEN_CHANGELOG_STORAGE_KEY,
        LATEST_CHANGELOG_VERSION,
      );
    } catch (e) {
      console.warn("Failed to save changelog seen version", e);
    }
    setShowChangelogPopup(false);
  };

  const currentFeatureTutorialKey = useMemo(
    () =>
      getFeatureTutorialKey({
        activeTab,
        planSubTab,
        librarySubTab,
        moneyView,
        isControlCenterOpen,
      }),
    [activeTab, isControlCenterOpen, librarySubTab, moneyView, planSubTab],
  );

  useEffect(() => {
    if (
      showOnboarding ||
      showChangelogPopup ||
      featureTutorialsDisabled ||
      activeFeatureTutorialKey
    )
      return;
    if (seenFeatureTutorials.includes(currentFeatureTutorialKey)) return;

    const timeout = window.setTimeout(() => {
      setActiveFeatureTutorialKey(currentFeatureTutorialKey);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [
    activeFeatureTutorialKey,
    currentFeatureTutorialKey,
    featureTutorialsDisabled,
    seenFeatureTutorials,
    showChangelogPopup,
    showOnboarding,
  ]);

  const markFeatureTutorialSeen = (key: FeatureTutorialKey) => {
    setSeenFeatureTutorials((prev) => {
      const next = prev.includes(key) ? prev : [...prev, key];
      try {
        localStorage.setItem(
          FEATURE_TUTORIALS_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch (e) {
        console.warn("Failed to save feature tutorial state", e);
      }
      return next;
    });
  };

  const handleCloseFeatureTutorial = () => {
    if (activeFeatureTutorialKey)
      markFeatureTutorialSeen(activeFeatureTutorialKey);
    setActiveFeatureTutorialKey(null);
  };

  const handleDisableFeatureTutorials = () => {
    try {
      localStorage.setItem(FEATURE_TUTORIALS_DISABLED_KEY, "true");
    } catch (e) {
      console.warn("Failed to disable feature tutorials", e);
    }
    setFeatureTutorialsDisabled(true);
    if (activeFeatureTutorialKey)
      markFeatureTutorialSeen(activeFeatureTutorialKey);
    setActiveFeatureTutorialKey(null);
  };

  // --- Handle Reply from URL ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const replyText = params.get("reply");
    if (replyText) {
      // Small delay to ensure everything is loaded
      setTimeout(() => {
        handleSendRef.current(replyText);
      }, 500);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Theme Effect ---
  useEffect(() => {
    // Apply theme to HTML element
    const theme = appSettings.theme || "dark";
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [appSettings.theme]);

  // --- Keyboard Detection Effect ---
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        // Calculate how much the visual viewport has been offset from the bottom of the layout viewport
        // This happens when the keyboard pushes the visual viewport up, but the layout viewport remains the same height
        const offset =
          window.innerHeight -
          (window.visualViewport.height + window.visualViewport.offsetTop);
        const safeOffset = Math.max(0, offset);

        if (fixedBottomRef.current) {
          // Apply directly to DOM to avoid React state batching delays during fast scrolling
          fixedBottomRef.current.style.transform = `translateY(-${safeOffset}px)`;
        }

        // Also update keyboard open state based on visual viewport height vs screen height
        const isKeyboardOpen =
          window.visualViewport.height < window.screen.height * 0.75;
        setIsMobileKeyboardOpen(isKeyboardOpen);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);
      handleResize(); // Initial check
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      }
    };
  }, []);

  // --- Back Handler Logic ---
  const exitWarningRef = useRef(false);
  const [showExitToast, setShowExitToast] = useState(false);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const handled = BackHandler.handle();
      if (handled) {
        window.history.pushState({ page: "app" }, "", window.location.href);
      } else {
        if (!exitWarningRef.current) {
          exitWarningRef.current = true;
          setShowExitToast(true);
          window.history.pushState({ page: "app" }, "", window.location.href);
          setTimeout(() => {
            exitWarningRef.current = false;
            setShowExitToast(false);
          }, 2000);
        } else {
          window.history.back();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        BackHandler.handle();
      }
    };

    window.history.pushState({ page: "app" }, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (deleteId)
      return BackHandler.register(() => {
        setDeleteId(null);
        setDeleteType(null);
        return true;
      });
  }, [deleteId]);
  useEffect(() => {
    if (themeEditMode)
      return BackHandler.register(() => {
        setThemeEditMode(false);
        return true;
      });
  }, [themeEditMode]);
  useEffect(() => {
    if (skillModal.isOpen)
      return BackHandler.register(() => {
        setSkillModal((prev) => ({ ...prev, isOpen: false }));
        return true;
      });
  }, [skillModal.isOpen]);
  useEffect(() => {
    if (walletModal.isOpen)
      return BackHandler.register(() => {
        setWalletModal((prev) => ({ ...prev, isOpen: false }));
        return true;
      });
  }, [walletModal.isOpen]);
  useEffect(() => {
    if (routineModalOpen)
      return BackHandler.register(() => {
        setRoutineModalOpen(false);
        return true;
      });
  }, [routineModalOpen]);
  useEffect(() => {
    if (showChangelogPopup)
      return BackHandler.register(() => {
        handleCloseChangelogPopup();
        return true;
      });
  }, [showChangelogPopup]);
  useEffect(() => {
    if (activeFeatureTutorialKey)
      return BackHandler.register(() => {
        handleCloseFeatureTutorial();
        return true;
      });
  }, [activeFeatureTutorialKey]);
  useEffect(() => {
    if (addTaskModal.isOpen)
      return BackHandler.register(() => {
        setAddTaskModal((prev) => ({ ...prev, isOpen: false }));
        return true;
      });
  }, [addTaskModal.isOpen]);
  useEffect(() => {
    if (addShoppingModal.isOpen)
      return BackHandler.register(() => {
        setAddShoppingModal((prev) => ({ ...prev, isOpen: false }));
        return true;
      });
  }, [addShoppingModal.isOpen]);
  useEffect(() => {
    if (addExpenseModalOpen)
      return BackHandler.register(() => {
        setAddExpenseModalOpen(false);
        return true;
      });
  }, [addExpenseModalOpen]);
  useEffect(() => {
    if (addNoteModalOpen)
      return BackHandler.register(() => {
        setAddNoteModalOpen(false);
        return true;
      });
  }, [addNoteModalOpen]);
  useEffect(() => {
    if (isControlCenterOpen)
      return BackHandler.register(() => {
        setIsControlCenterOpen(false);
        return true;
      });
  }, [isControlCenterOpen]);
  useEffect(() => {
    if (isChatOpen)
      return BackHandler.register(() => {
        setIsChatOpen(false);
        return true;
      });
  }, [isChatOpen]);
  useEffect(() => {
    if (isSearchExpanded)
      return BackHandler.register(() => {
        setIsSearchExpanded(false);
        return true;
      });
  }, [isSearchExpanded]);

  useEffect(() => {
    if (activeTab === "money" && moneyView !== "transactions")
      return BackHandler.register(() => {
        setMoneyView("transactions");
        return true;
      });
  }, [activeTab, moneyView]);

  useEffect(() => {
    if (activeTab === "money" && securitySettings.lockTabTransaction) {
      setActiveTab("summary");
      openLockedSecurityPopup('lockTabTransaction', 'Money tab is locked on this device.');
    }
  }, [activeTab, securitySettings.lockTabTransaction]);
  useEffect(() => {
    if (activeTab === "plan" && planSubTab !== "tasks")
      return BackHandler.register(() => {
        setPlanSubTab("tasks");
        return true;
      });
  }, [activeTab, planSubTab]);
  useEffect(() => {
    if (activeTab === "library" && librarySubTab !== "general")
      return BackHandler.register(() => {
        setLibrarySubTab("general");
        return true;
      });
  }, [activeTab, librarySubTab]);
  useEffect(() => {
    if (activeTab !== "summary")
      return BackHandler.register(() => {
        setActiveTab("summary");
        return true;
      });
  }, [activeTab]);

  // --- Handlers ---

  const handleAppSend = (text: string) => {
    const lower = text.toLowerCase().trim();
    const isQuestion =
      lower.endsWith("?") ||
      [
        "apa",
        "apakah",
        "bagaimana",
        "kenapa",
        "mengapa",
        "siapa",
        "kapan",
        "berapa",
        "tolong",
        "tanya",
        "ask",
        "can you",
        "how",
        "what",
        "why",
        "when",
        "where",
        "who",
        "saran",
        "suggest",
      ].some((word) => lower.startsWith(word));

    if (isQuestion || isChatOpen) {
      setNewChatMessage({ text, id: uuidv4() });
      setIsChatOpen(true);
    } else {
      handleSend(text);
    }
  };

  const authorizeSecurityPassword = async (
    options: SecurityPasswordRequestOptions = {},
  ): Promise<boolean> => {
    const allowCreate = options.allowCreate ?? false;
    let encryptedPassword = appSettings.securityPasswordHash || null;

    try {
      if (!encryptedPassword) {
        encryptedPassword = await fetchSecurityPasswordHash();
      }
    } catch (error) {
      console.error('Failed to load security password', error);
      alert('Security password could not be loaded from Themes & Settings. Please check the spreadsheet connection.');
      return false;
    }

    if (!encryptedPassword) {
      if (!allowCreate) {
        alert('Security password has not been created yet.');
        return false;
      }

      const createdPassword = window.prompt('Create a security password first.');
      if (!createdPassword) return false;
      const confirmedPassword = window.prompt('Confirm the security password.');
      if (confirmedPassword !== createdPassword) {
        alert('Password confirmation does not match.');
        return false;
      }

      const newEncryptedPassword = encryptSecurityPassword(createdPassword);
      try {
        await saveSecurityPasswordHash(newEncryptedPassword);
      } catch (error) {
        console.error('Failed to save security password', error);
        alert('Security password could not be saved to Themes & Settings.');
        return false;
      }

      setAppSettings({ ...appSettings, securityPasswordHash: newEncryptedPassword });
      return true;
    }

    if (!appSettings.securityPasswordHash) {
      setAppSettings({ ...appSettings, securityPasswordHash: encryptedPassword });
    }

    const actionLabel = options.actionLabel || 'change this security setting';
    const enteredPassword = window.prompt(`Fill password to ${actionLabel}.`);
    if (enteredPassword === null) return false;
    if (!verifySecurityPassword(enteredPassword, encryptedPassword)) {
      alert('Wrong password.');
      return false;
    }

    return true;
  };

  const handleDisableLockedSecurity = async () => {
    if (!lockedSecurityPopup) return;
    const ok = await authorizeSecurityPassword({
      allowCreate: false,
      actionLabel: 'disable this security setting',
    });
    if (!ok) return;

    setSecuritySettings({
      ...securitySettings,
      [lockedSecurityPopup.target]: false,
    });
    setLockedSecurityPopup(null);
  };

  const handleSettingsSaved = (
    newBudgetConfig?: BudgetConfig,
    newPrompt?: string,
    newAppSettings?: AppSettings,
  ) => {
    // Don't close control center immediately on save, let user close it
    // setIsControlCenterOpen(false);

    let shouldSync = false;
    if (newBudgetConfig) {
      setBudgetConfig(newBudgetConfig);
      shouldSync = true;
    }
    if (newPrompt !== undefined) {
      setCustomPrompt(newPrompt);
      shouldSync = true;
    }
    if (newAppSettings) {
      setAppSettings(newAppSettings);
      shouldSync = true;
    }

    if (shouldSync) {
      saveAndSync(
        items,
        newBudgetConfig,
        newPrompt,
        skills,
        wallets,
        monthlyThemes,
        newAppSettings,
      );
    } else {
      loadData();
    }
  };

  const closeThemeEditor = () => {
    setThemeEditMode(false);
    setThemeEditKey(null);
  };

  const handleSaveTheme = () => {
    const key = themeEditKey || getThemeMonthKey(themeNavDate);
    const nextThemes = { ...monthlyThemes };
    const trimmedContent = tempThemeContent.trim();

    if (trimmedContent) {
      nextThemes[key] = tempThemeContent;
    } else {
      delete nextThemes[key];
    }

    const nextThemeImages = { ...monthlyThemeImages };
    const trimmedImageUrl = tempThemeImageUrl.trim();

    if (trimmedImageUrl) {
      nextThemeImages[key] = trimmedImageUrl;
    } else {
      delete nextThemeImages[key];
    }

    setMonthlyThemes(nextThemes);
    setMonthlyThemeImages(nextThemeImages);
    saveAndSync(
      items,
      undefined,
      undefined,
      undefined,
      undefined,
      nextThemes,
      undefined,
      undefined,
      false,
      nextThemeImages,
    );
    closeThemeEditor();
  };

  const handleConfirmDelete = () => {
    if (deleteType === "skill" && deleteId) {
      const updated = skills.filter((s) => s.id !== deleteId);
      const updatedItems = syncSkillRoutineItems(items, updated);
      setSkills(updated);
      setItems(updatedItems);
      saveAndSync(updatedItems, undefined, undefined, updated, wallets, monthlyThemes);
    } else if (deleteType === "wallet" && deleteId) {
      const updated = wallets.filter((w) => w.id !== deleteId);
      setWallets(updated);
      saveAndSync(items, undefined, undefined, skills, updated, monthlyThemes);
    } else if (deleteId) {
      handleDelete(deleteId); // Call actual delete logic after confirmation
    }
    setDeleteId(null);
    setDeleteType(null);
  };

  const requestDeleteItem = (id: string) => {
    setDeleteId(id);
    setDeleteType(null);
  };

  // --- Data Management Handlers ---
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        // Basic validation
        if (data.items && Array.isArray(data.items)) {
          // Update all states
          saveAndSync(
            data.items,
            data.budgetConfig || budgetConfig,
            data.customPrompt || customPrompt,
            data.skills || skills,
            data.wallets || wallets,
            data.monthlyThemes || monthlyThemes,
            data.appSettings || appSettings,
          );
          alert("Data imported successfully!");
          setIsControlCenterOpen(false);
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) {
        console.error("Import error:", err);
        alert("Failed to parse backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = async () => {
    await saveAndSync(
      [],
      undefined,
      undefined,
      [],
      [],
      {},
      undefined,
      undefined,
      true,
    );
    clearSpreadsheetConfig();
    setIsControlCenterOpen(false);
    window.location.reload();
  };

  // --- Skill & Wallet Modal Handlers ---
  const handleOpenAddSkill = () => setSkillModal({ isOpen: true, mode: "add" });
  const handleOpenEditSkill = (id: string, name: string, target?: number) => {
    const existingSkill = skills.find((s) => s.id === id);
    setSkillModal({
      isOpen: true,
      mode: "edit",
      skillId: id,
      initialSkill: existingSkill || {
        id,
        name,
        weeklyTargetMinutes: target,
        color: "indigo-500",
        created_at: new Date().toISOString(),
      },
    });
  };

  const handleOpenAddWallet = () =>
    setWalletModal({ isOpen: true, mode: "add" });
  const handleOpenEditWallet = (wallet: Wallet) =>
    setWalletModal({
      isOpen: true,
      mode: "edit",
      walletId: wallet.id,
      initialData: wallet,
    });

  const handleSaveSkill = (payload: SkillModalPayload) => {
    const name = payload.name.trim();
    if (!name) return;

    let updatedSkills = skills;

    if (skillModal.mode === "add") {
      const newSkill: Skill = {
        id: uuidv4(),
        name,
        description: payload.description?.trim() || undefined,
        imageUrl: payload.imageUrl?.trim() || undefined,
        color: "indigo-500",
        created_at: new Date().toISOString(),
        weeklyTargetMinutes: payload.weeklyTargetMinutes,
        schedule: payload.schedule,
      };
      updatedSkills = [...skills, newSkill];
    } else if (skillModal.mode === "edit" && skillModal.skillId) {
      updatedSkills = skills.map((s) =>
        s.id === skillModal.skillId ? {
          ...s,
          name,
          description: payload.description?.trim() || undefined,
          imageUrl: payload.imageUrl?.trim() || undefined,
          weeklyTargetMinutes: payload.weeklyTargetMinutes,
          schedule: payload.schedule,
        } : s,
      );
    }

    const updatedItems = syncSkillRoutineItems(items, updatedSkills);
    setSkills(updatedSkills);
    setItems(updatedItems);
    saveAndSync(updatedItems, undefined, undefined, updatedSkills, wallets, monthlyThemes);
    setSkillModal({ ...skillModal, isOpen: false });
  };

  const handleSaveWallet = (
    name: string,
    type: Wallet["type"],
    initialBalance: number,
    color: string,
  ) => {
    if (!name.trim()) return;
    if (walletModal.mode === "add") {
      const newWallet: Wallet = {
        id: uuidv4(),
        name,
        type,
        initialBalance,
        color,
      };
      const updated = [...wallets, newWallet];
      setWallets(updated);
      saveAndSync(items, undefined, undefined, skills, updated, monthlyThemes);
    } else if (walletModal.mode === "edit" && walletModal.walletId) {
      const updated = wallets.map((w) =>
        w.id === walletModal.walletId
          ? { ...w, name, type, initialBalance, color }
          : w,
      );
      setWallets(updated);
      saveAndSync(items, undefined, undefined, skills, updated, monthlyThemes);
    }
    setWalletModal({ ...walletModal, isOpen: false });
  };

  // Unique Tags for Filter (Memoized locally since it's UI specific)
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    let targetItems: BrainDumpItem[] = [];

    if (activeTab === "money") {
      targetItems = items.filter(
        (i) =>
          (i.type === "FINANCE" &&
            (i.status === "done" || i.status === "pending") &&
            (i.meta.amount || 0) > 0) ||
          ((i.type === "SHOPPING" || i.type === "TODO") &&
            i.status === "done" &&
            (i.meta.amount || 0) > 0),
      );
    } else if (activeTab === "library") {
      if (librarySubTab === "general") {
        targetItems = items.filter((i) => i.type === ItemType.NOTE);
      } else if (librarySubTab === "skills") {
        targetItems = [];
      } else {
        targetItems = items.filter(
          (i) =>
            i.type === "JOURNAL" ||
            (i.type === ItemType.TODO && i.status === "done"),
        );
      }
    } else if (activeTab === "plan") {
      targetItems = items.filter(
        (i) => i.type === "TODO" || i.type === "EVENT" || i.type === "SHOPPING",
      );
    } else {
      targetItems = items;
    }

    targetItems.forEach((i) =>
      i.meta?.tags?.forEach((t) => {
        if (t && t !== "null" && t !== "undefined") tags.add(t);
      }),
    );

    return Array.from(tags).sort();
  }, [items, activeTab, librarySubTab]);

  const savingGoals = useMemo(() => {
    const { savings, investments } = getShoppingItems(items);
    return [...savings, ...investments];
  }, [items]);

  const handleOnboardingComplete = (
    settings: AppSettings,
    wallet: Wallet | null,
    budget: BudgetConfig | null,
    sampleItems: BrainDumpItem[],
  ) => {
    localStorage.setItem("braindump_onboarding_completed", "true");
    setShowOnboarding(false);

    setAppSettings(settings);

    const newWallets = wallet ? [wallet] : [];
    if (wallet) setWallets(newWallets);

    if (budget) setBudgetConfig(budget);

    saveAndSync(
      sampleItems.length > 0 ? [...items, ...sampleItems] : items,
      budget || budgetConfig,
      customPrompt,
      skills,
      newWallets.length > 0 ? newWallets : wallets,
      monthlyThemes,
      settings,
      undefined,
      true, // force overwrite
    );
  };

  const handleOnboardingTestParsing = async (
    text: string,
    context?: { wallet?: Wallet | null },
  ): Promise<BrainDumpItem[]> => {
    const previewWallets = context?.wallet ? [context.wallet] : wallets;
    const parsed = await classifyText(
      text,
      [],
      skills.map((s) => s.name),
      0,
      customPrompt,
      appSettings.parsingModel,
      previewWallets,
      budgetConfig?.rules || [],
    );

    const now = new Date().toISOString();
    return parsed.map((partial) => {
      const type =
        partial.type &&
        Object.values(ItemType).includes(partial.type as ItemType)
          ? (partial.type as ItemType)
          : ItemType.NOTE;
      const isRecord =
        type === ItemType.FINANCE ||
        type === ItemType.JOURNAL ||
        type === ItemType.SKILL_LOG;
      const meta = { ...(partial.meta || {}) };
      if ((type === ItemType.TODO || type === ItemType.EVENT) && !meta.priority)
        meta.priority = "normal";
      if (type === ItemType.JOURNAL && !meta.date) meta.date = now;

      return {
        id: uuidv4(),
        type,
        content: partial.content || text,
        status: isRecord ? "done" : "pending",
        created_at: now,
        completed_at: isRecord ? now : undefined,
        meta,
        isOptimistic: false,
      };
    });
  };

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={handleOnboardingComplete}
        onTestParsing={handleOnboardingTestParsing}
      />
    );
  }

  return (
    <div
      className={responsiveShellClass.root}
      data-active-tab={activeTab}
      data-plan-subtab={planSubTab}
      data-library-subtab={librarySubTab}
      data-money-view={moneyView}
    >
      <DesktopNavRail
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        planSubTab={planSubTab}
        setPlanSubTab={setPlanSubTab}
        librarySubTab={librarySubTab}
        setLibrarySubTab={setLibrarySubTab}
        pendingCount={pendingCount}
        reviewQueueCount={reviewCenterBadgeCount}
        saveStatus={saveStatus}
        saveProgress={saveProgress}
        fetchStatus={fetchStatus}
        onSyncClick={() => saveAndSync(items)}
        onRefreshClick={() => loadData()}
        onSettingsClick={() => setIsControlCenterOpen(true)}
        onOpenReviewCenter={openReviewCenterFromInput}
        error={error}
      />

      {/* Main Content */}
      <main className={responsiveShellClass.main}>
        <div
          className={responsiveShellContentClass[activeShellContentVariant]}
          data-shell-variant={activeShellContentVariant}
        >
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted animate-pulse pt-24">
              <div className="w-12 h-12 bg-surface rounded-full mb-4"></div>
              <p>Syncing...</p>
            </div>
          ) : (
            <div className="w-full">
              {activeTab === "summary" && (
                <SummaryView
                  items={items}
                  skills={skills}
                  wallets={wallets}
                  budgetConfig={budgetConfig}
                  appSettings={secureAppSettings}
                  themeNavDate={themeNavDate}
                  setThemeNavDate={setThemeNavDate}
                  monthlyThemes={monthlyThemes}
                  monthlyThemeImages={monthlyThemeImages}
                  onThemeEdit={(content, context) => {
                    const key = context?.key || getThemeMonthKey(themeNavDate);
                    setThemeEditKey(key);
                    setTempThemeContent(content);
                    setTempThemeImageUrl(
                      context?.heroImage || monthlyThemeImages[key] || "",
                    );
                    setThemeEditMode(true);
                  }}
                  handleToggleStatus={handleToggleStatus}
                  setActiveTab={handleSetActiveTab}
                  setPlanSubTab={setPlanSubTab}
                  showBalance={effectiveShowBalance}
                  setShowBalance={handleSetShowBalance}
                  pendingReviews={pendingReviews}
                  handleApproveReview={handleApproveReview}
                  handleRejectReview={handleRejectReview}
                  parsingTasks={parsingTasks}
                  retryParsing={retryParsing}
                  clearParsingTask={clearParsingTask}
                  undoParsingTask={undoSuccessfulParsingTask}
                  deleteParsingTaskEntries={deleteSuccessfulParsingTaskEntries}
                  handleOpenAddTask={(date) =>
                    setAddTaskModal({ isOpen: true, initialDate: date })
                  }
                  handleOpenAddShopping={(category) =>
                    setAddShoppingModal({
                      isOpen: true,
                      initialCategory: category,
                    })
                  }
                  handleOpenAddExpense={() => setAddExpenseModalOpen(true)}
                  handleOpenAddNote={() => {
                    setAddNoteModalType(ItemType.NOTE);
                    setAddNoteModalOpen(true);
                  }}
                  handleUpdateItem={handleUpdateItem}
                  handleDelete={requestDeleteItem}
                  handleKeepRawTodo={handleKeepRawTodo}
                  handleRetriggerDeepWorkTodo={handleRetriggerDeepWorkTodo}
                  handleAcceptDeepWorkTodo={handleAcceptDeepWorkTodo}
                  handleResetRoutine={handleResetRoutine}
                />
              )}

              {activeTab === "plan" && (
                <PlanView
                  items={items}
                  skills={skills}
                  planSubTab={planSubTab}
                  setPlanSubTab={setPlanSubTab}
                  focusDate={focusDate}
                  setFocusDate={setFocusDate}
                  appSettings={secureAppSettings}
                  handleToggleStatus={handleToggleStatus}
                  handleDelete={requestDeleteItem}
                  handleKeepRawTodo={handleKeepRawTodo}
                  handleRetriggerDeepWorkTodo={handleRetriggerDeepWorkTodo}
                  handleAcceptDeepWorkTodo={handleAcceptDeepWorkTodo}
                  handleUpdateItem={handleUpdateItem}
                  handleOpenAddRoutine={() => setRoutineModalOpen(true)}
                  handleOpenAddTask={(date) =>
                    setAddTaskModal({ isOpen: true, initialDate: date })
                  }
                  handleOpenAddShopping={(category) =>
                    setAddShoppingModal({
                      isOpen: true,
                      initialCategory: category,
                    })
                  }
                  handleOpenEditSkill={handleOpenEditSkill}
                  handleOpenAddSkill={handleOpenAddSkill}
                  setDeleteId={setDeleteId}
                  setDeleteType={setDeleteType}
                  searchQuery={searchQuery}
                  selectedTag={selectedTag}
                  wallets={wallets}
                  budgetRules={budgetConfig.rules}
                  handleResetRoutine={handleResetRoutine}
                  onAddFunds={handleAddSavingTransaction}
                  onCompleteGoal={(goal) => {
                    if (
                      confirm(
                        `Complete goal "${goal.content}"? This will record it in Transactions as Achieved Goals and release the reserved savings from its wallet.`,
                      )
                    ) {
                      handleToggleStatus(goal.id);
                    }
                  }}
                  setActiveTab={handleSetActiveTab}
                />
              )}

              {activeTab === "library" && (
                <LibraryView
                  items={items}
                  skills={skills}
                  librarySubTab={librarySubTab}
                  setLibrarySubTab={setLibrarySubTab}
                  appSettings={secureAppSettings}
                  handleDelete={requestDeleteItem}
                  handleUpdateItem={handleUpdateItem}
                  handleOpenEditSkill={handleOpenEditSkill}
                  handleOpenAddSkill={handleOpenAddSkill}
                  handleUpsertSkillSessionLog={handleUpsertSkillSessionLog}
                  setDeleteId={setDeleteId}
                  setDeleteType={setDeleteType}
                  selectedTag={selectedTag}
                  filterDate={filterDate}
                  filterDateTo={filterDateTo}
                  searchQuery={searchQuery}
                  sortOrder={sortOrder}
                  setActiveTab={handleSetActiveTab}
                  onAddItem={(type) => {
                    if (type === ItemType.NOTE) {
                      setAddNoteModalType(ItemType.NOTE);
                      setAddNoteModalOpen(true);
                    }
                    if (type === ItemType.JOURNAL) {
                      setAddNoteModalType(ItemType.JOURNAL);
                      setAddNoteModalOpen(true);
                    }
                  }}
                />
              )}

              {activeTab === "money" && !securitySettings.lockTabTransaction && (
                <MoneyViewComponent
                  items={items}
                  wallets={wallets}
                  budgetConfig={budgetConfig}
                  moneyView={moneyView}
                  setMoneyView={handleSetMoneyView}
                  financeDate={financeDate}
                  setFinanceDate={setFinanceDate}
                  showBalance={effectiveShowBalance}
                  setShowBalance={handleSetShowBalance}
                  appSettings={secureAppSettings}
                  handleDelete={requestDeleteItem}
                  handleUpdateItem={handleUpdateItem}
                  handleToggleStatus={handleToggleStatus}
                  handleOpenEditWallet={handleOpenEditWallet}
                  handleOpenAddWallet={handleOpenAddWallet}
                  setDeleteId={setDeleteId}
                  setDeleteType={setDeleteType}
                  setIsSettingsOpen={setIsControlCenterOpen}
                  filterWallet={filterWallet}
                  filterTransactionType={filterTransactionType}
                  filterCategory={filterCategory}
                  filterMinAmount={filterMinAmount}
                  filterMaxAmount={filterMaxAmount}
                  selectedTag={selectedTag}
                  searchQuery={searchQuery}
                  sortOrder={sortOrder}
                  savingGoals={savingGoals}
                  setActiveTab={handleSetActiveTab}
                  onAddItem={(type) => {
                    if (type === ItemType.FINANCE) setAddExpenseModalOpen(true);
                  }}
                />
              )}

              {activeTab === "calendar" && (
                <CalendarView
                  items={items}
                  handleToggleStatus={handleToggleStatus}
                  handleDelete={requestDeleteItem}
                  appSettings={secureAppSettings}
                  setActiveTab={handleSetActiveTab}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Fixed Bottom Layout */}
      <div
        ref={fixedBottomRef}
        data-keyboard-open={isMobileKeyboardOpen ? "true" : "false"}
        className={responsiveShellClass.fixedBottom}
      >
        <div
          className={
            responsiveShellComposerContentClass[activeShellContentVariant]
          }
          data-shell-composer-variant={activeShellContentVariant}
        >
          <FloatingChatBox
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            items={items}
            budgetConfig={budgetConfig}
            wallets={wallets}
            skills={skills}
            monthlyThemes={monthlyThemes}
            newMessage={newChatMessage}
            chatHistory={chatHistory}
            onUpdateHistory={handleUpdateChatHistory}
            onResetChat={handleResetChat}
            chatModel={appSettings.chatModel}
          />
          <InputBar
            onSend={handleAppSend}
            onFocus={() => {
              setIsSearchExpanded(false);
            }}
            saveStatus={saveStatus}
            saveProgress={saveProgress}
            fetchStatus={fetchStatus}
            pendingCount={pendingCount}
            isChatOpen={isChatOpen}
            onOpenChat={() => setIsChatOpen(!isChatOpen)}
            showReviewCenterButton={showReviewCenterNudge}
            reviewCenterActive={hasRunningProcess}
            reviewCenterCount={reviewCenterBadgeCount}
            onOpenReviewCenter={openReviewCenterFromInput}
            startAction={
              activeTab === "library" || activeTab === "money" ? (
                <FloatingSearch
                  activeTab={activeTab}
                  librarySubTab={librarySubTab}
                  moneyView={moneyView}
                  isSearchExpanded={isSearchExpanded}
                  setIsSearchExpanded={setIsSearchExpanded}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedTag={selectedTag}
                  setSelectedTag={setSelectedTag}
                  filterDate={filterDate}
                  setFilterDate={setFilterDate}
                  filterDateTo={filterDateTo}
                  setFilterDateTo={setFilterDateTo}
                  sortOrder={sortOrder}
                  setSortOrder={setSortOrder}
                  filterWallet={filterWallet}
                  setFilterWallet={setFilterWallet}
                  filterTransactionType={filterTransactionType}
                  setFilterTransactionType={setFilterTransactionType}
                  filterCategory={filterCategory}
                  setFilterCategory={setFilterCategory}
                  filterMinAmount={filterMinAmount}
                  setFilterMinAmount={setFilterMinAmount}
                  filterMaxAmount={filterMaxAmount}
                  setFilterMaxAmount={setFilterMaxAmount}
                  uniqueTags={uniqueTags}
                  wallets={wallets}
                  budgetConfig={budgetConfig}
                  savingGoals={savingGoals}
                />
              ) : null
            }
          />
        </div>

        <div
          data-mobile-bottom-stack-wrap="true"
          className={`${responsiveShellClass.bottomNavWrap} ${isMobileKeyboardOpen ? "hidden md:block" : "block"}`}
        >
          <BottomNav
            activeTab={activeTab}
            setActiveTab={handleSetActiveTab}
            planSubTab={planSubTab}
            setPlanSubTab={setPlanSubTab}
            librarySubTab={librarySubTab}
            setLibrarySubTab={setLibrarySubTab}
            onMenuClick={() => setIsControlCenterOpen(true)}
          />
        </div>
      </div>

      {/* Modals */}
      <ControlCenter
        isOpen={isControlCenterOpen}
        onClose={() => setIsControlCenterOpen(false)}
        saveStatus={saveStatus}
        saveProgress={saveProgress}
        fetchProgress={fetchProgress}
        fetchStatus={fetchStatus}
        onSyncClick={(forceOverwrite) =>
          saveAndSync(
            items,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            forceOverwrite,
          )
        }
        onRefreshClick={() => loadData()}
        onRunCanonicalBackfill={runCanonicalBackfill}
        canonicalRules={canonicalRules}
        pendingReviews={pendingReviews}
        onToggleCanonicalRuleDisabled={toggleCanonicalRuleDisabled}
        appSettings={appSettings}
        setAppSettings={setAppSettings}
        error={error}
        pendingCount={pendingCount}
        parsingTasks={parsingTasks}
        enrichmentTasks={enrichmentTasks}
        retryParsing={retryParsing}
        onSave={handleSettingsSaved}
        currentBudgetConfig={budgetConfig}
        currentPrompt={customPrompt}
        allItems={items}
        allSkills={skills}
        allWallets={wallets}
        monthlyThemes={monthlyThemes}
        monthlyThemeImages={monthlyThemeImages}
        onImportData={handleImportData}
        onClearData={handleClearData}
        securitySettings={securitySettings}
        onSecuritySettingsChange={setSecuritySettings}
        authorizeSecurityPassword={authorizeSecurityPassword}
      />

      <FeatureTutorialPopup
        tutorial={
          activeFeatureTutorialKey
            ? FEATURE_TUTORIALS[activeFeatureTutorialKey]
            : null
        }
        onClose={handleCloseFeatureTutorial}
        onDisableAll={handleDisableFeatureTutorials}
      />

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isReviewCenterOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeReviewCenterFromInput}
                  className="fixed inset-0 bg-black/40 z-[94]"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, x: "-50%", y: 20 }}
                  animate={{ opacity: 1, scale: 1, x: "-50%", y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, x: "-50%", y: 20 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="fixed left-1/2 bottom-28 z-[95] w-[calc(100vw-2rem)] max-w-2xl max-h-[70vh] bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:left-[calc(18rem+((100vw-18rem)/2))] lg:bottom-24 lg:max-w-3xl"
                >
                  <div className="flex items-center justify-between p-4 border-b border-border bg-surface shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-indigo-500" />
                      Review Center
                    </h3>
                    <div className="flex items-center gap-2">
                      {pendingReviews.length > 0 && (
                        <span className="text-xs bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                          {pendingReviews.length} Pending
                        </span>
                      )}
                      {hasRunningProcess && (
                        <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                          Running
                        </span>
                      )}
                      <button
                        onClick={closeReviewCenterFromInput}
                        className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors ml-1"
                        aria-label="Close Review Center"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <ReviewCenterPanel
                    parsingTasks={parsingTasks}
                    enrichmentTasks={enrichmentTasks}
                    pendingReviews={pendingReviews}
                    onApproveReview={handleApproveReview}
                    onRejectReview={handleRejectReview}
                    retryParsing={retryParsing}
                    clearParsingTask={clearParsingTask}
                    undoParsingTask={undoSuccessfulParsingTask}
                    deleteParsingTaskEntries={
                      deleteSuccessfulParsingTaskEntries
                    }
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <AnimatePresence>
        {showChangelogPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="bg-surface border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-border flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                      What's new
                    </div>
                    <h3 className="text-xl font-bold text-primary">
                      {LATEST_CHANGELOG.version}
                    </h3>
                    <p className="text-xs text-muted">
                      {LATEST_CHANGELOG.date}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseChangelogPopup}
                  className="p-2 rounded-xl text-muted hover:text-primary hover:bg-muted/10 transition-colors"
                  aria-label="Close changelog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <ul className="space-y-3 text-sm text-muted list-disc pl-5">
                  {LATEST_CHANGELOG.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <button
                  onClick={handleCloseChangelogPopup}
                  className="w-full py-3 rounded-2xl bg-primary text-background font-bold hover:opacity-90 transition-opacity"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {themeEditMode && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h3 className="text-lg font-bold text-primary">Add Theme</h3>
                <p className="mt-1 text-xs font-medium text-muted">
                  {themeEditKey || getThemeMonthKey(themeNavDate)} · mission
                  text and hero image URL
                </p>
              </div>
              <button
                onClick={closeThemeEditor}
                className="rounded-full p-2 text-muted transition-colors hover:bg-black/5 hover:text-primary dark:hover:bg-white/10"
                aria-label="Close add theme modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
                  Mission
                </span>
                <textarea
                  autoFocus
                  className="h-32 w-full resize-none rounded-2xl border border-border bg-background p-4 text-primary focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. Month of Discipline, Focus on Skill X..."
                  value={tempThemeContent}
                  onChange={(e) => setTempThemeContent(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
                  Theme image URL
                </span>
                <input
                  type="url"
                  inputMode="url"
                  className="w-full rounded-2xl border border-border bg-background p-4 text-primary focus:border-indigo-500 focus:outline-none"
                  placeholder="https://example.com/theme-image.jpg"
                  value={tempThemeImageUrl}
                  onChange={(e) => setTempThemeImageUrl(e.target.value)}
                />
              </label>

              {tempThemeImageUrl.trim() ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-background">
                  <img
                    src={tempThemeImageUrl.trim()}
                    alt="Theme preview"
                    className="h-44 w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex min-h-32 items-center gap-4 rounded-2xl border border-dashed border-border bg-background/70 p-4 text-muted">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted/10">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">
                      No image URL yet
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">
                      Paste an image URL here; the Summary hero will use it
                      immediately after saving.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-6">
              <button
                onClick={closeThemeEditor}
                className="px-5 py-2.5 rounded-xl text-sm text-muted hover:text-primary font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTheme}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
              >
                Save Theme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Warning Toast */}
      <AnimatePresence>
        {showExitToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 50, x: "-50%" }}
            className="fixed bottom-24 left-1/2 z-[100] bg-zinc-800 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium whitespace-nowrap"
          >
            Press back button once more to exit
          </motion.div>
        )}
      </AnimatePresence>

      <SkillModal
        isOpen={skillModal.isOpen}
        onClose={() => setSkillModal({ ...skillModal, isOpen: false })}
        onSave={handleSaveSkill}
        initialSkill={skillModal.initialSkill}
        mode={skillModal.mode}
      />

      <WalletModal
        isOpen={walletModal.isOpen}
        onClose={() => setWalletModal({ ...walletModal, isOpen: false })}
        onSave={handleSaveWallet}
        initialData={walletModal.initialData}
        mode={walletModal.mode}
      />

      <RoutineTaskModal
        isOpen={routineModalOpen}
        onClose={() => setRoutineModalOpen(false)}
        onSave={handleAddRoutineTask}
      />

      <AddTaskModal
        isOpen={addTaskModal.isOpen}
        onClose={() => setAddTaskModal({ isOpen: false })}
        onSave={handleAddTask}
        initialDate={addTaskModal.initialDate}
      />

      <AddShoppingModal
        isOpen={addShoppingModal.isOpen}
        onClose={() => setAddShoppingModal({ isOpen: false })}
        onSave={handleAddShoppingItem}
        initialCategory={addShoppingModal.initialCategory}
        budgetRules={budgetConfig.rules}
        wallets={wallets}
      />

      <AddExpenseModal
        isOpen={addExpenseModalOpen}
        onClose={() => setAddExpenseModalOpen(false)}
        onSave={(
          amount,
          description,
          category,
          walletId,
          date,
          type,
          toWalletId,
          savingGoalId,
          savingGoalName,
          investmentUnits,
          investmentUnitPrice,
          transactionLineItems,
          merchant,
          receiptCapture,
        ) => {
          if (type === "saving" && savingGoalId && savingGoalName) {
            handleAddSavingTransaction(
              amount,
              walletId,
              date,
              savingGoalId,
              savingGoalName,
              toWalletId,
              investmentUnits,
              investmentUnitPrice,
            );
          } else {
            if (walletId) {
              if (type === "transfer") {
                handleAddTransaction(
                  description,
                  amount,
                  type,
                  walletId,
                  category,
                  toWalletId,
                  date,
                  transactionLineItems,
                  merchant,
                  receiptCapture,
                );
              } else {
                handleAddTransaction(
                  description,
                  amount,
                  type,
                  walletId,
                  category,
                  undefined,
                  date,
                  transactionLineItems,
                  merchant,
                  receiptCapture,
                );
              }
            }
          }
        }}
        wallets={wallets}
        budgetConfig={budgetConfig}
        savingGoals={savingGoals}
        parsingModel={appSettings.parsingModel}
      />

      <AddNoteModal
        isOpen={addNoteModalOpen}
        onClose={() => setAddNoteModalOpen(false)}
        onSave={(title, content, tags) =>
          handleAddNote(title, content, tags, addNoteModalType)
        }
        mode={addNoteModalType === ItemType.JOURNAL ? "journal" : "note"}
      />

      <AnimatePresence>
        {lockedSecurityPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[98] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
            >
              <div className="border-b border-border p-5">
                <h3 className="text-xl font-bold text-primary">Locked</h3>
                <p className="mt-2 text-sm text-muted">{lockedSecurityPopup.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                <button
                  onClick={() => setLockedSecurityPopup(null)}
                  className="rounded-2xl border border-border px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-muted/10"
                >
                  Okay
                </button>
                <button
                  onClick={handleDisableLockedSecurity}
                  className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90"
                >
                  Fill Password
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Confirm Delete"
        message={
          deleteType === "skill"
            ? "Delete this skill? History will remain but tracking will stop."
            : deleteType === "wallet"
              ? "Delete this wallet? Balance history might be affected."
              : "Delete this item?"
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteId(null);
          setDeleteType(null);
        }}
      />
    </div>
  );
};

export default App;
