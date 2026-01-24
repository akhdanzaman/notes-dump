import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Brain, RefreshCw, AlertTriangle, WifiOff, Target, ShoppingCart, StickyNote, History, Search, Settings, CloudCheck, CloudOff, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { BrainDumpItem, ItemType } from './types';
import { fetchDb, syncItemsToDb, isUsingLocalStorage, SyncResult } from './services/githubService';
import { classifyText } from './services/geminiService';

import Card from './components/Card';
import ShoppingItem from './components/ShoppingItem';
import InputBar from './components/InputBar';
import EditModal from './components/EditModal';
import SettingsModal from './components/SettingsModal';

type Tab = 'focus' | 'shopping' | 'notes' | 'history';
type SyncStatus = 'synced' | 'syncing' | 'error' | 'local';

const App: React.FC = () => {
  const [items, setItems] = useState<BrainDumpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0); // For background processing indicator
  const [error, setError] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('focus');
  
  // Sync Status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  
  // Settings UI
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Filters
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state
  const [editingItem, setEditingItem] = useState<BrainDumpItem | null>(null);

  // Refs for accessing latest state in async callbacks
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Routine Reset Logic: Checks if a done routine item should be reset to pending
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
                  // Reset it!
                  return {
                      ...item,
                      status: 'pending' as const,
                      completed_at: undefined, // Clear completed time so it shows as new
                  };
              }
          }
          return item;
      });
  };

  // Wrapper for syncing to update status
  const saveAndSync = async (newItems: BrainDumpItem[]) => {
      setSyncStatus('syncing');
      try {
          const result: SyncResult = await syncItemsToDb(newItems);
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
        if (data && Array.isArray(data.data)) {
          // Check for routine items that need resetting on load
          const checkedData = checkRoutineResets(data.data);
          setItems(checkedData);
          if (JSON.stringify(checkedData) !== JSON.stringify(data.data)) {
             await saveAndSync(checkedData);
          } else {
             // If no changes, just set status based on mode
             setSyncStatus(isUsingLocalStorage() ? 'local' : 'synced');
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

  // Initial Data Fetch
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle settings update
  const handleSettingsSaved = () => {
      setIsSettingsOpen(false);
      loadData();
  };

  // Compute all unique tags for AI context
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(i => i.meta?.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [items]);

  const handleSend = async (text: string) => {
    setPendingCount(prev => prev + 1);
    setError(null);
    const tempId = uuidv4();

    // 1. Optimistic Update
    const optimisticItem: BrainDumpItem = {
      id: tempId,
      type: ItemType.NOTE, // Default until AI classifies
      content: text,
      status: 'pending',
      created_at: new Date().toISOString(),
      meta: { tags: [] },
      isOptimistic: true,
    };

    setItems((prev) => {
        const updated = [optimisticItem, ...prev];
        // We sync optimistically too to save the raw input
        saveAndSync(updated);
        return updated;
    });

    // Fire and forget (background process)
    processItemInBackground(text, tempId, optimisticItem);
  };

  const processItemInBackground = async (text: string, tempId: string, optimisticItem: BrainDumpItem) => {
    try {
        // Use refs for current tags to avoid stale closure
        const currentTags = new Set<string>();
        itemsRef.current.forEach(i => i.meta?.tags?.forEach(t => currentTags.add(t)));
        
        const classification = await classifyText(text, Array.from(currentTags));
  
        const finalItem: BrainDumpItem = {
          ...optimisticItem,
          ...classification,
          isOptimistic: false,
        };
  
        setItems((prev) => {
             // Replace optimistic item with real one
             const updated = prev.map(i => i.id === tempId ? finalItem : i);
             saveAndSync(updated); 
             return updated;
        });

    } catch (err) {
        console.error("Processing failed", err);
        setItems(prev => {
            const updated = prev.filter(i => i.id !== tempId);
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
    // Confirm delete for safety
    if (!window.confirm("Are you sure you want to delete this?")) return;
    
    setItems(prev => {
        const updatedItems = prev.filter(i => i.id !== id);
        saveAndSync(updatedItems);
        return updatedItems;
    });
  };

  const handleUpdateItem = async (id: string, newContent: string, newTags: string[]) => {
      setItems(prev => {
          const updatedItems = prev.map(item => 
              item.id === id 
                ? { ...item, content: newContent, meta: { ...item.meta, tags: newTags } } 
                : item
          );
          saveAndSync(updatedItems);
          return updatedItems;
      });
  };

  // --- Filtering & Grouping Logic ---

  const getShoppingItems = () => {
    // Show pending items OR routine items (even if done) OR non-routine items done within 24h
    const visibleItems = items.filter(i => {
        if (i.type !== ItemType.SHOPPING) return false;
        
        // Always show pending
        if (i.status === 'pending') return true;
        
        // Show routine items even if done (they are just disabled until reset)
        if (i.status === 'done' && i.meta?.shoppingCategory === 'routine') return true;

        // Retention logic for done non-routine items
        if (i.status === 'done' && i.completed_at) {
            const completedTime = new Date(i.completed_at).getTime();
            const now = new Date().getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            return (now - completedTime) < oneDayMs;
        }
        return false;
    });
    
    // Grouping
    const urgent = visibleItems.filter(i => i.meta?.shoppingCategory === 'urgent');
    const routine = visibleItems.filter(i => i.meta?.shoppingCategory === 'routine');
    const normal = visibleItems.filter(i => !i.meta?.shoppingCategory || i.meta.shoppingCategory === 'not_urgent');

    const sortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
        // Sort done items to bottom
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
        // Then by date
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
    
    // Tag Filter
    if (selectedTag) {
        notes = notes.filter(i => i.meta?.tags?.includes(selectedTag));
    }
    
    // Search Filter
    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        notes = notes.filter(i => i.content.toLowerCase().includes(lowerQ) || i.meta.tags?.some(t => t.toLowerCase().includes(lowerQ)));
    }

    return notes.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
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
      let targetDate = new Date(); // Default for sorting
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

      if (normalizedTarget.getTime() === today.getTime()) {
        groups.today.push(item);
      } else if (normalizedTarget.getTime() === tomorrow.getTime()) {
        groups.tomorrow.push(item);
      } else {
        if (normalizedTarget < today && item.status === 'pending') {
            groups.today.push(item);
        } else {
            groups.later.push(item);
        }
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
      return items.filter(i => i.status === 'done').sort((a, b) => {
          const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          return tb - ta;
      });
  };

  // --- Render Helpers ---
  
  const renderSyncIndicator = () => {
    let icon, text, color;
    
    switch(syncStatus) {
        case 'synced':
            icon = <CloudCheck className="w-4 h-4" />;
            text = "Saved";
            color = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
            break;
        case 'syncing':
            icon = <RefreshCw className="w-4 h-4 animate-spin" />;
            text = "Saving...";
            color = "text-blue-400 bg-blue-400/10 border-blue-400/20";
            break;
        case 'error':
            icon = <CloudOff className="w-4 h-4" />;
            text = "Sync Failed";
            color = "text-red-400 bg-red-400/10 border-red-400/20";
            break;
        case 'local':
            icon = <Save className="w-4 h-4" />;
            text = "Local";
            color = "text-amber-400 bg-amber-400/10 border-amber-400/20";
            break;
    }

    return (
        <button 
            onClick={() => {
                if (syncStatus === 'error' || syncStatus === 'local') {
                    // Force retry sync
                    saveAndSync(items);
                }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${color}`}
            title={syncStatus === 'error' ? "Click to retry sync" : "Sync Status"}
        >
            {icon}
            <span className="hidden sm:inline">{text}</span>
        </button>
    );
  };

  const renderTabs = () => (
    <div className="flex justify-center mb-6 overflow-x-auto no-scrollbar pb-2">
      <div className="bg-surface border border-border rounded-full p-1 flex gap-1 shadow-sm min-w-max">
        <button
          onClick={() => setActiveTab('focus')}
          className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
            activeTab === 'focus' ? 'bg-primary text-background shadow-md' : 'text-muted hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" /> Focus
        </button>
        <button
          onClick={() => setActiveTab('shopping')}
          className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
            activeTab === 'shopping' ? 'bg-primary text-background shadow-md' : 'text-muted hover:text-white'
          }`}
        >
          <ShoppingCart className="w-4 h-4" /> Life
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
            activeTab === 'notes' ? 'bg-primary text-background shadow-md' : 'text-muted hover:text-white'
          }`}
        >
          <StickyNote className="w-4 h-4" /> Notes
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
            activeTab === 'history' ? 'bg-primary text-background shadow-md' : 'text-muted hover:text-white'
          }`}
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-primary font-sans selection:bg-acc-todo selection:text-white">
      
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
             {/* Pending Processing Indicator (AI) */}
             {pendingCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-acc-todo bg-acc-todo/10 px-3 py-1.5 rounded-full animate-pulse mr-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span className="hidden sm:inline">Processing...</span>
                </div>
             )}
             
             {/* Cloud Sync Status */}
             {renderSyncIndicator()}

             <div className="w-px h-6 bg-border mx-1"></div>

             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-muted hover:text-white hover:bg-surface rounded-full transition-colors"
                title="Settings"
             >
                 <Settings className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 pb-32 px-4 max-w-2xl mx-auto">
        
        {renderTabs()}

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
              const isEmpty = today.length === 0 && tomorrow.length === 0 && later.length === 0;

              if (isEmpty) return <div className="text-center text-muted py-10">No tasks or events.</div>;

              return (
                <div className="space-y-8">
                  {today.length > 0 && (
                    <section>
                      <h3 className="text-sm font-bold text-acc-todo uppercase tracking-wider mb-3 pl-1">Today</h3>
                      <div className="space-y-3">
                        {today.map(item => <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} />)}
                      </div>
                    </section>
                  )}
                  {tomorrow.length > 0 && (
                    <section>
                      <h3 className="text-sm font-bold text-acc-event uppercase tracking-wider mb-3 pl-1">Tomorrow</h3>
                      <div className="space-y-3">
                        {tomorrow.map(item => <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} />)}
                      </div>
                    </section>
                  )}
                  {later.length > 0 && (
                    <section>
                      <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 pl-1">Later</h3>
                      <div className="space-y-3">
                        {later.map(item => <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} />)}
                      </div>
                    </section>
                  )}
                </div>
              );
            })()}

            {/* SHOPPING (LIFE) TAB */}
            {activeTab === 'shopping' && (() => {
              const { urgent, routine, normal } = getShoppingItems();
              const isEmpty = urgent.length === 0 && routine.length === 0 && normal.length === 0;

              if (isEmpty) return <div className="text-center text-muted py-10">No life admin tasks.</div>;

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

              return (
                <div>
                    {/* Search & Tag Filter */}
                    <div className="mb-4 space-y-3">
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search notes..."
                                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-acc-note transition-colors"
                            />
                        </div>

                        {/* Tags */}
                        {uniqueTags.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                <button 
                                    onClick={() => setSelectedTag(null)}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${!selectedTag ? 'bg-primary text-background border-primary' : 'border-border text-muted hover:border-muted'}`}
                                >
                                    All
                                </button>
                                {uniqueTags.map(tag => (
                                    <button 
                                        key={tag}
                                        onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${tag === selectedTag ? 'bg-acc-note text-white border-acc-note' : 'border-border text-muted hover:border-muted'}`}
                                    >
                                        #{tag}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {notes.length === 0 ? (
                        <div className="text-center text-muted py-10">
                            {searchQuery ? "No matching notes." : "No notes found."}
                        </div>
                    ) : (
                        <div className="columns-1 sm:columns-2 gap-4 space-y-4">
                        {notes.map(item => <Card key={item.id} item={item} onEdit={setEditingItem} onDelete={handleDelete} />)}
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
                    <div className="space-y-2 pb-10">
                        {history.map(item => {
                             const dateStr = item.completed_at || item.created_at;
                             let label = "Unknown Date";
                             if (dateStr) {
                                 const date = new Date(dateStr);
                                 if (!isNaN(date.getTime())) {
                                     const now = new Date();
                                     const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                     const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                     
                                     const diffTime = today.getTime() - target.getTime();
                                     const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                 
                                     if (diffDays === 0) label = 'Today';
                                     else if (diffDays === 1) label = 'Yesterday';
                                     else label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' });
                                 }
                             }

                             const showHeader = label !== lastLabel;
                             lastLabel = label;

                             return (
                                 <React.Fragment key={item.id}>
                                     {showHeader && (
                                         <h3 className="text-xs font-bold text-muted/70 uppercase tracking-wider mt-6 mb-2 pl-1 sticky top-16 bg-background/95 backdrop-blur py-2 z-10">
                                             {label}
                                         </h3>
                                     )}
                                     <div className="mb-3">
                                         {item.type === ItemType.SHOPPING ? (
                                             <ShoppingItem item={item} onToggleStatus={handleToggleStatus} onDelete={handleDelete} readonly={false} />
                                         ) : (
                                             <Card item={item} onToggleStatus={handleToggleStatus} onDelete={handleDelete} readonly={true} />
                                         )}
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

      {/* Input Area */}
      <InputBar onSend={handleSend} />

      {/* Edit Modal */}
      {editingItem && (
        <EditModal 
            item={editingItem} 
            isOpen={!!editingItem} 
            onClose={() => setEditingItem(null)} 
            onSave={handleUpdateItem} 
        />
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSettingsSaved}
      />
    </div>
  );
};

export default App;