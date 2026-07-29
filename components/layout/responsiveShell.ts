import { LibrarySubTab, MoneyView, PlanSubTab, Tab } from "../../types";

export const RESPONSIVE_SHELL = {
  desktopBreakpoint: "lg",
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
    "lg:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_34rem),var(--background)]",
  ].join(" "),

  main: [
    "relative min-h-screen w-full min-w-0 max-w-none overflow-x-hidden",
    "pb-48 [padding-top:env(safe-area-inset-top)] lg:[padding-top:0]",
    "px-3 sm:px-4 md:px-5",
    "lg:ml-[var(--rail-width)] lg:w-[calc(100vw-var(--rail-width))] lg:px-7 lg:pb-56",
    "xl:px-9 2xl:px-12",
  ].join(" "),

  content: responsiveShellContentClass.standard,

  fixedBottom: responsiveShellComposerClass.wrap,
  fixedBottomContent: responsiveShellComposerClass.container,

  bottomNavWrap: "pointer-events-auto lg:hidden",
} as const;
