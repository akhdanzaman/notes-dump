export type ChangelogEntry = {
  version: string;
  date: string;
  items: string[];
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: 'v0.3.109',
    date: 'May 2026',
    items: [
      'Replaced full item-sheet rewrites with per-row deletions (deleteDimension) and per-row appends during incremental saves, eliminating quota-heavy Transactions rewrites.',
      'Item sheets (Transactions, Todos, Shopping, Events, Notes & Journals, Skill Logs) now only write changed rows, append new rows, and delete specific removed rows — no full clear/rewrite.',
      'Config sheets (Budget Rules, Wallets Config, Skills Config, etc.) remain rewritten entirely as they are small and quota-cheap.',
      'Rows without IDs in spreadsheet are now detected as manual user edits; the app generates an ID and imports them on next fetch.',
      'Deleted items in the app are now removed from the sheet via row deletion instead of triggering a full sheet rewrite.',
    ],
  },
  {
    version: 'v0.3.108',
    date: 'May 2026',
    items: [
      'Fixed Vercel service-account API crashes by bundling the Google service account helper inside the API function tree and using NodeNext-compatible imports.',
      'Service-account status/proxy endpoints should now return JSON instead of crashing with ERR_MODULE_NOT_FOUND / MIDDLEWARE_INVOCATION_FAILED.',
    ],
  },
  {
    version: 'v0.3.107',
    date: 'May 2026',
    items: [
      'Service-account spreadsheet rewrites now use POST batchUpdate chunks instead of direct PUT range updates, avoiding proxy method failures during routine saves.',
      'Added an Event Log spreadsheet tab that records save plans, successes, and failures so cloud-sync activity/errors are visible from Google Sheets.',
    ],
  },
  {
    version: 'v0.3.106',
    date: 'May 2026',
    items: [
      'Routine sheet rewrites no longer call the Google Sheets clear endpoint; changed sheets are rewritten with padded value updates that also blank stale trailing rows.',
      'Added retries for transient service-account proxy failures, including FUNCTION_INVOCATION_FAILED errors from the Sheets proxy.',
    ],
  },
  {
    version: 'v0.3.105',
    date: 'May 2026',
    items: [
      'Added stale PWA asset recovery so blank screens caused by cached old bundles automatically refresh service-worker assets and reload once.',
      'Added a root render fallback screen with a refresh action instead of leaving the web app blank when an unexpected startup crash happens.',
    ],
  },
  {
    version: 'v0.3.104',
    date: 'May 2026',
    items: [
      'Routine spreadsheet autosave no longer clears or rewrites generated dashboard tabs like Sheet1/Data Quality; it only writes source data/config sheets that changed locally.',
      'Fixed a cloud save failure where generated dashboard drift caused autosave to clear Sheet1 and hit a Google Sheets proxy FUNCTION_INVOCATION_FAILED error.',
    ],
  },
  {
    version: 'v0.3.103',
    date: 'May 2026',
    items: [
      'Normal spreadsheet saves are now incremental: edited rows are updated in place, append-safe new rows are appended, and only affected tabs are rewritten when a row deletion, row move, or config change requires it.',
      'Remote-only manual spreadsheet edits are merged into local cache without being written back again, so autosave writes only local app changes instead of re-saving the whole workbook.',
    ],
  },
  {
    version: 'v0.3.102',
    date: 'May 2026',
    items: [
      'Spreadsheet autosave now checks and merges current Google Sheets rows before non-force saves, so manual sheet edits are not silently overwritten by stale app state.',
      'Parser undo/delete now only removes entries that were actually created by that parse, while restoring pre-existing edited items, wallets, skills, themes, and canonical rules safely.',
      'CRUD updates now keep in-memory refs synchronized immediately, preserve existing metadata on partial edits, and surface missing parser targets as needs-review notes instead of reporting silent success.',
      'Parser and batch parsing now preserve more supported fields, execute skill/wallet updates, avoid duplicate generated configs, and keep multiple AI results attached to the correct source line.',
    ],
  },
  {
    version: 'v0.3.101',
    date: 'May 2026',
    items: [
      'Saving status now shows the exact step currently running, including waiting for parser, caching the pending local write, building spreadsheet tabs, checking sheet structure, clearing old rows, writing each sheet batch, syncing calendar, and finalizing cache.',
      'Input bar, desktop rail, and Control Center now surface the current save step/detail so slow spreadsheet phases are easier to spot instead of showing only “Saving…”.',
    ],
  },
  {
    version: 'v0.3.100',
    date: 'May 2026',
    items: [
      'Parser now treats paid “beli/buy/belanja” inputs with an amount and known wallet as completed finance expenses, so quick purchase captures go straight into Transactions instead of Shopping or notes.',
      'Future/list-style “beli” inputs such as “beli susu besok” remain shopping tasks, preserving the planned-purchase workflow.',
    ],
  },
  {
    version: 'v0.3.99',
    date: 'May 2026',
    items: [
      'Fixed duplicate spreadsheet/app events caused by dedicated sheet reloads generating new IDs for Shopping and Events rows instead of preserving the row ID from the sheet.',
      'Startup now collapses obvious duplicate event rows by semantic content/date/tags and repairs the spreadsheet on the next sync, while preserving completed state, highest priority, and tags.',
    ],
  },
  {
    version: 'v0.3.98',
    date: 'May 2026',
    items: [
      'The PWA now flushes pending spreadsheet saves immediately when the page is hidden, minimized, frozen, or navigated away, so browser timer throttling cannot leave a debounced save stuck in the background.',
      'Added Background Sync and Periodic Background Sync hooks through the service worker to wake the app for pending background flushes when the browser supports it.',
      'Quick-input notification replies opened from the service worker are now processed from the launch URL, so captured thoughts are not dropped when no active app window was focused.',
    ],
  },
  {
    version: 'v0.3.97',
    date: 'May 2026',
    items: [
      'Spreadsheet sync now saves and fetches normal data through dedicated domain tabs instead of continuously writing All Items (Raw) or JSON App_State snapshots.',
      'Added dedicated Skill Logs, Chat History, and Canonical Rules tabs so those records survive without relying on a full-database backup sheet.',
      'Legacy All Items (Raw) and App_State_Do_Not_Edit sheets remain readable as migration fallbacks, but are no longer part of the normal save path.',
    ],
  },
  {
    version: 'v0.3.96',
    date: 'May 2026',
    items: [
      'Local writes are now persisted immediately as a pending spreadsheet write before the debounced cloud save runs, so refreshing the web app cannot lose a just-created entry.',
      'On startup, if the cloud fetch is missing a pending local write, the app merges the pending local data back in and forces a spreadsheet write to repair the cloud copy.',
    ],
  },
  {
    version: 'v0.3.95',
    date: 'May 2026',
    items: [
      'Older spreadsheets now auto-migrate into the current direct-sheet sync format by reading legacy App_State snapshots or user-editable sheets when All Items (Raw) is missing.',
      'Spreadsheet reload now preserves current export config sheets, including budget rules, monthly themes, settings, wallets, and skills, so migrated sheets stay compatible with the active service.',
      'Weekly money analytics now includes pending dated shopping/todo amounts in planned budget totals without showing them as completed transactions.',
    ],
  },
  {
    version: 'v0.3.94',
    date: 'May 2026',
    items: [
      'Budget category backfill now works for savings entries too (not just expenses), via canonicalizer and async enrichment paths.',
      'Budget category API fallback: when a parsed budgetCategory exists but no configured rule matches by name, the first rule is used as pragmatic default instead of returning None.',
      'Commodity and subcommodity edit fields are now available for all finance types (expense, income, saving) instead of only expenses.',
      'Saving entries now show commodity (saving) and subcommodity (goal_funding) fields in the edit card.',
      'Shopping transactions now carry commodity, subcommodity, and canonical metadata the same way regular expenses do.',
      'Parser now recognizes badminton, futsal, gym, and sports activities as hobby/sports commodity; iuran, dues, membership as social/membership.',
      'Saving keywords (nabung, tabung, invest, goal, deposit) now set commodity=saving and subcommodity=goal_funding at parse time.',
    ],
  },
  {
    version: 'v0.3.93',
    date: 'May 2026',
    items: [
      'Async enrichment now backfills budgetCategory for expense entries that the local parser could not classify (hybrid approach: save first, then update after).',
      'Parser signal patterns extended with taxi, taksi, go-car, and grab-car for ride_hailing commodity detection.',
    ],
  },
  {
    version: 'v0.3.92',
    date: 'May 2026',
    items: [
      'Connect now treats Google account login and Spreadsheet connection as separate states, so a signed-in Google account still appears even when Sheets uses the service account.',
      'Google Calendar sync can now be toggled on from Control Center and syncs dated todos, shopping items, events, and routines through the connected Google account.',
    ],
  },
  {
    version: 'v0.3.91',
    date: 'May 2026',
    items: [
      'Finance parsing now uses current spreadsheet budget categories and recent transaction history to infer budgetCategory before falling back to generic parser guesses.',
      'Budget category fallback is more creative but bounded: recognizable expense purposes map to the closest configured category instead of returning none, while income, transfers, and purpose-less amount-only inputs stay uncategorized.',
    ],
  },
  {
    version: 'v0.3.90',
    date: 'May 2026',
    items: [
      'Spreadsheet sync now detects Vercel service-account proxy invocation failures and falls back to direct OAuth Google Sheets requests when the user has a valid Google session.',
      'This keeps cloud saves working even when the service-account proxy returns an opaque FUNCTION_INVOCATION_FAILED response.',
    ],
  },
  {
    version: 'v0.3.89',
    date: 'May 2026',
    items: [
      'System snapshot writes are now split into bounded row batches so large cloud saves no longer send one oversized proxy request to the service-account function.',
      'Spreadsheet save errors now identify the exact system snapshot batch phase when Google Sheets or the proxy rejects a write.',
    ],
  },
  {
    version: 'v0.3.88',
    date: 'May 2026',
    items: [
      'Spreadsheet saves now tolerate temporary metadata fetch failures from the service-account proxy by falling back to known managed sheet names and continuing the save path where safe.',
      'Manual spreadsheet reconciliation still prefers live metadata, but no longer blocks cloud save when the metadata endpoint returns an opaque serverless failure.',
    ],
  },
  {
    version: 'v0.3.87',
    date: 'May 2026',
    items: [
      'Spreadsheet sync now uses incremental row writes for safe item-only changes, updating or appending the affected item rows instead of rebuilding every user-facing sheet during the save path.',
      'Heavy spreadsheet export rebuilds now run as a delayed background repair pass, while saves still publish the source-of-truth system snapshot first.',
      'Pre-save manual spreadsheet reconciliation now fetches only user-editable ranges instead of the large system snapshot, keeping manual edits supported with a faster merge check.',
    ],
  },
  {
    version: 'v0.3.86',
    date: 'May 2026',
    items: [
      'Spreadsheet saves now debounce rapid consecutive edits so multiple quick changes collapse into one cloud sync instead of several back-to-back writes.',
      'Dashboard, chart, and Data Quality formatting now runs only during setup, newly-created sheet repair, or missing-chart recovery instead of every save.',
    ],
  },
  {
    version: 'v0.3.85',
    date: 'May 2026',
    items: [
      'The app has been rebranded to Arkaiv with the tagline “Ngarsip Harian” across the browser title, PWA manifest, onboarding, navigation, and Control Center surfaces.',
      'The web header and desktop navigation now show the same app logo used by the PWA icon for consistent branding.',
    ],
  },
  {
    version: 'v0.3.84',
    date: 'May 2026',
    items: [
      'Control Center now includes a compact, local-only Parser Health card with fast-path rate, AI fallback count, average latency, and Review Center pressure.',
      'Parser guardrails now warn when failed parses, noisy review queues, or repeated AI fallbacks suggest the acceleration path needs attention.',
    ],
  },
  {
    version: 'v0.3.83',
    date: 'May 2026',
    items: [
      'Notes now have a dedicated title field separate from body content, including add/edit flows and spreadsheet sync support.',
      'Note cards now use a clearer hierarchy: metadata first, title as the primary line, and a muted content preview underneath for faster scanning.',
    ],
  },
  {
    version: 'v0.3.82',
    date: 'May 2026',
    items: [
      'Parser AI fallback now has an opt-in model-routing policy that tries the allowlisted fast extraction model first and reserves the deep parser for ambiguous or incomplete outputs.',
      'Review Center parser summaries now show which model tier handled a routed parse, including escalation reasons and ignored unsupported-model warnings.',
    ],
  },
  {
    version: 'v0.3.81',
    date: 'May 2026',
    items: [
      'Pasted multi-line or multi-item captures now parse as one ordered batch, using local parsing per clear item and a single deep-AI fallback pass only for ambiguous leftovers.',
      'Review Center now groups parser batch results with per-item source text, ordered action summaries, isolated failure/review states, and clear local-vs-AI batch counts.',
    ],
  },
  {
    version: 'v0.3.80',
    date: 'May 2026',
    items: [
      'Spreadsheet connection now stays in service-account mode by default, including older saved configs that did not yet store an auth mode.',
      'Control Center no longer opens Google OAuth/login popups when a service-account spreadsheet is connected; Google sign-in is clearly optional profile sync only.',
      'Signing out of the optional Google profile no longer disconnects the spreadsheet, and service-account connection checks are guarded against duplicate clicks.',
    ],
  },
  {
    version: 'v0.3.79',
    date: 'May 2026',
    items: [
      'Review Center success cards now show concise saved-item summaries for parser create, update, complete, delete, wallet, skill, transfer, and saving actions instead of empty no-detail states.',
      'No-op successful parser tasks are suppressed, duplicate parser collapses show compact merged-output evidence only when duplicates were removed, and normal parser cards hide canonical/internal metadata.',
    ],
  },
  {
    version: 'v0.3.78',
    date: 'May 2026',
    items: [
      'Fast parser saves now defer commodity, subcommodity, and canonical enrichment to a background queue so capture is not blocked by deep metadata cleanup.',
      'Background enrichment is merge-safe: high-confidence suggestions apply only to untouched fields, while ambiguous canonical suggestions move to Review Center instead of silently overwriting manual data.',
    ],
  },
  {
    version: 'v0.3.77',
    date: 'May 2026',
    items: [
      'Deep AI parser calls now send intent-specific context slices so simple finance, task, and shopping requests do not include unrelated app data.',
      'Parser cleanup now removes invalid wallet, budget, date, and low-confidence commodity fields from structured results and sends the ambiguity to Review Center instead of saving prose as IDs.',
    ],
  },
  {
    version: 'v0.3.76',
    date: 'May 2026',
    items: [
      'Finance parsing now reuses high-confidence recent behavior to fill repeated wallet, budget category, commodity, and subcommodity metadata locally without calling deep AI.',
      'Behavior suggestions use only the newest approved finance history, ignore weak others/unknown rows, and never override explicit parser fields or manual review corrections.',
    ],
  },
  {
    version: 'v0.3.74',
    date: 'May 2026',
    items: [
      'The parser now routes obvious local entries directly without calling deep AI, sends medium-confidence local parses to Review Center, and keeps mixed or low-confidence inputs on the deep AI fallback path.',
      'Review Center parser drafts now show structured parsed details for routed local outputs and avoid noisy internal router/canonical metadata in user-facing cards.',
    ],
  },
  {
    version: 'v0.3.73',
    date: 'May 2026',
    items: [
      'Review Center now collapses single-transaction parser variants into one saved transaction even when optional metadata like date, subcommodity, or destination wallet differs.',
      'Expense parsing now strips destination-wallet text from normal expenses, and Review Center hides noisy canonical internals so parser details are easier to scan.',
    ],
  },
  {
    version: 'v0.3.72',
    date: 'May 2026',
    items: [
      'Transaction edit cards now merge Achieved Goal into Saving so users have one consistent saving transaction type to edit.',
      'Saving transaction edits now show the same wallet-from behavior as saving creation: goal wallets are locked to the wallet configured in Goals, while investment funding lets users choose any source wallet except the linked investment wallet.',
    ],
  },
  {
    version: 'v0.3.71',
    date: 'May 2026',
    items: [
      'Canonical backfill now fills blank or weak “others” commodity/subcommodity fields from current user behavior, including repeated merchant patterns, before falling back to transaction signal inference.',
      'New parsed finance transactions now receive commodity/subcommodity raw fields and canonical values from the same behavior-aware inference path so Budget analytics stays aligned with recent user tagging habits.',
      'Commodity backfill is now scoped to real transaction candidates so non-money notes and todos are not mislabeled from everyday words like food or transport terms.',
      'Saving and investment funding transactions now keep the selected transaction date in Money filters instead of falling back to the creation date.',
    ],
  },
  {
    version: 'v0.3.70',
    date: 'May 2026',
    items: [
      'Expense transaction edit cards now include commodity and subcommodity fields with existing-value dropdown suggestions while still allowing custom entries.',
      'Investment saving transfers now keep source-wallet movement behavior and add investment P/L into the linked investment wallet balance.',
    ],
  },
  {
    version: 'v0.3.69',
    date: 'May 2026',
    items: [
      'Money > Budget Spend Anatomy commodity tiles now show floating hover details with subcommodity breakdowns and top transactions for that commodity.',
    ],
  },
  {
    version: 'v0.3.68',
    date: 'May 2026',
    items: [
      'Money > Budget Spend Anatomy category progress bars now reveal a floating hover card for each colored commodity segment, including amount, category share, transaction count, and top subcategories.',
    ],
  },
  {
    version: 'v0.3.67',
    date: 'May 2026',
    items: [
      'Money > Budget now supports weekly period navigation beside monthly and yearly, with actual and planned budget calculations scoped to the selected week.',
      'Spend Timeline now uses income, expense, and net bars with a floating hover breakdown while keeping planned spend visible in the timeline summary.',
      'Budget Performance and Spend Anatomy now surface data-backed insights from category, commodity, and subcategory totals without placeholder metrics.',
    ],
  },
  {
    version: 'v0.3.66',
    date: 'May 2026',
    items: [
      'Money > Budget Spend Anatomy now treats low-confidence “others” canonical values as fallback-only and infers clearer commodity/subcommodity labels from transaction text and tags.',
      'Finance parsing recognizes more everyday spend signals such as rent, laundry, home goods, hobby tools, clothing, AI subscriptions, and transfers so new transactions are less likely to land in others.',
    ],
  },
  {
    version: 'v0.3.65',
    date: 'May 2026',
    items: [
      'Money header now adds breathing room below the net worth and date selector row so the stats cards below do not feel cramped.',
      'The desktop date selector now uses the same 25% header width as the Used stat card, with net worth taking the remaining 75%.',
    ],
  },
  {
    version: 'v0.3.64',
    date: 'May 2026',
    items: [
      'Money > Budget Spend Timeline hover details now appear as a floating tooltip over the graph instead of a fixed detail card inside the timeline container.',
    ],
  },
  {
    version: 'v0.3.63',
    date: 'May 2026',
    items: [
      'Money > Budget Spend Timeline details are now hover-only, removing the tap-sticky detail behavior while showing spend, income, and top category totals for the hovered date or month.',
      'Budget layout now stacks the full-width Spend Timeline first, then places the 6 Categories card beside Spend Anatomy on desktop while keeping them stacked on smaller screens.',
    ],
  },
  {
    version: 'v0.3.62',
    date: 'May 2026',
    items: [
      'Money > Budget now separates Spend Timeline into its own standalone card instead of nesting the time-series graph inside Spend Anatomy.',
      'Spend Timeline bars can now be hovered, focused, or tapped to show the selected date/month spend details, including prior-year comparison in yearly mode.',
      'Spend Anatomy now focuses only on category → commodity → subcommodity breakdown while using the same card heading hierarchy as Budget Categories.',
    ],
  },
  {
    version: 'v0.3.61',
    date: 'May 2026',
    items: [
      'Money header Used card now shows the planned-inclusive percentage inline beside the used percentage with a pipe separator instead of stacking it underneath.',
      'The Money header stat row now gives Used a wider 25% column while Income and Expense share the remaining width evenly.',
    ],
  },
  {
    version: 'v0.3.60',
    date: 'May 2026',
    items: [
      'Money > Budget now shows Spend Anatomy as its own card outside the Categories container, using the same large heading hierarchy as the budget category card.',
      'The Budget M/Y toggle now lives below the period selector; monthly mode keeps the month selector, while yearly mode switches the selector to year navigation.',
      'Spend Anatomy now includes a time-over-time graph: daily spend bars for a selected month and YoY monthly comparison bars for a selected year.',
    ],
  },
  {
    version: 'v0.3.59',
    date: 'May 2026',
    items: [
      'Finance canonical analytics now use category → commodity → subcommodity as the primary spend hierarchy, with merchant kept as optional vendor drilldown only.',
      'Transactions spreadsheet export now uses Canonical_Commodity instead of Canonical_Merchant while preserving raw merchant data in item metadata and raw exports.',
      'Money > Budget now includes an in-place Spend Anatomy graphic that highlights which commodities and subcommodities dominate each budget category, with undefined values normalized to others.',
    ],
  },
  {
    version: 'v0.3.58',
    date: 'May 2026',
    items: [
      'Money > Budget header now shows the used-plus-planned percentage directly under the Used percentage as a smaller amber number with no extra label text.',
    ],
  },
  {
    version: 'v0.3.57',
    date: 'May 2026',
    items: [
      'Summary focus cards now use the same expandable task workspace controls as the Focus view, including Show edit and Subtasks actions.',
      'Deep Work tasks shown on Summary can now preview, edit, transform, retrigger, keep raw, and open existing subtasks without jumping to the Focus tab.',
      'Manual subtasks can now be added from Summary focus cards while keeping the same in-card edit-field style used in Focus.',
    ],
  },
  {
    version: 'v0.3.56',
    date: 'May 2026',
    items: [
      'Deep Work focus cards no longer add a separate purple wrapper around expanded task content, keeping the task card visually clean.',
      'Deep Work and manual focus subtasks now render inside the expanded task card in an edit-field-style panel instead of as a separate container below the card.',
      'Expanded Deep Work cards now default to edit details until subtasks have actually been created, then default to the subtasks panel for faster execution.',
    ],
  },
  {
    version: 'v0.3.55',
    date: 'May 2026',
    items: [
      'Investment funding now auto-fills units from invested capital and buy price, or invested capital from units and buy price, while still allowing capital-only investments with no units.',
      'Money > Transactions saving entries for investment targets now include optional units and buy price fields, then add those units to the linked investment with weighted average buy tracking.',
      'Plan > Investments Add Capital uses the same units/capital auto-fill behavior so investment wallet transfers, invested capital, and owned units stay aligned.',
    ],
  },
  {
    version: 'v0.3.54',
    date: 'May 2026',
    items: [
      'Investment cards now label the main amount as owned value and calculate it from units multiplied by current price.',
      'Investment P/L now compares owned value against position cost basis (units multiplied by average buy), so unused funded capital in the platform wallet is not counted as a loss.',
    ],
  },
  {
    version: 'v0.3.53',
    date: 'May 2026',
    items: [
      'Investment invested capital now comes from Saving transactions linked to the investment item, matching saving-goal progress instead of relying on manual card input.',
      'Investment platforms are tracked as investment wallets, and saving into an investment moves money from the selected source wallet into the linked platform wallet.',
      'Investment cards now keep their expanded styling intact and show invested capital as read-only transaction-derived data.',
    ],
  },
  {
    version: 'v0.3.52',
    date: 'May 2026',
    items: [
      'Plan > Savings now supports investment entries alongside saving goals, with asset type, ticker/code, units, average buy price, current price, platform, buy date, and invested capital fields for gold, stocks, mutual funds, crypto, bonds, deposits, and other positions.',
      'Investment cards show current value, invested capital, units, and profit/loss with ROI, while staying out of expense analytics and spreadsheet transaction rows.',
      'Spreadsheet export/reconcile now preserves investment metadata in the Shopping sheet and raw backup sheet.',
    ],
  },
  {
    version: 'v0.3.51',
    date: 'May 2026',
    items: [
      'Focus task cards with subtasks now keep the subtasks collapsed by default, so the card stays focused on the main task until the Subtasks control is expanded.',
      'The Show edit and Subtasks controls now toggle closed as well as open, making task panels behave like true collapsed/expanded sections.',
    ],
  },
  {
    version: 'v0.3.50',
    date: 'May 2026',
    items: [
      'Money > Budget category rows now show a smaller amber used-plus-planned percentage directly beneath the used percentage, matching the planned spending accent without adding extra label text.',
    ],
  },
  {
    version: 'v0.3.49',
    date: 'May 2026',
    items: [
      'Focus task cards now place Show edit and Subtasks/Add subtask in one shared action row, with exactly one expanded panel active while the card is open.',
      'Expanded focus cards now default to Show edit when no subtasks exist, then default/switch to the subtask panel after subtasks are created, using matching expand-collapse animation for both panels.',
    ],
  },
  {
    version: 'v0.3.48',
    date: 'May 2026',
    items: [
      'Focus desktop tasks now group Today and Later vertically in the first column, matching the Today width while Routines and Tomorrow stay as the adjacent desktop columns.',
    ],
  },
  {
    version: 'v0.3.47',
    date: 'May 2026',
    items: [
      'Focus desktop Later group now uses a true full-row span at every desktop width, removing the awkward empty column that made the panel look like it was floating.',
    ],
  },
  {
    version: 'v0.3.46',
    date: 'May 2026',
    items: [
      'Focus desktop task layout now lets the Later group span the workspace row so it no longer feels like a floating card in empty space.',
      'Focus task cards now keep edit details and subtasks as mutually exclusive expanded panels: opening edit hides subtasks, and opening subtasks hides edit.',
      'Subtask controls only appear after a task card is expanded, child subtasks stay hidden from top-level Today’s Focus lists, and the tutorial-style Subtask Progress copy was removed.',
    ],
  },
  {
    version: 'v0.3.45',
    date: 'May 2026',
    items: [
      'Focus task cards no longer show wallet/payment metadata icons when the item is not a finance or shopping entry.',
      'Money > Transactions Income, Expense, and Used summary cards now use balanced top and bottom padding for a cleaner desktop rhythm.',
      'Focus tasks can now add manual subtasks from the focus workspace; created subtasks roll up progress like Deep Work steps while keeping the parent task separate.',
    ],
  },
  {
    version: 'v0.3.44',
    date: 'May 2026',
    items: [
      'Summary > Today’s Focus now uses a clear date-aware rule: include pending focus tasks/events plus pending urgent shopping, reserve visibility for both when both exist, then sort by nearest due date with focus items winning same-date ties.',
      'Urgent shopping dated later can no longer block nearer focus tasks/events, so a focus task on May 7 stays visible ahead of urgent shopping due May 10.',
    ],
  },
  {
    version: 'v0.3.43',
    date: 'May 2026',
    items: [
      'Shopping items now keep due date, created date, and completed/transaction date separate: marking an item bought no longer overwrites its due date.',
      'Shopping display, calendar scheduling, money transaction filtering, and spreadsheet export/reconcile now use the right date for each context, with clearer Due date / Completed date labels.',
      'Summary > Today’s Focus now mixes urgent shopping items and focus tasks/events together, so shopping items can no longer hide every focus item when both exist.',
    ],
  },
  {
    version: 'v0.3.42',
    date: 'May 2026',
    items: [
      'Money > Transactions adds calmer desktop breathing room to the Income, Expense, and Used cards so the stat row no longer feels pressed against the footer divider.',
      'Notes/Library and Calendar now use the same full desktop workspace width as the already-expanded tabs, removing the uneven narrow-container look across tabs.',
    ],
  },
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
