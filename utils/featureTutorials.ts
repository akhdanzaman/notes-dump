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
  manualExample: string;
  inputBarExample: string;
  bullets: string[];
}

export const FEATURE_TUTORIALS: Record<FeatureTutorialKey, FeatureTutorial> = {
  summary: {
    key: 'summary',
    eyebrow: 'Overview',
    title: 'This is your command center',
    body: 'Summary is the quick read: what needs attention today, how money is moving, and what the app thinks is worth reviewing.',
    manualExample: 'Manual: open a highlighted card, then review or edit the entry it points to.',
    inputBarExample: 'Input bar: “Journal: hari ini fokus beresin laporan dan follow up vendor”',
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
    manualExample: 'Manual: Plan > Tasks > +, title “Follow up invoice vendor”, due tomorrow, priority normal.',
    inputBarExample: 'Input bar: “Focus: follow up invoice vendor besok jam 10”',
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
    manualExample: 'Manual: Plan > Shopping > +, item “Beli susu”, category urgent, amount 12000.',
    inputBarExample: 'Input bar: “shopping: beli susu besok 12000”',
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
    manualExample: 'Manual: Plan > Savings > +, goal “Emergency fund”, target 5000000, dedicated wallet optional.',
    inputBarExample: 'Input bar: “Saving for emergency fund 5jt”',
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
    manualExample: 'Manual: Library > Notes > +, note “Vendor A prefers WhatsApp follow-up”, tags vendor, ops.',
    inputBarExample: 'Input bar: “notes: Vendor A prefers WhatsApp follow-up before noon”',
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
    manualExample: 'Manual: Library > Skills > +, skill “English Speaking”, weekly target 120 minutes.',
    inputBarExample: 'Input bar: “Skill log: English Speaking practice 45 menit”',
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
    manualExample: 'Manual: Library > Journal > +, entry “Hari ini meeting lancar, blocker tinggal follow-up dokumen.”',
    inputBarExample: 'Input bar: “Journal: hari ini meeting lancar, blocker tinggal follow-up dokumen”',
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
    manualExample: 'Manual: Money > Transactions > +, expense lunch 50000, wallet Main Bank, category wants.',
    inputBarExample: 'Input bar: “Expense: lunch McDonald 50k from Main Bank”',
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
    manualExample: 'Manual: Money > Wallets > +, wallet “BCA”, type bank, initial balance 2500000.',
    inputBarExample: 'Input bar: “Create wallet BCA bank balance 2500000”',
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
    manualExample: 'Manual: Money > Budget, set income 10000000, then split Needs/Wants/Savings percentages.',
    inputBarExample: 'Input bar: “Set monthly income 10000000 and budget needs 50 wants 30 savings 20”',
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
    manualExample: 'Manual: Money > Savings, open a goal, add funds 500000 from BCA.',
    inputBarExample: 'Input bar: “Saved 500k for emergency fund from BCA”',
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
    manualExample: 'Manual: Plan > Tasks > +, add “Call supplier”, date Friday, start 09:00.',
    inputBarExample: 'Input bar: “Event: call supplier Jumat jam 9 pagi”',
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
    manualExample: 'Manual: Control Center > Spreadsheet, paste your Google Sheets link after sharing Editor access.',
    inputBarExample: 'Input bar: “notes: spreadsheet utama sudah dishare ke service account”',
    bullets: [
      'Spreadsheet connection uses service-account access only, so there is no Google login popup to manage.',
      'Share the Sheet with the service-account email as Editor, then paste the link in Control Center.',
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
