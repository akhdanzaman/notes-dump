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
import { LibrarySubTab, PlanSubTab, SyncProgress, SyncStatus, Tab } from '../../types';
import { getAppNavigationItems } from '../navigationItems';
import ActiveIndicator from '../../motion/ActiveIndicator';
import { popVariants } from '../../motion/variants';
import CountBadge from '../../motion/CountBadge';

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
}

const DesktopNavRail: React.FC<DesktopNavRailProps> = ({
  activeTab,
  setActiveTab,
  planSubTab,
  librarySubTab,
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
}) => {
  const navItems = getAppNavigationItems(planSubTab, librarySubTab);
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
      label: 'Tersinkron',
      helper: 'Semua perubahan tersimpan',
      className: 'text-emerald-700 dark:text-emerald-400',
      surfaceClassName: 'bg-emerald-500/10',
    },
    syncing: {
      icon: RefreshCw,
      label: 'Memuat pembaruan',
      helper: 'Memuat pembaruan terbaru',
      className: 'text-blue-600 dark:text-blue-400',
      surfaceClassName: 'bg-blue-500/10',
    },
    saving: {
      icon: Save,
      label: saveProgress?.label || 'Menyimpan perubahan',
      helper: saveProgress?.detail || 'Perubahan sedang diproses',
      className: 'text-amber-700 dark:text-amber-400',
      surfaceClassName: 'bg-amber-500/10',
    },
    error: {
      icon: CloudOff,
      label: 'Sinkronisasi gagal',
      helper: 'Coba muat atau sinkronkan lagi',
      className: 'text-red-600 dark:text-red-400',
      surfaceClassName: 'bg-red-500/10',
    },
    local: {
      icon: Save,
      label: 'Disimpan di perangkat',
      helper: 'Sinkronkan saat Anda siap',
      className: 'text-amber-700 dark:text-amber-400',
      surfaceClassName: 'bg-amber-500/10',
    },
  }[activeStatus];

  const StatusIcon = statusConfig.icon;
  const totalQueue = reviewQueueCount + pendingCount;

  return (
    <aside
      data-desktop-rail="true"
      className="fixed inset-y-0 left-0 z-50 hidden w-72 flex-col overflow-y-auto border-r border-border/70 bg-surface/86 p-3 backdrop-blur-xl lg:flex"
      aria-label="Navigasi dan status Arkaiv"
    >
      <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
        <div className="shrink-0">
          <img
            src="/icon.svg"
            alt="Logo Arkaiv"
            className="h-10 w-10 rounded-[13px] bg-zinc-950 shadow-sm ring-1 ring-black/10 dark:ring-white/10"
          />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-bold tracking-[-0.025em] text-primary">Arkaiv</h1>
          <p className="truncate text-[11px] font-medium text-muted">Ruang finansial personal</p>
        </div>
      </div>

      <p className="mb-1 mt-5 px-3 text-[11px] font-semibold text-muted">Workspace</p>

      <LayoutGroup id="desktop-primary-navigation">
        <nav className="space-y-1" aria-label="Navigasi utama desktop">
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
                  'group relative flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left',
                  'transition-[color,background-color,transform] duration-150 active:scale-[0.985]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65 focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
                  isActive
                    ? 'text-accent'
                    : 'text-muted hover:bg-black/[0.035] hover:text-primary dark:hover:bg-white/[0.055]',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${item.label}. ${item.helper}`}
                title={item.helper}
              >
                {isActive && (
                  <ActiveIndicator
                    className="absolute inset-0 rounded-2xl bg-accent/10 ring-1 ring-inset ring-accent/15 before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-accent before:content-['']"
                  />
                )}
                <span
                  data-nav-icon="true"
                  className={[
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-[color,background-color,transform] duration-150 group-active:scale-[0.94]',
                    isActive
                      ? 'bg-accent/12 text-accent'
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

      <div className="mt-auto space-y-2 pt-5">
        {error && (
          <div
            role="status"
            className="rounded-2xl bg-red-500/[0.08] p-3 text-red-600 ring-1 ring-inset ring-red-500/15 dark:text-red-400"
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Perlu perhatian
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed opacity-85">{error}</p>
          </div>
        )}

        <div className="border-t border-border/65 pt-3">
          <div
            className="flex min-h-11 items-center gap-3 rounded-2xl px-2"
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

          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem] gap-1.5">
            <button
              type="button"
              onClick={onOpenReviewCenter}
              className="relative flex h-11 min-w-0 items-center gap-2 rounded-xl bg-surface-soft px-3 pr-8 text-xs font-semibold text-muted transition-[color,background-color,transform] duration-150 hover:bg-accent/10 hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65"
              title="Review dan proses"
              aria-label={`Buka review dan proses${totalQueue ? `, ${totalQueue} item perlu diperiksa` : ''}`}
            >
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">Review</span>
              <CountBadge
                count={totalQueue}
                ariaLabel={`${totalQueue} item perlu diperiksa`}
                className="absolute right-2 top-1/2 min-w-[17px] -translate-y-1/2 rounded-full bg-accent px-1 text-center text-[9px] font-bold leading-[17px] text-white"
              />
            </button>
            <button
              type="button"
              onClick={onRefreshClick}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-soft text-muted transition-[color,background-color,transform] duration-150 hover:bg-blue-500/10 hover:text-blue-600 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65 dark:hover:text-blue-400"
              title="Muat data terbaru"
              aria-label="Muat data terbaru"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onSyncClick}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-soft text-muted transition-[color,background-color,transform] duration-150 hover:bg-emerald-500/10 hover:text-emerald-700 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65 dark:hover:text-emerald-400"
              title="Sinkronkan sekarang"
              aria-label="Sinkronkan sekarang"
            >
              <Save className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onSettingsClick}
          className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold text-muted transition-[color,background-color,transform] duration-150 hover:bg-black/[0.035] hover:text-primary active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65 dark:hover:bg-white/[0.055]"
          aria-label="Buka pengaturan"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.035] dark:bg-white/[0.055]">
            <Settings className="h-4 w-4" />
          </span>
          Pengaturan
        </button>
      </div>
    </aside>
  );
};

export default DesktopNavRail;
