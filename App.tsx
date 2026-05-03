import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';

import { motion, AnimatePresence } from 'framer-motion';
import { BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, Tab, PlanSubTab, LibrarySubTab, MoneyView, SortOrder, ItemType, ShoppingCategory } from './types';
import { useBrainDumpData } from './hooks/useBrainDumpData';
import { getShoppingItems } from './utils/selectors';
import { clearSpreadsheetConfig } from './services/spreadsheetService';
import { BackHandler } from './utils/backHandler';

import InputBar from './components/InputBar';
import SkillModal from './components/SkillModal';
import WalletModal from './components/WalletModal';
import ConfirmDialog from './components/ConfirmDialog';

import BottomNav from './components/BottomNav';
import FloatingSearch from './components/FloatingSearch';
import ControlCenter from './components/ControlCenter';

import SummaryView from './components/views/SummaryView';
import PlanView from './components/views/PlanView';
import LibraryView from './components/views/LibraryView';
import MoneyViewComponent from './components/views/MoneyView';
import CalendarView from './components/views/CalendarView';
import RoutineTaskModal from './components/RoutineTaskModal';
import AddTaskModal from './components/AddTaskModal';
import AddShoppingModal from './components/AddShoppingModal';
import AddExpenseModal from './components/AddExpenseModal';
import AddNoteModal from './components/AddNoteModal';
import FloatingChatBox from './components/FloatingChatBox';
import ReviewCenterPanel from './components/ReviewCenterPanel';
import Onboarding from './components/Onboarding';
import { History, X, ClipboardCheck, ChevronDown } from 'lucide-react';
import { LATEST_CHANGELOG, LATEST_CHANGELOG_VERSION, SEEN_CHANGELOG_STORAGE_KEY } from './utils/changelog';

