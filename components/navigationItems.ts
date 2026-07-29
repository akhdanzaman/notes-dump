import { Calendar as CalendarIcon, LayoutDashboard, Library, ListTodo, LucideIcon, Wallet as WalletIcon } from 'lucide-react';
import { LibrarySubTab, PlanSubTab, Tab } from '../types';

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
): AppNavigationItem[] => [
  { id: 'summary', icon: LayoutDashboard, label: 'Home', helper: 'Ringkasan dan aktivitas hari ini' },
  { id: 'plan', icon: ListTodo, label: 'Plan', helper: 'Focus, shopping, dan goals' },
  { id: 'library', icon: Library, label: 'Library', helper: 'Notes, skills, dan journal' },
  { id: 'money', icon: WalletIcon, label: 'Money', helper: 'Transactions, budget, dan wallet' },
  { id: 'calendar', icon: CalendarIcon, label: 'Calendar', helper: 'Agenda dan entry bertanggal' },
];
