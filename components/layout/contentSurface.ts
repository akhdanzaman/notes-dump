export const TABLET_BASELINE = {
  minWidth: 640,
  maxWidth: 1023,
  desktopBreakpointClass: 'lg',
  shellModel: 'bottom-stack-first',
  modalCenteringClass: 'sm:items-center',
  masonryColumnsClass: 'sm:columns-2',
} as const;

const tabletMasonryGridClass = 'columns-1 sm:columns-2 gap-4';

export const contentSurface = {
  pageStack: 'space-y-6',
  // NDZ-012: desktop pages reserve enough scroll room for the wider fixed composer/chat stack and bottom actions.
  pageShell: 'pb-20 min-h-[50vh] overflow-hidden lg:pb-52',
  headerHero: 'bg-surface text-primary rounded-b-[32px] p-6 pt-12 mb-4 touch-pan-y lg:mt-6 lg:rounded-[32px] lg:border lg:border-border lg:p-7 lg:shadow-sm',
  invertedHeaderHero: 'bg-white dark:bg-zinc-100 text-black rounded-b-[32px] p-6 pt-12 shadow-sm mb-4 touch-pan-y lg:mt-6 lg:rounded-[32px] lg:border lg:border-border lg:p-7',
  // NDZ-007 #1: keep mobile gutters, but let desktop content align to the shared shell edge.
  contentPad: 'px-4 lg:px-0',
  // NDZ-017: Summary owns the wider desktop dashboard rhythm; keep side context useful without starving the primary scan column.
  summaryDashboardGrid: 'px-4 space-y-8 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_23rem] 2xl:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-6 xl:gap-8 lg:space-y-0 lg:px-0',
  primaryColumn: 'lg:col-start-1',
  sideColumn: 'lg:col-start-2',
  sideStack: 'space-y-5 lg:space-y-6',
  // NDZ-007 #4: shared split panes get stronger desktop minimums once the shell widens.
  splitGrid: 'space-y-8 lg:grid lg:grid-cols-[repeat(2,minmax(18rem,1fr))] xl:grid-cols-[repeat(3,minmax(18rem,1fr))] lg:items-start lg:gap-6 lg:space-y-0',
  workflowGrid: 'space-y-6 lg:grid lg:grid-cols-[repeat(2,minmax(20rem,1fr))] xl:grid-cols-[minmax(21rem,1.15fr)_repeat(2,minmax(19rem,1fr))] lg:items-start lg:gap-5 xl:gap-6 lg:space-y-0',
  // NDZ-018: Plan/Focus task editing gets a true workspace grid; keep passive list density separate from edit-card comfort.
  taskWorkspaceGrid: 'space-y-6 lg:grid lg:grid-cols-[repeat(2,minmax(22rem,1fr))] min-[1440px]:grid-cols-[minmax(23rem,1.2fr)_repeat(2,minmax(21rem,1fr))] 2xl:grid-cols-[minmax(24rem,1.2fr)_repeat(2,minmax(22rem,1fr))] lg:items-start lg:gap-6 2xl:gap-7 lg:space-y-0',
  // NDZ-019: Money uses the workspace shell with a fixed context rail so the finance scan column can grow without becoming spreadsheet full-bleed.
  moneyHeaderGrid: 'space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_25rem] lg:items-stretch lg:gap-5 xl:gap-6 lg:space-y-0',
  moneyMetricGrid: 'grid grid-cols-3 gap-2 lg:gap-3 xl:gap-4',
  moneyWorkspaceGrid: 'space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-6 xl:gap-8 lg:space-y-0',
  moneyPrimaryPanel: 'lg:rounded-[28px] lg:border lg:border-border/70 lg:bg-surface/35 lg:p-4 lg:shadow-sm xl:p-5',
  moneySideCard: 'hidden lg:block lg:sticky lg:top-6 rounded-[28px] border border-border bg-surface/70 p-4 text-sm text-muted shadow-sm xl:p-5',
  workflowPanel: 'rounded-[28px] border border-border/70 bg-surface/55 p-4 shadow-sm',
  desktopWorkflowPanel: 'lg:rounded-[28px] lg:border lg:border-border/70 lg:bg-surface/55 lg:p-4 lg:shadow-sm',
  detailSplitGrid: 'space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6 lg:space-y-0',
  cardGrid: 'space-y-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:space-y-0',
  // NDZ-016: tablet (640-1023px) is a locked baseline: two-column masonry, no desktop rail assumptions.
  tabletMasonryGrid: tabletMasonryGridClass,
  masonryGrid: `${tabletMasonryGridClass} lg:columns-3 2xl:columns-4`,
  denseList: 'space-y-3 lg:space-y-2',
  emptyStateCard: 'rounded-[32px] border border-dashed border-border bg-surface/60 p-6 text-center shadow-sm lg:p-8',
  desktopSettingsGrid: 'space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0',
  desktopSettingsWide: 'lg:col-span-2',
  card: 'bg-background border border-border rounded-2xl shadow-sm',
} as const;

export const taskEditSurface = {
  cardExpanded: 'lg:p-4 xl:p-5',
  textarea: 'lg:min-h-[104px] lg:p-4 xl:text-[15px]',
  fieldGrid: 'grid grid-cols-2 gap-3 mb-3 lg:gap-4',
  priorityButton: 'lg:py-3',
  progressPanel: 'lg:p-4',
  actions: 'flex flex-col-reverse gap-2 pt-3 border-t border-border/30 sm:flex-row sm:justify-end lg:gap-3',
  actionButton: 'lg:px-4 lg:py-2',
} as const;

export const responsiveModal = {
  overlay: 'fixed inset-0 bg-black/60 backdrop-blur-sm',
  // NDZ-016: sm is the tablet entry point; keep existing centered tablet modal behavior until a later task proves a change.
  sheetOverlay: 'fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm',
  panel: 'bg-surface border-border shadow-2xl',
  sheetPanel: 'bg-surface rounded-t-[32px] sm:rounded-[32px] w-full shadow-2xl overflow-hidden flex flex-col',
  // NDZ-007 #5: creation/edit forms widen on desktop while confirmations can stay narrow.
  formPanel: 'bg-surface rounded-t-[32px] sm:rounded-[32px] w-full max-w-md lg:max-w-2xl shadow-2xl overflow-hidden flex flex-col lg:border lg:border-border',
  denseFormPanel: 'bg-surface rounded-t-[32px] sm:rounded-[32px] w-full max-w-md lg:max-w-3xl shadow-2xl overflow-hidden flex flex-col lg:border lg:border-border',
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