const App: React.FC = () => {
  // Data Logic Hook
  const {
      items, budgetConfig, setBudgetConfig, skills, setSkills, wallets, setWallets,
      customPrompt, setCustomPrompt, monthlyThemes, setMonthlyThemes, appSettings, setAppSettings,
      chatHistory, setChatHistory,
      loading, error, pendingCount, parsingTasks, pendingReviews, canonicalRules, saveStatus, fetchStatus, saveAndSync, handleSend, handleToggleStatus,
      handleDelete, handleUpdateItem, loadData, runCanonicalBackfill, toggleCanonicalRuleDisabled, handleAddRoutineTask, handleAddTask, handleAddShoppingItem, handleAddSavingTransaction, handleKeepRawTodo, handleRetriggerDeepWorkTodo, handleAcceptDeepWorkTodo, handleResetRoutine, handleAddTransaction, handleAddNote, retryParsing, clearParsingTask, handleApproveReview, handleRejectReview
  } = useBrainDumpData();

  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('braindump_onboarding_completed') !== 'true';
  });

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [planSubTab, setPlanSubTab] = useState<'tasks' | 'shopping' | 'savings'>('tasks');
  const [librarySubTab, setLibrarySubTab] = useState<'general' | 'skills' | 'journal'>('general');
  const [showBalance, setShowBalance] = useState(false);
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [showChangelogPopup, setShowChangelogPopup] = useState(false);
  const [themeNavDate, setThemeNavDate] = useState(new Date());
  
  // Focus View State
  const [focusDate, setFocusDate] = useState(new Date());

  // Modal States
  const [skillModal, setSkillModal] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; skillId?: string; initialName?: string; initialTarget?: number }>({ isOpen: false, mode: 'add' });
  const [walletModal, setWalletModal] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; walletId?: string; initialData?: Wallet }>({ isOpen: false, mode: 'add' });
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [addTaskModal, setAddTaskModal] = useState<{ isOpen: boolean; initialDate?: string }>({ isOpen: false });
  const [addShoppingModal, setAddShoppingModal] = useState<{ isOpen: boolean; initialCategory?: ShoppingCategory }>({ isOpen: false });
  const [addExpenseModalOpen, setAddExpenseModalOpen] = useState(false);
  const [addNoteModalOpen, setAddNoteModalOpen] = useState(false);
  const [addNoteModalType, setAddNoteModalType] = useState<ItemType.NOTE | ItemType.JOURNAL>(ItemType.NOTE);
  const [themeEditMode, setThemeEditMode] = useState(false);
  const [tempThemeContent, setTempThemeContent] = useState('');
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'skill' | 'wallet' | null>(null);

  // Filter & Sort State
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [filterDate, setFilterDate] = useState<string>(''); // YYYY-MM-DD
  const [filterDateTo, setFilterDateTo] = useState<string>(''); // YYYY-MM-DD
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Advanced Money Filters
  const [filterWallet, setFilterWallet] = useState<string>('');
  const [filterTransactionType, setFilterTransactionType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterMinAmount, setFilterMinAmount] = useState<string>('');
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>('');

  // Finance Date Filter
  const [financeDate, setFinanceDate] = useState(new Date());
  const [moneyView, setMoneyView] = useState<MoneyView>('transactions');

  // Input Focus State
  const [isMobileKeyboardOpen, setIsMobileKeyboardOpen] = useState(false);
  const fixedBottomRef = useRef<HTMLDivElement>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newChatMessage, setNewChatMessage] = useState<{ text: string; id: string } | null>(null);

  // Review Center nudge above the input bar
  const [isReviewCenterOpen, setIsReviewCenterOpen] = useState(false);
  const [lastReviewCenterOpenedAt, setLastReviewCenterOpenedAt] = useState(0);

  const latestParsingTaskAt = useMemo(() => {
    return parsingTasks.reduce((latest, task) => Math.max(latest, task.createdAt || 0, task.completedAt || 0), 0);
  }, [parsingTasks]);

  const hasRunningProcess = useMemo(() => {
    return pendingCount > 0
      || parsingTasks.some(task => task.status === 'pending')
      || saveStatus === 'saving'
      || fetchStatus === 'syncing';
  }, [fetchStatus, parsingTasks, pendingCount, saveStatus]);

  const showReviewCenterNudge = parsingTasks.length > 0 && latestParsingTaskAt > lastReviewCenterOpenedAt;
  const reviewCenterBadgeCount = pendingReviews.length + parsingTasks.length;

  const openReviewCenterFromInput = () => {
    setLastReviewCenterOpenedAt(Date.now());
    setIsReviewCenterOpen(true);
  };

  const closeReviewCenterFromInput = () => {
    setIsReviewCenterOpen(false);
  };

  const handleUpdateChatHistory = (newHistory: import('./types').ChatMessage[]) => {
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
    const handleSWMessage = (event: MessageEvent) => {
      const { type, text } = event.data || {};
      if (type === 'NOTIFICATION_REPLY' && text) {
        handleSendRef.current(text);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  useEffect(() => {
  const handleMessage = async (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;

    const { type, tokens, error } = event.data || {};

    if (type === 'GOOGLE_OAUTH_SUCCESS') {
      try {
        // simpan session
        localStorage.setItem('braindump_google_session', JSON.stringify({
          ...tokens,
          expires_at: Date.now() + ((tokens.expires_in || 3600) * 1000),
        }));

        console.log('Google login success');

        // kalau mau, lanjut fetch profile / config di sini
        // const profile = await fetchGoogleProfile(tokens.access_token);
        // const config = await loadConfigFromDrive(tokens.access_token);

        loadData(); // atau trigger refresh state
      } catch (e) {
        console.error('Failed to process OAuth success', e);
      }
    }

    if (type === 'GOOGLE_OAUTH_ERROR') {
      console.error('Google login failed:', error);
      alert(`Login gagal: ${error}`);
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [loadData]);

  // --- Persistent Notification Effect ---
  useEffect(() => {
    import('./utils/notificationHandler').then(({ updatePersistentNotification }) => {
      updatePersistentNotification(!!appSettings.persistentNotification);
    });
  }, [appSettings.persistentNotification]);

  useEffect(() => {
    if (showOnboarding) return;
    try {
      const seenVersion = localStorage.getItem(SEEN_CHANGELOG_STORAGE_KEY);
      if (seenVersion !== LATEST_CHANGELOG_VERSION) {
        setShowChangelogPopup(true);
      }
    } catch (e) {
      console.warn('Failed to read changelog seen version', e);
    }
  }, [showOnboarding]);

  const handleCloseChangelogPopup = () => {
    try {
      localStorage.setItem(SEEN_CHANGELOG_STORAGE_KEY, LATEST_CHANGELOG_VERSION);
    } catch (e) {
      console.warn('Failed to save changelog seen version', e);
    }
    setShowChangelogPopup(false);
  };

  // --- Handle Reply from URL ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const replyText = params.get('reply');
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
    const theme = appSettings.theme || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appSettings.theme]);

  // --- Keyboard Detection Effect ---
  useEffect(() => {
    const handleResize = () => {
        if (window.visualViewport) {
            // Calculate how much the visual viewport has been offset from the bottom of the layout viewport
            // This happens when the keyboard pushes the visual viewport up, but the layout viewport remains the same height
            const offset = window.innerHeight - (window.visualViewport.height + window.visualViewport.offsetTop);
            const safeOffset = Math.max(0, offset);
            
            if (fixedBottomRef.current) {
                // Apply directly to DOM to avoid React state batching delays during fast scrolling
                fixedBottomRef.current.style.transform = `translateY(-${safeOffset}px)`;
            }
            
            // Also update keyboard open state based on visual viewport height vs screen height
            const isKeyboardOpen = window.visualViewport.height < window.screen.height * 0.75;
            setIsMobileKeyboardOpen(isKeyboardOpen);
        }
    };

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
        handleResize(); // Initial check
    }
    
    return () => {
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', handleResize);
            window.visualViewport.removeEventListener('scroll', handleResize);
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
        window.history.pushState({ page: 'app' }, '', window.location.href);
      } else {
        if (!exitWarningRef.current) {
          exitWarningRef.current = true;
          setShowExitToast(true);
          window.history.pushState({ page: 'app' }, '', window.location.href);
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
      if (e.key === 'Escape') {
        BackHandler.handle();
      }
    };

    window.history.pushState({ page: 'app' }, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => { if (deleteId) return BackHandler.register(() => { setDeleteId(null); setDeleteType(null); return true; }); }, [deleteId]);
  useEffect(() => { if (themeEditMode) return BackHandler.register(() => { setThemeEditMode(false); return true; }); }, [themeEditMode]);
  useEffect(() => { if (skillModal.isOpen) return BackHandler.register(() => { setSkillModal(prev => ({ ...prev, isOpen: false })); return true; }); }, [skillModal.isOpen]);
  useEffect(() => { if (walletModal.isOpen) return BackHandler.register(() => { setWalletModal(prev => ({ ...prev, isOpen: false })); return true; }); }, [walletModal.isOpen]);
  useEffect(() => { if (routineModalOpen) return BackHandler.register(() => { setRoutineModalOpen(false); return true; }); }, [routineModalOpen]);
  useEffect(() => { if (showChangelogPopup) return BackHandler.register(() => { handleCloseChangelogPopup(); return true; }); }, [showChangelogPopup]);
  useEffect(() => { if (addTaskModal.isOpen) return BackHandler.register(() => { setAddTaskModal(prev => ({ ...prev, isOpen: false })); return true; }); }, [addTaskModal.isOpen]);
  useEffect(() => { if (addShoppingModal.isOpen) return BackHandler.register(() => { setAddShoppingModal(prev => ({ ...prev, isOpen: false })); return true; }); }, [addShoppingModal.isOpen]);
  useEffect(() => { if (addExpenseModalOpen) return BackHandler.register(() => { setAddExpenseModalOpen(false); return true; }); }, [addExpenseModalOpen]);
  useEffect(() => { if (addNoteModalOpen) return BackHandler.register(() => { setAddNoteModalOpen(false); return true; }); }, [addNoteModalOpen]);
  useEffect(() => { if (isControlCenterOpen) return BackHandler.register(() => { setIsControlCenterOpen(false); return true; }); }, [isControlCenterOpen]);
  useEffect(() => { if (isChatOpen) return BackHandler.register(() => { setIsChatOpen(false); return true; }); }, [isChatOpen]);
  useEffect(() => { if (isSearchExpanded) return BackHandler.register(() => { setIsSearchExpanded(false); return true; }); }, [isSearchExpanded]);

  useEffect(() => { if (activeTab === 'money' && moneyView !== 'transactions') return BackHandler.register(() => { setMoneyView('transactions'); return true; }); }, [activeTab, moneyView]);
  useEffect(() => { if (activeTab === 'plan' && planSubTab !== 'tasks') return BackHandler.register(() => { setPlanSubTab('tasks'); return true; }); }, [activeTab, planSubTab]);
  useEffect(() => { if (activeTab === 'library' && librarySubTab !== 'general') return BackHandler.register(() => { setLibrarySubTab('general'); return true; }); }, [activeTab, librarySubTab]);
  useEffect(() => { if (activeTab !== 'summary') return BackHandler.register(() => { setActiveTab('summary'); return true; }); }, [activeTab]);

  // --- Handlers ---

  const handleAppSend = (text: string) => {
      const lower = text.toLowerCase().trim();
      const isQuestion = lower.endsWith('?') || 
          ['apa', 'apakah', 'bagaimana', 'kenapa', 'mengapa', 'siapa', 'kapan', 'berapa', 'tolong', 'tanya', 'ask', 'can you', 'how', 'what', 'why', 'when', 'where', 'who', 'saran', 'suggest'].some(word => lower.startsWith(word));

      if (isQuestion || isChatOpen) {
          setNewChatMessage({ text, id: uuidv4() });
          setIsChatOpen(true);
      } else {
          handleSend(text);
      }
  };

  const handleSettingsSaved = (newBudgetConfig?: BudgetConfig, newPrompt?: string, newAppSettings?: AppSettings) => {
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
          saveAndSync(items, newBudgetConfig, newPrompt, skills, wallets, monthlyThemes, newAppSettings);
      } else {
          loadData();
      }
  };

  const handleSaveTheme = () => {
      const year = themeNavDate.getFullYear();
      const month = String(themeNavDate.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      
      const newThemes = { ...monthlyThemes, [key]: tempThemeContent };
      setMonthlyThemes(newThemes);
      saveAndSync(items, undefined, undefined, undefined, undefined, newThemes);
      setThemeEditMode(false);
  };

  const handleConfirmDelete = () => {
      if (deleteType === 'skill' && deleteId) {
          const updated = skills.filter(s => s.id !== deleteId);
          setSkills(updated);
          saveAndSync(items, undefined, undefined, updated, wallets, monthlyThemes);
      } else if (deleteType === 'wallet' && deleteId) {
          const updated = wallets.filter(w => w.id !== deleteId);
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
                      data.appSettings || appSettings
                  );
                  alert('Data imported successfully!');
                  setIsControlCenterOpen(false);
              } else {
                  alert('Invalid backup file format.');
              }
          } catch (err) {
              console.error('Import error:', err);
              alert('Failed to parse backup file.');
          }
      };
      reader.readAsText(file);
  };

  const handleClearData = async () => {
      await saveAndSync([], undefined, undefined, [], [], {}, undefined, undefined, true);
      clearSpreadsheetConfig();
      setIsControlCenterOpen(false);
      window.location.reload();
  };

  // --- Skill & Wallet Modal Handlers ---
  const handleOpenAddSkill = () => setSkillModal({ isOpen: true, mode: 'add' });
  const handleOpenEditSkill = (id: string, name: string, target?: number) => setSkillModal({ isOpen: true, mode: 'edit', skillId: id, initialName: name, initialTarget: target });
  
  const handleOpenAddWallet = () => setWalletModal({ isOpen: true, mode: 'add' });
  const handleOpenEditWallet = (wallet: Wallet) => setWalletModal({ isOpen: true, mode: 'edit', walletId: wallet.id, initialData: wallet });

  const handleSaveSkill = (name: string, weeklyTargetMinutes?: number) => {
      if (!name.trim()) return;
      if (skillModal.mode === 'add') {
          const newSkill: Skill = { id: uuidv4(), name, color: 'indigo-500', created_at: new Date().toISOString(), weeklyTargetMinutes };
          const updated = [...skills, newSkill];
          setSkills(updated);
          saveAndSync(items, undefined, undefined, updated, wallets, monthlyThemes);
      } else if (skillModal.mode === 'edit' && skillModal.skillId) {
          const updated = skills.map(s => s.id === skillModal.skillId ? { ...s, name, weeklyTargetMinutes } : s);
          setSkills(updated);
          saveAndSync(items, undefined, undefined, updated, wallets, monthlyThemes);
      }
      setSkillModal({ ...skillModal, isOpen: false });
  };

  const handleSaveWallet = (name: string, type: Wallet['type'], initialBalance: number, color: string) => {
      if (!name.trim()) return;
      if (walletModal.mode === 'add') {
          const newWallet: Wallet = { id: uuidv4(), name, type, initialBalance, color };
          const updated = [...wallets, newWallet];
          setWallets(updated);
          saveAndSync(items, undefined, undefined, skills, updated, monthlyThemes);
      } else if (walletModal.mode === 'edit' && walletModal.walletId) {
          const updated = wallets.map(w => w.id === walletModal.walletId ? { ...w, name, type, initialBalance, color } : w);
          setWallets(updated);
          saveAndSync(items, undefined, undefined, skills, updated, monthlyThemes);
      }
      setWalletModal({ ...walletModal, isOpen: false });
  };

  // Unique Tags for Filter (Memoized locally since it's UI specific)
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    let targetItems: BrainDumpItem[] = [];

    if (activeTab === 'money') {
        targetItems = items.filter(i => 
            (i.type === 'FINANCE' && (i.status === 'done' || i.status === 'pending') && (i.meta.amount || 0) > 0) || 
            ((i.type === 'SHOPPING' || i.type === 'TODO') && i.status === 'done' && (i.meta.amount || 0) > 0)
        );
    } else if (activeTab === 'library') {
        if (librarySubTab === 'general') {
            targetItems = items.filter(i => i.type === ItemType.NOTE);
        } else if (librarySubTab === 'skills') {
            targetItems = [];
        } else {
            targetItems = items.filter(i => 
                i.type === 'JOURNAL' || 
                (i.type === ItemType.TODO && i.status === 'done')
            );
        }
    } else if (activeTab === 'plan') {
         targetItems = items.filter(i => i.type === 'TODO' || i.type === 'EVENT' || i.type === 'SHOPPING');
    } else {
        targetItems = items;
    }

    targetItems.forEach(i => i.meta?.tags?.forEach(t => {
        if (t && t !== 'null' && t !== 'undefined') tags.add(t);
    }));
    
    return Array.from(tags).sort();
  }, [items, activeTab, librarySubTab]);

  const savingGoals = useMemo(() => {
      const { savings } = getShoppingItems(items);
      return savings;
  }, [items]);

  const handleOnboardingComplete = (
    settings: AppSettings, 
    wallet: Wallet | null, 
    budget: BudgetConfig | null, 
    sampleItems: any[]
  ) => {
    localStorage.setItem('braindump_onboarding_completed', 'true');
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
      true // force overwrite
    );
  };

  const handleOnboardingTestParsing = async (text: string) => {
    // We can use the existing parseInput logic from useBrainDumpData, 
    // but since it's not exported directly, we can just simulate it or use the API directly.
    // For simplicity, we'll just use the API directly here.
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API key not found");
    
    const { GoogleGenAI, Type } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse this text: "${text}". Return a JSON object with "type" (FINANCE, NOTE, TASK) and "data" containing the parsed details.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            data: { type: Type.OBJECT }
          }
        }
      }
    });
    
    return JSON.parse(response.text || "{}");
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
    <div className="min-h-screen bg-background text-primary font-sans transition-colors duration-300 selection:bg-indigo-500/30">
      
      {/* Main Content */}
      <main className="pt-0 pb-48 max-w-2xl mx-auto min-h-screen relative">
        
        <div className="relative z-10">
            {(loading && items.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted animate-pulse pt-24">
                <div className="w-12 h-12 bg-surface rounded-full mb-4"></div>
                <p>Syncing...</p>
              </div>
            ) : (
              <div className="w-full">
                  {activeTab === 'summary' && (
                      <SummaryView 
                          items={items} skills={skills} wallets={wallets} budgetConfig={budgetConfig} appSettings={appSettings}
                          themeNavDate={themeNavDate} setThemeNavDate={setThemeNavDate}
                          monthlyThemes={monthlyThemes}
                          onThemeEdit={(content) => { setTempThemeContent(content); setThemeEditMode(true); }}
                          handleToggleStatus={handleToggleStatus}
                          setActiveTab={setActiveTab}
                          setPlanSubTab={setPlanSubTab}
                          showBalance={showBalance} setShowBalance={setShowBalance}
                          pendingReviews={pendingReviews}
                          handleApproveReview={handleApproveReview}
                          handleRejectReview={handleRejectReview}
                          parsingTasks={parsingTasks}
                          retryParsing={retryParsing}
                          clearParsingTask={clearParsingTask}
                          handleOpenAddTask={(date) => setAddTaskModal({ isOpen: true, initialDate: date })}
                          handleOpenAddShopping={(category) => setAddShoppingModal({ isOpen: true, initialCategory: category })}
                          handleOpenAddExpense={() => setAddExpenseModalOpen(true)}
                          handleOpenAddNote={() => { setAddNoteModalType(ItemType.NOTE); setAddNoteModalOpen(true); }}
                          handleUpdateItem={handleUpdateItem}
                          handleDelete={requestDeleteItem}
                      />
                  )}

                  {activeTab === 'plan' && (
                      <PlanView 
                          items={items} skills={skills}
                          planSubTab={planSubTab} setPlanSubTab={setPlanSubTab}
                          focusDate={focusDate} setFocusDate={setFocusDate}
                          appSettings={appSettings}
                          handleToggleStatus={handleToggleStatus} handleDelete={requestDeleteItem}
                          handleKeepRawTodo={handleKeepRawTodo}
                          handleRetriggerDeepWorkTodo={handleRetriggerDeepWorkTodo}
                          handleAcceptDeepWorkTodo={handleAcceptDeepWorkTodo}
                          handleUpdateItem={handleUpdateItem}
                          handleOpenAddRoutine={() => setRoutineModalOpen(true)}
                          handleOpenAddTask={(date) => setAddTaskModal({ isOpen: true, initialDate: date })}
                          handleOpenAddShopping={(category) => setAddShoppingModal({ isOpen: true, initialCategory: category })}
                          handleOpenEditSkill={handleOpenEditSkill} handleOpenAddSkill={handleOpenAddSkill}
                          setDeleteId={setDeleteId} setDeleteType={setDeleteType}
                          searchQuery={searchQuery} selectedTag={selectedTag}
                          wallets={wallets} budgetRules={budgetConfig.rules}
                          handleResetRoutine={handleResetRoutine}
                          onAddFunds={handleAddSavingTransaction}
                          onCompleteGoal={(goal) => {
                              if (confirm(`Complete goal "${goal.content}"? This will record it in Transactions as Achieved Goals and release the reserved savings from its wallet.`)) {
                                  handleToggleStatus(goal.id);
                              }
                          }}
                          setActiveTab={setActiveTab}
                      />
                  )}

                  {activeTab === 'library' && (
                      <LibraryView 
                          items={items} skills={skills}
                          librarySubTab={librarySubTab} setLibrarySubTab={setLibrarySubTab}
                          appSettings={appSettings}
                          handleDelete={requestDeleteItem}
                          handleUpdateItem={handleUpdateItem}
                          handleOpenEditSkill={handleOpenEditSkill} handleOpenAddSkill={handleOpenAddSkill}
                          setDeleteId={setDeleteId} setDeleteType={setDeleteType}
                          selectedTag={selectedTag} filterDate={filterDate} filterDateTo={filterDateTo} searchQuery={searchQuery} sortOrder={sortOrder}
                          setActiveTab={setActiveTab}
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

                  {activeTab === 'money' && (
                      <MoneyViewComponent 
                          items={items} wallets={wallets} budgetConfig={budgetConfig}
                          moneyView={moneyView} setMoneyView={setMoneyView}
                          financeDate={financeDate} setFinanceDate={setFinanceDate}
                          showBalance={showBalance} setShowBalance={setShowBalance}
                          appSettings={appSettings}
                          handleDelete={requestDeleteItem}
                          handleUpdateItem={handleUpdateItem}
                          handleToggleStatus={handleToggleStatus}
                          handleOpenEditWallet={handleOpenEditWallet} handleOpenAddWallet={handleOpenAddWallet}
                          setDeleteId={setDeleteId} setDeleteType={setDeleteType} setIsSettingsOpen={setIsControlCenterOpen}
                          filterWallet={filterWallet} filterTransactionType={filterTransactionType}
                          filterCategory={filterCategory}
                          filterMinAmount={filterMinAmount} filterMaxAmount={filterMaxAmount}
                          selectedTag={selectedTag} searchQuery={searchQuery} sortOrder={sortOrder}
                          savingGoals={savingGoals}
                          setActiveTab={setActiveTab}
                          onAddItem={(type) => {
                              if (type === ItemType.FINANCE) setAddExpenseModalOpen(true);
                          }}
                      />
                  )}

                  {activeTab === 'calendar' && (
                      <CalendarView 
                          items={items}
                          handleToggleStatus={handleToggleStatus}
                          handleDelete={requestDeleteItem}
                          appSettings={appSettings}
                          setActiveTab={setActiveTab}
                      />
                  )}
              </div>
            )}
        </div>
      </main>

      {/* Fixed Bottom Layout */}
      <div 
        ref={fixedBottomRef}
        className="fixed bottom-0 w-full z-40 bg-transparent pointer-events-none"
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
          <div className="pointer-events-none flex flex-col items-center w-full">
            <InputBar 
                onSend={handleAppSend} 
                onFocus={() => { setIsSearchExpanded(false); }} 
                saveStatus={saveStatus}
                fetchStatus={fetchStatus}
                pendingCount={pendingCount}
                isChatOpen={isChatOpen}
                onOpenChat={() => setIsChatOpen(!isChatOpen)}
                showReviewCenterButton={showReviewCenterNudge}
                reviewCenterActive={hasRunningProcess}
                reviewCenterCount={reviewCenterBadgeCount}
                onOpenReviewCenter={openReviewCenterFromInput}
                startAction={(activeTab === 'library' || activeTab === 'money') ? (
                    <FloatingSearch 
                        activeTab={activeTab} librarySubTab={librarySubTab} moneyView={moneyView}
                        isSearchExpanded={isSearchExpanded} setIsSearchExpanded={setIsSearchExpanded}
                        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                        selectedTag={selectedTag} setSelectedTag={setSelectedTag}
                        filterDate={filterDate} setFilterDate={setFilterDate}
                        filterDateTo={filterDateTo} setFilterDateTo={setFilterDateTo}
                        sortOrder={sortOrder} setSortOrder={setSortOrder}
                        filterWallet={filterWallet} setFilterWallet={setFilterWallet}
                        filterTransactionType={filterTransactionType} setFilterTransactionType={setFilterTransactionType}
                        filterCategory={filterCategory} setFilterCategory={setFilterCategory}
                        filterMinAmount={filterMinAmount} setFilterMinAmount={setFilterMinAmount}
                        filterMaxAmount={filterMaxAmount} setFilterMaxAmount={setFilterMaxAmount}
                        uniqueTags={uniqueTags} wallets={wallets} budgetConfig={budgetConfig}
                        savingGoals={savingGoals}
                    />
                ) : null}
            />
          </div>

          <div className={`pointer-events-auto ${isMobileKeyboardOpen ? "hidden md:block" : "block"}`}>
             <BottomNav 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
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
        fetchStatus={fetchStatus}
        onSyncClick={(forceOverwrite) => saveAndSync(items, undefined, undefined, undefined, undefined, undefined, undefined, undefined, forceOverwrite)}
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
        retryParsing={retryParsing}
        onSave={handleSettingsSaved}
        currentBudgetConfig={budgetConfig}
        currentPrompt={customPrompt}
        allItems={items}
        allSkills={skills}
        allWallets={wallets}
        monthlyThemes={monthlyThemes}
        onImportData={handleImportData}
        onClearData={handleClearData}
      />

      {typeof document !== 'undefined' && createPortal(
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
                initial={{ opacity: 0, scale: 0.96, x: '-50%', y: 20 }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: 0 }}
                exit={{ opacity: 0, scale: 0.96, x: '-50%', y: 20 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="fixed left-1/2 bottom-28 z-[95] w-[calc(100vw-2rem)] max-w-2xl max-h-[70vh] bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col"
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
                  pendingReviews={pendingReviews}
                  onApproveReview={handleApproveReview}
                  onRejectReview={handleRejectReview}
                  retryParsing={retryParsing}
                  clearParsingTask={clearParsingTask}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
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
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-500">What's new</div>
                    <h3 className="text-xl font-bold text-primary">{LATEST_CHANGELOG.version}</h3>
                    <p className="text-xs text-muted">{LATEST_CHANGELOG.date}</p>
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
             <div className="bg-surface border border-border rounded-3xl w-full max-w-sm shadow-2xl p-6">
                 <h3 className="text-lg font-bold text-primary mb-4">Set Theme</h3>
                 <textarea
                    autoFocus
                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 mb-4 h-32 resize-none"
                    placeholder="e.g. Month of Discipline, Focus on Skill X..."
                    value={tempThemeContent}
                    onChange={(e) => setTempThemeContent(e.target.value)}
                 />
                 <div className="flex justify-end gap-2">
                     <button onClick={() => setThemeEditMode(false)} className="px-5 py-2.5 rounded-xl text-sm text-muted hover:text-primary font-medium">Cancel</button>
                     <button onClick={handleSaveTheme} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">Save Theme</button>
                 </div>
             </div>
          </div>
      )}

      {/* Exit Warning Toast */}
      <AnimatePresence>
        {showExitToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
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
        initialName={skillModal.initialName}
        initialTarget={skillModal.initialTarget}
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
        onSave={(amount, description, category, walletId, date, type, toWalletId, savingGoalId, savingGoalName) => {
            if (type === 'saving' && savingGoalId && savingGoalName) {
                handleAddSavingTransaction(amount, walletId, date, savingGoalId, savingGoalName);
            } else {
                if (walletId) {
                    if (type === 'transfer') {
                        handleAddTransaction(description, amount, type, walletId, category, toWalletId, date);
                    } else {
                        handleAddTransaction(description, amount, type, walletId, category, undefined, date);
                    }
                }
            }
        }}
        wallets={wallets}
        budgetConfig={budgetConfig}
        savingGoals={savingGoals}
      />

      <AddNoteModal
        isOpen={addNoteModalOpen}
        onClose={() => setAddNoteModalOpen(false)}
        onSave={(content, tags) => handleAddNote(content, tags, addNoteModalType)}
        mode={addNoteModalType === ItemType.JOURNAL ? 'journal' : 'note'}
      />

      <ConfirmDialog 
        isOpen={!!deleteId} 
        title="Confirm Delete" 
        message={deleteType === 'skill' ? "Delete this skill? History will remain but tracking will stop." : (deleteType === 'wallet' ? "Delete this wallet? Balance history might be affected." : "Delete this item?")}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeleteId(null); setDeleteType(null); }} 
      />

    </div>
  );
};

export default App;
