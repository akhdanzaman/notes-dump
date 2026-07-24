import React from 'react';
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
        : saveStatus === 'local'
          ? 'local'
          : 'synced';

  const statusConfig = {
    synced: {
      icon: CloudCheck,
      label: 'Semua tersimpan',
      helper: 'Data lokal dan cloud sinkron',
      className: 'text-emerald-600 dark:text-emerald-400',
    },
    syncing: {
      icon: RefreshCw,
      label: 'Mengambil data',
      helper: 'Memuat pembaruan terbaru',
      className: 'text-blue-600 dark:text-blue-400',
    },
    saving: {
      icon: Save,
      label: saveProgress?.label || 'Menyimpan perubahan',
      helper: saveProgress?.detail || 'Perubahan sedang diproses',
      className: 'text-amber-600 dark:text-amber-400',
    },
    error: {
      icon: CloudOff,
      label: 'Sinkronisasi gagal',
      helper: 'Buka tindakan untuk mencoba lagi',
      className: 'text-red-600 dark:text-red-400',
    },
    local: {
      icon: Save,
      label: 'Tersimpan lokal',
      helper: 'Menunggu sinkronisasi cloud',
      className: 'text-amber-600 dark:text-amber-400',
    },
  }[activeStatus];

  const StatusIcon = statusConfig.icon;
  const totalQueue = reviewQueueCount + pendingCount;

  return (
    <aside
      data-desktop-rail="true"
      className="fixed inset-y-0 left-0 z-50 hidden w-72 flex-col border-r border-border/80 bg-surface/88 px-4 py-4 backdrop-blur-2xl lg:flex"
    >
      <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
        <div className="relative">
          <img
            src="/icon.svg"
            alt="Logo Arkaiv"
            className="h-11 w-11 rounded-[14px] bg-zinc-950 shadow-sm ring-1 ring-black/10 dark:ring-white/10"
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-surface bg-emerald-500" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold tracking-[-0.02em] text-primary">Arkaiv</h1>
          <p className="truncate text-xs font-medium text-muted">Personal workspace</p>
        </div>
      </div>

      <div className="mt-5 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted/80">
        Navigasi
      </div>

      <nav className="mt-2 space-y-1" aria-label="Navigasi utama desktop">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={[
                'group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left',
                'transition-colors duration-200',
                isActive
                  ? 'bg-indigo-500/10 text-primary ring-1 ring-inset ring-indigo-500/15'
                  : 'text-muted hover:bg-black/[0.035] hover:text-primary dark:hover:bg-white/[0.055]',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && <span className="absolute left-0 h-7 w-1 rounded-r-full bg-indigo-500" />}
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isActive
                    ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-black/[0.035] text-muted group-hover:text-primary dark:bg-white/[0.055]',
                ].join(' ')}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.35 : 2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted">
                  {item.helper}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2.5">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-3 text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertTriangle className="h-4 w-4" />
              Perlu perhatian
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed opacity-85">{error}</p>
          </div>
        )}

        <div className="rounded-2xl border border-border/80 bg-background/55 p-2.5">
          <div className="flex items-center gap-3 px-1 py-1">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface ${statusConfig.className}`}>
              <StatusIcon className={`h-[18px] w-[18px] ${activeStatus === 'syncing' ? 'animate-spin' : activeStatus === 'saving' ? 'animate-pulse' : ''}`} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-primary">{statusConfig.label}</span>
              <span className="block truncate text-[10px] text-muted">{statusConfig.helper}</span>
            </span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={onOpenReviewCenter}
              className="relative flex h-9 items-center justify-center rounded-xl border border-border/70 bg-surface text-muted transition-colors hover:border-indigo-500/30 hover:text-indigo-500"
              title="Review dan proses"
              aria-label="Buka review dan proses"
            >
              <ClipboardCheck className="h-4 w-4" />
              {totalQueue > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-indigo-500 px-1 text-center text-[9px] font-bold leading-[17px] text-white">
                  {totalQueue > 9 ? '9+' : totalQueue}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onRefreshClick}
              className="flex h-9 items-center justify-center rounded-xl border border-border/70 bg-surface text-muted transition-colors hover:border-blue-500/30 hover:text-blue-500"
              title="Muat data terbaru"
              aria-label="Muat data terbaru"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onSyncClick}
              className="flex h-9 items-center justify-center rounded-xl border border-border/70 bg-surface text-muted transition-colors hover:border-emerald-500/30 hover:text-emerald-500"
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
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-black/[0.035] hover:text-primary dark:hover:bg-white/[0.055]"
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
