export const RESPONSIVE_SHELL = {
  desktopBreakpoint: 'lg',
  railWidth: '18rem',
  contentMaxWidth: '80rem',
  contentStandardMaxWidth: '72rem',
  contentWideMaxWidth: '80rem',
} as const;

export const responsiveShellContentClass = {
  // NDZ-007 #1: rail-aware desktop origin with stepped caps instead of one centered 64rem island.
  standard: 'relative z-10 w-full lg:mr-auto lg:max-w-6xl 2xl:max-w-7xl',
  wide: 'relative z-10 w-full lg:mr-auto lg:max-w-7xl',
  workspace: 'relative z-10 w-full lg:max-w-none',
} as const;

export const responsiveShellComposerClass = {
  // NDZ-007 #2: fixed composer follows the rail-aware content gutter/origin on desktop.
  wrap: 'fixed bottom-0 left-0 w-full z-40 bg-transparent pointer-events-none lg:left-72 lg:w-[calc(100%-18rem)] lg:px-8',
  container: 'pointer-events-none flex flex-col items-center w-full lg:items-start lg:mx-0 lg:mr-auto lg:max-w-6xl 2xl:max-w-7xl',
} as const;

export const responsiveShellClass = {
  root: [
    'min-h-screen bg-background text-primary font-sans transition-colors duration-300 selection:bg-indigo-500/30',
    'lg:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_34rem),var(--background)]',
  ].join(' '),
  main: [
    'pt-0 pb-48 max-w-2xl mx-auto min-h-screen relative',
    'lg:ml-72 lg:mr-0 lg:max-w-none lg:px-8 lg:pb-56',
  ].join(' '),
  content: responsiveShellContentClass.standard,
  fixedBottom: responsiveShellComposerClass.wrap,
  fixedBottomContent: responsiveShellComposerClass.container,
  bottomNavWrap: 'pointer-events-auto lg:hidden',
} as const;
