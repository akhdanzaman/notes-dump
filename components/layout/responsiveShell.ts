export const RESPONSIVE_SHELL = {
  desktopBreakpoint: 'lg',
  railWidth: '18rem',
  contentMaxWidth: '64rem',
} as const;

export const responsiveShellClass = {
  root: [
    'min-h-screen bg-background text-primary font-sans transition-colors duration-300 selection:bg-indigo-500/30',
    'lg:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_34rem),var(--background)]',
  ].join(' '),
  main: [
    'pt-0 pb-48 max-w-2xl mx-auto min-h-screen relative',
    'lg:ml-72 lg:mr-0 lg:max-w-none lg:px-8 lg:pb-40',
  ].join(' '),
  content: 'relative z-10 lg:max-w-5xl lg:mx-auto',
  fixedBottom: 'fixed bottom-0 left-0 w-full z-40 bg-transparent pointer-events-none lg:left-72 lg:w-[calc(100%-18rem)]',
  bottomNavWrap: 'pointer-events-auto lg:hidden',
} as const;
