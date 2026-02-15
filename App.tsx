
import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, Tab, FocusSubTab, NotesSubTab, MoneyView, SortOrder, ItemType } from './types';
import { useBrainDumpData } from './hooks/useBrainDumpData';

import InputBar from './components/InputBar';
import EditModal from './components/EditModal';
import SettingsModal from './components/SettingsModal';
import SkillModal from './components/SkillModal';
import WalletModal from './components/WalletModal';
import ConfirmDialog from './components/ConfirmDialog';

import Header from './components/Header';
import BottomNav from './components/BottomNav';
import FloatingSearch from './components/FloatingSearch';

import SummaryView from './components/views/SummaryView';
import FocusView from './components/views/FocusView';
import ShoppingView from './components/views/ShoppingView';
import NotesView from './components/views/NotesView';
import MoneyViewComponent from './components/views/MoneyView';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
  const [filterMinAmount, setFilterMinAmount] = useState<string>('');
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>('');

  // Finance Date Filter
  const [financeDate, setFinanceDate] = useState(new Date());
  const [moneyView, setMoneyView] = useState<MoneyView>('transactions');

  // Input Focus State
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [editingItem, setEditingItem] = useState<BrainDumpItem | null>(null);

  // --- Handlers ---

  const handleSettingsSaved = (newBudgetConfig?: BudgetConfig, newPrompt?: string, newAppSettings?: AppSettings) => {
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
          handleDelete(deleteId);
      }
      setDeleteId(null);
      setDeleteType(null);
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
            targetItems = items.filter(i => i.type === 'NOTE');
        } else if (notesSubTab === 'skills') {
            targetItems = items.filter(i => i.type === ItemType.SKILL_LOG);
        } else {
            targetItems = items.filter(i => 
                i.type === 'JOURNAL' || 
                (i.type === 'TODO' && i.status === 'done')
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

  // Unique Payment Methods for Edit Modal
  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set<string>();
    items.forEach(i => {
        if (i.meta.paymentMethod) methods.add(i.meta.paymentMethod);
    });
    return Array.from(methods);
  }, [items]);

  return (
    <div className="min-h-screen bg-background text-primary font-sans">
      
      <Header 
        pendingCount={pendingCount}
        syncStatus={syncStatus}
        onSyncClick={() => {
            if (syncStatus === 'error') {
                saveAndSync(items); // Retry instead of reload
            } else {
                saveAndSync(items);
            }
        }}
        onRefreshClick={() => loadData()}
        onSettingsClick={() => setIsSettingsOpen(true)}
        error={error}
      />

      {/* Main Content */}
      <main className="pt-20 pb-48 px-4 max-w-2xl mx-auto min-h-screen">
        
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
                    handleToggleStatus={handleToggleStatus} handleDelete={setDeleteId}
                    setEditingItem={setEditingItem}
                    handleOpenEditSkill={handleOpenEditSkill} handleOpenAddSkill={handleOpenAddSkill}
                    setDeleteId={setDeleteId} setDeleteType={setDeleteType}
                    searchQuery={searchQuery} selectedTag={selectedTag}
                />
            )}

            {activeTab === 'shopping' && (
                <ShoppingView 
                    items={items}
                    handleToggleStatus={handleToggleStatus} handleDelete={handleDelete} setEditingItem={setEditingItem}
                />
            )}

            {activeTab === 'notes' && (
                <NotesView 
                    items={items} skills={skills}
                    notesSubTab={notesSubTab} setNotesSubTab={setNotesSubTab}
                    appSettings={appSettings}
                    handleDelete={handleDelete} setEditingItem={setEditingItem}
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
                    handleDelete={handleDelete} setEditingItem={setEditingItem}
                    handleOpenEditWallet={handleOpenEditWallet} handleOpenAddWallet={handleOpenAddWallet}
                    setDeleteId={setDeleteId} setDeleteType={setDeleteType} setIsSettingsOpen={setIsSettingsOpen}
                    filterWallet={filterWallet} filterTransactionType={filterTransactionType}
                    filterMinAmount={filterMinAmount} filterMaxAmount={filterMaxAmount}
                    selectedTag={selectedTag} searchQuery={searchQuery} sortOrder={sortOrder}
                />
            )}

          </div>
        )}
      </main>

      {/* Fixed Bottom Layout */}
      <div className="fixed bottom-0 w-full z-40 bg-background border-t border-border">
          
          <InputBar 
            onSend={handleSend} 
            onFocus={() => { setIsInputFocused(true); setIsSearchExpanded(false); }} 
            onBlur={() => setIsInputFocused(false)} 
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
                    filterMinAmount={filterMinAmount} setFilterMinAmount={setFilterMinAmount}
                    filterMaxAmount={filterMaxAmount} setFilterMaxAmount={setFilterMaxAmount}
                    uniqueTags={uniqueTags} wallets={wallets}
                />
            }
          />

          <div className={isInputFocused ? "hidden md:block" : "block"}>
             <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
      </div>

      {/* Modals */}
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
        currentAppSettings={appSettings}
        allItems={items}
        allSkills={skills}
        allWallets={wallets}
        monthlyThemes={monthlyThemes}
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
