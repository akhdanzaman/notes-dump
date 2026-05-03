export type ChangelogEntry = {
  version: string;
  date: string;
  items: string[];
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: 'v0.3.22',
    date: 'May 2026',
    items: [
      'New manual transactions now store wallet IDs directly, so wallet balances keep updating even if a wallet name changes later.',
      'Wallet balance calculation now counts ID-based transactions reliably, keeps true zero balances, and falls back to the raw wallet when stale canonical metadata points somewhere invalid.',
      'Google Sheets transaction sync now reads the full exported row including the ID after the canonical columns, preventing transaction reconciliation from losing its match key.',
    ],
  },
  {
    version: 'v0.3.21',
    date: 'May 2026',
    items: [
      'Calendar now uses the same rounded bottom header container as the other main tabs, so the top area feels consistent instead of like a separate sticky toolbar.',
      'The Calendar header now supports horizontal swipe navigation into the neighboring app tabs, matching the gesture behavior used by Summary, Plan, Library, and Money.',
    ],
  },
  {
    version: 'v0.3.20',
    date: 'May 2026',
    items: [
      'Deep Work suggestions now refresh through both parser updates and manual task edits, so turning a plain task into “summary IIMS” or “summary regulasi” immediately surfaces the structured plan instead of leaving hidden/stale metadata.',
      'The Deep Work ship gate now validates the actual transformer output on Adan’s real IIMS 2026 and regulasi todos, including concrete next action, final output, estimate, blocker check, and non-generic subtasks.',
    ],
  },
  {
    version: 'v0.3.19',
    date: 'May 2026',
    items: [
      'Plan now gives Deep Work todos a compact decision panel with next action, final output, session estimate, and blocker check without changing the plain todo card flow.',
      'Deep Work suggestions can be kept raw, retriggered, or transformed from an editable mobile-friendly subtask preview.',
      'Nested Deep Work steps now expand under their parent with visible step progress while parent completion stays tied to the final output check.',
    ],
  },
  {
    version: 'v0.3.18',
    date: 'May 2026',
    items: [
      'Added the Deep Work Transformer detector for abstract todos like summary IIMS, summary regulasi, research, recap, planning, writing, and implementation work: the app now surfaces first action, final output, session estimate, blocker checks, and suggested steps.',
      'Low-confidence Deep Work suggestions stay review-first/editable and require an explicit Create steps action, so vague parser output no longer silently mutates tasks into nonsense.',
      'Plan now shows optional nested todo steps directly under the parent task, with progress rolling up as the steps are completed instead of only relying on optimistic local state.',
      'Google Sheets sync now preserves the nested todo fields, parent/child IDs, step order, next action, requested final output, session estimate, blocker/status notes, checklist subtasks, and completion mode so the plan survives a clean refresh or reload.',
      'Nested todo metadata stays optional and backward-compatible: old todo rows keep working, while child completion rolls up progress without marking the parent done unless the parent explicitly opts into all-subtasks completion.',
    ],
  },
  {
    version: 'v0.3.17',
    date: 'May 2026',
    items: [
      'Library sub-tabs now use the same left-to-right order as the rest of the app, so the Skills pane slides consistently instead of feeling reversed.',
      'Aligned the Library slider track with the visible tab order to remove the odd Skills transition mismatch.',
    ],
  },
  {
    version: 'v0.3.16',
    date: 'May 2026',
    items: [
      'Added a journal recovery migration that restores legacy entries accidentally saved back as regular notes during the earlier refresh bug.',
      'Recovered journal rows are promoted back into the Journal timeline on load, then re-synced so Google Sheets stops carrying the wrong NOTE type forward.',
    ],
  },
  {
    version: 'v0.3.15',
    date: 'May 2026',
    items: [
      'Fixed a journal refresh bug where same-day appended journal entries could come back from Google Sheets as regular notes and vanish from the Journal tab.',
      'Spreadsheet note/journal reconciliation now treats uppercase JOURNAL rows correctly and preserves their IDs when rebuilding local state.',
    ],
  },
  {
    version: 'v0.3.14',
    date: 'May 2026',
    items: [
      'Journal tab now has a month slicer, so you can browse the daily timeline one month at a time like Transactions.',
      'Large lists across Library, Plan, and Money now lazy-load in batches of 20 to keep scrolling smooth on heavy datasets.',
      'Skills, notes, journal days, shopping lists, tasks, goals, wallets, and transaction lists now reveal more entries on demand instead of rendering everything at once.',
    ],
  },
  {
    version: 'v0.3.13',
    date: 'May 2026',
    items: [
      'Journal quick-add now appends into the same day\'s journal entry instead of scattering multiple separate cards across one date.',
      'Journal view now behaves more like a real daily log: completed todos, shopped items, events, and transactions are grouped into their own day-level cards.',
      'Transaction history now appears inside the daily journal timeline too, so post-spend reflections can live beside what actually happened that day.',
    ],
  },
  {
    version: 'v0.3.12',
    date: 'May 2026',
    items: [
      'Upgraded Sheet1 into a more premium command center with richer KPI copy, today-vs-yesterday comparisons, projected burn, and a cleaner analytics deck.',
      'Spreadsheet sync now rebuilds embedded Google Sheets charts for cashflow trend, productivity pulse, and top spend categories after each save.',
      'Expanded the hidden dashboard helper data so visual summaries stay powered by fresh structured metrics instead of brittle manual edits.',
    ],
  },
  {
    version: 'v0.3.11',
    date: 'May 2026',
    items: [
      'Sheet1 now auto-generates a polished BrainDump dashboard with finance + life tracker summaries, upcoming radar, merchant/category highlights, and built-in sparkline charts.',
      'Google Sheets sync now reapplies dashboard layout formatting so the first tab stays readable and presentable after every save.',
      'Fixed lingering TypeScript/lint breakages around tabs, skill logs, calendar typing, and insight timestamp helpers.',
    ],
  },
  {
    version: 'v0.3.10',
    date: 'May 2026',
    items: [
      'Hardened Google Sheets refresh/save flow so a fast browser refresh can no longer wipe the live database while a sync is mid-flight.',
      'The app now publishes a protected system snapshot before clearing user-facing sheets, then marks the sync complete only after every sheet finishes writing.',
      'Refresh reads now detect in-progress spreadsheet writes and temporarily trust the protected system snapshot instead of reconciling against half-cleared tabs.',
    ],
  },
  {
    version: 'v0.3.9',
    date: 'May 2026',
    items: [
      'Fixed recurring task status in Calendar so a completed occurrence no longer makes future occurrences look done too.',
      'Routine items now compute status per occurrence date, including recurrenceDays-based routines, so history and upcoming instances render more truthfully.',
      'Calendar month view now keeps the completed mark on the actual finished date while later recurring slots stay pending until they are really done.',
    ],
  },
  {
    version: 'v0.3.8',
    date: 'May 2026',
    items: [
      'Reworked the mobile Calendar month view to stay full-width without horizontal scrolling.',
      'The month grid now follows a more Google Calendar-like layout with fixed 7-day columns, airy week rows, and compact event chips inside each day.',
      'Calendar entries now prioritize readable in-cell blocks over oversized cards, so more context fits without brutal truncation.',
    ],
  },
  {
    version: 'v0.3.7',
    date: 'May 2026',
    items: [
      'Fixed the mobile Calendar month view so day cells are no longer squeezed into tiny truncated cards.',
      'The Calendar grid now scrolls horizontally on narrow screens, uses taller day rows, and allows item titles to wrap up to three lines.',
      'Added extra bottom breathing room so the input bar and bottom navigation do not cover the final calendar rows as aggressively.',
    ],
  },
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
