import React from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  AlertTriangle,
  ClipboardCheck,
  CloudCheck,
  CloudOff,
  RefreshCw,
  Save,
  Settings,
} from 'lucide-react';
import { AppLanguage, LibrarySubTab, PlanSubTab, SyncProgress, SyncStatus, Tab } from '../../types';
import { getAppNavigationItems } from '../navigationItems';
import ActiveIndicator from '../../motion/ActiveIndicator';
import { popVariants } from '../../motion/variants';
import CountBadge from '../../motion/CountBadge';
import { shellCopy } from '../../utils/i18n';

interface DesktopNavRailProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  planSubTab: PlanSubTab;
  setPlanSubTab: (tab: PlanSubTab) => void;
  librarySubTab: LibrarySubTab;
  setLibrarySubTab: (tab: LibrarySubTab) => void;
  pendingCount: number;
  reviewQueueCount: number;
  saveStatus: SyncStatus;
  saveProgress?: SyncProgress | null;
  fetchStatus: SyncStatus;
  onSyncClick: () => void;
  onRefreshClick: () => void;
  onSettingsClick: () => void;
  onOpenReviewCenter: () => void;
  error: string | null;
  language?: AppLanguage;
}

const DesktopNavRail: React.FC<DesktopNavRailProps> = ({
  activeTab,
  setActiveTab,
  planSubTab,
  setPlanSubTab,
  librarySubTab,
  setLibrarySubTab,
  pendingCount,
  reviewQueueCount,
  saveStatus,
  saveProgress,
  fetchStatus,
  onSyncClick,
  onRefreshClick,
  onSettingsClick,
  onOpenReviewCenter,
  error,
  language,
}) => {
  const copy = shellCopy(language);
  const navItems = getAppNavigationItems(planSubTab, librarySubTab, language);
  const activeStatus = saveStatus === 'saving'
    ? 'saving'
    : fetchStatus === 'syncing'
      ? 'syncing'
      : saveStatus === 'error' || fetchStatus === 'error'
        ? 'error'
        : saveStatus === 'local' || fetchStatus === 'local'
          ? 'local'
          : 'synced';

  const statusConfig = {
    synced: {
      icon: CloudCheck,
      label: copy.synced,
      helper: copy.syncedHelper,
      className: 'text-emerald-700 dark:text-emerald-400',
      surfaceClassName: 'bg-emerald-500/10',
    },
    syncing: {
      icon: RefreshCw,
      label: copy.syncing,
      helper: copy.syncingHelper,
      className: 'text-blue-600 dark:text-blue-400',
      surfaceClassName: 'bg-blue-500/10',
    },
    saving: {
      icon: Save,
      label: saveProgress?.label || copy.saving,
      helper: saveProgress?.detail || copy.savingHelper,
      className: 'text-amber-700 dark:text-amber-400',
      surfaceClassName: 'bg-amber-500/10',
    },
    error: {
      icon: CloudOff,
      label: copy.syncError,
      helper: copy.syncErrorHelper,
      className: 'text-red-600 dark:text-red-400',
      surfaceClassName: 'bg-red-500/10',
    },
    local: {
      icon: Save,
      label: copy.local,
      helper: copy.localHelper,
      className: 'text-amber-700 dark:text-amber-400',
      surfaceClassName: 'bg-amber-500/10',
    },
  }[activeStatus];

  const StatusIcon = statusConfig.icon;
  const totalQueue = reviewQueueCount + pendingCount;

  return (
    <aside
      data-desktop-rail="true"
      className="fixed z-40 hidden flex-col overflow-y-auto border-r border-border bg-surface p-3 lg:flex"
      aria-label={`${copy.navigation} Arkaiv`}
    >
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="shrink-0">
          <img
            src="/icon.svg"
            alt="Logo Arkaiv"
            className="h-10 w-10 rounded-[13px] bg-zinc-950 shadow-sm ring-1 ring-black/10 dark:ring-white/10"
          />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-bold tracking-[-0.025em] text-primary">Arkaiv</h1>
            <p className="truncate text-[10px] font-medium text-muted">Personal workspace</p>
        </div>
      </div>

      <p className="mb-1 mt-5 px-3 text-[11px] font-semibold text-muted">{copy.workspace}</p>

      <LayoutGroup id="desktop-primary-navigation">
        <nav className="space-y-1" aria-label={`${copy.navigation} desktop`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                data-desktop-nav-tab={item.id}
                data-active={isActive ? 'true' : 'false'}
                className={[
                  'group relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left',
                  'transition-[color,background-color,transform] duration-150 active:scale-[0.985]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65 focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
                  isActive
                    ? 'text-[#234123]'
                    : 'text-muted hover:bg-black/[0.035] hover:text-primary dark:hover:bg-white/[0.055]',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${item.label}. ${item.helper}`}
                title={item.helper}
              >
                {isActive && (
                  <ActiveIndicator
                    className="absolute inset-0 rounded-lg bg-brand-400"
                  />
                )}
                <span
                  data-nav-icon="true"
                  className={[
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-[color,background-color,transform] duration-150 group-active:scale-[0.94]',
                    isActive
                      ? 'text-[#234123]'
                      : 'text-muted group-hover:bg-black/[0.035] group-hover:text-primary dark:group-hover:bg-white/[0.055]',
                  ].join(' ')}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.35 : 2} />
                </span>
                <span className="relative z-10 min-w-0 flex-1 truncate text-sm font-semibold">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </LayoutGroup>

      {(activeTab === 'plan' || activeTab === 'library') && <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">{language === 'en' ? 'Sections' : 'Bagian'}</p>
        {(activeTab === 'plan'
          ? ([['tasks', 'Tasks', 'Tugas'], ['shopping', 'Shopping', 'Belanja'], ['savings', 'Goals & investments', 'Target & investasi'], ['loans', 'Loans', 'Pinjaman']] as const)
          : ([['general', 'Notes', 'Catatan'], ['skills', 'Skills', 'Skill'], ['journal', 'Journal', 'Jurnal']] as const)
        ).map(([id, en, ind]) => <button key={id} type="button" onClick={() => activeTab === 'plan' ? setPlanSubTab(id as PlanSubTab) : setLibrarySubTab(id as LibrarySubTab)} aria-current={(activeTab === 'plan' ? planSubTab : librarySubTab) === id ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs ${(activeTab === 'plan' ? planSubTab : librarySubTab) === id ? 'bg-accent/10 font-semibold text-accent' : 'text-muted hover:bg-surface-soft'}`}><span className="h-1 w-1 rounded-full bg-current" />{language === 'en' ? en : ind}</button>)}
      </div>}

      <div className="mt-auto space-y-2 pt-5">
        {error && (
          <div
            role="status"
            className="rounded-lg bg-red-500/[0.08] p-3 text-red-600 ring-1 ring-inset ring-red-500/15 dark:text-red-400"
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle className="h-4 w-4" />
              {copy.attention}
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed opacity-85">{error}</p>
          </div>
        )}

        <div className="border-t border-border/65 pt-3">
          <div
            className="flex min-h-11 items-center gap-3 rounded-lg px-2"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${statusConfig.surfaceClassName} ${statusConfig.className}`}>
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={activeStatus}
                  variants={popVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex"
                >
                  <StatusIcon
                    className={`h-[18px] w-[18px] ${activeStatus === 'syncing' ? 'animate-spin motion-reduce:animate-none' : ''}`}
                  />
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-primary">{statusConfig.label}</span>
              <span className="mt-0.5 block truncate text-[10px] text-muted">{statusConfig.helper}</span>
            </span>
          </div>

          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem] gap-1">
            <button
              type="button"
              onClick={onOpenReviewCenter}
              className="relative flex min-w-0 items-center gap-1 rounded-lg bg-surface-soft px-2 text-xs font-medium text-muted hover:bg-accent/10 hover:text-accent"
              title={copy.review}
              aria-label={`${copy.openReview}${totalQueue ? `, ${totalQueue}` : ''}`}
            >
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">{language === 'en' ? 'Review' : 'Tinjau'}</span>
              <CountBadge
                count={totalQueue}
                ariaLabel={`${totalQueue} item perlu diperiksa`}
                className="absolute right-2 top-1/2 min-w-[17px] -translate-y-1/2 rounded-full bg-accent px-1 text-center text-[9px] font-bold leading-[17px] text-white"
              />
            </button>
            <button
              type="button"
              onClick={onRefreshClick}
              className="flex items-center justify-center rounded-lg bg-surface-soft text-muted hover:text-primary"
              title={copy.refresh}
              aria-label={copy.refresh}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onSyncClick}
              className="flex items-center justify-center rounded-lg bg-surface-soft text-muted hover:text-primary"
              title={copy.syncNow}
              aria-label={copy.syncNow}
            >
              <Save className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onSettingsClick}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-[color,background-color,transform] duration-150 hover:bg-black/[0.035] hover:text-primary active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65 dark:hover:bg-white/[0.055]"
          aria-label={copy.openSettings}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.035] dark:bg-white/[0.055]">
            <Settings className="h-4 w-4" />
          </span>
          {copy.settings}
        </button>
      </div>
    </aside>
  );
};

export default DesktopNavRail;
