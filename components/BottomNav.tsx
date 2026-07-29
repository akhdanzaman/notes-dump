import React from 'react';
import { LayoutGroup } from 'motion/react';
import { Menu } from 'lucide-react';
import { Tab, PlanSubTab, LibrarySubTab } from '../types';
import { getAppNavigationItems } from './navigationItems';
import ActiveIndicator from '../motion/ActiveIndicator';

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
        <LayoutGroup id="mobile-primary-navigation">
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
                      ? 'text-indigo-600 dark:text-indigo-300'
                      : 'text-muted hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  {isActive && (
                    <ActiveIndicator
                      className="absolute inset-0 rounded-[1rem] bg-indigo-500/12 after:absolute after:bottom-1 after:left-1/2 after:h-0.5 after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-indigo-500 after:content-['']"
                    />
                  )}
                  <span className="relative z-10 flex h-5 items-center justify-center transition-transform duration-150 group-active:scale-90">
                    <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.35 : 2} />
                  </span>
                  <span className="relative z-10 max-w-full truncate text-[9px] font-semibold leading-none sm:text-[10px]">
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
        </LayoutGroup>
      </div>
    </div>
  );
};

export default BottomNav;
