import { LibrarySubTab, MoneyView, PlanSubTab, Tab } from '../types';

export const FEATURE_TUTORIALS_STORAGE_KEY = 'braindump_seen_feature_tutorials_v1';
export const FEATURE_TUTORIALS_DISABLED_KEY = 'braindump_feature_tutorials_disabled';

export type FeatureTutorialKey =
  | 'summary'
  | 'plan.tasks'
  | 'plan.shopping'
  | 'plan.savings'
  | 'library.general'
  | 'library.skills'
  | 'library.journal'
  | 'money.transactions'
  | 'money.wallets'
  | 'money.budget'
  | 'money.savings'
  | 'calendar'
  | 'control-center';

export interface FeatureTutorial {
  key: FeatureTutorialKey;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
}

export const FEATURE_TUTORIALS: Record<FeatureTutorialKey, FeatureTutorial> = {
  summary: {
    key: 'summary',
    eyebrow: 'Overview',
    title: 'This is your command center',
    body: 'Summary is the quick read: what needs attention today, how money is moving, and what the app thinks is worth reviewing.',
    bullets: [
      'Use the cards as shortcuts into Plan, Library, and Money.',
      'Today-vs-yesterday finance highlights live here once transactions exist.',
      'Pending AI reviews surface here before they affect your data.',
    ],
  },
  'plan.tasks': {
    key: 'plan.tasks',
    eyebrow: 'Plan / Tasks',
    title: 'Turn loose tasks into executable work',
    body: 'Plan is for todos, routines, and deeper work that needs structure instead of just another checkbox.',
    bullets: [
      'Use Tasks for one-off actions and dated work.',
      'Routine tasks can repeat without duplicating your list manually.',
      'Deep Work suggestions help vague tasks become concrete steps when useful.',
    ],
  },
  'plan.shopping': {
    key: 'plan.shopping',
    eyebrow: 'Plan / Shopping',
    title: 'Separate buying intent from actual spending',
    body: 'Shopping keeps planned purchases visible before they become transactions, so your money view stays honest.',
    bullets: [
      'Classify items by urgency or routine need.',
      'Use it as a lightweight purchase backlog.',
      'Completed purchases can later be reflected in Money.',
    ],
  },
  'plan.savings': {
    key: 'plan.savings',
    eyebrow: 'Plan / Savings',
    title: 'Track goals before the money moves',
    body: 'Savings goals are planned commitments. They help distinguish reserved money from normal spending.',
    bullets: [
      'Add funds gradually toward a goal.',
      'Complete a goal when the reserved money is actually used.',
      'Keep goal progress separate from daily expense noise.',
    ],
  },
  'library.general': {
    key: 'library.general',
    eyebrow: 'Library / Notes',
    title: 'Your searchable memory, not a dumping ground',
    body: 'Library stores notes and references after the parser has cleaned them up enough to be useful later.',
    bullets: [
      'Search and tags help find old context fast.',
      'Use notes for durable information, not tasks or transactions.',
      'Filters are available from the floating search button.',
    ],
  },
  'library.skills': {
    key: 'library.skills',
    eyebrow: 'Library / Skills',
    title: 'Track practice and skill momentum',
    body: 'Skills help you log focused practice and compare it against weekly targets.',
    bullets: [
      'Create a skill with an optional weekly target.',
      'Log practice sessions from natural input.',
      'Use trends to see whether you are actually showing up.',
    ],
  },
  'library.journal': {
    key: 'library.journal',
    eyebrow: 'Library / Journal',
    title: 'A daily timeline for what happened',
    body: 'Journal groups notes, completed work, events, and transactions by day so reflection has context.',
    bullets: [
      'Write entries like “Journal: today I…” to append to the day.',
      'Daily sections can include life and money activity together.',
      'Use month navigation to review older periods.',
    ],
  },
  'money.transactions': {
    key: 'money.transactions',
    eyebrow: 'Money / Transactions',
    title: 'The ledger is the source of truth',
    body: 'Transactions drive wallet balances, category totals, and money highlights. Keep them accurate and the rest follows.',
    bullets: [
      'Use wallet IDs behind the scenes, so renamed wallets keep working.',
      'Transfers, income, savings, and expenses are treated differently.',
      'Filters help inspect specific wallets, categories, or periods.',
    ],
  },
  'money.wallets': {
    key: 'money.wallets',
    eyebrow: 'Money / Wallets',
    title: 'Wallet balances come from the ledger',
    body: 'Wallets define starting balances; transactions explain every movement after that.',
    bullets: [
      'Add bank, cash, e-wallet, or credit-card wallets.',
      'Balances update from done finance transactions.',
      'Edit wallet names safely without breaking old rows.',
    ],
  },
  'money.budget': {
    key: 'money.budget',
    eyebrow: 'Money / Budget',
    title: 'Budget is for decisions, not guilt',
    body: 'Budget rules translate income into categories so daily spending has a clear context.',
    bullets: [
      'Set monthly income and category percentages.',
      'Use categories to explain what drove totals.',
      'Stable recurring context stays quiet unless something changes.',
    ],
  },
  'money.savings': {
    key: 'money.savings',
    eyebrow: 'Money / Savings',
    title: 'Savings shows reserved progress',
    body: 'This view connects savings goals to actual wallet movement so goals stay grounded in cashflow.',
    bullets: [
      'Review goal funding without mixing it into normal spend.',
      'Complete goals when funds are released or used.',
      'Use it alongside Plan / Savings for intent vs reality.',
    ],
  },
  calendar: {
    key: 'calendar',
    eyebrow: 'Calendar',
    title: 'Your dated work in one place',
    body: 'Calendar collects tasks, routines, events, and time-aware items into a monthly view.',
    bullets: [
      'Swipe between main tabs from the header area.',
      'Completed recurring tasks are tracked per occurrence.',
      'Use it for date context, not as another inbox.',
    ],
  },
  'control-center': {
    key: 'control-center',
    eyebrow: 'Control Center',
    title: 'Settings, sync, and data controls live here',
    body: 'Control Center is where you tune behavior, connect Sheets, run sync, review data tools, and manage app-level settings.',
    bullets: [
      'Spreadsheet connection works without Google login when the service account has Editor access.',
      'Google login remains optional as a fallback.',
      'Danger-zone actions stay separated so they are harder to trigger accidentally.',
    ],
  },
};

export const getFeatureTutorialKey = (state: {
  activeTab: Tab;
  planSubTab: PlanSubTab;
  librarySubTab: LibrarySubTab;
  moneyView: MoneyView;
  isControlCenterOpen: boolean;
}): FeatureTutorialKey => {
  if (state.isControlCenterOpen) return 'control-center';
  if (state.activeTab === 'plan') return `plan.${state.planSubTab}` as FeatureTutorialKey;
  if (state.activeTab === 'library') return `library.${state.librarySubTab}` as FeatureTutorialKey;
  if (state.activeTab === 'money') return `money.${state.moneyView}` as FeatureTutorialKey;
  return state.activeTab;
};

export const parseSeenFeatureTutorials = (raw: string | null): FeatureTutorialKey[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((key): key is FeatureTutorialKey => typeof key === 'string' && key in FEATURE_TUTORIALS);
  } catch {
    return [];
  }
};
