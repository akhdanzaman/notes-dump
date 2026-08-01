import React from 'react';
import { ClipboardCheck, Settings } from 'lucide-react';
import { AppLanguage, LibrarySubTab, PlanSubTab, Tab } from '../../types';
import CountBadge from '../../motion/CountBadge';
import { shellCopy } from '../../utils/i18n';
import { getAppNavigationItems } from '../navigationItems';

interface MobileAppBarProps {
  activeTab: Tab;
  planSubTab: PlanSubTab;
  librarySubTab: LibrarySubTab;
  language?: AppLanguage;
  reviewCount: number;
  onOpenReview: () => void;
  onOpenSettings: () => void;
}

const MobileAppBar: React.FC<MobileAppBarProps> = ({
  activeTab,
  planSubTab,
  librarySubTab,
  language,
  reviewCount,
  onOpenReview,
  onOpenSettings,
}) => {
  const copy = shellCopy(language);
  const activeItem = getAppNavigationItems(planSubTab, librarySubTab, language)
    .find((item) => item.id === activeTab);

  return (
    <header
      data-mobile-app-bar="true"
      className="sticky top-0 z-40 -mx-3 mb-1 flex min-h-14 items-center justify-between border-b border-border/55 bg-background/92 px-3 py-1.5 backdrop-blur-xl sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 lg:hidden"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <img
          src="/icon.svg"
          alt=""
          className="h-9 w-9 shrink-0 rounded-xl bg-zinc-950 ring-1 ring-black/10 dark:ring-white/10"
        />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-muted">Arkaiv</p>
          <h1 className="truncate text-sm font-semibold tracking-[-0.015em] text-primary">
            {activeItem?.label || copy.workspace}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenReview}
          className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65"
          aria-label={`${copy.openReview}${reviewCount ? `, ${reviewCount}` : ''}`}
        >
          <ClipboardCheck className="h-[19px] w-[19px]" />
          <CountBadge
            count={reviewCount}
            ariaLabel={`${reviewCount} ${copy.review.toLowerCase()}`}
            className="absolute right-0.5 top-0.5 min-w-[17px] rounded-full bg-accent px-1 text-center text-[9px] font-bold leading-[17px] text-white"
          />
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65"
          aria-label={copy.openSettings}
        >
          <Settings className="h-[19px] w-[19px]" />
        </button>
      </div>
    </header>
  );
};

export default MobileAppBar;
