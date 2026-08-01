import { Calendar as CalendarIcon, LayoutDashboard, Library, ListTodo, LucideIcon, Wallet as WalletIcon } from 'lucide-react';
import { AppLanguage, LibrarySubTab, PlanSubTab, Tab } from '../types';
import { normalizeAppLanguage } from '../utils/i18n';

export interface AppNavigationItem {
  id: Tab;
  icon: LucideIcon;
  label: string;
  helper: string;
}

/**
 * Primary navigation labels intentionally stay stable. Sub-tabs belong inside
 * their section so users do not lose their sense of place when switching views.
 */
export const getAppNavigationItems = (
  _planSubTab?: PlanSubTab,
  _librarySubTab?: LibrarySubTab,
  language?: AppLanguage,
): AppNavigationItem[] => {
  if (normalizeAppLanguage(language) === 'en') {
    return [
      { id: 'summary', icon: LayoutDashboard, label: 'Home', helper: 'Overview and next steps' },
      { id: 'plan', icon: ListTodo, label: 'Plan', helper: 'Tasks, shopping, goals, and loans' },
      { id: 'library', icon: Library, label: 'Library', helper: 'Notes, skills, and journal' },
      { id: 'money', icon: WalletIcon, label: 'Money', helper: 'Wallets, transactions, and budget' },
      { id: 'calendar', icon: CalendarIcon, label: 'Calendar', helper: 'Agenda and scheduled activity' },
    ];
  }

  return [
    { id: 'summary', icon: LayoutDashboard, label: 'Beranda', helper: 'Ringkasan dan langkah berikutnya' },
    { id: 'plan', icon: ListTodo, label: 'Rencana', helper: 'Tugas, belanja, target, dan pinjaman' },
    { id: 'library', icon: Library, label: 'Pustaka', helper: 'Catatan, skill, dan jurnal' },
    { id: 'money', icon: WalletIcon, label: 'Uang', helper: 'Wallet, transaksi, dan budget' },
    { id: 'calendar', icon: CalendarIcon, label: 'Kalender', helper: 'Agenda dan aktivitas terjadwal' },
  ];
};
