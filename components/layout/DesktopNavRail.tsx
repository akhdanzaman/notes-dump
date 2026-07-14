import React from 'react';
import { AlertTriangle, ClipboardCheck, CloudCheck, CloudOff, RefreshCw, Save, Settings } from 'lucide-react';
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
}) => {
  const navItems = getAppNavigationItems(planSubTab, librarySubTab);
  const activeStatus = saveStatus === 'saving' ? 'saving'
    : fetchStatus === 'syncing' ? 'syncing'
    : saveStatus === 'error' ? 'error'
    : fetchStatus === 'error' ? 'error'
    : saveStatus === 'local' ? 'local'
    : 'synced';

  const statusConfig = {
    synced: {
      icon: CloudCheck,
      label: 'Tersinkron',
      helper: 'Data lokal dan Google Sheets sudah sama',
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      onClick: onRefreshClick,
    },
    syncing: {
      icon: RefreshCw,
      label: 'Mengambil data',
      helper: 'Sinkronisasi sedang berjalan',
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      onClick: undefined,
    },
    saving: {
      icon: Save,
      label: saveProgress?.label || 'Menyimpan',
      helper: saveProgress?.detail || 'Menyimpan perubahan',
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      onClick: undefined,
    },
    error: {
      icon: CloudOff,
      label: 'Sinkronisasi gagal',
      helper: 'Klik untuk mencoba lagi',
      color: 'text-red-500 bg-red-500/10 border-red-500/20',
      onClick: onSyncClick,
    },
    local: {
      icon: Save,
      label: 'Tersimpan lokal',
      helper: 'Perubahan menunggu sinkronisasi',
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      onClick: onSyncClick,
    },
  }[activeStatus];

  const StatusIcon = statusConfig.icon;
  const syncActionLabel = activeStatus === 'error' ? 'Coba lagi' : activeStatus === 'local' ? 'Sinkronkan' : 'Sinkron manual';
  const queueTooltip = reviewQueueCount > 0 || pendingCount > 0
    ? `${reviewQueueCount} menunggu tinjauan · ${pendingCount} perubahan menunggu simpan`
    : 'Tidak ada review atau perubahan tertunda';
  const syncTooltip = `${statusConfig.label} — ${statusConfig.helper}`;

  const StatusSquare = ({
    label,
    description,
    icon,
    className,
    onClick,
  }: {
    label: string;
    description: string;
    icon: React.ReactNode;
    className: string;
    onClick?: () => void;
  }) => {
    const tooltip = `${label}: ${description}`;
    const content = (
      <>
        {icon}
        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded-xl border border-border bg-background/95 px-3 py-2 text-left text-xs leading-snug text-primary opacity-0 shadow-xl shadow-black/10 backdrop-blur-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="block font-bold">{label}</span>
          <span className="block text-muted">{description}</span>
        </span>
      </>
    );

    const baseClass = `group relative flex h-12 min-w-0 items-center justify-center rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${className}`;

    if (onClick) {
      return (
        <button type="button" onClick={onClick} title={tooltip} aria-label={tooltip} className={baseClass}>
          {content}
        </button>
      );
    }

    return (
      <div title={tooltip} aria-label={tooltip} className={baseClass}>
        {content}
      </div>
    );
  };

  return (
    <aside data-desktop-rail="true" className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-border bg-surface/75 px-4 py-5 backdrop-blur-2xl shadow-2xl shadow-black/5">
      <div className="flex items-center gap-3 px-2 pb-5">
        <img src="/icon.svg" alt="Arkaiv logo" className="h-12 w-12 rounded-2xl bg-zinc-950 ring-1 ring-indigo-500/20" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Ngarsip Harian</div>
          <h1 className="text-xl font-black tracking-tight text-primary">Arkaiv</h1>
        </div>
      </div>

      <div className="mb-4 rounded-3xl border border-border bg-background/60 p-2">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-muted">Workspace</div>
        <nav className="space-y-1" aria-label="Primary desktop navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                }}
                className={[
                  'group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200',
                  isActive
                    ? 'bg-primary text-background shadow-lg shadow-black/5 dark:bg-white dark:text-zinc-950'
                    : 'text-muted hover:bg-surface hover:text-primary',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isActive ? 'bg-background/15' : 'bg-surface text-muted group-hover:text-primary',
                ].join(' ')}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight">{item.label}</span>
                  <span className={[
                    'block truncate text-xs leading-tight',
                    isActive ? 'text-background/70 dark:text-zinc-950/60' : 'text-muted/80',
                  ].join(' ')}>{item.helper}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto space-y-3">
        <section className="rounded-3xl border border-border bg-background/70 p-2 shadow-sm" aria-label="Desktop status shortcuts">
          {error && (
            <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-500">
              <div className="mb-1 flex items-center gap-2 text-sm font-bold">
                <AlertTriangle className="h-4 w-4" />
                Sinkronisasi perlu perhatian
              </div>
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            <StatusSquare
              label="Sync"
              description={syncTooltip}
              onClick={statusConfig.onClick}
              className={statusConfig.color}
              icon={<StatusIcon className={`h-5 w-5 shrink-0 ${activeStatus === 'saving' || activeStatus === 'syncing' ? 'animate-spin' : ''}`} />}
            />

            <StatusSquare
              label="Review & proses"
              description={queueTooltip}
              onClick={onOpenReviewCenter}
              className="border-indigo-500/20 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/15"
              icon={(
                <span className="relative flex h-6 w-6 items-center justify-center">
                  <ClipboardCheck className={`h-5 w-5 ${reviewQueueCount > 0 ? 'animate-pulse' : ''}`} />
                  {reviewQueueCount > 0 && (
                    <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-indigo-500 px-1 text-center text-[10px] font-black leading-4 text-white">
                      {reviewQueueCount > 9 ? '9+' : reviewQueueCount}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <RefreshCw className="absolute -bottom-2 -right-2 h-3.5 w-3.5 animate-spin rounded-full bg-background text-blue-500" />
                  )}
                </span>
              )}
            />

            <StatusSquare
              label="Muat ulang"
              description="Ambil data terbaru dari Google Sheets"
              onClick={onRefreshClick}
              className="border-border bg-surface/80 text-primary hover:bg-background"
              icon={<RefreshCw className="h-5 w-5" />}
            />

            <StatusSquare
              label={syncActionLabel}
              description={activeStatus === 'error' ? 'Ulangi sinkronisasi yang gagal' : activeStatus === 'local' ? 'Kirim perubahan lokal ke Google Sheets' : 'Jalankan sinkronisasi manual'}
              onClick={onSyncClick}
              className="border-border bg-surface/80 text-primary hover:bg-background"
              icon={<Save className="h-5 w-5" />}
            />
          </div>
        </section>

        <button
          type="button"
          onClick={onSettingsClick}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-muted/10"
        >
          Pengaturan
          <Settings className="h-5 w-5 text-muted" />
        </button>
      </div>
    </aside>
  );
};

export default DesktopNavRail;
