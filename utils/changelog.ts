export type ChangelogEntry = {
  version: string;
  date: string;
  items: string[];
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: 'v0.3.41',
    date: 'May 2026',
    items: [
      'Money tabs now let the tab switcher fill the full header width on desktop instead of stopping halfway across the main container.',
      'Money > Transactions gets a more desktop-native header: Total Net Worth and the month selector form a wide two-column top row, while Income, Expense, and Used expand into equal desktop cards below.',
    ],
  },
  {
    version: 'v0.3.40',
    date: 'May 2026',
    items: [
      'Money > Transactions moves the month selector into the top-right header area instead of keeping it as the first monthly stat card.',
      'The balance visibility eye now sits directly beside the Total Net Worth amount while the Income, Expense, and Used stat row keeps the v0.3.33 proportions.',
    ],
  },
  {
    version: 'v0.3.39',
    date: 'May 2026',
    items: [
      'Money > Transactions restores the v0.3.33-style Total Net Worth header with no extra gray wrapper behind the net worth amount.',
      'Assets, Debt, Savings, and the Add finance plus button now return to the v0.3.33 inline footer strip beneath the monthly stats.',
    ],
  },
  {
    version: 'v0.3.38',
    date: 'May 2026',
    items: [
      'Money > Transactions removes the extra gray wrapper around the Assets, Debt, and Savings strip so the header matches the cleaner tab-header style.',
      'The Add finance action now sits in the same row as those totals as a compact circular plus button with no extra label text.',
    ],
  },
  {
    version: 'v0.3.37',
    date: 'May 2026',
    items: [
      'Money > Transactions restores the Assets, Debt, and Savings summary to a single horizontal row instead of stacking the three totals vertically.',
      'The transaction month selector now sits in the card’s top-right action slot, while the hide/show balance eye moves down beside the Net Worth amount.',
    ],
  },
  {
    version: 'v0.3.36',
    date: 'May 2026',
    items: [
      'Review Center successful parse cards now have explicit Undo and Delete actions, so users can reverse a saved AI result or remove the entries it created without hunting through the destination tab.',
      'Undo restores updated/completed/deleted items from the pre-parse snapshot and removes parser-created entries, while Delete removes entries created by that successful parse after confirmation.',
      'This main release also includes the AI expense duplicate guard, keeping one atomic expense input from becoming a repeated transaction batch.',
    ],
  },
  {
    version: 'v0.3.35',
    date: 'May 2026',
    items: [
      'AI expense parsing now blocks duplicate structured transaction results before saving, so one input like “expense: beli calliper 10000 gopaylater” creates one transaction instead of a repeated batch.',
      'The pro parser prompt now explicitly treats one atomic user entry as one result and warns Gemini not to repeat identical finance outputs.',
      'Review Center shows when duplicate parser results were blocked, making parser safeguards visible instead of silently hiding the recovery.',
    ],
  },
  {
    version: 'v0.3.34',
    date: 'May 2026',
    items: [
      'Finished the NDZ responsive UX closure pass: Library and Notes empty states now feel intentional on desktop, and global search opens from the same composer/content frame instead of floating as a detached island.',
      'Calendar desktop width was validated and intentionally kept on the readable cap so dense month scanning stays comfortable instead of stretching too wide.',
      'Task, note, shopping, expense, and destructive confirmation dialogs now use clear responsive panel variants, with overlay Escape/back/close handling covered by regression tests.',
    ],
  },
  {
    version: 'v0.3.33',
    date: 'May 2026',
    items: [
      'Money > Transactions on mobile now keeps Income, Expense, and Used in one row, with a 40/40/20 split so the usage percent stays visible without pushing the stats into a second line.',
      'Desktop transaction stats keep the existing wider layout; this release only tightens the mobile card proportions and spacing.',
    ],
  },
  {
    version: 'v0.3.32',
    date: 'May 2026',
    items: [
      'Desktop shell polish now keeps the main workspace rail-aligned on wide monitors instead of centering every page inside a narrow island.',
      'The bottom composer and chat panel now share the same desktop origin/width as the content area, with extra bottom breathing room for form-heavy views.',
      'Add Task, Shopping, Expense, and Note creation forms now use wider shared desktop modal panels while preserving the mobile sheet behavior.',
    ],
  },
  {
    version: 'v0.3.31',
    date: 'May 2026',
    items: [
      'Responsive desktop QA is complete: mobile and tablet keep the familiar touch-first flow, while desktop now uses the wider rail, content grids, and settings workspace added in this release.',
      'Verified the desktop pass across app shell, cards/lists, forms, Control Center, search/chat overlays, sync status, and PWA build readiness.',
      'No migration is needed; this release only changes how Notes Dump adapts across screen sizes.',
    ],
  },
  {
    version: 'v0.3.30',
    date: 'May 2026',
    items: [
      'Control Center now becomes a desktop settings workspace with a persistent section rail, wider content pane, and two-column config sections while keeping the mobile bottom sheet flow.',
      'Onboarding, feature tips, wallet setup, skill setup, and generated insight popovers now use desktop widths/density without changing the touch-first mobile path.',
      'Added shared responsive surface helpers so later settings/modal polish can reuse the same lg-only contract instead of creating one-off desktop rules.',
    ],
  },
  {
    version: 'v0.3.29',
    date: 'May 2026',
    items: [
      'Sheet1 now shows sync/data health, generated-vs-editable guidance, and richer today-vs-yesterday money driver copy based on structured finance metadata.',
      'Added a generated-only Data Quality tab that flags duplicate IDs, missing/unknown wallet/category config, broken transfers, and deep-work parent/child linkage issues with suggested fixes.',
      'Daily spend summaries now exclude transfers and savings from expense totals while still showing wallet movement separately.',
    ],
  },
  {
    version: 'v0.3.28',
    date: 'May 2026',
    items: [
      'Google Sheets refresh now ignores header-only user sheets during reconciliation, preventing shopping todos and transactions from disappearing or reverting after save while sync is mid-refresh or partially loaded.',
      'Transaction reconciliation now parses Indonesian currency strings like Rp75.000 correctly instead of shrinking them to 75 or 0.',
      'Plan / Shopping edit cards now receive budget rules, so shopping item edits can keep/select budget categories consistently from the Plan tab.',
    ],
  },
  {
    version: 'v0.3.27',
    date: 'May 2026',
    items: [
      'Feature tips now show concrete manual-entry and input-bar examples for every tab/sub-feature, so tips teach by example instead of abstract explanation.',
      'Onboarding parsing previews now become real BrainDump entries when setup finishes, and the starter sample data uses the same valid entry shape as the rest of the app.',
      'Library / Skills sub-tab sliding now uses the same animation mechanics as the other sub-tabs, removing the odd transition mismatch.',
    ],
  },
  {
    version: 'v0.3.26',
    date: 'May 2026',
    items: [
      'First-time users now get contextual tutorial popups when they discover each tab or sub-feature, instead of cramming every explanation into onboarding.',
      'Main onboarding now stays focused on a general app overview and basic setup, while feature-specific guidance appears only when that area becomes relevant.',
      'Feature tips remember what has been seen and include a “Don’t show tips” escape hatch for users who prefer exploring without coaching.',
    ],
  },
  {
    version: 'v0.3.25',
    date: 'May 2026',
    items: [
      'Spreadsheet connection no longer requires Google login first: paste a Google Sheets link and Notes Dump checks service-account access directly.',
      'Added server-side Google Service Account Sheets access for shared spreadsheets, keeping the private key on the backend instead of exposing credentials in the browser.',
      'If the linked spreadsheet has not been shared yet, the app now tells you to add openclaw-adan@gen-lang-client-0558606321.iam.gserviceaccount.com as an Editor and retry.',
    ],
  },
  {
    version: 'v0.3.24',
    date: 'May 2026',
    items: [
      'Wallet balances now recalculate immediately from the transaction ledger when a transaction wallet is edited, instead of being pinned by stale canonical wallet metadata.',
      'Transaction edit dropdowns now save registered wallet IDs directly, so moving a transaction between wallets updates the source/destination balances consistently.',
    ],
  },
  {
    version: 'v0.3.23',
    date: 'May 2026',
    items: [
      'Deep Work Transformer now handles recap-style todos with a recap-specific first action and final-output shape instead of falling back to generic summary wording.',
      'Added stricter regression coverage for research/recap detection, low-confidence summary regulasi guidance, and false-positive counter-examples like concrete RFQs, packing tasks, and already-scoped desk-toys research.',
    ],
  },
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
