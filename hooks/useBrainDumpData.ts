
import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BrainDumpItem, ItemType, BudgetConfig, Skill, Wallet, FinanceType, AppSettings, SyncStatus, DbSchema } from '../types';
import { fetchDb, syncData, isUsingLocalStorage, SyncResult, mergeDbData } from '../services/githubService';
import { classifyText, DEFAULT_PROMPT } from '../services/geminiService';

export const useBrainDumpData = () => {
    const [items, setItems] = useState<BrainDumpItem[]>([]);
    const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>({
        monthlyIncome: 0,
        rules: [
            { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
            { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
            { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
        ]
    });
    const [skills, setSkills] = useState<Skill[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_PROMPT);
    const [monthlyThemes, setMonthlyThemes] = useState<Record<string, string>>({});
    const [appSettings, setAppSettings] = useState<AppSettings>({ defaultCollapsed: false, hideMoney: false });

    const [loading, setLoading] = useState(true);
    const [pendingCount, setPendingCount] = useState(0); 
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

    const itemsRef = useRef(items);
    itemsRef.current = items;

    // Helper: Routine Resets
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

    const saveAndSync = async (
        newItems: BrainDumpItem[], 
        newConfig?: BudgetConfig, 
        newPrompt?: string, 
        newSkills?: Skill[], 
        newWallets?: Wallet[], 
        newThemes?: Record<string, string>, 
        newAppSettings?: AppSettings
    ) => {
        setSyncStatus('syncing');
        try {
            // Use syncData to save everything
            const configToSave = newConfig || budgetConfig;
            const promptToSave = newPrompt !== undefined ? newPrompt : customPrompt;
            const skillsToSave = newSkills || skills;
            const walletsToSave = newWallets || wallets;
            const themesToSave = newThemes || monthlyThemes;
            const settingsToSave = newAppSettings || appSettings;
            
            const result: SyncResult = await syncData(newItems, configToSave, promptToSave, skillsToSave, walletsToSave, themesToSave, settingsToSave);
            
            if (result.mergedData) {
                // Conflict resolution: Merge result from cloud with current local state
                // This ensures if user kept typing while sync was happening, we don't overwrite their new keystrokes/items
                // but we DO add the items that came from the cloud.
                
                const remoteSchema = result.mergedData;
                
                setItems(currentItems => {
                   const merged = mergeDbData({ data: currentItems } as DbSchema, remoteSchema);
                   return merged.data;
                });
                
                setSkills(currentSkills => {
                    const merged = mergeDbData({ skills: currentSkills } as DbSchema, remoteSchema);
                    return merged.skills || [];
                });
                
                setWallets(currentWallets => {
                     const merged = mergeDbData({ wallets: currentWallets } as DbSchema, remoteSchema);
                     return merged.wallets || [];
                });

                if (remoteSchema.monthlyThemes) setMonthlyThemes(prev => ({ ...remoteSchema.monthlyThemes, ...prev }));
                
                // For singleton configs, we usually accept the merged (local priority) one or just keep current
                // if the merge logic in githubService preferred local.
            }
            
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
          // Don't show full loading screen on background re-fetch, only initial
          if (items.length === 0) setLoading(true);
          setError(null);
  
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
                 await saveAndSync(checkedData, data.budgetConfig, data.customPrompt, data.skills, data.wallets, data.monthlyThemes, data.appSettings);
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
                saveAndSync(data.data || [], data.budgetConfig, data.customPrompt, defaults, data.wallets, data.monthlyThemes, data.appSettings);
            }
  
            // Load Wallets
            if (data.wallets && data.wallets.length > 0) {
                setWallets(data.wallets);
            } else {
                // Create default Cash wallet if none exist
                const defaultWallet: Wallet = { id: 'w-1', name: 'Cash', type: 'cash', initialBalance: 0, color: 'bg-emerald-500' };
                setWallets([defaultWallet]);
                // Trigger save with default wallet
                saveAndSync(data.data || [], data.budgetConfig, data.customPrompt, data.skills, [defaultWallet], data.monthlyThemes, data.appSettings);
            }
  
            // Load Themes
            if (data.monthlyThemes) {
                setMonthlyThemes(data.monthlyThemes);
            }
  
            // Load App Settings
            if (data.appSettings) {
                setAppSettings(data.appSettings);
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

    // Auto-fetch on visibility change or window focus
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log("App became visible, fetching latest data...");
                loadData();
            }
        };

        const handleFocus = () => {
             console.log("Window focused, fetching latest data...");
             loadData();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [loadData]);


    const processItemInBackground = async (text: string, tempId: string) => {
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
    
        processItemInBackground(text, tempId);
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

    return {
        items,
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
        appSettings,
        setAppSettings,
        loading,
        error,
        pendingCount,
        syncStatus,
        loadData,
        saveAndSync,
        handleSend,
        handleToggleStatus,
        handleDelete,
        handleUpdateItem
    };
};
