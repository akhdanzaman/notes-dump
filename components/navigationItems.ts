import { LucideIcon, LayoutDashboard, Target, ShoppingCart, StickyNote, Wallet as WalletIcon, PiggyBank, Book, Wrench, Calendar as CalendarIcon } from 'lucide-react';
import { LibrarySubTab, PlanSubTab, Tab } from '../types';

export interface AppNavigationItem {
  id: Tab;
  icon: LucideIcon;
  label: string;
  helper: string;
  subTab?: PlanSubTab | LibrarySubTab;
}

export const getPlanTabInfo = (planSubTab: PlanSubTab): Pick<AppNavigationItem, 'icon' | 'label'> => {
  switch (planSubTab) {
    case 'shopping': return { icon: ShoppingCart, label: 'Shopping' };
    case 'savings': return { icon: PiggyBank, label: 'Goals' };
    default: return { icon: Target, label: 'Focus' };
  }
};

export const getLibraryTabInfo = (librarySubTab: LibrarySubTab): Pick<AppNavigationItem, 'icon' | 'label'> => {
  switch (librarySubTab) {
    case 'skills': return { icon: Wrench, label: 'Skills' };
    case 'journal': return { icon: Book, label: 'Journal' };
    default: return { icon: StickyNote, label: 'Notes' };
  }
};

export const getAppNavigationItems = (planSubTab: PlanSubTab, librarySubTab: LibrarySubTab): AppNavigationItem[] => {
  const planTabInfo = getPlanTabInfo(planSubTab);
  const libraryTabInfo = getLibraryTabInfo(librarySubTab);

  return [
    { id: 'summary', icon: LayoutDashboard, label: 'Home', helper: 'Overview and daily pulse' },
    { id: 'plan', icon: planTabInfo.icon, label: planTabInfo.label, helper: 'Focus, shopping, and goals', subTab: 'tasks' },
    { id: 'library', icon: libraryTabInfo.icon, label: libraryTabInfo.label, helper: 'Notes, skills, and journal', subTab: 'general' },
    { id: 'money', icon: WalletIcon, label: 'Money', helper: 'Transactions and wallets' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar', helper: 'Upcoming dated work' },
  ];
};
