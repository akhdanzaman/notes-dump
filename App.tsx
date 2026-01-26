import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Brain, RefreshCw, AlertTriangle, WifiOff, Target, ShoppingCart, StickyNote, History, Search, Settings, CloudCheck, CloudOff, Save, Wallet, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, CheckCircle2, PiggyBank, Calculator, PieChart, BarChart3, List } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { BrainDumpItem, ItemType, BudgetConfig, BudgetRule } from './types';
import { fetchDb, syncData, isUsingLocalStorage, SyncResult } from './services/githubService';
import { classifyText, DEFAULT_PROMPT } from './services/geminiService';

import Card from './components/Card';
import ShoppingItem from './components/ShoppingItem';
import InputBar from './components/InputBar';
import EditModal from './components/EditModal';
import SettingsModal from './components/SettingsModal';

type Tab = 'focus' | 'shopping' | 'notes' | 'money' | 'history';
type SyncStatus = 'synced' | 'syncing' | 'error' | 'local';
type MoneyView = 'transactions' | 'budget';

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
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_PROMPT);

  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0); 
  const [error, setError] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('focus');
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
      return currentItems.map(item => {
          if (item.type === ItemType.SHOPPING && 
              item.meta.shoppingCategory === 'routine' && 
              item.status === 'done' && 
              item.completed_at) {
              
              const completedTime = new Date(item.completed_at).getTime();
              const recurrenceDays = item.meta.recurrenceDays || 7;
              const nextDueTime = completedTime + (recurrenceDays * 24 * 60 * 60 * 1000);
              
              if (now.getTime() >= nextDueTime) {
                  return {
                      ...item,
                      status: 'pending' as const,
                      completed_at: undefined,
                  };
              }
          }
          return item;
      });
  };

  const saveAndSync = async (newItems: BrainDumpItem[], newConfig?: BudgetConfig, newPrompt?: string) => {
      setSyncStatus('syncing');
      try {
          // Use syncData to save everything
          const configToSave = newConfig || budgetConfig;
          const promptToSave = newPrompt !== undefined ? newPrompt : customPrompt;
          
          const result: SyncResult = await syncData(newItems, configToSave, promptToSave);
          
          if (result.method === 'error') {
              setSyncStatus('error');
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
            // This prevents data loss or crashes if loading an older DB version
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
               await saveAndSync(checkedData, data.budgetConfig, data.customPrompt);
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
          saveAndSync(items, newBudgetConfig, newPrompt);
      } else {
          loadData();
      }
  };

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(i => i.meta?.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [items]);

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
        
        // Pass the current custom prompt to the classifier
        const classifiedItems = await classifyText(text, Array.from(currentTags), 0, customPrompt);
  
        const newItems: BrainDumpItem[] = classifiedItems.map(partial => {
            const isFinance = partial.type === ItemType.FINANCE;
            // Finance items are historical records, so we mark them as done immediately
            return {
                id: uuidv4(),
                status: isFinance ? 'done' : 'pending',
                created_at: new Date().toISOString(),
                completed_at: isFinance ? new Date().toISOString() : undefined,
                type: ItemType.NOTE,
                content: text,
                meta: { tags: [] },
                ...partial, 
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

  const handleUpdateItem = async (id: string, newContent: string, newTags: string[], newAmount?: number, newDate?: string, newPaymentMethod?: string, newBudgetCategory?: string) => {
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
                        budgetCategory: newBudgetCategory
                    } 
                  } 
                : item
          );
          saveAndSync(updatedItems);
          return updatedItems;
      });
  };

  // --- Filtering Logic ---

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
    let notes = items.filter(i => i.type === ItemType.NOTE && i.status !== 'done');
    if (selectedTag) {
        notes = notes.filter(i => i.meta?.tags?.includes(selectedTag));
    }
    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        notes = notes.filter(i => i.content.toLowerCase().includes(lowerQ) || i.meta.tags?.some(t => t.toLowerCase().includes(lowerQ)));
    }
    return notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const getFinanceItems = () => {
      // 1. Explicit Finance Items
      let finance = items.filter(i => i.type === ItemType.FINANCE);
      
      // 2. Implicit Expenses: Tasks (Shopping/Todo) that are DONE and have an AMOUNT
      const implicitExpenses = items.filter(i => 
          (i.type === ItemType.SHOPPING || i.type === ItemType.TODO) && 
          i.status === 'done' && 
          (i.meta.amount || 0) > 0
      );

      // Combine them
      let allTransactions = [...finance, ...implicitExpenses];
      
      // Filter by Month
      allTransactions = allTransactions.filter(i => {
          // For explicit finance, use created_at (or completed_at which is set for FINANCE). For tasks, use completed_at.
          const dateStr = i.completed_at || i.created_at;
          if (!dateStr) return false;
          
          const d = new Date(dateStr);
          return d.getMonth() === financeDate.getMonth() && d.getFullYear() === financeDate.getFullYear();
      });

      // Filter logic if needed
      if (selectedTag) allTransactions = allTransactions.filter(i => i.meta?.tags?.includes(selectedTag));
      if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        allTransactions = allTransactions.filter(i => i.content.toLowerCase().includes(lowerQ));
      }

      // Sort recent first
      allTransactions.sort((a, b) => {
          const dateA = new Date(a.completed_at || a.created_at).getTime();
          const dateB = new Date(b.completed_at || b.created_at).getTime();
          return dateB - dateA;
      });

      // Totals
      const totalIncome = allTransactions.reduce((acc, curr) => {
          if (curr.meta?.financeType === 'income' || curr.meta?.financeType === 'reimbursement') {
              return acc + (curr.meta.amount || 0);
          }
          return acc;
      }, 0);

      const totalExpense = allTransactions.reduce((acc, curr) => {
        // Count as expense if:
        // 1. It is Explicit Finance type 'expense' or 'lending'
        // 2. OR It is an Implicit Task (Shopping/Todo) - these are always expenses by default logic
        if (curr.type !== ItemType.FINANCE || curr.meta?.financeType === 'expense' || curr.meta?.financeType === 'lending') {
            return acc + (curr.meta.amount || 0);
        }
        return acc;
      }, 0);

      // Custom Budget Calculations
      const budgetMap = new Map<string, number>();
      let uncategorized = 0;
      
      // Initialize map from config rules
      budgetConfig.rules.forEach(rule => budgetMap.set(rule.id, 0));

      allTransactions.forEach(item => {
           // Skip income
           if (item.meta?.financeType === 'income' || item.meta?.financeType === 'reimbursement') return;
           
           const amt = item.meta?.amount || 0;
           const cat = item.meta?.budgetCategory;

           if (cat) {
               // Try to match by ID first, then Case-Insensitive Name
               if (budgetMap.has(cat)) {
                   budgetMap.set(cat, (budgetMap.get(cat) || 0) + amt);
               } else {
                   // Try find by name
                   const foundRule = budgetConfig.rules.find(r => r.name.toLowerCase() === cat.toLowerCase());
                   if (foundRule) {
                       budgetMap.set(foundRule.id, (budgetMap.get(foundRule.id) || 0) + amt);
                   } else {
                       uncategorized += amt;
                   }
               }
           } else {
               uncategorized += amt;
           }
      });

      // --- Projected / Planned Expenses (Pending items with cost) ---
      const pendingWithCost = items.filter(i => 
        (i.type === ItemType.SHOPPING || i.type === ItemType.TODO) &&
        i.status === 'pending' &&
        (i.meta.amount || 0) > 0 &&
        // EXCLUDE 'not_urgent' shopping items (To Buy list) from Planned Spending
        !(i.type === ItemType.SHOPPING && (!i.meta.shoppingCategory || i.meta.shoppingCategory === 'not_urgent'))
      );
      
      const projectedExpense = pendingWithCost.reduce((acc, curr) => acc + (curr.meta.amount || 0), 0);

      return { list: allTransactions, totalIncome, totalExpense, balance: totalIncome - totalExpense, projectedExpense, pendingWithCost, budgetMap, uncategorized };
  };

  const getFocusItems = () => {
    const relevant = items.filter(i => {
        const isFocusType = i.type === ItemType.TODO || i.type === ItemType.EVENT;
        if (!isFocusType) return false;
        if (i.status === 'pending') return true;
        if (i.status === 'done' && i.completed_at) {
            const completedTime = new Date(i.completed_at).getTime();
            const now = new Date().getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            return (now - completedTime) < oneDayMs;
        }
        return false;
    });
    
    const normalize = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = normalize(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const groups = {
      today: [] as BrainDumpItem[],
      tomorrow: [] as BrainDumpItem[],
      later: [] as BrainDumpItem[]
    };

    relevant.forEach(item => {
      let targetDate = new Date(); 
      if (item.meta?.date && item.meta.date !== 'null') {
         targetDate = new Date(item.meta.date);
      } else if (item.completed_at) {
         targetDate = new Date(item.completed_at);
      }

      if (isNaN(targetDate.getTime())) {
          groups.later.push(item);
          return;
      }
      const normalizedTarget = normalize(targetDate);
      if (normalizedTarget.getTime() === today.getTime()) groups.today.push(item);
      else if (normalizedTarget.getTime() === tomorrow.getTime()) groups.tomorrow.push(item);
      else {
        if (normalizedTarget < today && item.status === 'pending') groups.today.push(item);
        else groups.later.push(item);
      }
    });

    const dateSort = (a: BrainDumpItem, b: BrainDumpItem) => {
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
        const da = a.meta?.date ? new Date(a.meta.date).getTime() : 0;
        const db = b.meta?.date ? new Date(b.meta.date).getTime() : 0;
        return da - db;
    };
    
    groups.today.sort(dateSort);
    groups.tomorrow.sort(dateSort);
    groups.later.sort(dateSort);

    return groups;
  };

  const getHistoryItems = () => {
      // Include "Done" items AND "Finance" items (records)
      return items.filter(i => i.status === 'done' || i.type === ItemType.FINANCE).sort((a, b) => {
          const ta = a.completed_at ? new Date(a.completed_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
          const tb = b.completed_at ? new Date(b.completed_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
          return tb - ta;
      });
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
           <div className={`p-2 rounded-full ${activeTab === 'money' ? 'bg-primary/10' : ''}`}><Wallet className="w-5 h-5" /></div>
          Money
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${activeTab === 'history' ? 'text-primary' : 'text-muted hover:text-white'}`}>
           <div className={`p-2 rounded-full ${activeTab === 'history' ? 'bg-primary/10' : ''}`}><History className="w-5 h-5" /></div>
          History
        </button>
      </div>
    </div>
  );

  const renderFilters = () => {
    // Show filters only for tabs that need them
    if (activeTab !== 'notes' && activeTab !== 'money') return null;

    return (
        <div className="px-4 py-2 bg-background border-t border-border">
            <div className="flex items-center gap-2 max-w-2xl mx-auto">
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
                 {/* Tags */}
                 {uniqueTags.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[50%]">
                        <button 
                            onClick={() => setSelectedTag(null)}
                            className={`px-2 py-1 rounded-full text-[10px] font-medium border whitespace-nowrap ${!selectedTag ? 'bg-primary text-background border-primary' : 'border-border text-muted'}`}
                        >
                            All
                        </button>
                        {uniqueTags.map(tag => (
                            <button 
                                key={tag}
                                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                className={`px-2 py-1 rounded-full text-[10px] font-medium border whitespace-nowrap ${tag === selectedTag ? 'bg-acc-note text-white border-acc-note' : 'border-border text-muted'}`}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}
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
            
            {/* FOCUS TAB */}
            {activeTab === 'focus' && (() => {
              const { today, tomorrow, later } = getFocusItems();
              if (today.length === 0 && tomorrow.length === 0 && later.length === 0) return <div className="text-center text-muted py-10">No tasks or events.</div>;

              return (
                <div className="space-y-8">
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
              const notes = getNoteItems();
              return notes.length === 0 ? <div className="text-center text-muted py-10">{searchQuery ? "No matching notes." : "No notes found."}</div> : (
                  <div className="columns-1 sm:columns-2 gap-4 space-y-4">
                  {notes.map(item => <Card key={item.id} item={item} onEdit={setEditingItem} onDelete={handleDelete} />)}
                  </div>
              );
            })()}

            {/* MONEY (FINANCE) TAB */}
            {activeTab === 'money' && (() => {
               const { list, totalIncome, totalExpense, balance, projectedExpense, budgetMap, uncategorized } = getFinanceItems();
               const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
               
               // Use manual income from config if available and non-zero, otherwise use recorded income
               const effectiveIncome = budgetConfig.monthlyIncome > 0 ? budgetConfig.monthlyIncome : totalIncome;
               const incomeLabel = budgetConfig.monthlyIncome > 0 ? 'Fixed Income' : 'Recorded Income';

               const pct = (n: number, total: number) => total === 0 ? 0 : Math.min(100, Math.round((n / total) * 100));

               return (
                   <div>
                       {/* Month Selector */}
                       <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 mb-4">
                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded-full text-muted hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
                            <span className="font-semibold text-white">
                                {financeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded-full text-muted hover:text-white"><ChevronRight className="w-5 h-5" /></button>
                       </div>

                       {/* Balance Header */}
                       <div className="bg-surface border border-border rounded-xl p-4 mb-4 shadow-lg">
                           <div className="text-sm text-muted mb-1">Monthly Flow</div>
                           <div className={`text-2xl font-bold mb-4 ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>{fmt(balance)}</div>
                           <div className="grid grid-cols-2 gap-4">
                               <div className="bg-black/20 rounded-lg p-2 px-3">
                                   <div className="flex items-center gap-1 text-xs text-muted mb-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> Income</div>
                                   <div className="font-semibold text-emerald-400">{fmt(totalIncome)}</div>
                               </div>
                               <div className="bg-black/20 rounded-lg p-2 px-3">
                                   <div className="flex items-center gap-1 text-xs text-muted mb-1"><TrendingDown className="w-3 h-3 text-red-500" /> Expense</div>
                                   <div className="font-semibold text-red-400">{fmt(totalExpense)}</div>
                               </div>
                           </div>
                       </div>
                       
                       {/* Submenu Toggle */}
                       <div className="flex bg-surface rounded-lg p-1 mb-4 border border-border">
                            <button 
                                onClick={() => setMoneyView('transactions')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${moneyView === 'transactions' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                            >
                                <List className="w-3.5 h-3.5" /> Transactions
                            </button>
                            <button 
                                onClick={() => setMoneyView('budget')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${moneyView === 'budget' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
                            >
                                <PieChart className="w-3.5 h-3.5" /> Budget
                            </button>
                       </div>

                       {/* VIEW: Transactions */}
                       {moneyView === 'transactions' && (
                           <>
                               {/* Projected/Planned Card */}
                               {projectedExpense > 0 && (
                                   <div className="bg-surface/50 border border-dashed border-border rounded-xl p-3 mb-6 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-muted">
                                            <Calculator className="w-4 h-4" />
                                            <span className="text-xs font-medium">Planned Spending (Pending)</span>
                                        </div>
                                        <span className="text-sm font-bold text-amber-400">{fmt(projectedExpense)}</span>
                                   </div>
                               )}

                               {list.length === 0 ? <div className="text-center text-muted py-10">No transactions recorded.</div> : (
                                   <div className="space-y-3">
                                       {list.map(item => <Card key={item.id} item={item} onEdit={setEditingItem} onDelete={handleDelete} />)}
                                   </div>
                               )}
                           </>
                       )}

                       {/* VIEW: Budget Dashboard */}
                       {moneyView === 'budget' && (
                           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                                            <span className="text-sm font-bold text-white">{fmt(effectiveIncome)}</span>
                                        </div>

                                        {/* Dynamic Budget Categories */}
                                        {budgetConfig.rules.map(rule => {
                                            const spent = budgetMap.get(rule.id) || 0;
                                            const limit = effectiveIncome * (rule.percentage / 100);
                                            const percentageUsed = pct(spent, limit);
                                            // Ensure rule.color is safe, fallback if class is weird
                                            const barColor = rule.color || 'bg-gray-500';

                                            return (
                                                <div key={rule.id}>
                                                    <div className="flex justify-between items-end mb-1">
                                                        <span className={`text-sm font-semibold text-white`}>{rule.name} <span className="text-xs font-normal text-muted opacity-70">({rule.percentage}%)</span></span>
                                                        <span className="text-xs text-muted">{fmt(spent)} / {fmt(limit)}</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-surface rounded-full overflow-hidden border border-white/5 relative">
                                                        <div 
                                                            className={`h-full transition-all duration-700 ${barColor}`} 
                                                            style={{ width: `${Math.min(100, (spent / effectiveIncome) * 100)}%` }}
                                                        ></div>
                                                        {/* Marker for the limit */}
                                                        <div 
                                                            className="h-full w-0.5 bg-white/50 absolute top-0"
                                                            style={{ left: `${rule.percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Uncategorized */}
                                        {uncategorized > 0 && (
                                            <div className="pt-4 border-t border-border mt-4">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs text-muted">Uncategorized / Others</span>
                                                    <span className="text-xs text-white">{fmt(uncategorized)}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                                                     <div className="h-full bg-gray-500 w-full opacity-50"></div>
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

            {/* HISTORY TAB */}
            {activeTab === 'history' && (() => {
                const history = getHistoryItems();
                if (history.length === 0) return <div className="text-center text-muted py-10">Nothing completed yet.</div>;
                
                let lastLabel = '';
                
                return (
                    <div className="space-y-1 pb-10">
                        {history.map(item => {
                             const dateStr = item.completed_at || item.created_at;
                             let label = "Unknown";
                             let timeStr = "";

                             if (dateStr) {
                                 const date = new Date(dateStr);
                                 if (!isNaN(date.getTime())) {
                                     const now = new Date();
                                     const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                     const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                     const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
                                     if (diffDays === 0) label = 'Today';
                                     else if (diffDays === 1) label = 'Yesterday';
                                     else label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' });
                                     
                                     timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute:'2-digit', hour12: false });
                                 }
                             }
                             
                             const showHeader = label !== lastLabel;
                             lastLabel = label;
                             
                             // Compact List Item Logic
                             const isFinance = item.type === ItemType.FINANCE;
                             // Check explicitly for 'income' finance type
                             const isIncome = item.meta.financeType === 'income' || item.meta.financeType === 'reimbursement';
                             
                             const amount = item.meta.amount 
                                ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.meta.amount)
                                : null;

                             return (
                                 <React.Fragment key={item.id}>
                                     {showHeader && <h3 className="text-xs font-bold text-muted/70 uppercase tracking-wider mt-6 mb-2 pl-1">{label}</h3>}
                                     
                                     <div className="flex items-center text-sm py-2 border-b border-border/40 hover:bg-surface/50 rounded px-1 transition-colors">
                                         <span className="text-muted text-xs font-mono w-10 shrink-0">{timeStr}</span>
                                         <span className="mr-3">{item.type === ItemType.FINANCE ? (isIncome ? '💰' : '💸') : '✅'}</span>
                                         <div className="flex-1 min-w-0 mr-2">
                                             <div className="truncate text-gray-200">{item.content}</div>
                                             {item.meta.paymentMethod && <div className="text-[9px] text-muted uppercase tracking-tight">{item.meta.paymentMethod}</div>}
                                         </div>
                                         <div className="text-right shrink-0">
                                            {amount ? (
                                                <span className={`text-xs font-semibold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {isIncome ? '+' : '-'}{amount}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-muted">{item.type}</span>
                                            )}
                                         </div>
                                     </div>
                                 </React.Fragment>
                             );
                        })}
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
      {editingItem && <EditModal item={editingItem} isOpen={!!editingItem} onClose={() => setEditingItem(null)} onSave={handleUpdateItem} existingPaymentMethods={uniquePaymentMethods} budgetRules={budgetConfig.rules} />}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSave={handleSettingsSaved} currentBudgetConfig={budgetConfig} currentPrompt={customPrompt} />
    </div>
  );
};

export default App;