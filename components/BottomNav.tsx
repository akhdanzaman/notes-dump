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
  // The mobile navigation intentionally exposes no more than five primary
  // destinations. Secondary controls remain available through Menu.
  const tabs = getAppNavigationItems(planSubTab, librarySubTab).slice(0, 5);

  return (
    <nav
      data-mobile-bottom-nav="true"
      className="relative z-40 w-full px-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-5 md:px-6 lg:hidden"
      aria-label="Navigasi utama"
    >
      <div className="mx-auto w-full max-w-[35rem] md:max-w-[46rem]">
        <LayoutGroup id="mobile-primary-navigation">
          <div className="grid grid-cols-6 gap-0.5 rounded-[1.4rem] bg-surface/88 p-1 shadow-[0_12px_34px_rgba(16,23,19,0.12)] ring-1 ring-inset ring-border/70 backdrop-blur-xl dark:shadow-[0_16px_38px_rgba(0,0,0,0.34)] sm:gap-1 sm:p-1.5 md:rounded-[1.25rem] md:bg-surface/84 md:p-2">
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
                  aria-label={`${tab.label}. ${tab.helper}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'group relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-[1rem] px-1 py-1.5',
                    'transition-[color,transform] duration-150 active:scale-[0.97]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
                    'md:min-h-12 md:flex-row md:gap-2 md:rounded-[0.9rem] md:px-3 md:py-2',
                    isActive
                      ? 'text-accent'
                      : 'text-muted hover:bg-black/[0.035] hover:text-primary dark:hover:bg-white/[0.055]',
                  ].join(' ')}
                >
                  {isActive && (
                    <ActiveIndicator
                      className="absolute inset-0 rounded-[1rem] bg-accent/10 ring-1 ring-inset ring-accent/15 after:absolute after:bottom-0.5 after:left-1/2 after:h-0.5 after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-accent after:content-[''] md:rounded-[0.9rem] md:after:bottom-auto md:after:left-0.5 md:after:top-1/2 md:after:h-5 md:after:w-0.5 md:after:-translate-x-0 md:after:-translate-y-1/2"
                    />
                  )}
                  <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center transition-transform duration-150 group-active:scale-90 md:h-7 md:w-7">
                    <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.35 : 2} />
                  </span>
                  <span className="relative z-10 max-w-full truncate text-[9px] font-semibold leading-none sm:text-[10px] md:text-xs">
                    {tab.label}
                  </span>
                </button>
              );
            })}

            <button
              data-mobile-nav-menu="true"
              type="button"
              onClick={onMenuClick}
              aria-label="Buka menu lainnya dan pengaturan"
              className="group relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-[1rem] px-1 py-1.5 text-muted transition-[color,background-color,transform] duration-150 hover:bg-black/[0.035] hover:text-primary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-surface dark:hover:bg-white/[0.055] md:min-h-12 md:flex-row md:gap-2 md:rounded-[0.9rem] md:px-3 md:py-2"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center transition-transform duration-150 group-active:scale-90 md:h-7 md:w-7">
                <Menu className="h-[19px] w-[19px]" />
              </span>
              <span className="max-w-full truncate text-[9px] font-semibold leading-none sm:text-[10px] md:text-xs">
                Menu
              </span>
            </button>
          </div>
        </LayoutGroup>
      </div>
    </nav>
  );
};

export default BottomNav;
