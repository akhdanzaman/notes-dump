import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Brain, RefreshCw, AlertTriangle, WifiOff, Target, ShoppingCart, StickyNote, History, Search, Settings, CloudCheck, CloudOff, Save, Wallet as WalletIcon, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, CheckCircle2, PiggyBank, Calculator, PieChart, BarChart3, List, BookOpen, Plus, Timer, TrendingUp as GrowthIcon, Pencil, Trash2, Library, NotebookPen, LayoutDashboard, ArrowRight, Eye, EyeOff, CreditCard, Sparkles, BookText, Filter, CalendarDays, ArrowUpDown, X, Tag, DollarSign, ArrowDownUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { BrainDumpItem, ItemType, BudgetConfig, BudgetRule, Skill, Wallet, FinanceType } from './types';
import { fetchDb, syncData, isUsingLocalStorage, SyncResult } from './services/githubService';
import { classifyText, DEFAULT_PROMPT } from './services/geminiService';

import Card from './components/Card';
import ShoppingItem from './components/ShoppingItem';
import InputBar from './components/InputBar';
import EditModal from './components/EditModal';
import SettingsModal from './components/SettingsModal';
import SkillModal from './components/SkillModal';
import WalletModal from './components/WalletModal';
import ConfirmDialog from './components/ConfirmDialog';

type Tab = 'summary' | 'focus' | 'shopping' | 'notes' | 'money';
type FocusSubTab = 'tasks' | 'skills';
type NotesSubTab = 'general' | 'skills' | 'journal';
type SyncStatus = 'synced' | 'syncing' | 'error' | 'local';
type MoneyView = 'transactions' | 'budget' | 'wallets';
type SortOrder = 'newest' | 'oldest' | 'highest_amount' | 'lowest_amount';

