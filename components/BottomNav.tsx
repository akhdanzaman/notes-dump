import React from 'react';
import {
  LayoutDashboard,
  Target,
  ShoppingCart,
  StickyNote,
  Wallet as WalletIcon,
  Menu,
  PiggyBank,
  Book,
  Wrench,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Tab, PlanSubTab, LibrarySubTab } from '../types';

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  planSubTab: PlanSubTab;
  setPlanSubTab: (tab: PlanSubTab) => void;
  librarySubTab: LibrarySubTab;
  setLibrarySubTab: (tab: LibrarySubTab) => void;
  onMenuClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  planSubTab,
  setPlanSubTab,
  librarySubTab,
  setLibrarySubTab,
  onMenuClick,
}) => {
  const getPlanTab = () => {
    switch (planSubTab) {
      case 'shopping': return { icon: ShoppingCart, label: 'Shopping' };
      case 'savings': return { icon: PiggyBank, label: 'Goals' };
      default: return { icon: Target, label: 'Focus' };
    }
  };

  const getLibraryTab = () => {
    switch (librarySubTab) {
      case 'skills': return { icon: Wrench, label: 'Skills' };
      case 'journal': return { icon: Book, label: 'Journal' };
      default: return { icon: StickyNote, label: 'Notes' };
    }
  };

  const planTabInfo = getPlanTab();
  const libraryTabInfo = getLibraryTab();

  const tabs: { id: Tab; icon: React.ElementType; label: string; subTab?: PlanSubTab | LibrarySubTab }[] = [
    { id: 'summary', icon: LayoutDashboard, label: 'Home' },
    { id: 'plan', icon: planTabInfo.icon, label: planTabInfo.label, subTab: 'tasks' },
    { id: 'library', icon: libraryTabInfo.icon, label: libraryTabInfo.label, subTab: 'general' },
    { id: 'money', icon: WalletIcon, label: 'Money' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
  ];

  return (
    <div className="w-full pb-6 px-4 z-40">
      <div className="flex justify-center">
        <div className="w-fit">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-2 backdrop-blur-xl">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={`${tab.id}-${tab.subTab || 'main'}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.subTab) {
                      if (tab.id === 'plan') setPlanSubTab(tab.subTab as PlanSubTab);
                      if (tab.id === 'library') setLibrarySubTab(tab.subTab as LibrarySubTab);
                    }
                  }}
                  className={[
                    'group relative flex shrink-0 items-center overflow-hidden rounded-full',
                    'transition-all duration-300 ease-in-out',
                    'h-10',
                    isActive
                      ? 'w-[116px] bg-black/5 dark:bg-white/10 text-primary shadow-sm'
                      : 'w-10 bg-transparent text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/10',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'flex w-full items-center transition-all duration-300 ease-in-out',
                      isActive ? 'justify-center px-3' : 'justify-center px-0',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5 shrink-0" />

                    <span
                      className={[
                        'overflow-hidden whitespace-nowrap text-sm font-medium leading-none',
                        'transition-all duration-300 ease-in-out',
                        isActive
                          ? 'ml-2 max-w-[64px] opacity-100'
                          : 'ml-0 max-w-0 opacity-0',
                      ].join(' ')}
                    >
                      {tab.label}
                    </span>
                  </div>
                </button>
              );
            })}

            <div className="mx-1 h-5 w-px shrink-0 bg-border" />

            <button
              onClick={onMenuClick}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-all duration-300 ease-in-out hover:bg-black/5 hover:text-primary dark:hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;