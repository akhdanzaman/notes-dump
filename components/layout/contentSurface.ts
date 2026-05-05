export const contentSurface = {
  pageStack: 'space-y-6',
  pageShell: 'pb-20 min-h-[50vh] overflow-hidden lg:pb-32',
  headerHero: 'bg-surface text-primary rounded-b-[32px] p-6 pt-12 mb-4 touch-pan-y lg:mt-6 lg:rounded-[32px] lg:border lg:border-border lg:p-7 lg:shadow-sm',
  invertedHeaderHero: 'bg-white dark:bg-zinc-100 text-black rounded-b-[32px] p-6 pt-12 shadow-sm mb-4 touch-pan-y lg:mt-6 lg:rounded-[32px] lg:border lg:border-border lg:p-7',
  contentPad: 'px-4 lg:px-6',
  dashboardGrid: 'px-4 space-y-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6 lg:space-y-0 lg:px-6',
  primaryColumn: 'lg:col-start-1',
  sideColumn: 'lg:col-start-2',
  splitGrid: 'space-y-8 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:items-start lg:gap-6 lg:space-y-0',
  detailSplitGrid: 'space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6 lg:space-y-0',
  cardGrid: 'space-y-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:space-y-0',
  masonryGrid: 'columns-1 sm:columns-2 lg:columns-3 2xl:columns-4 gap-4',
  denseList: 'space-y-3 lg:space-y-2',
  desktopSettingsGrid: 'space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0',
  desktopSettingsWide: 'lg:col-span-2',
  card: 'bg-background border border-border rounded-2xl shadow-sm',
} as const;

export const responsiveModal = {
  overlay: 'fixed inset-0 bg-black/60 backdrop-blur-sm',
  sheetOverlay: 'fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm',
  panel: 'bg-surface border-border shadow-2xl',
  sheetPanel: 'bg-surface rounded-t-[32px] sm:rounded-[32px] w-full shadow-2xl overflow-hidden flex flex-col',
  fieldGrid: 'space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0',
  footer: 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
} as const;

export const controlCenterSurface = {
  panel: [
    'fixed bottom-0 left-0 right-0 bg-surface border-t border-border rounded-t-3xl z-[70] shadow-2xl max-w-2xl mx-auto flex flex-col h-[85vh]',
    'lg:left-72 lg:right-8 lg:top-8 lg:bottom-8 lg:mx-0 lg:h-auto lg:max-w-none lg:rounded-[2rem] lg:border lg:border-border lg:bg-surface/95 lg:backdrop-blur-2xl',
  ].join(' '),
  header: 'p-6 pb-2 shrink-0 lg:px-8 lg:pt-7 lg:pb-4 lg:border-b lg:border-border/70',
  handle: 'w-12 h-1.5 bg-border rounded-full mx-auto mb-6 opacity-50 lg:hidden',
  contentWrap: 'overflow-y-auto p-6 pt-2 flex-1 relative lg:p-8 lg:pt-6',
  desktopWorkspace: 'lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-8',
  desktopSidebar: 'hidden lg:block lg:sticky lg:top-0 space-y-4',
  desktopNavButton: 'w-full flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all',
  contentPane: 'w-full lg:min-w-0',
} as const;
