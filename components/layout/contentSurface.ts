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
  pageStack: 'space-y-5 lg:space-y-6',
  // NDZ-012: desktop pages reserve enough scroll room for the wider fixed composer/chat stack and bottom actions.
  pageShell: 'pb-20 min-h-[50vh] overflow-hidden lg:pb-52',
  summaryPageShell: 'min-h-0 w-full min-w-0 max-w-full overflow-x-hidden overflow-y-visible pb-0',
  headerHero: 'mx-0 mt-3 mb-5 rounded-[28px] border border-border/80 bg-surface/88 p-5 pt-6 text-primary shadow-sm backdrop-blur-xl touch-pan-y sm:p-6 lg:mt-6 lg:rounded-[30px] lg:p-7',
  invertedHeaderHero: 'mx-0 mt-3 mb-5 rounded-[28px] border border-black/5 bg-white p-5 pt-6 text-black shadow-sm touch-pan-y sm:p-6 dark:bg-zinc-100 lg:mt-6 lg:rounded-[30px] lg:p-7',
  // NDZ-007 #1: keep mobile gutters, but let desktop content align to the shared shell edge.
  contentPad: 'px-1 sm:px-2 lg:px-0',
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
  emptyStateCard: 'rounded-[28px] border border-dashed border-border/90 bg-surface/65 p-6 text-center shadow-sm backdrop-blur-sm lg:p-8',
  libraryEmptyState: 'mx-auto max-w-3xl lg:mx-0 lg:max-w-4xl lg:text-left',
  libraryEmptyActions: 'mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start',
  calendarFrame: 'w-full overflow-hidden rounded-[28px] border border-border/80 bg-surface/70 shadow-sm',
  desktopSettingsGrid: 'space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0',
  desktopSettingsWide: 'lg:col-span-2',
  card: 'rounded-2xl border border-border/80 bg-surface/75 shadow-sm',
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
  overlay: 'fixed inset-0 bg-black/45 backdrop-blur-sm dark:bg-black/65',
  // NDZ-016: sm is the tablet entry point; keep existing centered tablet modal behavior until a later task proves a change.
  sheetOverlay: 'fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm dark:bg-black/65 sm:items-center sm:p-4',
  panel: 'bg-surface border-border shadow-2xl',
  sheetPanel: 'flex w-full flex-col overflow-hidden rounded-t-[28px] border border-border/80 bg-surface shadow-2xl sm:rounded-[28px]',
  // NDZ-007 #5: creation/edit forms widen on desktop while confirmations can stay narrow.
  formPanel: 'flex w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-border/80 bg-surface shadow-2xl sm:rounded-[28px] lg:max-w-2xl',
  denseFormPanel: 'flex w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-border/80 bg-surface shadow-2xl sm:rounded-[28px] lg:max-w-3xl',
  confirmPanel: 'w-full max-w-xs rounded-[24px] border border-border/80 bg-surface p-6 text-center shadow-2xl',
  destructiveConfirmPanel: 'w-full max-w-xs rounded-[24px] border border-red-500/30 bg-surface p-6 text-center shadow-2xl ring-1 ring-red-500/10',
  fieldGrid: 'space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0',
  footer: 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
} as const;

export const addItemModal = {
  panel: `${responsiveModal.denseFormPanel} max-h-[90vh]`,
  header: 'flex shrink-0 items-center justify-between border-b border-border/80 bg-surface px-5 py-4 sm:px-6',
  title: 'flex items-center gap-2 text-lg font-bold tracking-tight text-primary sm:text-xl',
  icon: 'w-5 h-5 text-indigo-500',
  closeButton: 'rounded-xl p-2 text-muted transition-colors hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]',
  body: 'space-y-5 overflow-y-auto p-5 sm:p-6',
  footer: 'shrink-0 border-t border-border/80 bg-surface p-5 sm:p-6',
  label: 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted',
  input: 'w-full rounded-xl border border-border bg-background/70 px-3.5 py-3 text-primary font-medium outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10',
  titleInput: 'w-full rounded-xl border border-border bg-background/70 px-3.5 py-3 text-lg font-bold text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10',
  textarea: 'min-h-[150px] w-full resize-none rounded-xl border border-border bg-background/70 px-3.5 py-3 font-medium text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10',
  select: 'w-full appearance-none rounded-xl border border-border bg-background/70 px-3.5 py-3 font-medium text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10',
  smallInput: 'w-full rounded-xl border border-border bg-background/70 p-3 text-sm text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10',
  readonlyField: 'flex w-full items-center gap-2 rounded-xl border border-border bg-background/70 p-4 font-medium text-muted',
  tabGroup: 'flex gap-2 rounded-xl border border-border/70 bg-background/55 p-1',
  tabButton: (active: boolean) => `flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-colors ${active ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-primary'}`,
  choiceButton: (active: boolean, activeClass = 'bg-indigo-600 border-indigo-500 text-white shadow-md', inactiveClass = 'bg-background border-border text-muted hover:border-indigo-500') => `${active ? activeClass : inactiveClass}`,
  sectionPanel: 'mt-4 space-y-4 rounded-xl border border-border/80 bg-background/45 p-4',
  accentSectionPanel: 'mt-4 space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4',
  accentPanel: 'space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4',
  sectionTitle: 'flex items-center gap-2 text-sm font-bold text-muted mb-3 uppercase tracking-wider',
  accentSectionTitle: 'flex items-center gap-2 text-sm font-bold text-emerald-500 mb-3 uppercase tracking-wider',
  helpText: 'text-xs text-muted mt-2',
  checkbox: 'w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500',
  primaryButton: 'flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-base font-bold text-white shadow-sm shadow-indigo-500/20 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
} as const;

export const addItemModalMotion = {
  // Avoid vertical translate on add-item sheets: mobile keyboards resize/push the visual viewport
  // at the same time autofocus opens, so a sheet y-animation creates a visible double bounce.
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.16, ease: 'easeOut' },
} as const;

export const controlCenterSurface = {
  panel: [
    'fixed bottom-0 left-0 right-0 z-[70] mx-auto flex h-[88vh] max-w-2xl flex-col rounded-t-[28px] border border-b-0 border-border/80 bg-surface/96 shadow-2xl backdrop-blur-2xl',
    'lg:bottom-6 lg:left-[19.5rem] lg:right-6 lg:top-6 lg:mx-0 lg:h-auto lg:max-w-none lg:rounded-[30px] lg:border lg:border-border/80 lg:bg-surface/94',
  ].join(' '),
  header: 'shrink-0 px-5 pb-3 pt-4 sm:px-6 lg:border-b lg:border-border/70 lg:px-8 lg:pb-5 lg:pt-7',
  handle: 'mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong/70 lg:hidden',
  contentWrap: 'relative flex-1 overflow-y-auto px-5 pb-6 pt-2 sm:px-6 lg:p-8 lg:pt-6',
  desktopWorkspace: 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-7',
  desktopSidebar: 'hidden space-y-2 lg:sticky lg:top-0 lg:block',
  desktopNavButton: 'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
  contentPane: 'w-full lg:min-w-0',
} as const;
