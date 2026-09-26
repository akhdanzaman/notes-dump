import { LibrarySubTab, MoneyView, PlanSubTab, Tab } from "../../types";

export const RESPONSIVE_SHELL = {
  desktopBreakpoint: "lg",
  tabletMinWidth: "48rem",
  tabletMaxWidth: "63.9375rem",
  railWidth: "14rem",
} as const;

const railWidthCssVar = "[--rail-width:14rem]";

const fullWidthSurface = "relative z-10 w-full min-w-0 max-w-none mx-0";

const fullWidthComposerSurface =
  "pointer-events-none relative flex w-full min-w-0 max-w-none flex-col items-center lg:items-stretch lg:mx-0";

export const responsiveShellContentClass = {
  standard: fullWidthSurface,
  wide: fullWidthSurface,
  workspace: fullWidthSurface,
} as const;

export type ResponsiveShellContentVariant =
  keyof typeof responsiveShellContentClass;

interface ResponsiveShellSurfaceArgs {
  activeTab: Tab;
  planSubTab: PlanSubTab;
  librarySubTab: LibrarySubTab;
  moneyView: MoneyView;
}

export const getResponsiveShellContentVariant = ({
  activeTab,
  planSubTab,
  librarySubTab,
  moneyView,
}: ResponsiveShellSurfaceArgs): ResponsiveShellContentVariant => {
  void planSubTab;
  void librarySubTab;
  void moneyView;

  if (
    activeTab === "summary" ||
    activeTab === "plan" ||
    activeTab === "library" ||
    activeTab === "money" ||
    activeTab === "calendar"
  ) {
    return "workspace";
  }

  return "standard";
};

export const responsiveShellComposerContentClass = {
  standard: fullWidthComposerSurface,
  wide: fullWidthComposerSurface,
  workspace: fullWidthComposerSurface,
} as const;

export const responsiveShellComposerClass = {
  wrap: [
    "fixed inset-x-0 bottom-0 z-40 w-full bg-transparent pointer-events-none",
    "md:px-3",
    "desktop-capture lg:left-auto lg:right-[calc(var(--frame-inset)+1rem)] lg:bottom-6 lg:w-[min(42rem,calc(100vw-18rem))] lg:px-0",
  ].join(" "),
  container: responsiveShellComposerContentClass.standard,
} as const;

export const responsiveShellClass = {
  root: [
    railWidthCssVar,
    "app-frame min-h-screen w-full min-w-0 overflow-x-clip lg:h-[calc(100dvh-32px)] lg:min-h-0 lg:overflow-hidden",
    "bg-background text-primary font-sans transition-colors duration-150 selection:bg-brand-400/30",
  ].join(" "),

  main: [
    "relative min-h-screen w-full min-w-0 max-w-none lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain",
    "pb-[calc(var(--composer-inset,12rem)+1rem)] [scroll-padding-bottom:calc(var(--composer-inset,12rem)+1rem)]",
    "[padding-top:env(safe-area-inset-top)] lg:[padding-top:0]",
    "px-3 sm:px-5 md:px-6",
    "lg:ml-[var(--rail-width)] lg:w-[calc(100%-var(--rail-width))] lg:px-6 lg:pb-8 lg:[scroll-padding-bottom:2rem]",
  ].join(" "),

  content: responsiveShellContentClass.standard,

  fixedBottom: responsiveShellComposerClass.wrap,
  fixedBottomContent: responsiveShellComposerClass.container,

  bottomNavWrap: "pointer-events-auto shrink-0 lg:hidden",
} as const;
