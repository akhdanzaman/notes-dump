import React, { useEffect, useRef, useState } from 'react';
import { Plus, Search, SlidersHorizontal, Sparkles, ClipboardCheck, X } from 'lucide-react';
import { AppLanguage, Tab } from '../../types';
import { getAppNavigationItems } from '../navigationItems';
import { normalizeAppLanguage } from '../../utils/i18n';

export type CreateAction = 'task' | 'routine' | 'shopping' | 'goal' | 'loan' | 'expense' | 'income' | 'transfer' | 'note' | 'journal' | 'skill' | 'wallet';
interface Props {
  activeTab: Tab;
  language?: AppLanguage;
  query: string;
  onSearch: (value: string) => void;
  onCreate: (action: CreateAction) => void;
  onCapture: () => void;
  onFilters: () => void;
  onReview: () => void;
  reviewCount: number;
}

export default function DesktopCommandBar({ activeTab, language, query, onSearch, onCreate, onCapture, onFilters, onReview, reviewCount }: Props) {
  const en = normalizeAppLanguage(language) === 'en';
  const section = getAppNavigationItems(undefined, undefined, language).find(item => item.id === activeTab)!;
  const searchable = activeTab === 'plan' || activeTab === 'money' || activeTab === 'library';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!window.matchMedia('(min-width: 1024px)').matches) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (searchable) searchRef.current?.focus(); else onCapture();
      }
      if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); newButton.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('keydown', keyboard);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', keyboard); document.removeEventListener('pointerdown', outside); };
  }, [menuOpen, searchable, onCapture]);
  const actions: [CreateAction, string, string][] = [
    ['task', 'Task', 'Tugas'], ['routine', 'Routine', 'Rutinitas'], ['shopping', 'Shopping item', 'Belanja'],
    ['goal', 'Saving / investment goal', 'Target tabungan / investasi'], ['loan', 'Loan', 'Pinjaman'],
    ['expense', 'Expense', 'Pengeluaran'], ['income', 'Income', 'Pemasukan'], ['transfer', 'Transfer', 'Transfer'],
    ['note', 'Note', 'Catatan'], ['journal', 'Journal', 'Jurnal'], ['skill', 'Skill', 'Skill'], ['wallet', 'Wallet', 'Wallet'],
  ];
  return <header data-command-bar="true" className="sticky top-0 z-30 -mx-6 hidden h-[76px] items-center justify-between gap-4 border-b border-border bg-background/95 px-6 backdrop-blur-md lg:flex">
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{en ? 'Personal workspace' : 'Workspace pribadi'}</div>
      <h1 className="truncate text-lg font-semibold tracking-tight">{section.label}</h1>
    </div>
    <div className="flex min-w-0 items-center gap-2">
      {searchable && <label className="flex w-44 items-center gap-2 rounded-lg border border-border bg-surface px-3 xl:w-64">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input ref={searchRef} aria-label={en ? 'Search this workspace' : 'Cari di workspace ini'} value={query} onChange={event => onSearch(event.target.value)} placeholder={en ? 'Search…' : 'Cari…'} className="w-full min-w-0 bg-transparent py-2 text-sm outline-none" />
        {query ? <button type="button" onClick={() => onSearch('')} aria-label={en ? 'Clear search' : 'Hapus pencarian'}><X className="h-3.5 w-3.5" /></button> : <kbd className="shrink-0 text-[10px] text-muted">⌘/Ctrl K</kbd>}
      </label>}
      {(activeTab === 'money' || activeTab === 'library') && <button type="button" onClick={onFilters} className="rounded-lg border border-border bg-surface p-2 text-muted" aria-label={en ? 'Filters and sorting' : 'Filter dan urutan'} title={en ? 'Filters and sorting' : 'Filter dan urutan'}><SlidersHorizontal className="h-4 w-4" /></button>}
      <button type="button" onClick={onReview} className="relative rounded-lg p-2 text-muted hover:bg-surface-soft" aria-label={`${en ? 'Review queue' : 'Antrean review'} (${reviewCount})`} title={en ? 'Review queue' : 'Antrean review'}><ClipboardCheck className="h-4 w-4" />{reviewCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[10px] text-surface">{reviewCount}</span>}</button>
      <button type="button" onClick={onCapture} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium"><Sparkles className="h-4 w-4 text-accent" /><span className="hidden xl:inline">{en ? 'Capture / Ask' : 'Catat / Tanya'}</span></button>
      <div ref={menuRef} className="relative">
        <button ref={newButton} type="button" aria-expanded={menuOpen} aria-controls="workspace-create-menu" onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-surface"><Plus className="h-4 w-4" />{en ? 'New' : 'Baru'}</button>
        {menuOpen && <div id="workspace-create-menu" className="absolute right-0 top-full mt-2 grid max-h-[70vh] w-64 gap-1 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-xl" aria-label={en ? 'Create a record' : 'Buat data baru'}>
          {actions.map(([action, english, indonesian]) => <button type="button" key={action} onClick={() => { setMenuOpen(false); onCreate(action); }} className="rounded-md px-3 py-2 text-left text-sm hover:bg-surface-soft">{en ? english : indonesian}</button>)}
        </div>}
      </div>
    </div>
  </header>;
}
