export type ChangelogEntry = {
  version: string;
  date: string;
  items: string[];
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: 'v0.3.6',
    date: 'May 2026',
    items: [
      'Paused spreadsheet save/fetch work while parser jobs are still running, then safely flushes queued sync after parsing finishes.',
      'Added a Review Center button above the input bar after new parser activity, with a spinning ring while parsing/save/fetch work is active.',
      'Review Center now shows successful parser destinations and structured attributes, plus clear failure details when parsing fails.',
    ],
  },
  {
    version: 'v0.3.5',
    date: 'May 2026',
    items: [
      'Added a one-time changelog popup after app launch so users immediately see what changed after each new update.',
      'The popup remembers the latest version locally, so it only appears once per newly shipped changelog version.',
      'Centralized changelog entries so the popup and Control Center version history stay in sync.',
    ],
  },
  {
    version: 'v0.3.4',
    date: 'May 2026',
    items: [
      'Retired the GitHub/db.json runtime database path so Google Sheets is now the only cloud source of truth.',
      'Added a spreadsheet cache for fast/offline display, with one-time migration from the legacy browser cache when a new spreadsheet is connected.',
      'Control Center and onboarding now point users to Google Sheets instead of local-only or GitHub file sync.',
    ],
  },
  {
    version: 'v0.3.3',
    date: 'May 2026',
    items: [
      'Added Smart Canonicalizer foundations so parser results can store stable canonical merchant, payment method, and subcommodity metadata without changing raw user input.',
      'Pending Review now surfaces canonical suggestions with Use/Keep Raw actions, so approvals can intentionally teach either accepted mappings or rejection signals.',
      'Learned canonical aliases now merge deterministically, graduate to auto-apply after repeated approvals, decay after rejection, and lose auto-apply when they become risky.',
      'Added a safe historical canonical sweep that backfills high-confidence aliases, queues only threshold-qualified ambiguous rows for review, and can be rerun from Data settings after rule improvements.',
      'Control Center now shows canonical data quality coverage, learned-rule counts, review pressure, rejected-rule guardrails, and recent learned-rule controls before rerunning the sweep.',
      'Money search, wallet filters, wallet balances, AI insights, and exports now read canonical merchant, payment method, commodity, and subcommodity clusters while preserving raw item text.',
      'Parser extraction now captures clearer merchant, commodity, and subcommodity signals for common finance notes such as sarapan, parkir, and wallet mentions while leaving ambiguous transactions uncategorized.',
    ],
  },
  {
    version: 'v0.3.2',
    date: 'May 2026',
    items: [
      'Added behavior drift alerts that flag real pattern changes instead of only static summaries.',
      'New alerts can catch 3-day food spend runs, wants reactivation, task throughput dips, and 2-week skill stagnation.',
      "Refreshed AI insight cache versioning so newly shipped insight logic shows up without waiting for yesterday's cached cards to expire.",
    ],
  },
  {
    version: 'v0.3.1',
    date: 'April 2026',
    items: [
      'Stabilized all Gemini-based AI services with shared key handling and retry logic.',
      'Hardened AI JSON parsing so fenced/prose-wrapped responses no longer break flows easily.',
      'Improved Google Sheets sync reliability with token refresh retry, rate-limit backoff, and chunked sheet writes.',
      'Expanded spreadsheet history reads/writes to avoid truncated backups on larger databases.',
      'Reduced silent localStorage failures with safer read/write guards.',
    ],
  },
  {
    version: 'v0.3.0',
    date: 'April 2026',
    items: [
      'Fixed wiggly animations when switching sub-tabs.',
      'Enhanced summary numbers in Focus and Notes tabs.',
      'Fixed navigation bar expansion on sub-tabs.',
      'Improved dark and light mode theme consistency.',
      'Fixed navbar width consistency.',
      'Set AI draft review disabled by default.',
      'Set collapsed card view enabled by default.',
    ],
  },
  {
    version: 'v0.2.0',
    date: 'April 2026',
    items: [
      'Added Changelog section to Control Center.',
      'Refined UI theme for light mode consistency.',
      'Fixed navbar background color in light mode.',
      'Removed "Life" tab from navigation.',
    ],
  },
  {
    version: 'v0.1.0',
    date: 'Initial Release',
    items: [
      'Initial BrainDump AI release.',
      'Added Gemini parsing support.',
      'Added Budget and Money tracking.',
    ],
  },
];

export const LATEST_CHANGELOG = CHANGELOG_ENTRIES[0];
export const LATEST_CHANGELOG_VERSION = LATEST_CHANGELOG.version;
export const SEEN_CHANGELOG_STORAGE_KEY = 'braindump_seen_changelog_version';
