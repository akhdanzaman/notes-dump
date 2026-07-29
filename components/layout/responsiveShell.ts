import { LibrarySubTab, MoneyView, PlanSubTab, Tab } from "../../types";

export const RESPONSIVE_SHELL = {
  desktopBreakpoint: "lg",
  tabletMinWidth: "48rem",
  tabletMaxWidth: "63.9375rem",
  railWidth: "18rem",
} as const;

const railWidthCssVar = "[--rail-width:18rem]";

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
    "lg:left-[var(--rail-width)] lg:right-0 lg:w-[calc(100vw-var(--rail-width))]",
    "lg:px-6 xl:px-8 2xl:px-10",
  ].join(" "),
  container: responsiveShellComposerContentClass.standard,
} as const;

export const responsiveShellClass = {
  root: [
    railWidthCssVar,
    "min-h-screen w-full min-w-0 max-w-none overflow-x-hidden",
    "bg-transparent text-primary font-sans transition-colors duration-300 selection:bg-indigo-500/30",
  ].join(" "),

  main: [
    "relative min-h-screen w-full min-w-0 max-w-none overflow-x-hidden",
    "pb-[calc(12rem+env(safe-area-inset-bottom))] [scroll-padding-bottom:calc(12rem+env(safe-area-inset-bottom))]",
    "[padding-top:env(safe-area-inset-top)] lg:[padding-top:0]",
    "px-3 sm:px-5 md:px-8",
    "lg:ml-72 lg:ml-[var(--rail-width)] lg:w-[calc(100vw-var(--rail-width))] lg:px-7 lg:pb-56 lg:[scroll-padding-bottom:14rem]",
    "xl:px-9 2xl:px-12",
  ].join(" "),

  content: responsiveShellContentClass.standard,

  fixedBottom: responsiveShellComposerClass.wrap,
  fixedBottomContent: responsiveShellComposerClass.container,

  bottomNavWrap: "pointer-events-auto shrink-0 lg:hidden",
} as const;
