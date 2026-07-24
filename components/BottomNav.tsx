import React from 'react';
import { Menu } from 'lucide-react';
import { Tab, PlanSubTab, LibrarySubTab } from '../types';
import { getAppNavigationItems } from './navigationItems';

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
  librarySubTab,
  onMenuClick,
}) => {
  const tabs = getAppNavigationItems(planSubTab, librarySubTab);

  return (
    <div
      data-mobile-bottom-nav="true"
      className="z-40 w-full px-3 sm:px-5 lg:hidden"
      role="navigation"
      aria-label="Navigasi utama"
    >
      <div className="mx-auto max-w-lg">
        <div className="grid grid-cols-6 gap-1 rounded-[1.4rem] border border-border/80 bg-surface/90 p-1.5 backdrop-blur-2xl">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                data-mobile-nav-tab={tab.id}
                data-active={isActive ? 'true' : 'false'}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tab.label}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1rem] px-1 py-2',
                  'transition-colors duration-200 active:scale-[0.97]',
                  isActive
                    ? 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-300'
                    : 'text-muted hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]',
                ].join(' ')}
              >
                <span className="relative flex h-5 items-center justify-center">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.35 : 2} />
                  {isActive && (
                    <span className="absolute -bottom-2 h-0.5 w-4 rounded-full bg-indigo-500" />
                  )}
                </span>
                <span className="max-w-full truncate text-[9px] font-semibold leading-none sm:text-[10px]">
                  {tab.label}
                </span>
              </button>
            );
          })}

          <button
            data-mobile-nav-menu="true"
            type="button"
            onClick={onMenuClick}
            aria-label="Buka menu dan pengaturan"
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1rem] px-1 py-2 text-muted transition-colors duration-200 hover:bg-black/[0.04] hover:text-primary active:scale-[0.97] dark:hover:bg-white/[0.06]"
          >
            <Menu className="h-[19px] w-[19px]" />
            <span className="text-[9px] font-semibold leading-none sm:text-[10px]">Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