const App: React.FC = () => {
  const [items, setItems] = useState<BrainDumpItem[]>([]);
  // Budget Config State
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>({
      monthlyIncome: 0,
      rules: [
        { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
        { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
        { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
      ]
  });
  // Skills State
  const [skills, setSkills] = useState<Skill[]>([]);
  // Wallet State
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_PROMPT);
  // Monthly Themes State
  const [monthlyThemes, setMonthlyThemes] = useState<Record<string, string>>({});
  const [themeNavDate, setThemeNavDate] = useState(new Date());

  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0); 
  const [error, setError] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [focusSubTab, setFocusSubTab] = useState<FocusSubTab>('tasks');
  const [notesSubTab, setNotesSubTab] = useState<NotesSubTab>('general');
  const [showBalance, setShowBalance] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Modal States
  const [skillModal, setSkillModal] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; skillId?: string; initialName?: string; initialTarget?: number }>({ isOpen: false, mode: 'add' });
  const [walletModal, setWalletModal] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; walletId?: string; initialData?: Wallet }>({ isOpen: false, mode: 'add' });
  const [themeEditMode, setThemeEditMode] = useState(false);
  const [tempThemeContent, setTempThemeContent] = useState('');
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'skill' | 'wallet' | null>(null);

  // Filter & Sort State
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [filterDate, setFilterDate] = useState<string>(''); // YYYY-MM-DD
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Advanced Money Filters
  const [filterWallet, setFilterWallet] = useState<string>('');
  const [filterTransactionType, setFilterTransactionType] = useState<string>('');
  const [filterMinAmount, setFilterMinAmount] = useState<string>('');
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>('');

  // Finance Date Filter
  const [financeDate, setFinanceDate] = useState(new Date());
  const [moneyView, setMoneyView] = useState<MoneyView>('transactions');

  const [editingItem, setEditingItem] = useState<BrainDumpItem | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Extract unique payment methods for autocomplete
  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set<string>();
    items.forEach(i => {
        if (i.meta.paymentMethod) methods.add(i.meta.paymentMethod);
    });
    return Array.from(methods);
  }, [items]);

  const checkRoutineResets = (currentItems: BrainDumpItem[]) => {
      const now = new Date();
      const newHistoryItems: BrainDumpItem[] = [];

      const updatedItems = currentItems.map(item => {
          if (item.type === ItemType.SHOPPING && 
              item.meta.shoppingCategory === 'routine' && 
              item.status === 'done' && 
              item.completed_at) {
              
              const completedTime = new Date(item.completed_at).getTime();
              const recurrenceDays = item.meta.recurrenceDays || 7;
              const nextDueTime = completedTime + (recurrenceDays * 24 * 60 * 60 * 1000);
              
              if (now.getTime() >= nextDueTime) {
                  // Create a history record of the completed instance
                  const historyItem: BrainDumpItem = {
                      ...item,
                      id: uuidv4(), // New ID for the history log
                      meta: {
                          ...item.meta,
                          shoppingCategory: 'not_urgent', // Downgrade to normal completed item so it doesn't trigger recursion
                      }
                  };
                  newHistoryItems.push(historyItem);

                  // Reset the main item to pending for the new cycle
                  return {
                      ...item,
                      status: 'pending' as const,
                      completed_at: undefined,
                  };
              }
          }
          return item;
      });

      return [...updatedItems, ...newHistoryItems];
  };

  const saveAndSync = async (newItems: BrainDumpItem[], newConfig?: BudgetConfig, newPrompt?: string, newSkills?: Skill[], newWallets?: Wallet[], newThemes?: Record<string, string>) => {
      setSyncStatus('syncing');
      try {
          // Use syncData to save everything
          const configToSave = newConfig || budgetConfig;
          const promptToSave = newPrompt !== undefined ? newPrompt : customPrompt;
          const skillsToSave = newSkills || skills;
          const walletsToSave = newWallets || wallets;
          const themesToSave = newThemes || monthlyThemes;
          
          const result: SyncResult = await syncData(newItems, configToSave, promptToSave, skillsToSave, walletsToSave, themesToSave);
          
          if (result.method === 'error' || result.method === 'skipped_not_hydrated') {
              setSyncStatus('error');
              if (result.method === 'skipped_not_hydrated') {
                  setError("Cloud sync inactive. Please reload the page to reconnect.");
              }
          } else if (result.method === 'local') {
              setSyncStatus('local');
          } else {
              setSyncStatus('synced');
          }
      } catch (e) {
          console.error(e);
          setSyncStatus('error');
      }
  };

  const loadData = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);
        setIsLocalMode(isUsingLocalStorage());

        const { data } = await fetchDb();
        if (data) {
          if (Array.isArray(data.data)) {
            // Migration: Ensure all items have valid meta structure
            const migratedData = data.data.map(item => ({
                ...item,
                meta: {
                    tags: [],
                    // Preserve existing meta
                    ...item.meta,
                    // Default shopping category if missing for SHOPPING type
                    shoppingCategory: (item.type === ItemType.SHOPPING && !item.meta?.shoppingCategory) 
                        ? 'not_urgent' 
                        : item.meta?.shoppingCategory
                }
            }));

            const checkedData = checkRoutineResets(migratedData);
            setItems(checkedData);
            
            // Check for changes in routine resets to sync
            if (JSON.stringify(checkedData) !== JSON.stringify(data.data)) {
               await saveAndSync(checkedData, data.budgetConfig, data.customPrompt, data.skills, data.wallets, data.monthlyThemes);
            } else {
               setSyncStatus(isUsingLocalStorage() ? 'local' : 'synced');
            }
          }
          
          // Load Budget Config if exists
          if (data.budgetConfig) {
              setBudgetConfig(data.budgetConfig);
          }
          // Load Prompt if exists
          if (data.customPrompt) {
              setCustomPrompt(data.customPrompt);
          }
          // Load Skills
          if (data.skills) {
              setSkills(data.skills);
          } else {
              // Default Skills if empty
              const defaults: Skill[] = [
                  { id: 'skill-1', name: 'General Learning', color: 'indigo-500', created_at: new Date().toISOString() }
              ];
              setSkills(defaults);
              saveAndSync(data.data || [], data.budgetConfig, data.customPrompt, defaults, data.wallets, data.monthlyThemes);
          }

          // Load Wallets
          if (data.wallets && data.wallets.length > 0) {
              setWallets(data.wallets);
          } else {
              // Create default Cash wallet if none exist
              const defaultWallet: Wallet = { id: 'w-1', name: 'Cash', type: 'cash', initialBalance: 0, color: 'bg-emerald-500' };
              setWallets([defaultWallet]);
              // Trigger save with default wallet
              saveAndSync(data.data || [], data.budgetConfig, data.customPrompt, data.skills, [defaultWallet], data.monthlyThemes);
          }

          // Load Themes
          if (data.monthlyThemes) {
              setMonthlyThemes(data.monthlyThemes);
          }
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load data. Please check connection.");
        setSyncStatus('error');
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSettingsSaved = (newBudgetConfig?: BudgetConfig, newPrompt?: string) => {
      setIsSettingsOpen(false);
      
      let shouldSync = false;
      if (newBudgetConfig) {
          setBudgetConfig(newBudgetConfig);
          shouldSync = true;
      }
      if (newPrompt !== undefined) {
          setCustomPrompt(newPrompt);
          shouldSync = true;
      }

      if (shouldSync) {
          saveAndSync(items, newBudgetConfig, newPrompt, skills, wallets, monthlyThemes);
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

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    let targetItems: BrainDumpItem[] = [];

    if (activeTab === 'money') {
        // Include all items that are financial in nature
        targetItems = items.filter(i => 
            i.type === ItemType.FINANCE || 
            ((i.type === ItemType.SHOPPING || i.type === ItemType.TODO) && (i.meta.amount || 0) > 0)
        );
    } else if (activeTab === 'notes') {
        // Filter based on active Notes sub-tab to keep tags relevant
        if (notesSubTab === 'general') {
            targetItems = items.filter(i => i.type === ItemType.NOTE);
        } else if (notesSubTab === 'skills') {
            targetItems = items.filter(i => i.type === ItemType.SKILL_LOG);
        } else {
            // Journal tags
            targetItems = items.filter(i => 
                i.type === ItemType.JOURNAL || 
                (i.type === ItemType.TODO && i.status === 'done')
            );
        }
    } else {
        // Fallback for other tabs, though usually filters are hidden
        targetItems = items;
    }

    targetItems.forEach(i => i.meta?.tags?.forEach(t => {
        if (t && t !== 'null' && t !== 'undefined') tags.add(t);
    }));
    
    return Array.from(tags).sort();
  }, [items, activeTab, notesSubTab]);

  const handleSend = async (text: string) => {
    setPendingCount(prev => prev + 1);
    setError(null);
    const tempId = uuidv4();

    const optimisticItem: BrainDumpItem = {
      id: tempId,
      type: ItemType.NOTE,
      content: text,
      status: 'pending',
      created_at: new Date().toISOString(),
      meta: { tags: [] },
      isOptimistic: true,
    };

    setItems((prev) => {
        const updated = [optimisticItem, ...prev];
        saveAndSync(updated); // Syncing items only, keeps existing config
        return updated;
    });

    processItemInBackground(text, tempId, optimisticItem);
  };

  const processItemInBackground = async (text: string, tempId: string, optimisticItem: BrainDumpItem) => {
    try {
        const currentTags = new Set<string>();
        itemsRef.current.forEach(i => i.meta?.tags?.forEach(t => currentTags.add(t)));
        
        // Pass known skills to classifier
        const skillNames = skills.map(s => s.name);

        const classifiedItems = await classifyText(text, Array.from(currentTags), skillNames, 0, customPrompt);
  
        const newItems: BrainDumpItem[] = classifiedItems.map(partial => {
            const isFinance = partial.type === ItemType.FINANCE;
            // Finance and Skill Logs are records, so mark as done. Journal is also a record.
            const isRecord = isFinance || partial.type === ItemType.SKILL_LOG || partial.type === ItemType.JOURNAL;
            
            // Resolve Skill ID if it's a SKILL_LOG
            let finalMeta = { tags: [], ...partial.meta };
            if (partial.type === ItemType.SKILL_LOG && partial.meta?.skillName) {
                // Try exact match (case insensitive)
                const matchedSkill = skills.find(s => s.name.toLowerCase() === partial.meta?.skillName?.toLowerCase());
                
                if (matchedSkill) {
                    finalMeta = { ...finalMeta, skillId: matchedSkill.id };
                } else {
                    if (skills.length > 0) {
                        finalMeta = { ...finalMeta, skillId: skills[0].id }; // Default assignment
                    }
                }
            }

            return {
                id: uuidv4(),
                status: isRecord ? 'done' : 'pending',
                created_at: new Date().toISOString(),
                completed_at: isRecord ? new Date().toISOString() : undefined,
                type: ItemType.NOTE,
                content: text, // Fallback content
                ...partial, 
                meta: finalMeta, // Use resolved meta
                isOptimistic: false,
            };
        });
  
        setItems((prev) => {
             const prevWithoutOptimistic = prev.filter(i => i.id !== tempId);
             const updated = [...newItems, ...prevWithoutOptimistic];
             saveAndSync(updated); 
             return updated;
        });

    } catch (err) {
        console.error("Processing failed", err);
        setItems(prev => {
            const updated = prev.map(i => i.id === tempId ? { ...i, isOptimistic: false } : i);
            saveAndSync(updated);
            return updated;
        });
    } finally {
        setPendingCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleToggleStatus = async (id: string) => {
    setItems((prevItems) => {
        const targetItem = prevItems.find(i => i.id === id);
        if (!targetItem) return prevItems;
    
        const newStatus: 'pending' | 'done' = targetItem.status === 'pending' ? 'done' : 'pending';
        const completedAt = newStatus === 'done' ? new Date().toISOString() : undefined;
    
        const updatedItems = prevItems.map(item => 
          item.id === id ? { ...item, status: newStatus, completed_at: completedAt } : item
        );

        saveAndSync(updatedItems);
        return updatedItems;
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    setItems(prev => {
        const updatedItems = prev.filter(i => i.id !== id);
        saveAndSync(updatedItems);
        return updatedItems;
    });
  };

  const handleUpdateItem = async (id: string, newContent: string, newTags: string[], newAmount?: number, newDate?: string, newPaymentMethod?: string, newBudgetCategory?: string, newDuration?: number, newSkillId?: string, newToWallet?: string, newFinanceType?: FinanceType) => {
      setItems(prev => {
          const updatedItems = prev.map(item => 
              item.id === id 
                ? { 
                    ...item, 
                    content: newContent, 
                    meta: { 
                        ...item.meta, 
                        tags: newTags, 
                        amount: newAmount, 
                        date: newDate,
                        paymentMethod: newPaymentMethod,
                        budgetCategory: newBudgetCategory,
                        durationMinutes: newDuration,
                        skillId: newSkillId,
                        toWallet: newToWallet,
                        financeType: newFinanceType || item.meta.financeType
                    } 
                  } 
                : item
          );
          saveAndSync(updatedItems);
          return updatedItems;
      });
  };

  // --- Skill & Wallet Management Handlers ---
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

  const handleConfirmDelete = () => {
      if (deleteType === 'skill' && deleteId) {
          const updated = skills.filter(s => s.id !== deleteId);
          setSkills(updated);
          saveAndSync(items, undefined, undefined, updated, wallets, monthlyThemes);
      } else if (deleteType === 'wallet' && deleteId) {
          const updated = wallets.filter(w => w.id !== deleteId);
          setWallets(updated);
          saveAndSync(items, undefined, undefined, skills, updated, monthlyThemes);
      }
      setDeleteId(null);
      setDeleteType(null);
  };

  // --- Theme Navigation ---
  const changeThemeMonth = (offset: number) => {
      const newDate = new Date(themeNavDate);
      newDate.setMonth(newDate.getMonth() + offset);
      setThemeNavDate(newDate);
  };

  const getThemeForDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      return { key, content: monthlyThemes[key] || '' };
  };

  // --- Filtering Logic ---
  
  const getFocusItems = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86400000;
    const afterTomorrowStart = tomorrowStart + 86400000;

    const relevantItems = items.filter(i => 
        (i.type === ItemType.TODO || i.type === ItemType.EVENT) && 
        i.status === 'pending'
    );
    
    const today: BrainDumpItem[] = [];
    const tomorrow: BrainDumpItem[] = [];
    const later: BrainDumpItem[] = [];

    relevantItems.forEach(item => {
        if (!item.meta.date) {
            later.push(item);
            return;
        }

        const d = new Date(item.meta.date);
        const itemTime = d.getTime();
        
        if (isNaN(itemTime)) {
            later.push(item);
            return;
        }
        
        if (itemTime < tomorrowStart) {
            today.push(item);
        } else if (itemTime >= tomorrowStart && itemTime < afterTomorrowStart) {
            tomorrow.push(item);
        } else {
            later.push(item);
        }
    });

    const sortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
         const da = a.meta.date ? new Date(a.meta.date).getTime() : Infinity;
         const db = b.meta.date ? new Date(b.meta.date).getTime() : Infinity;
         return da - db;
    };

    return { 
        today: today.sort(sortFn), 
        tomorrow: tomorrow.sort(sortFn), 
        later: later.sort(sortFn) 
    };
  };

  // Calculate start of current week (Monday)
  const getStartOfWeek = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      d.setHours(0, 0, 0, 0);
      return new Date(d.setDate(diff));
  };

  const getSkillItems = () => {
      const logs = items.filter(i => i.type === ItemType.SKILL_LOG).sort((a, b) => {
          const da = new Date(a.meta.date || a.created_at).getTime();
          const db = new Date(b.meta.date || b.created_at).getTime();
          return db - da; 
      });

      const skillStats = new Map<string, number>(); // All time
      const weeklyStats = new Map<string, number>(); // Current Week

      const startOfWeek = getStartOfWeek(new Date());

      skills.forEach(s => {
          skillStats.set(s.id, 0);
          weeklyStats.set(s.id, 0);
      });

      items.filter(i => i.type === ItemType.SKILL_LOG).forEach(log => {
          const duration = log.meta.durationMinutes || 0;
          const sId = log.meta.skillId;
          const logDate = new Date(log.meta.date || log.created_at);

          if (sId) {
             // Total
             skillStats.set(sId, (skillStats.get(sId) || 0) + duration);
             
             // Weekly
             if (logDate >= startOfWeek) {
                 weeklyStats.set(sId, (weeklyStats.get(sId) || 0) + duration);
             }
          }
      });

      const stats = skills.map(skill => ({
          ...skill,
          totalHours: Math.round(((skillStats.get(skill.id) || 0) / 60) * 10) / 10,
          weeklyHours: Math.round(((weeklyStats.get(skill.id) || 0) / 60) * 10) / 10,
          weeklyProgress: skill.weeklyTargetMinutes 
            ? Math.min(100, ( (weeklyStats.get(skill.id) || 0) / skill.weeklyTargetMinutes ) * 100)
            : 0
      })).sort((a,b) => b.totalHours - a.totalHours);

      return { stats, logs: logs.slice(0, 10) };
  };

  const getShoppingItems = () => {
    const visibleItems = items.filter(i => {
        if (i.type !== ItemType.SHOPPING) return false;
        if (i.status === 'pending') return true;
        if (i.status === 'done' && i.meta?.shoppingCategory === 'routine') return true;
        if (i.status === 'done' && i.completed_at) {
            const completedTime = new Date(i.completed_at).getTime();
            const now = new Date().getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            return (now - completedTime) < oneDayMs;
        }
        return false;
    });
    
    const urgent = visibleItems.filter(i => i.meta?.shoppingCategory === 'urgent');
    const routine = visibleItems.filter(i => i.meta?.shoppingCategory === 'routine');
    const normal = visibleItems.filter(i => !i.meta?.shoppingCategory || i.meta.shoppingCategory === 'not_urgent');

    const sortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
        const da = a.meta.date ? new Date(a.meta.date).getTime() : 0;
        const db = b.meta.date ? new Date(b.meta.date).getTime() : 0;
        return da - db;
    };

    urgent.sort(sortFn);
    routine.sort(sortFn);
    normal.sort(sortFn);

    return { urgent, routine, normal };
  };

  const getNoteItems = () => {
    // Separation logic
    let relevantItems: BrainDumpItem[] = [];
    
    if (notesSubTab === 'general') {
        relevantItems = items.filter(i => i.type === ItemType.NOTE && i.status !== 'done');
    } else if (notesSubTab === 'skills') {
        relevantItems = items.filter(i => i.type === ItemType.SKILL_LOG);
    } else {
        // JOURNAL: Include explicit journals AND done TODO items
        relevantItems = items.filter(i => 
            i.type === ItemType.JOURNAL || 
            (i.type === ItemType.TODO && i.status === 'done')
        );
    }
    
    // Tag Filter
    if (selectedTag) {
        relevantItems = relevantItems.filter(i => i.meta?.tags?.includes(selectedTag));
    }
    
    // Date Filter
    if (filterDate) {
        relevantItems = relevantItems.filter(i => {
             const itemDateStr = i.meta.date || i.created_at;
             if (!itemDateStr) return false;
             
             // Compare YYYY-MM-DD
             const itemDate = new Date(itemDateStr);
             const targetDate = new Date(filterDate);
             
             return itemDate.getFullYear() === targetDate.getFullYear() &&
                    itemDate.getMonth() === targetDate.getMonth() &&
                    itemDate.getDate() === targetDate.getDate();
        });
    }

    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        relevantItems = relevantItems.filter(i => i.content.toLowerCase().includes(lowerQ) || i.meta.tags?.some(t => t.toLowerCase().includes(lowerQ)));
    }

    return relevantItems.sort((a, b) => {
        // Sort by actual date for Journals, created for others usually
        const da = a.meta.date ? new Date(a.meta.date).getTime() : new Date(a.created_at).getTime();
        const db = b.meta.date ? new Date(b.meta.date).getTime() : new Date(b.created_at).getTime();
        
        return sortOrder === 'newest' ? db - da : da - db;
    });
  };

  const getJournalGroups = (journalItems: BrainDumpItem[]) => {
      const groups: Record<string, BrainDumpItem[]> = {};
      
      journalItems.forEach(item => {
          // For TODOs, use completed_at if available to place them on the day they were done.
          // For Journals, use meta.date or created_at.
          const dateStr = (item.type === ItemType.TODO && item.completed_at) 
            ? item.completed_at 
            : (item.meta.date || item.created_at);
            
          const dateObj = new Date(dateStr);
          // Key by YYYY-MM-DD
          const key = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD
          
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
      });

      // Sort items within day by time (creation or completion)
      Object.keys(groups).forEach(key => {
          groups[key].sort((a, b) => {
              const ta = (a.type === ItemType.TODO && a.completed_at) ? new Date(a.completed_at).getTime() : new Date(a.created_at).getTime();
              const tb = (b.type === ItemType.TODO && b.completed_at) ? new Date(b.completed_at).getTime() : new Date(b.created_at).getTime();
              return sortOrder === 'newest' ? tb - ta : ta - tb;
          });
      });

      // Sort groups themselves
      const sortedKeys = Object.keys(groups).sort((a, b) => {
           return sortOrder === 'newest' ? new Date(b).getTime() - new Date(a).getTime() : new Date(a).getTime() - new Date(b).getTime();
      });
      
      // Return entries in order
      const sortedGroups: Record<string, BrainDumpItem[]> = {};
      sortedKeys.forEach(key => sortedGroups[key] = groups[key]);

      return sortedGroups;
  };

  const getWalletStats = () => {
      // Create a map to track balances
      const balanceMap = new Map<string, number>();
      
      wallets.forEach(w => balanceMap.set(w.name.toLowerCase(), w.initialBalance));

      // Go through ALL finished items that involve money
      items.forEach(item => {
          if (item.status !== 'done' && item.type !== ItemType.FINANCE) return;
          if (!item.meta.amount) return;
          
          const amount = item.meta.amount;
          const walletName = item.meta.paymentMethod?.toLowerCase(); // Source Wallet
          
          if (walletName && balanceMap.has(walletName)) {
              const current = balanceMap.get(walletName) || 0;
              const wallet = wallets.find(w => w.name.toLowerCase() === walletName);
              const isCC = wallet?.type === 'cc';

              const isIncome = item.meta.financeType === 'income' || item.meta.financeType === 'reimbursement';
              const isTransfer = item.meta.financeType === 'transfer';
              
              if (isIncome) {
                   // Income adds to Asset. If CC, it reduces debt (by subtracting from the 'positive' debt balance).
                   if (isCC) balanceMap.set(walletName, Math.max(0, current - amount)); 
                   else balanceMap.set(walletName, current + amount);
              } else if (isTransfer) {
                  // Source of Transfer
                  if (isCC) balanceMap.set(walletName, current + amount); // Cash Advance from CC -> Increases Debt
                  else balanceMap.set(walletName, current - amount); // Transfer from Asset -> Decreases Asset
                  
                  // Destination of Transfer
                  const destName = item.meta.toWallet?.toLowerCase();
                  if (destName && balanceMap.has(destName)) {
                      const destCurrent = balanceMap.get(destName) || 0;
                      const destWallet = wallets.find(w => w.name.toLowerCase() === destName);
                      const isDestCC = destWallet?.type === 'cc';
                      
                      if (isDestCC) balanceMap.set(destName, Math.max(0, destCurrent - amount)); // Paying CC bill -> Decreases Debt
                      else balanceMap.set(destName, destCurrent + amount); // Transfer to Asset -> Increases Asset
                  }
              } else {
                  // Expense or Lending
                  if (isCC) balanceMap.set(walletName, current + amount); // Spending on CC -> Increases Debt
                  else balanceMap.set(walletName, current - amount); // Spending from Asset -> Decreases Asset
              }
          }
      });

      // Map back to wallet objects
      const walletStats = wallets.map(w => ({
          ...w,
          currentBalance: balanceMap.get(w.name.toLowerCase()) || w.initialBalance
      }));

      // Calculate Total Net Worth: (Total Assets) - (Total CC Debt)
      const assets = walletStats.filter(w => w.type !== 'cc');
      const liabilities = walletStats.filter(w => w.type === 'cc');

      const totalAssets = assets.reduce((acc, w) => acc + w.currentBalance, 0);
      const totalDebt = liabilities.reduce((acc, w) => acc + w.currentBalance, 0);
      const totalNetWorth = totalAssets - totalDebt;

      return { walletStats, totalNetWorth, totalAssets, totalDebt };
  };

  const getFinanceItems = () => {
      // 1. Explicit Finance Items
      let finance = items.filter(i => i.type === ItemType.FINANCE);
      
      // 2. Implicit Expenses
      const implicitExpenses = items.filter(i => 
          (i.type === ItemType.SHOPPING || i.type === ItemType.TODO) && 
          i.status === 'done' && 
          (i.meta.amount || 0) > 0
      );

      // Combine them
      let allTransactions = [...finance, ...implicitExpenses];
      
      // Filter by Month
      allTransactions = allTransactions.filter(i => {
          const dateStr = i.completed_at || i.created_at;
          if (!dateStr) return false;
          
          const d = new Date(dateStr);
          return d.getMonth() === financeDate.getMonth() && d.getFullYear() === financeDate.getFullYear();
      });

      // --- FILTERS ---

      // Filter by Wallet (Source or Destination)
      if (filterWallet) {
          const wName = filterWallet.toLowerCase();
          allTransactions = allTransactions.filter(i => 
              i.meta.paymentMethod?.toLowerCase() === wName || 
              i.meta.toWallet?.toLowerCase() === wName
          );
      }

      // Filter by Type
      if (filterTransactionType) {
          allTransactions = allTransactions.filter(i => {
              if (filterTransactionType === 'shopping') {
                  return i.type === ItemType.SHOPPING;
              }
              // Default to 'expense' if financeType is missing for money items
              const type = i.meta.financeType || ((i.type === ItemType.FINANCE || i.meta.amount) ? 'expense' : undefined);
              return type === filterTransactionType;
          });
      }

      // Filter by Amount Range
      if (filterMinAmount) {
          allTransactions = allTransactions.filter(i => (i.meta.amount || 0) >= parseFloat(filterMinAmount));
      }
      if (filterMaxAmount) {
          allTransactions = allTransactions.filter(i => (i.meta.amount || 0) <= parseFloat(filterMaxAmount));
      }

      // Tag Filter
      if (selectedTag) allTransactions = allTransactions.filter(i => i.meta?.tags?.includes(selectedTag));
      
      if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        allTransactions = allTransactions.filter(i => i.content.toLowerCase().includes(lowerQ));
      }

      // Sort
      allTransactions.sort((a, b) => {
          // Amount Sort
          if (sortOrder === 'highest_amount') {
              return (b.meta.amount || 0) - (a.meta.amount || 0);
          }
          if (sortOrder === 'lowest_amount') {
              return (a.meta.amount || 0) - (b.meta.amount || 0);
          }

          // Default Date Sort
          const dateA = new Date(a.completed_at || a.created_at).getTime();
          const dateB = new Date(b.completed_at || b.created_at).getTime();
          return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });

      // Totals (Calculate based on visible list for context, but usually totals should reflect the whole month unless filtered deeply. 
      // For now, let's keep totals based on the filtered list to reflect what is seen, OR we can calc based on unfiltered month data.
      // Usually users want to see totals of what they filtered. Let's stick to filtered list for now.)
      
      const totalIncome = allTransactions.reduce((acc, curr) => {
          if (curr.meta?.financeType === 'income' || curr.meta?.financeType === 'reimbursement') {
              return acc + (curr.meta.amount || 0);
          }
          return acc;
      }, 0);

      const totalExpense = allTransactions.reduce((acc, curr) => {
        if (curr.meta?.financeType === 'transfer') return acc;
        
        // If type is expense, lending or implicit expense
        const type = curr.meta.financeType || 'expense';
        if (type === 'expense' || type === 'lending') {
             return acc + (curr.meta.amount || 0);
        }
        return acc;
      }, 0);

      // Custom Budget Calculations (These usually need full month data to be accurate for "Remaining Budget", 
      // but if we are filtering, maybe we just want to see the list. 
      // Let's re-calculate full month stats separately for the Budget View to ensure accuracy regardless of filters on Transaction View.)

      // ... However, the function returns one object. Let's recalculate full month data for the Budget Map 
      // so the Budget View doesn't break when filters are applied.
      
      // FULL MONTH DATA (Unfiltered by wallet/amount/type) for Budget Context
      let fullMonthTransactions = [...finance, ...implicitExpenses];
      fullMonthTransactions = fullMonthTransactions.filter(i => {
          const dateStr = i.completed_at || i.created_at;
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return d.getMonth() === financeDate.getMonth() && d.getFullYear() === financeDate.getFullYear();
      });

      const budgetMap = new Map<string, number>();
      const plannedBudgetMap = new Map<string, number>();
      let uncategorized = 0;
      let projectedUncategorized = 0;
      
      budgetConfig.rules.forEach(rule => {
          budgetMap.set(rule.id, 0);
          plannedBudgetMap.set(rule.id, 0);
      });

      const resolveCategory = (cat?: string) => {
          if (!cat) return null;
          if (budgetMap.has(cat)) return cat; 
          const foundRule = budgetConfig.rules.find(r => r.name.toLowerCase() === cat.toLowerCase());
          return foundRule ? foundRule.id : null;
      };

      // Use fullMonthTransactions for correct Budget Progress bars
      fullMonthTransactions.forEach(item => {
           if (item.meta?.financeType === 'income' || item.meta?.financeType === 'reimbursement' || item.meta?.financeType === 'transfer') return;
           
           const amt = item.meta?.amount || 0;
           const catId = resolveCategory(item.meta?.budgetCategory);

           if (catId) {
               budgetMap.set(catId, (budgetMap.get(catId) || 0) + amt);
           } else {
               uncategorized += amt;
           }
      });

      // --- Projected / Planned Expenses ---
      let projectedExpense = 0;
      const startOfMonth = new Date(financeDate.getFullYear(), financeDate.getMonth(), 1);
      const endOfMonth = new Date(financeDate.getFullYear(), financeDate.getMonth() + 1, 0, 23, 59, 59);
      const now = new Date();

      items.forEach(item => {
           if ((item.type !== ItemType.SHOPPING && item.type !== ItemType.TODO) || (item.meta.amount || 0) <= 0) return;
           if (item.type === ItemType.SHOPPING && (!item.meta.shoppingCategory || item.meta.shoppingCategory === 'not_urgent')) return;

           const amount = item.meta.amount || 0;
           const catId = resolveCategory(item.meta.budgetCategory);
           
           const addToPlanned = (amt: number) => {
               if (catId) {
                   plannedBudgetMap.set(catId, (plannedBudgetMap.get(catId) || 0) + amt);
               } else {
                   projectedUncategorized += amt;
               }
           };

           if (item.type === ItemType.SHOPPING && item.meta.shoppingCategory === 'routine') {
               const recurrence = item.meta.recurrenceDays || 7;
               let nextDue: Date;
               if (item.status === 'done' && item.completed_at) {
                   nextDue = new Date(new Date(item.completed_at).getTime() + (recurrence * 86400000));
               } else if (item.meta.date) {
                   nextDue = new Date(item.meta.date);
               } else {
                   nextDue = new Date();
               }
               
               const cursor = new Date(nextDue);
               while (cursor < startOfMonth) {
                   cursor.setDate(cursor.getDate() + recurrence);
               }
               while (cursor <= endOfMonth) {
                   projectedExpense += amount;
                   addToPlanned(amount);
                   cursor.setDate(cursor.getDate() + recurrence);
               }
           } else {
               if (item.status === 'pending') {
                   const targetDate = item.meta.date ? new Date(item.meta.date) : null;
                   if (!targetDate) {
                       if (financeDate.getMonth() === now.getMonth() && financeDate.getFullYear() === now.getFullYear()) {
                           projectedExpense += amount;
                           addToPlanned(amount);
                       }
                   } else {
                       if (targetDate.getMonth() === financeDate.getMonth() && targetDate.getFullYear() === financeDate.getFullYear()) {
                           projectedExpense += amount;
                           addToPlanned(amount);
                       }
                   }
               }
           }
      });

      // Recalculate Totals based on FULL MONTH for the top card overview, unless we want the top card to react to filters?
      // User request implies filtering "Transactions". Let's return the filtered list for the list view, but keep totals consistent with the view context.
      // If I filter by "Food", I expect "Total Expense" to show Food expense.
      // So returning `totalIncome` and `totalExpense` derived from `allTransactions` (filtered) is correct for the Dashboard "Income/Expense" blocks when filters are active.
      // However, Net Worth should be global. (Already handled by getWalletStats).

      return { 
          list: allTransactions, 
          totalIncome, 
          totalExpense, 
          balance: totalIncome - totalExpense, 
          projectedExpense, 
          budgetMap, 
          plannedBudgetMap,
          uncategorized, 
          projectedUncategorized 
      };
  };

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const renderSyncIndicator = () => {
    let icon, text, color;
    switch(syncStatus) {
        case 'synced': icon = <CloudCheck className="w-4 h-4" />; text = "Saved"; color = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"; break;
        case 'syncing': icon = <RefreshCw className="w-4 h-4 animate-spin" />; text = "Saving..."; color = "text-blue-400 bg-blue-400/10 border-blue-400/20"; break;
        case 'error': icon = <CloudOff className="w-4 h-4" />; text = "Sync Failed"; color = "text-red-400 bg-red-400/10 border-red-400/20"; break;
        case 'local': icon = <Save className="w-4 h-4" />; text = "Local"; color = "text-amber-400 bg-amber-400/10 border-amber-400/20"; break;
    }
    return (
        <button 
            onClick={() => (syncStatus === 'error' || syncStatus === 'local') && saveAndSync(items)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${color}`}
        >
            {icon} <span className="hidden sm:inline">{text}</span>
        </button>
    );
  };

  const changeMonth = (offset: number) => {
      const newDate = new Date(financeDate);
      newDate.setMonth(newDate.getMonth() + offset);
      setFinanceDate(newDate);
  };

  // --- Bottom Navigation Components ---

  const renderTabs = () => (
    <div className="flex justify-center overflow-x-auto no-scrollbar pb-2 pt-2 px-4 bg-background/95 backdrop-blur-sm border-t border-border">
      <div className="flex gap-4 sm:gap-6 min-w-max">
        <button onClick={() => setActiveTab('summary')} className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${activeTab === 'summary' ? 'text-primary' : 'text-muted hover:text-white'}`}>
          <div className={`p-2 rounded-full ${activeTab === 'summary' ? 'bg-primary/10' : ''}`}><LayoutDashboard className="w-5 h-5" /></div>
          Summary
        </button>
        <button onClick={() => setActiveTab('focus')} className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${activeTab === 'focus' ? 'text-primary' : 'text-muted hover:text-white'}`}>
          <div className={`p-2 rounded-full ${activeTab === 'focus' ? 'bg-primary/10' : ''}`}><Target className="w-5 h-5" /></div>
          Focus
        </button>
        <button onClick={() => setActiveTab('shopping')} className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${activeTab === 'shopping' ? 'text-primary' : 'text-muted hover:text-white'}`}>
           <div className={`p-2 rounded-full ${activeTab === 'shopping' ? 'bg-primary/10' : ''}`}><ShoppingCart className="w-5 h-5" /></div>
          Life
        </button>
        <button onClick={() => setActiveTab('notes')} className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${activeTab === 'notes' ? 'text-primary' : 'text-muted hover:text-white'}`}>
           <div className={`p-2 rounded-full ${activeTab === 'notes' ? 'bg-primary/10' : ''}`}><StickyNote className="w-5 h-5" /></div>
          Notes
        </button>
        <button onClick={() => setActiveTab('money')} className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${activeTab === 'money' ? 'text-primary' : 'text-muted hover:text-white'}`}>
           <div className={`p-2 rounded-full ${activeTab === 'money' ? 'bg-primary/10' : ''}`}><WalletIcon className="w-5 h-5" /></div>
          Money
        </button>
      </div>
    </div>
  );

  const renderFilters = () => {
    // Show filters only for tabs that need them
    if (activeTab !== 'notes' && activeTab !== 'money') return null;
    // Don't show filters for Journal subtab
    if (activeTab === 'notes' && notesSubTab === 'journal') return null;

    const isMoney = activeTab === 'money';
    const isTransactions = moneyView === 'transactions';

    return (
        <div className="px-4 py-2 bg-background border-t border-border z-50">
            <div className="flex items-center gap-2 max-w-2xl mx-auto relative">
                 {/* Search Bar */}
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full bg-surface border border-border rounded-full pl-8 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-acc-note transition-colors"
                    />
                </div>
                
                {/* Filter & Sort Buttons */}
                <div className="flex gap-2 relative">
                    {/* Filter Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                            className={`p-1.5 rounded-full border transition-colors ${showFilterMenu || selectedTag || filterDate || filterWallet || filterTransactionType || filterMinAmount ? 'bg-acc-note/20 border-acc-note text-acc-note' : 'bg-surface border-border text-muted hover:text-white'}`}
                        >
                            <Filter className="w-4 h-4" />
                        </button>
                        
                        {showFilterMenu && (
                            <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)}></div>
                            <div className="absolute right-0 bottom-full mb-2 w-64 bg-surface border border-border rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <h4 className="text-xs font-bold text-white mb-3 uppercase tracking-wider flex justify-between items-center">
                                    Filters
                                    {(selectedTag || filterDate || filterWallet || filterTransactionType || filterMinAmount || filterMaxAmount) && (
                                        <button 
                                            onClick={() => {
                                                setSelectedTag('');
                                                setFilterDate('');
                                                setFilterWallet('');
                                                setFilterTransactionType('');
                                                setFilterMinAmount('');
                                                setFilterMaxAmount('');
                                            }}
                                            className="text-[10px] text-red-400 hover:underline"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </h4>
                                
                                {/* Tag Select */}
                                <div className="mb-3">
                                    <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><Tag className="w-3 h-3" /> Tag</label>
                                    <select 
                                        value={selectedTag || ''}
                                        onChange={(e) => setSelectedTag(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-acc-note"
                                    >
                                        <option value="">All Tags</option>
                                        {uniqueTags.map(tag => (
                                            <option key={tag} value={tag}>{tag}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Date Input */}
                                <div className="mb-3">
                                    <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Specific Date</label>
                                    <div className="flex gap-1">
                                        <input 
                                            type="date"
                                            value={filterDate}
                                            onChange={(e) => setFilterDate(e.target.value)}
                                            className="w-full bg-background border border-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-acc-note [color-scheme:dark]"
                                        />
                                        {filterDate && (
                                            <button onClick={() => setFilterDate('')} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white">
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* MONEY SPECIFIC FILTERS */}
                                {isMoney && isTransactions && (
                                    <div className="pt-2 border-t border-border mt-2">
                                        <h5 className="text-[10px] font-bold text-emerald-400 mb-2 uppercase tracking-wider">Money Filters</h5>
                                        
                                        {/* Wallet */}
                                        <div className="mb-2">
                                            <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><WalletIcon className="w-3 h-3" /> Wallet</label>
                                            <select 
                                                value={filterWallet}
                                                onChange={(e) => setFilterWallet(e.target.value)}
                                                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-acc-note"
                                            >
                                                <option value="">All Wallets</option>
                                                {wallets.map(w => (
                                                    <option key={w.id} value={w.name}>{w.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Type */}
                                        <div className="mb-2">
                                            <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><ArrowDownUp className="w-3 h-3" /> Type</label>
                                            <select 
                                                value={filterTransactionType}
                                                onChange={(e) => setFilterTransactionType(e.target.value)}
                                                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-acc-note"
                                            >
                                                <option value="">All Types</option>
                                                <option value="expense">Expense</option>
                                                <option value="income">Income</option>
                                                <option value="transfer">Transfer</option>
                                                <option value="lending">Lending</option>
                                                <option value="reimbursement">Reimbursement</option>
                                                <option value="shopping">Shopping</option>
                                            </select>
                                        </div>

                                        {/* Amount Range */}
                                        <div>
                                            <label className="block text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Amount Range</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number"
                                                    placeholder="Min"
                                                    value={filterMinAmount}
                                                    onChange={(e) => setFilterMinAmount(e.target.value)}
                                                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-acc-note"
                                                />
                                                <input 
                                                    type="number"
                                                    placeholder="Max"
                                                    value={filterMaxAmount}
                                                    onChange={(e) => setFilterMaxAmount(e.target.value)}
                                                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-acc-note"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            </>
                        )}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                            className={`p-1.5 rounded-full border transition-colors ${showSortMenu ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-border text-muted hover:text-white'}`}
                        >
                            <ArrowUpDown className="w-4 h-4" />
                        </button>
                        
                        {showSortMenu && (
                             <>
                             <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
                             <div className="absolute right-0 bottom-full mb-2 w-44 bg-surface border border-border rounded-xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider px-2">Sort By</h4>
                                <button 
                                    onClick={() => { setSortOrder('newest'); setShowSortMenu(false); }}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${sortOrder === 'newest' ? 'bg-white/10 text-white' : 'text-muted hover:text-white hover:bg-white/5'}`}
                                >
                                    Newest First
                                    {sortOrder === 'newest' && <CheckCircle2 className="w-3 h-3 text-acc-todo" />}
                                </button>
                                <button 
                                    onClick={() => { setSortOrder('oldest'); setShowSortMenu(false); }}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${sortOrder === 'oldest' ? 'bg-white/10 text-white' : 'text-muted hover:text-white hover:bg-white/5'}`}
                                >
                                    Oldest First
                                    {sortOrder === 'oldest' && <CheckCircle2 className="w-3 h-3 text-acc-todo" />}
                                </button>
                                
                                {isMoney && isTransactions && (
                                    <>
                                        <div className="h-px bg-border my-1"></div>
                                        <button 
                                            onClick={() => { setSortOrder('highest_amount'); setShowSortMenu(false); }}
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${sortOrder === 'highest_amount' ? 'bg-white/10 text-white' : 'text-muted hover:text-white hover:bg-white/5'}`}
                                        >
                                            Highest Amount
                                            {sortOrder === 'highest_amount' && <CheckCircle2 className="w-3 h-3 text-acc-todo" />}
                                        </button>
                                        <button 
                                            onClick={() => { setSortOrder('lowest_amount'); setShowSortMenu(false); }}
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${sortOrder === 'lowest_amount' ? 'bg-white/10 text-white' : 'text-muted hover:text-white hover:bg-white/5'}`}
                                        >
                                            Lowest Amount
                                            {sortOrder === 'lowest_amount' && <CheckCircle2 className="w-3 h-3 text-acc-todo" />}
                                        </button>
                                    </>
                                )}
                             </div>
                             </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-primary font-sans">
      
      {/* Header */}
      <header className="fixed top-0 w-full bg-background/80 backdrop-blur-md z-40 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-acc-todo to-acc-event p-2 rounded-lg">
               <Brain className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">BrainDump <span className="text-muted font-normal text-sm ml-1">AI</span></h1>
          </div>
          
          <div className="flex items-center gap-2">
             {pendingCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-acc-todo bg-acc-todo/10 px-3 py-1.5 rounded-full animate-pulse mr-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span className="hidden sm:inline">Processing...</span>
                </div>
             )}
             {renderSyncIndicator()}
             <div className="w-px h-6 bg-border mx-1"></div>
             <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-muted hover:text-white hover:bg-surface rounded-full transition-colors"><Settings className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-48 px-4 max-w-2xl mx-auto min-h-screen">
        
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-900/50 flex items-center gap-3 text-red-200">
            <AlertTriangle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted animate-pulse">
            <div className="w-12 h-12 bg-surface rounded-full mb-4"></div>
            <p>Syncing...</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {/* SUMMARY DASHBOARD TAB */}
            {activeTab === 'summary' && (() => {
               // Calculate metrics on fly
               const { today, tomorrow, later } = getFocusItems();
               const overdueCount = later.filter(i => i.meta.date && new Date(i.meta.date) < new Date()).length;
               
               const { stats } = getSkillItems();
               const topSkill = stats[0];
               const totalWeeklyHours = stats.reduce((acc, s) => acc + s.weeklyHours, 0);
               const totalAllTimeHours = stats.reduce((acc, s) => acc + s.totalHours, 0);
               const avgProgress = stats.length > 0 
                  ? stats.reduce((acc, s) => acc + s.weeklyProgress, 0) / stats.length 
                  : 0;

               const { urgent, routine } = getShoppingItems();
               
               const { walletStats, totalNetWorth, totalAssets, totalDebt } = getWalletStats();
               const { totalExpense } = getFinanceItems();
               const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

               // Notes Metrics
               const allNotes = items.filter(i => i.type === ItemType.NOTE);
               const randomNotes = allNotes.length > 0 
                    ? [...allNotes].sort(() => 0.5 - Math.random()).slice(0, 3) 
                    : [];

               // Theme Data
               const { key: themeKey, content: themeContent } = getThemeForDate(themeNavDate);

               return (
                   <div className="space-y-6">
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">{getGreeting()}</h2>
                            <p className="text-sm text-muted">Here is your daily snapshot.</p>
                        </div>

                        {/* NEW: Monthly Theme Card */}
                        <div className="bg-surface border border-border p-4 rounded-xl transition-all relative">
                            <div className="flex justify-between items-center mb-3">
                                <button onClick={() => changeThemeMonth(-1)} className="p-1 text-muted hover:text-white hover:bg-white/10 rounded"><ChevronLeft className="w-4 h-4" /></button>
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> {themeNavDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} Theme
                                </span>
                                <button onClick={() => changeThemeMonth(1)} className="p-1 text-muted hover:text-white hover:bg-white/10 rounded"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                            
                            <div className="text-center py-2 px-1">
                                {themeContent ? (
                                    <p onClick={() => { setTempThemeContent(themeContent); setThemeEditMode(true); }} className="text-lg font-medium text-white cursor-pointer hover:opacity-80 transition-opacity">
                                        "{themeContent}"
                                    </p>
                                ) : (
                                    <p onClick={() => { setTempThemeContent(''); setThemeEditMode(true); }} className="text-sm text-muted italic cursor-pointer hover:text-white transition-colors border-b border-dashed border-border inline-block pb-1">
                                        Set a theme for this month...
                                    </p>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => { setTempThemeContent(themeContent); setThemeEditMode(true); }}
                                className="absolute top-3 right-10 p-1.5 text-muted hover:text-white rounded-md opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Money Card (Total Net Worth) */}
                        <div className="bg-gradient-to-br from-surface to-surface/50 border border-border p-5 rounded-xl transition-all group relative">
                             <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <WalletIcon className="w-5 h-5" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Total Net Worth</span>
                                </div>
                                <button onClick={() => setShowBalance(!showBalance)} className="text-muted hover:text-white transition-colors">
                                    {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                             </div>
                             <div 
                                onClick={() => setActiveTab('money')}
                                className="text-2xl font-bold text-white mb-1 cursor-pointer hover:text-emerald-400 transition-colors"
                             >
                                 {showBalance ? fmt(totalNetWorth) : '••••••••'}
                             </div>
                             <div className="flex gap-4 mt-2 pt-2 border-t border-white/5">
                                 <div className="text-xs text-muted">
                                    Assets: <span className="text-emerald-400 font-medium">{showBalance ? fmt(totalAssets) : '••'}</span>
                                 </div>
                                 <div className="text-xs text-muted">
                                    Debt: <span className="text-red-400 font-medium">{showBalance ? fmt(totalDebt) : '••'}</span>
                                 </div>
                             </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             {/* Focus Card - Enhanced */}
                             <div onClick={() => { setActiveTab('focus'); setFocusSubTab('tasks'); }} className="bg-gradient-to-br from-surface to-surface/50 border border-border p-4 rounded-xl cursor-pointer hover:border-acc-todo/30 transition-all group flex flex-col">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="p-2 bg-acc-todo/10 rounded-lg text-acc-todo">
                                          <CheckCircle2 className="w-5 h-5" />
                                      </div>
                                      <span className="text-xs text-muted group-hover:text-white font-medium">{today.length} Today</span>
                                  </div>
                                  <h3 className="font-semibold text-white mb-2">Focus</h3>
                                  
                                  {/* Quick Preview */}
                                  <div className="flex-1 space-y-1 mb-2">
                                      {today.slice(0, 3).map(i => (
                                          <div key={i.id} className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                                              <div className="w-1 h-1 bg-acc-todo rounded-full shrink-0"></div>
                                              {i.content}
                                          </div>
                                      ))}
                                      {today.length === 0 && <span className="text-[10px] text-muted italic">All clear!</span>}
                                  </div>

                                  <div className="flex justify-between items-end text-[10px] text-muted border-t border-border pt-2 mt-auto">
                                      <span>{tomorrow.length} tmrw</span>
                                      {overdueCount > 0 && <span className="text-red-400">{overdueCount} overdue</span>}
                                  </div>
                             </div>

                             {/* Skill Card - Enhanced */}
                             <div onClick={() => { setActiveTab('focus'); setFocusSubTab('skills'); }} className="bg-gradient-to-br from-surface to-surface/50 border border-border p-4 rounded-xl cursor-pointer hover:border-indigo-500/30 transition-all group flex flex-col">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                          <GrowthIcon className="w-5 h-5" />
                                      </div>
                                      <span className="text-xs text-muted group-hover:text-white font-medium">{totalAllTimeHours}h Total</span>
                                  </div>
                                  <h3 className="font-semibold text-white mb-2">Growth</h3>
                                  
                                   {/* Quick Preview */}
                                   <div className="flex-1 space-y-1 mb-2">
                                      {topSkill ? (
                                         <>
                                            <div className="text-[10px] text-white truncate font-medium">{topSkill.name}</div>
                                            <div className="w-full h-1 bg-black/30 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, topSkill.weeklyProgress)}%` }}></div>
                                            </div>
                                         </>
                                      ) : <span className="text-[10px] text-muted italic">No active skills</span>}
                                  </div>

                                  <p className="text-[10px] text-muted mt-auto pt-2 border-t border-border">{totalWeeklyHours}h total this week</p>
                             </div>

                             {/* Life Card - Enhanced */}
                             <div onClick={() => setActiveTab('shopping')} className="bg-gradient-to-br from-surface to-surface/50 border border-border p-4 rounded-xl cursor-pointer hover:border-acc-shopping/30 transition-all group flex flex-col">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="p-2 bg-acc-shopping/10 rounded-lg text-acc-shopping">
                                          <ShoppingCart className="w-5 h-5" />
                                      </div>
                                      <span className="text-xs text-muted group-hover:text-white font-medium">{urgent.length} Urgent</span>
                                  </div>
                                  <h3 className="font-semibold text-white mb-2">Life</h3>

                                  {/* Quick Preview */}
                                  <div className="flex-1 space-y-1 mb-2">
                                      {urgent.length > 0 ? urgent.slice(0, 2).map(i => (
                                          <div key={i.id} className="text-[10px] text-red-400 truncate flex items-center gap-1">
                                              <AlertTriangle className="w-2 h-2 shrink-0" />
                                              {i.content}
                                          </div>
                                      )) : (
                                          routine.slice(0, 2).map(i => (
                                            <div key={i.id} className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                                                <div className="w-1 h-1 bg-acc-shopping rounded-full shrink-0"></div>
                                                {i.content}
                                            </div>
                                          ))
                                      )}
                                      {urgent.length === 0 && routine.length === 0 && <span className="text-[10px] text-muted italic">No tasks</span>}
                                  </div>

                                  <p className="text-[10px] text-muted mt-auto pt-2 border-t border-border">{routine.length} routine items</p>
                             </div>
                             
                             {/* Notes Card - Enhanced */}
                             <div onClick={() => setActiveTab('notes')} className="bg-gradient-to-br from-surface to-surface/50 border border-border p-4 rounded-xl cursor-pointer hover:border-acc-note/30 transition-all group flex flex-col">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="p-2 bg-acc-note/10 rounded-lg text-acc-note">
                                          <StickyNote className="w-5 h-5" />
                                      </div>
                                      <span className="text-xs text-muted group-hover:text-white font-medium">{allNotes.length} Notes</span>
                                  </div>
                                  <h3 className="font-semibold text-white mb-2">Brain Bank</h3>
                                  
                                  <div className="flex-1 space-y-1 mb-2">
                                      {randomNotes.length > 0 ? randomNotes.map(note => (
                                          <div key={note.id} className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                                              <div className="w-1 h-1 bg-acc-note rounded-full shrink-0"></div>
                                              {note.content}
                                          </div>
                                      )) : <span className="text-[10px] text-muted italic">Empty mind...</span>}
                                  </div>

                                  <p className="text-[10px] text-muted mt-auto pt-2 border-t border-border flex items-center gap-1">
                                     <Sparkles className="w-3 h-3 text-acc-note" /> Random Rediscovery
                                  </p>
                             </div>
                        </div>
                   </div>
               );
            })()}

            {/* FOCUS TAB */}
            {activeTab === 'focus' && (() => {
              
              // Render Sub-tab Switcher
              const renderSubTab = () => (
                  <div className="flex bg-surface rounded-lg p-1 mb-6 border border-border">
                    <button 
                        onClick={() => setFocusSubTab('tasks')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${focusSubTab === 'tasks' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Tasks
                    </button>
                    <button 
                        onClick={() => setFocusSubTab('skills')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${focusSubTab === 'skills' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                    >
                        <GrowthIcon className="w-3.5 h-3.5" /> Skill Growth
                    </button>
                  </div>
              );

              // Sub-tab: TASKS
              if (focusSubTab === 'tasks') {
                  const { today, tomorrow, later } = getFocusItems();
                  if (today.length === 0 && tomorrow.length === 0 && later.length === 0) 
                      return (
                        <>
                           {renderSubTab()}
                           <div className="text-center text-muted py-10">No tasks or events.</div>
                        </>
                      );
    
                  return (
                    <div className="space-y-8">
                      {renderSubTab()}
                      {today.length > 0 && (
                        <section>
                          <h3 className="text-sm font-bold text-acc-todo uppercase tracking-wider mb-3 pl-1">Today</h3>
                          <div className="space-y-3">{today.map(item => <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} />)}</div>
                        </section>
                      )}
                      {tomorrow.length > 0 && (
                        <section>
                          <h3 className="text-sm font-bold text-acc-event uppercase tracking-wider mb-3 pl-1">Tomorrow</h3>
                          <div className="space-y-3">{tomorrow.map(item => <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} />)}</div>
                        </section>
                      )}
                      {later.length > 0 && (
                        <section>
                          <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 pl-1">Later</h3>
                          <div className="space-y-3">{later.map(item => <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} />)}</div>
                        </section>
                      )}
                    </div>
                  );
              }

              // Sub-tab: SKILL GROWTH
              if (focusSubTab === 'skills') {
                  const { stats, logs } = getSkillItems();
                  
                  return (
                      <div>
                          {renderSubTab()}
                          
                          {/* Skill Dashboard Cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-6">
                              {stats.map(skill => (
                                  <div key={skill.id} className="bg-surface border border-border p-4 rounded-xl relative group hover:border-indigo-500/50 transition-colors">
                                      <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                          <button 
                                            onClick={() => handleOpenEditSkill(skill.id, skill.name, skill.weeklyTargetMinutes)}
                                            className="p-1.5 hover:bg-white/10 rounded-md text-muted hover:text-white transition-colors"
                                            title="Edit Skill"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            onClick={() => { setDeleteId(skill.id); setDeleteType('skill'); }}
                                            className="p-1.5 hover:bg-red-900/30 rounded-md text-muted hover:text-red-400 transition-colors"
                                            title="Delete"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                      </div>
                                      <h4 className="text-sm font-medium text-muted mb-1 truncate pr-16">{skill.name}</h4>
                                      <div className="flex items-end justify-between mb-2">
                                         <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                                             {skill.weeklyHours} <span className="text-xs font-normal text-muted">hrs this week</span>
                                         </div>
                                         <div className="text-xs text-muted font-mono">
                                             Total: {skill.totalHours}h
                                         </div>
                                      </div>
                                      
                                      {/* Progress Bar */}
                                      <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden flex relative">
                                          {skill.weeklyTargetMinutes ? (
                                              <>
                                                 <div 
                                                    className={`h-full ${skill.weeklyProgress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'} transition-all duration-500`} 
                                                    style={{ width: `${Math.min(100, skill.weeklyProgress)}%` }}
                                                 ></div>
                                              </>
                                          ) : (
                                             <div className="h-full bg-indigo-500/30 w-full"></div>
                                          )}
                                      </div>
                                      {skill.weeklyTargetMinutes && (
                                          <div className="text-[10px] text-right mt-1 text-muted">
                                              Target: {(skill.weeklyTargetMinutes / 60).toFixed(1)}h / week
                                          </div>
                                      )}
                                  </div>
                              ))}
                              
                              {/* Add Skill Button */}
                              <button onClick={handleOpenAddSkill} className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center p-4 hover:border-indigo-500/50 hover:bg-surface/50 transition-all text-muted hover:text-white min-h-[106px]">
                                  <Plus className="w-6 h-6 mb-1" />
                                  <span className="text-xs font-medium">Add Skill</span>
                              </button>
                          </div>

                          {/* Log List */}
                          <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 pl-1 flex items-center gap-2">
                             <History className="w-4 h-4" /> Recent Logs (Proof of Output)
                          </h3>
                          {logs.length === 0 ? (
                              <div className="text-center text-muted py-10 bg-surface/30 rounded-xl border border-dashed border-border">
                                  <p>No study sessions logged yet.</p>
                                  <p className="text-xs mt-2 opacity-70">Try typing: "Belajar Python 45 menit tentang loops"</p>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  {logs.map(log => {
                                      const skill = skills.find(s => s.id === log.meta.skillId);
                                      return (
                                          <Card 
                                            key={log.id} 
                                            item={log} 
                                            skillName={skill?.name || log.meta.skillName || 'Unknown'} 
                                            onEdit={setEditingItem} 
                                            onDelete={handleDelete}
                                          />
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  );
              }
            })()}

            {/* SHOPPING TAB */}
            {activeTab === 'shopping' && (() => {
              const { urgent, routine, normal } = getShoppingItems();
              if (urgent.length === 0 && routine.length === 0 && normal.length === 0) return <div className="text-center text-muted py-10">No life admin tasks.</div>;

              const renderGroup = (title: string, list: BrainDumpItem[], colorClass: string) => {
                  if (list.length === 0) return null;
                  return (
                      <div className="mb-6">
                           <h3 className={`text-sm font-bold ${colorClass} uppercase tracking-wider mb-2 pl-1`}>{title}</h3>
                           <div className="space-y-2">
                               {list.map(item => (
                                <ShoppingItem 
                                  key={item.id} 
                                  item={item} 
                                  onToggleStatus={handleToggleStatus} 
                                  onDelete={handleDelete} 
                                  onEdit={setEditingItem} 
                                />
                               ))}
                           </div>
                      </div>
                  );
              };

              return (
                <div>
                   {renderGroup("Urgent", urgent, "text-red-500")}
                   {renderGroup("Routine & Maintenance", routine, "text-acc-event")}
                   {renderGroup("To Do / To Buy", normal, "text-acc-shopping")}
                </div>
              );
            })()}

            {/* NOTES TAB */}
            {activeTab === 'notes' && (() => {
              const itemsToShow = getNoteItems();
              
              return (
                  <>
                      {/* Notes Sub-Tab Switcher */}
                      <div className="flex bg-surface rounded-lg p-1 mb-6 border border-border">
                        <button 
                            onClick={() => setNotesSubTab('general')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${notesSubTab === 'general' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                        >
                            <NotebookPen className="w-3.5 h-3.5" /> General
                        </button>
                        <button 
                            onClick={() => setNotesSubTab('journal')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${notesSubTab === 'journal' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                        >
                            <BookText className="w-3.5 h-3.5" /> Journal
                        </button>
                        <button 
                            onClick={() => setNotesSubTab('skills')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${notesSubTab === 'skills' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                        >
                            <Library className="w-3.5 h-3.5" /> Skill Logs
                        </button>
                      </div>

                      {/* Content Render */}
                      {itemsToShow.length === 0 ? (
                        <div className="text-center text-muted py-10">
                            {searchQuery 
                                ? "No matching notes." 
                                : (notesSubTab === 'general' 
                                    ? "No notes found." 
                                    : (notesSubTab === 'journal' ? "Write your first entry: \"Journal: Today was...\"" : "No skill logs found."))}
                        </div>
                      ) : (
                          // Different Layout for Journal vs Others
                          notesSubTab === 'journal' ? (
                            <div className="space-y-8">
                                {Object.entries(getJournalGroups(itemsToShow)).map(([dateKey, entries]) => {
                                    const date = new Date(dateKey);
                                    const friendlyDate = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                                    
                                    return (
                                        <div key={dateKey} className="relative pl-6 border-l border-border/50">
                                            {/* Date Header */}
                                            <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-fuchsia-400/50 border border-fuchsia-400"></div>
                                            <h3 className="text-sm font-serif font-bold text-fuchsia-200 mb-4">{friendlyDate}</h3>
                                            
                                            <div className="space-y-4">
                                                {entries.map(item => (
                                                    <Card key={item.id} item={item} onEdit={setEditingItem} onDelete={handleDelete} noStrikethrough={true} />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                          ) : (
                            <div className="columns-1 sm:columns-2 gap-4 space-y-4">
                            {itemsToShow.map(item => {
                                // Resolve skill name for display if it's a log
                                const skillName = item.type === ItemType.SKILL_LOG 
                                    ? (skills.find(s => s.id === item.meta.skillId)?.name || item.meta.skillName)
                                    : undefined;

                                return <Card key={item.id} item={item} onEdit={setEditingItem} onDelete={handleDelete} skillName={skillName} />;
                            })}
                            </div>
                          )
                      )}
                  </>
              );
            })()}

            {/* MONEY (FINANCE) TAB */}
            {activeTab === 'money' && (() => {
               const { 
                   list, 
                   totalIncome, 
                   totalExpense, 
                   projectedExpense, 
                   budgetMap, 
                   plannedBudgetMap,
                   uncategorized, 
                   projectedUncategorized 
               } = getFinanceItems();
               
               const { walletStats, totalNetWorth, totalAssets, totalDebt } = getWalletStats();

               const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
               
               // Use manual income from config if available and non-zero, otherwise use recorded income
               const effectiveIncome = budgetConfig.monthlyIncome > 0 ? budgetConfig.monthlyIncome : totalIncome;
               const incomeLabel = budgetConfig.monthlyIncome > 0 ? 'Fixed Income' : 'Recorded Income';

               const pct = (n: number, total: number) => total === 0 ? 0 : Math.min(100, Math.round((n / total) * 100));

               return (
                   <div>
                       {/* Total Net Worth Header */}
                       <div className="bg-surface border border-border rounded-xl p-4 mb-4 shadow-lg">
                           <div className="flex justify-between items-start">
                                <div className="text-sm text-muted mb-1">Total Net Worth</div>
                                <button onClick={() => setShowBalance(!showBalance)} className="text-muted hover:text-white transition-colors">
                                    {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                           </div>
                           <div className={`text-2xl font-bold mb-4 text-white`}>{showBalance ? fmt(totalNetWorth) : '••••••••'}</div>
                           <div className="grid grid-cols-2 gap-4">
                               <div className="bg-black/20 rounded-lg p-2 px-3">
                                   <div className="flex items-center gap-1 text-xs text-muted mb-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> Income (Mo)</div>
                                   <div className="font-semibold text-emerald-400">{showBalance ? fmt(totalIncome) : '••••'}</div>
                               </div>
                               <div className="bg-black/20 rounded-lg p-2 px-3">
                                   <div className="flex items-center gap-1 text-xs text-muted mb-1"><TrendingDown className="w-3 h-3 text-red-500" /> Expense (Mo)</div>
                                   <div className="font-semibold text-red-400">{showBalance ? fmt(totalExpense) : '••••'}</div>
                               </div>
                           </div>
                           <div className="flex gap-4 mt-2 pt-2 border-t border-white/5">
                                 <div className="text-xs text-muted">
                                    Assets: <span className="text-emerald-400 font-medium">{showBalance ? fmt(totalAssets) : '••'}</span>
                                 </div>
                                 <div className="text-xs text-muted">
                                    Debt: <span className="text-red-400 font-medium">{showBalance ? fmt(totalDebt) : '••'}</span>
                                 </div>
                           </div>
                       </div>
                       
                       {/* Submenu Toggle */}
                       <div className="flex bg-surface rounded-lg p-1 mb-4 border border-border">
                            <button 
                                onClick={() => setMoneyView('wallets')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${moneyView === 'wallets' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                            >
                                <WalletIcon className="w-3.5 h-3.5" /> Wallets
                            </button>
                            <button 
                                onClick={() => setMoneyView('transactions')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${moneyView === 'transactions' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                            >
                                <List className="w-3.5 h-3.5" /> Trans.
                            </button>
                            <button 
                                onClick={() => setMoneyView('budget')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${moneyView === 'budget' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                            >
                                <PieChart className="w-3.5 h-3.5" /> Budget
                            </button>
                       </div>

                       {/* VIEW: Wallets */}
                       {moneyView === 'wallets' && (
                           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                               {walletStats.map(wallet => (
                                   <div key={wallet.id} className="bg-surface border border-border p-4 rounded-xl relative group hover:border-white/20 transition-colors">
                                        <div className="absolute top-3 right-3 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleOpenEditWallet(wallet)}
                                                className="p-1.5 hover:bg-white/10 rounded-md text-muted hover:text-white transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => { setDeleteId(wallet.id); setDeleteType('wallet'); }}
                                                className="p-1.5 hover:bg-red-900/30 rounded-md text-muted hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-10 h-10 rounded-full ${wallet.color} flex items-center justify-center text-white`}>
                                                {wallet.type === 'bank' ? <PiggyBank className="w-5 h-5" /> : 
                                                 wallet.type === 'cc' ? <CreditCard className="w-5 h-5" /> : 
                                                 wallet.type === 'ewallet' ? <WalletIcon className="w-5 h-5" /> :
                                                 <WalletIcon className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white">{wallet.name}</div>
                                                <div className="text-[10px] text-muted uppercase tracking-wider">{wallet.type}</div>
                                            </div>
                                        </div>
                                        <div className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                            {showBalance ? fmt(wallet.currentBalance) : '••••••••'}
                                            {wallet.type === 'cc' && <span className="text-xs font-normal text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Debt</span>}
                                        </div>
                                   </div>
                               ))}

                               <button onClick={handleOpenAddWallet} className="w-full border border-dashed border-border rounded-xl flex items-center justify-center p-4 hover:border-white/30 hover:bg-surface/50 transition-all text-muted hover:text-white gap-2">
                                  <Plus className="w-5 h-5" />
                                  <span className="text-sm font-medium">Add Wallet</span>
                               </button>
                           </div>
                       )}

                       {/* VIEW: Transactions */}
                       {moneyView === 'transactions' && (
                           <>
                               <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 mb-4">
                                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded-full text-muted hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
                                    <span className="font-semibold text-white">
                                        {financeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded-full text-muted hover:text-white"><ChevronRight className="w-5 h-5" /></button>
                               </div>

                               {/* Projected/Planned Card */}
                               {projectedExpense > 0 && (
                                   <div className="bg-surface/50 border border-dashed border-border rounded-xl p-3 mb-6 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-muted">
                                            <Calculator className="w-4 h-4" />
                                            <span className="text-xs font-medium">Planned Spending (Pending)</span>
                                        </div>
                                        <span className="text-sm font-bold text-amber-400">{showBalance ? fmt(projectedExpense) : '••••'}</span>
                                   </div>
                               )}

                               {list.length === 0 ? <div className="text-center text-muted py-10">No transactions recorded.</div> : (
                                   <div className="space-y-3">
                                       {list.map(item => <Card key={item.id} item={item} onEdit={setEditingItem} onDelete={handleDelete} noStrikethrough={true} />)}
                                   </div>
                               )}
                           </>
                       )}

                       {/* VIEW: Budget Dashboard */}
                       {moneyView === 'budget' && (
                           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                               <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 mb-4">
                                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded-full text-muted hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
                                    <span className="font-semibold text-white">
                                        {financeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded-full text-muted hover:text-white"><ChevronRight className="w-5 h-5" /></button>
                               </div>

                               {effectiveIncome === 0 ? (
                                   <div className="text-center p-6 bg-surface border border-border rounded-xl">
                                       <PiggyBank className="w-8 h-8 text-muted mx-auto mb-2" />
                                       <p className="text-sm text-muted">Set a <strong>Monthly Income</strong> in Settings <br/>or record Income to see your budget breakdown.</p>
                                       <button onClick={() => setIsSettingsOpen(true)} className="mt-4 px-4 py-2 bg-primary text-background rounded-lg text-sm font-semibold">
                                           Set Income
                                       </button>
                                   </div>
                               ) : (
                                   <>
                                        <div className="flex justify-between items-center mb-2 px-1">
                                            <span className="text-xs font-medium text-muted">Basis: {incomeLabel}</span>
                                            <span className="text-sm font-bold text-white">{showBalance ? fmt(effectiveIncome) : '••••'}</span>
                                        </div>

                                        {/* Dynamic Budget Categories */}
                                        {budgetConfig.rules.map(rule => {
                                            const spent = budgetMap.get(rule.id) || 0;
                                            const planned = plannedBudgetMap.get(rule.id) || 0;
                                            const limit = effectiveIncome * (rule.percentage / 100);
                                            
                                            // Ensure rule.color is safe, fallback if class is weird
                                            const barColor = rule.color || 'bg-gray-500';

                                            return (
                                                <div key={rule.id}>
                                                    <div className="flex justify-between items-end mb-1">
                                                        <div className="flex flex-col">
                                                            <span className={`text-sm font-semibold text-white`}>{rule.name} <span className="text-xs font-normal text-muted opacity-70">({rule.percentage}%)</span></span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-white font-medium">
                                                                {showBalance ? fmt(spent) : '•••'} <span className="text-muted/60">/ {showBalance ? fmt(limit) : '•••'}</span>
                                                            </div>
                                                            {planned > 0 && (
                                                                <div className="text-[10px] text-amber-400">
                                                                    +{showBalance ? fmt(planned) : '•••'} planned
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Stacked Bar Chart */}
                                                    <div className="h-3 w-full bg-surface rounded-full overflow-hidden border border-white/5 relative flex">
                                                        {/* Actual Spending */}
                                                        <div 
                                                            className={`h-full ${barColor}`} 
                                                            style={{ width: `${Math.min(100, (spent / effectiveIncome) * 100)}%` }}
                                                        ></div>
                                                        
                                                        {/* Planned Spending (Stacked) */}
                                                        <div 
                                                            className={`h-full ${barColor} opacity-40 bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)]`} 
                                                            style={{ width: `${Math.min(100 - ((spent / effectiveIncome) * 100), (planned / effectiveIncome) * 100)}%` }}
                                                        ></div>
                                                        
                                                        {/* Limit Marker */}
                                                        <div 
                                                            className="h-full w-0.5 bg-white/50 absolute top-0 z-10"
                                                            style={{ left: `${rule.percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Uncategorized */}
                                        {(uncategorized > 0 || projectedUncategorized > 0) && (
                                            <div className="pt-4 border-t border-border mt-4">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs text-muted">Uncategorized / Others</span>
                                                    <div className="text-right">
                                                        <span className="text-xs text-white">{showBalance ? fmt(uncategorized) : '•••'}</span>
                                                        {projectedUncategorized > 0 && (
                                                            <span className="text-[10px] text-amber-400 ml-1">+{showBalance ? fmt(projectedUncategorized) : '•••'}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden flex">
                                                     <div className="h-full bg-gray-500 opacity-50 flex-1"></div>
                                                </div>
                                            </div>
                                        )}
                                   </>
                               )}
                           </div>
                       )}
                   </div>
               );
            })()}

          </div>
        )}
      </main>

      {/* Fixed Bottom Layout: Filters -> Tabs -> Input */}
      <div className="fixed bottom-0 w-full z-50">
          {renderFilters()}
          {renderTabs()}
          <div className="bg-background border-t border-border">
             <InputBar onSend={handleSend} />
          </div>
      </div>

      {/* Modals */}
      {/* Theme Edit Modal (Inline/Simple) */}
      {themeEditMode && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl p-6">
                 <h3 className="text-lg font-bold text-white mb-4">Set Theme</h3>
                 <textarea
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 mb-4 h-24 resize-none"
                    placeholder="e.g. Month of Discipline, Focus on Skill X..."
                    value={tempThemeContent}
                    onChange={(e) => setTempThemeContent(e.target.value)}
                 />
                 <div className="flex justify-end gap-2">
                     <button onClick={() => setThemeEditMode(false)} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white">Cancel</button>
                     <button onClick={handleSaveTheme} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 transition-colors">Save Theme</button>
                 </div>
             </div>
          </div>
      )}

      {/* Modals */}
      {editingItem && (
        <EditModal 
          item={editingItem} 
          isOpen={!!editingItem} 
          onClose={() => setEditingItem(null)} 
          onSave={handleUpdateItem}
          existingPaymentMethods={uniquePaymentMethods}
          budgetRules={budgetConfig.rules}
          skills={skills}
          wallets={wallets}
        />
      )}

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={handleSettingsSaved}
        currentBudgetConfig={budgetConfig}
        currentPrompt={customPrompt}
      />

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