import React from 'react';
import { AlertTriangle, Brain, CloudCheck, CloudOff, RefreshCw, Save, Settings } from 'lucide-react';
import { LibrarySubTab, PlanSubTab, SyncStatus, Tab } from '../../types';
import { getAppNavigationItems } from '../navigationItems';

interface DesktopNavRailProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  planSubTab: PlanSubTab;
  setPlanSubTab: (tab: PlanSubTab) => void;
  librarySubTab: LibrarySubTab;
  setLibrarySubTab: (tab: LibrarySubTab) => void;
  pendingCount: number;
  saveStatus: SyncStatus;
  fetchStatus: SyncStatus;
  onSyncClick: () => void;
  onRefreshClick: () => void;
  onSettingsClick: () => void;
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
  saveStatus,
  fetchStatus,
  onSyncClick,
  onRefreshClick,
  onSettingsClick,
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
      label: 'Saved',
      helper: 'Click to refresh from Sheets',
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      onClick: onRefreshClick,
    },
    syncing: {
      icon: RefreshCw,
      label: 'Fetching...',
      helper: 'Sync in progress',
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      onClick: undefined,
    },
    saving: {
      icon: Save,
      label: 'Saving...',
      helper: 'Writing changes',
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      onClick: undefined,
    },
    error: {
      icon: CloudOff,
      label: 'Sync failed',
      helper: 'Click to retry',
      color: 'text-red-500 bg-red-500/10 border-red-500/20',
      onClick: onSyncClick,
    },
    local: {
      icon: Save,
      label: 'Local changes',
      helper: 'Click to sync',
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      onClick: onSyncClick,
    },
  }[activeStatus];

  const StatusIcon = statusConfig.icon;

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-border bg-surface/75 px-4 py-5 backdrop-blur-2xl shadow-2xl shadow-black/5">
      <div className="flex items-center gap-3 px-2 pb-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-500 ring-1 ring-indigo-500/20">
          <Brain className="h-6 w-6" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">My Assistant</div>
          <h1 className="text-xl font-black tracking-tight text-primary">BrainDump <span className="text-indigo-500">AI</span></h1>
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
                key={`${item.id}-${item.subTab || 'main'}`}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.subTab) {
                    if (item.id === 'plan') setPlanSubTab(item.subTab as PlanSubTab);
                    if (item.id === 'library') setLibrarySubTab(item.subTab as LibrarySubTab);
                  }
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
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" />
              Needs attention
            </div>
            <p className="line-clamp-3 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {pendingCount > 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Processing {pendingCount} item{pendingCount === 1 ? '' : 's'}
          </div>
        )}

        <button
          type="button"
          onClick={statusConfig.onClick}
          disabled={!statusConfig.onClick}
          className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all disabled:cursor-default ${statusConfig.color}`}
        >
          <StatusIcon className={`h-5 w-5 shrink-0 ${activeStatus === 'saving' || activeStatus === 'syncing' ? 'animate-spin' : ''}`} />
          <span>
            <span className="block text-sm font-bold">{statusConfig.label}</span>
            <span className="block text-xs opacity-75">{statusConfig.helper}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onSettingsClick}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-muted/10"
        >
          Control Center
          <Settings className="h-5 w-5 text-muted" />
        </button>
      </div>
    </aside>
  );
};

export default DesktopNavRail;
