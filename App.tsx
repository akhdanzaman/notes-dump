import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, Tab, FocusSubTab, NotesSubTab, MoneyView, SortOrder, ItemType } from './types';
import { useBrainDumpData } from './hooks/useBrainDumpData';

import InputBar from './components/InputBar';
import SkillModal from './components/SkillModal';
import WalletModal from './components/WalletModal';
import ConfirmDialog from './components/ConfirmDialog';

import BottomNav from './components/BottomNav';
import FloatingSearch from './components/FloatingSearch';
import ControlCenter from './components/ControlCenter';

import SummaryView from './components/views/SummaryView';
import FocusView from './components/views/FocusView';
import ShoppingView from './components/views/ShoppingView';
import NotesView from './components/views/NotesView';
import MoneyViewComponent from './components/views/MoneyView';
import { Brain } from 'lucide-react';

const App: React.FC = () => {
  // Data Logic Hook
  const {
      items, budgetConfig, setBudgetConfig, skills, setSkills, wallets, setWallets,
      customPrompt, setCustomPrompt, monthlyThemes, setMonthlyThemes, appSettings, setAppSettings,
      loading, error, pendingCount, syncStatus, saveAndSync, handleSend, handleToggleStatus,
      handleDelete, handleUpdateItem, loadData
  } = useBrainDumpData();

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [focusSubTab, setFocusSubTab] = useState<FocusSubTab>('tasks');
  const [notesSubTab, setNotesSubTab] = useState<NotesSubTab>('general');
  const [showBalance, setShowBalance] = useState(false);
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [themeNavDate, setThemeNavDate] = useState(new Date());

  // Focus View State
  const [focusDate, setFocusDate] = useState(new Date());

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
  const [filterDateTo, setFilterDateTo] = useState<string>(''); // YYYY-MM-DD
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
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
    // We assume the initial height is the "keyboard closed" state
    const initialHeight = window.innerHeight;
    
    const handleResize = () => {
        // Only trigger if an input is focused (simple optimization to avoid calc on scroll-hide address bars)
        const isFocused = document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT';
        
        if (!isFocused) {
            setIsMobileKeyboardOpen(false);
            return;
        }

        const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        // If height is reduced by more than 150px (typical virtual keyboard height), assume it's open
        const isKeyboardOpen = currentHeight < (initialHeight - 150);
        
        setIsMobileKeyboardOpen(isKeyboardOpen);
    };

    if (window.visualViewport) window.visualViewport.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    
    return () => {
        if (window.visualViewport) window.visualViewport.removeEventListener('resize', handleResize);
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  // --- Handlers ---

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

  const handleClearData = () => {
      saveAndSync([], undefined, undefined, [], [], {}, undefined);
      setIsControlCenterOpen(false);
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
            i.type === 'FINANCE' || 
            ((i.type === 'SHOPPING' || i.type === 'TODO') && (i.meta.amount || 0) > 0)
        );
    } else if (activeTab === 'notes') {
        if (notesSubTab === 'general') {
            targetItems = items.filter(i => i.type === ItemType.NOTE);
        } else if (notesSubTab === 'skills') {
            targetItems = items.filter(i => i.type === ItemType.SKILL_LOG);
        } else {
            targetItems = items.filter(i => 
                i.type === 'JOURNAL' || 
                (i.type === ItemType.TODO && i.status === 'done')
            );
        }
    } else if (activeTab === 'focus') {
         targetItems = items.filter(i => i.type === 'TODO' || i.type === 'EVENT');
    } else {
        targetItems = items;
    }

    targetItems.forEach(i => i.meta?.tags?.forEach(t => {
        if (t && t !== 'null' && t !== 'undefined') tags.add(t);
    }));
    
    return Array.from(tags).sort();
  }, [items, activeTab, notesSubTab]);

  return (
    <div className="min-h-screen bg-background text-primary font-sans transition-colors duration-300 selection:bg-indigo-500/30">
      
      {/* Minimal Top Bar */}
      <div className="fixed top-0 w-full z-30 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                    <Brain className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-primary">BrainDump</h1>
            </div>
            {/* Optional: Add a small status indicator here if needed, but keeping it clean for now */}
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-24 pb-48 px-4 max-w-2xl mx-auto min-h-screen">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted animate-pulse">
            <div className="w-12 h-12 bg-surface rounded-full mb-4"></div>
            <p>Syncing...</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {activeTab === 'summary' && (
                <SummaryView 
                    items={items} skills={skills} wallets={wallets} budgetConfig={budgetConfig}
                    themeNavDate={themeNavDate} setThemeNavDate={setThemeNavDate}
                    monthlyThemes={monthlyThemes}
                    onThemeEdit={(content) => { setTempThemeContent(content); setThemeEditMode(true); }}
                    handleToggleStatus={handleToggleStatus}
                    setActiveTab={setActiveTab}
                    setFocusSubTab={setFocusSubTab}
                    showBalance={showBalance} setShowBalance={setShowBalance}
                />
            )}

            {activeTab === 'focus' && (
                <FocusView 
                    items={items} skills={skills}
                    focusSubTab={focusSubTab} setFocusSubTab={setFocusSubTab}
                    focusDate={focusDate} setFocusDate={setFocusDate}
                    appSettings={appSettings}
                    handleToggleStatus={handleToggleStatus} handleDelete={requestDeleteItem}
                    handleUpdateItem={handleUpdateItem}
                    handleOpenEditSkill={handleOpenEditSkill} handleOpenAddSkill={handleOpenAddSkill}
                    setDeleteId={setDeleteId} setDeleteType={setDeleteType}
                    searchQuery={searchQuery} selectedTag={selectedTag}
                    wallets={wallets} budgetRules={budgetConfig.rules}
                />
            )}

            {activeTab === 'shopping' && (
                <ShoppingView 
                    items={items}
                    handleToggleStatus={handleToggleStatus} handleDelete={requestDeleteItem}
                    handleUpdateItem={handleUpdateItem}
                />
            )}

            {activeTab === 'notes' && (
                <NotesView 
                    items={items} skills={skills}
                    notesSubTab={notesSubTab} setNotesSubTab={setNotesSubTab}
                    appSettings={appSettings}
                    handleDelete={requestDeleteItem}
                    handleUpdateItem={handleUpdateItem}
                    selectedTag={selectedTag} filterDate={filterDate} filterDateTo={filterDateTo} searchQuery={searchQuery} sortOrder={sortOrder}
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
                    handleOpenEditWallet={handleOpenEditWallet} handleOpenAddWallet={handleOpenAddWallet}
                    setDeleteId={setDeleteId} setDeleteType={setDeleteType} setIsSettingsOpen={setIsControlCenterOpen}
                    filterWallet={filterWallet} filterTransactionType={filterTransactionType}
                    filterCategory={filterCategory}
                    filterMinAmount={filterMinAmount} filterMaxAmount={filterMaxAmount}
                    selectedTag={selectedTag} searchQuery={searchQuery} sortOrder={sortOrder}
                />
            )}

          </div>
        )}
      </main>

      {/* Fixed Bottom Layout */}
      <div className="fixed bottom-0 w-full z-40 bg-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <InputBar 
                onSend={handleSend} 
                onFocus={() => { setIsSearchExpanded(false); }} 
                startAction={
                    <FloatingSearch 
                        activeTab={activeTab} notesSubTab={notesSubTab} moneyView={moneyView}
                        isSearchExpanded={isSearchExpanded} setIsSearchExpanded={setIsSearchExpanded}
                        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                        showFilterMenu={showFilterMenu} setShowFilterMenu={setShowFilterMenu}
                        showSortMenu={showSortMenu} setShowSortMenu={setShowSortMenu}
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
                    />
                }
            />
          </div>

          <div className={`pointer-events-auto ${isMobileKeyboardOpen ? "hidden md:block" : "block"}`}>
             <BottomNav 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                onMenuClick={() => setIsControlCenterOpen(true)}
             />
          </div>
      </div>

      {/* Modals */}
      <ControlCenter 
        isOpen={isControlCenterOpen}
        onClose={() => setIsControlCenterOpen(false)}
        syncStatus={syncStatus}
        onSyncClick={() => saveAndSync(items)}
        onRefreshClick={() => loadData()}
        appSettings={appSettings}
        setAppSettings={setAppSettings}
        error={error}
        pendingCount={pendingCount}
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