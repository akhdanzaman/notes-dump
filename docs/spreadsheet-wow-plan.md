# Notes Dump Spreadsheet Wow Plan

Status: Phase 0/1 planning artifact only. Implementation has **not** started.

Owner: Adan  
Repo: `/home/ubuntu/.openclaw/workspace/notes-dump`  
Baseline inspected: `main` at `bf288af` (`Revert "Remove broken Google OAuth flow"`)

## Executive direction

Make the Google Sheet feel useful even when the app is closed: a safe, readable personal command center with finance movement, task radar, wallet/category insight, data quality flags, and sync health. Keep the spreadsheet editable where it already is, but make generated/dashboard surfaces clearly read-only and resilient.

The highest-ROI path is not a giant schema migration. First ship better generated sheet value and visible sync/data health without changing authoritative input columns. Then harden spreadsheetService around schema manifests, reconciliation diffs, and migration/versioning before adding more editable columns.

## Phase 0 findings — current state

### Current spreadsheet architecture

- Google Sheets is now the runtime source of truth through `services/syncFacade.ts` + `services/spreadsheetService.ts`.
- Preferred connection path is service account; OAuth remains fallback.
- Runtime source snapshot lives in hidden/system sheet `App_State_Do_Not_Edit`.
- System snapshot format is v2:
  - marker: `__BRAINDUMP_STATE_V2__`
  - version: `2`
  - status: `writing | ready`
  - chunk count metadata avoids stale trailing-row reads.
- `App_State_History` stores backup rows with timestamp + chunked JSON.
- `operationQueue` serializes fetch/sync operations in-browser.
- Save flow is already two-phase:
  1. publish system snapshot as `writing`
  2. clear/rewrite user-facing sheets
  3. finalize system snapshot as `ready`
  4. append backup history
- Fetch flow skips user-sheet reconciliation when system snapshot says `writing`.

### Managed user sheets today

`Sheet1`, `Transactions`, `Todos`, `Shopping`, `Events`, `Notes & Journals`, `All Items (Raw)`, `Wallets Config`, `Skills Config`, `Budget Rules`, `Themes & Settings`.

Fetch/reconcile ranges:

- `Transactions: A:K`
- `Todos: A:AA`
- `Shopping: A:I`
- `Events: A:H`
- `Notes & Journals: A:E`
- `Skill Logs: A:F` (legacy/removed surface)
- `Wallets Config: A:E`
- `Skills Config: A:E`
- `Budget Rules: A:C`
- `Themes & Settings: A:C`

### Current spreadsheet UX strengths

- `Sheet1` is already a generated command center, not just a raw dump.
- Current dashboard includes:
  - Finance Pulse
  - Life Tracker
  - Today vs Yesterday
  - Budget Radar
  - Upcoming Radar
  - Top Merchants
  - Analytics Deck
- Hidden helper data spans H:AE and drives charts.
- Charts are rebuilt after sync:
  - Cashflow Trend (14 days)
  - Productivity Pulse (14 days)
  - Top Spend Categories
- `Transactions` exports canonical merchant/subcommodity while preserving raw item content.
- `Todos` exports deep-work parent/step metadata, next action, blocker fields, completion mode, subtasks.
- `All Items (Raw)` is a broad backup/export tab with canonical and deep-work fields.
- Reconciliation is mostly header-aware and has backwards compatibility for older Todos/Shopping/Event formats.
- Header-only fetched tabs no longer delete local data/config.

### Current validation baseline

Ran on the untouched baseline before writing this planning doc:

- `npm test` — pass, 81 tests
- `npm run lint` — pass (`tsc --noEmit`)
- `npm run build` — pass, with existing Vite large chunk warning

Relevant spreadsheet/sync tests already exist:

- `services/__tests__/spreadsheetFetchContract.test.ts`
- `services/__tests__/spreadsheetReconcilerJournal.test.ts`
- `services/__tests__/spreadsheetServiceSystemSnapshot.test.ts`
- `services/__tests__/syncFacadeSpreadsheetOnly.test.ts`
- `utils/__tests__/spreadsheetSchemaRoundTrip.test.ts`
- `utils/__tests__/exportUtilsDashboard.test.ts`
- `utils/__tests__/mergeUtils.test.ts`
- `server/__tests__/googleServiceAccount.test.ts`

## Risk zones

### 1. Authoritative deletion is powerful

If a reconciled sheet has data rows, missing rows are treated as deleted for that item type. This is intentional for spreadsheet editability, but it means accidental tab deletion/filter-copy mistakes can delete app items on refresh. History restore helps, but the sheet itself does not warn the user before this happens.

### 2. Generated tabs are not visibly protected

`Sheet1` and `All Items (Raw)` are generated surfaces. Edits there are wiped on next sync, but the spreadsheet does not clearly say that. Helper columns are hidden, but not conceptually protected from accidental edits.

### 3. Schema is spread across multiple files

Column contracts currently live across:

- `utils/exportUtils.ts`
- `services/spreadsheetReconciler.ts`
- `services/spreadsheetService.ts` fetch ranges
- tests

This is manageable but fragile. Any future editable column change must update export, reconciliation, fetch range, round-trip tests, and backwards compatibility together.

### 4. Date/currency parsing is still locale-sensitive

Exports use `toLocaleDateString() + toLocaleTimeString()`, while reconciliation uses `new Date(sheetString)`. This passes current tests but is vulnerable to locale/timezone differences and Google Sheets display-format changes.

### 5. Sheet health is invisible

If chart formatting fails, helper ranges drift, a service-account check is stale, or a fetch falls back to cache, the user sees app status but the spreadsheet itself does not explain the health state.

### 6. History exists, but is opaque outside app

`App_State_History` is chunked JSON. Good for restore, not useful for a human auditing “what changed yesterday vs today” directly in Sheets.

### 7. Finance interpretation must stay metadata-first

Adan explicitly does not want expense meaning inferred from names alone. Existing canonical/tag/category/wallet support is a strength, but dashboard copy must use tags, budgetCategory, financeType, paymentMethod, toWallet, wallet movement, monthly income, budget percentages, and canonical clusters before making claims.

## Product principles for the spreadsheet

1. **Spreadsheet-first value:** if Adan opens only Google Sheets, it should answer “what matters today?” without the app.
2. **Safe by default:** generated/read-only surfaces should be obvious; editable tabs should have clear headers/instructions.
3. **Metadata over guesses:** money insight must prioritize tags/categories/wallets/finance types/canonical metadata, not literal transaction names.
4. **Delta-aware:** daily money/task highlights should explain movement versus yesterday and what drove it.
5. **Quiet about stable context:** monthly reports should avoid repeating unchanged explanations unless needed to explain an anomaly.
6. **Backwards compatible:** old sheets and header layouts must keep reading safely.
7. **Test the contract, not just visuals:** every schema/header/range change needs export + reconcile + migration tests.

## Prioritized concepts

### P0 — Spreadsheet Health + Guide surface

Add a generated, human-readable health/guide section so the sheet explains itself.

Recommended shape:

- Add visible `Sheet1` block: `SYNC HEALTH`.
- Add generated `Spreadsheet Guide` tab or top section if a new tab is too much for first slice.
- Show:
  - last generated timestamp
  - snapshot/schema version
  - source-of-truth status (`ready` conceptually; do not expose internals too loudly)
  - item counts by type
  - editable tabs vs generated tabs
  - “safe to edit” guidance
  - backup/history location
  - service-account connection mode if available
- Add a data freshness warning if no items or no wallet/budget config.

Why it is wow/useful:

- The spreadsheet stops feeling mysterious.
- Adan can trust which tabs are safe to touch.
- Future debugging gets easier without opening devtools.

Acceptance criteria:

- A non-technical user can open the spreadsheet and know what to edit, what not to edit, and whether data looks fresh.
- No authoritative input columns change.
- Existing sync/reconcile tests remain green.
- Generated guide copy does not imply edits to generated tabs will persist.

### P0 — Data Quality Radar generated tab

Add a generated-only `Data Quality` tab with flags that help prevent silent data drift.

Flag examples:

- duplicate IDs
- transactions without wallet/paymentMethod
- transactions with unknown wallet/category IDs
- expenses without budget category
- transfer rows missing `toWallet`
- suspicious amount outliers versus recent median by category/canonical merchant
- invalid or unparsable dates
- done items without `completed_at`
- saving goals without linked saving transactions
- Todos with deep-work child IDs that do not exist

Why it is wow/useful:

- The sheet becomes an audit assistant, not only a dump.
- It catches the exact class of spreadsheet sync/data-loss issues that hurt trust.

Acceptance criteria:

- Generated-only; not included in reconciliation ranges.
- Empty state is positive and clear: “No issues detected.”
- Flags include item ID, sheet/tab, severity, reason, suggested fix.
- Tests cover at least duplicate IDs, unknown wallet/category, missing transfer target, invalid deep-work linkage.

### P0 — Better Today vs Yesterday money drivers

Upgrade `Sheet1` from raw deltas to actual driver explanations.

Add visible lines like:

- `Today spend: RpX vs yesterday RpY (+/- RpZ)`
- `Main driver: [category/tag/canonical merchant] via [wallet]`
- `Wallet movement: BCA -RpX, GoPay +RpY, transfers excluded from spend`
- `Pattern: normal / unusual` based on category pace and recent median, not transaction names alone

Required data priority:

1. financeType
2. budgetCategory
3. paymentMethod/toWallet and wallet movement
4. tags
5. canonical merchant/subcommodity
6. repeated transaction clusters
7. amount and budget percentage
8. raw content only as supporting evidence

Why it is wow/useful:

- Matches Adan’s desired reminders: main highlight, day-over-day movement, and what drove totals.
- Makes the spreadsheet useful as a daily finance cockpit.

Acceptance criteria:

- No claim is based solely on raw description/name.
- Transfers and savings do not inflate expense totals.
- Tests include same-name/different-category cases and transfer exclusion.
- Dashboard text stays short enough for Sheets cells.

### P1 — Wallet & Budget radar tabs

Add generated tabs that are more useful than raw `Transactions`:

- `Wallet Radar`
  - current balance
  - day-over-day change
  - MTD inflow/outflow
  - transfer in/out
  - biggest wallet movement drivers
- `Budget Radar`
  - category limit, spent, planned, remaining
  - pace vs day-of-month
  - projected month-end spend
  - anomaly flag when category spikes vs recent behavior

Acceptance criteria:

- Uses existing wallet selector logic or a shared pure helper to avoid divergence from app balances.
- Does not infer category from transaction names.
- Shows unknown/missing config as a data quality problem, not as fake certainty.

### P1 — Human-readable Audit Log

Create a generated `Audit Log` or `Change Summary` tab that summarizes changes between current data and prior snapshot/history when available.

Examples:

- added/updated/deleted item counts by type
- latest backup timestamp
- high-risk deletes detected
- budget/wallet/config changes
- notable day-over-day finance movement

Acceptance criteria:

- Never replaces `App_State_History`; it is a human-readable companion.
- If previous snapshot is unavailable, shows “baseline unavailable” instead of pretending.
- Sync should still succeed if audit generation fails; failure appears in health warnings.

### P1 — SpreadsheetService schema manifest

Centralize spreadsheet schema definitions in one module.

Recommended module shape:

- `spreadsheetSchema.ts`
- one manifest per sheet:
  - sheet name
  - generated vs editable
  - headers
  - fetch range
  - reconciliation support
  - schema version
  - backwards-compatible aliases/legacy layouts

Why it matters:

- Reduces risk when adding columns.
- Makes tests stronger and implementation easier to review.

Acceptance criteria:

- Fetch ranges derive from manifest or are tested against manifest.
- Export headers derive from manifest where practical.
- Reconciler uses header names from the same source for new-format sheets.
- Legacy formats remain readable.

### P1 — Reconciliation diff + guardrails

Change reconciliation from “return DbSchema only” toward a richer result:

```ts
{
  db: DbSchema,
  changed: boolean,
  summary: {
    created: number,
    updated: number,
    deleted: number,
    warnings: SpreadsheetWarning[]
  }
}
```

Potential guardrails:

- warn/block if a sheet suddenly deletes more than N% of a type
- distinguish blank/header-only from authoritative empty intentionally
- mark config changes separately from item changes
- expose warnings in `Sheet1`/`Data Quality`

Acceptance criteria:

- Existing API can be adapted without breaking callers.
- Tests prove header-only protection still works.
- Tests prove large accidental deletes are detected before being silently accepted.

### P2 — Protected generated ranges and formatting polish

Use Google Sheets batchUpdate to protect or clearly style generated ranges/tabs.

Candidates:

- protect `Sheet1`, helper columns, generated `Data Quality`, `Wallet Radar`, `Budget Radar`, `All Items (Raw)`
- freeze header rows on editable tabs
- apply filters to editable tabs
- color-code severity/status/category columns
- add notes to headers explaining accepted values

Acceptance criteria:

- Protection does not block the service account from rewriting generated tabs.
- Editable tabs remain editable by Adan.
- Formatting failures are non-fatal but visible in sync health.

### P2 — Stable date/currency codec

Replace ad-hoc locale date strings with explicit spreadsheet-safe formatting/parsing.

Options:

- Keep visible date columns human-readable but add hidden ISO columns for reconciliation.
- Or change editable sheets to include `ISO_Date`/`Created_At_ISO` in later schema version.

Acceptance criteria:

- Old locale-based sheets still reconcile.
- New exports round-trip date/time without timezone drift.
- Tests cover Indonesian currency strings, ISO dates, and legacy locale strings.

## Recommended implementation slices

### Slice 1 — Low-risk wow: Health + Data Quality + richer daily drivers

Scope:

- Enhance `Sheet1` with sync/data health, clearer edit guidance, and better day-over-day money driver copy.
- Add generated-only `Data Quality` tab.
- Add pure helpers for diagnostics and driver summaries inside `utils/exportUtils.ts` or a new utility module.
- Update dashboard formatting to include the new block/tab if needed.

Why first:

- High user-visible value.
- Minimal schema risk because authoritative editable columns do not change.
- Strong acceptance tests can be added without touching live Google APIs.

Files likely touched:

- `utils/exportUtils.ts`
- `utils/__tests__/exportUtilsDashboard.test.ts`
- possibly new `utils/__tests__/spreadsheetDiagnostics.test.ts`
- possibly `services/spreadsheetService.ts` only to clear/format generated `Data Quality`
- `utils/changelog.ts` after implementation

Do not include:

- new editable columns
- reconcile return-shape refactor
- protected ranges unless small and obviously safe

### Slice 2 — Service maintainability: schema manifest + tests

Scope:

- Introduce schema manifest.
- Wire fetch contract tests to manifest.
- Start moving export headers to manifest for editable tabs.
- Keep reconciler backwards compatible.

Why second:

- It makes future column improvements safer.
- It reduces hidden coupling before bigger migration work.

### Slice 3 — Reconciliation guardrails and visible sync journal

Scope:

- Add reconciliation diff summaries/warnings.
- Expose warnings in dashboard/data quality.
- Add tests for high-delete detection and stale/partial-sheet scenarios.

Why third:

- Higher code-risk because it touches fetch/save semantics.
- Better done after generated diagnostics are already in place.

### Slice 4 — Formatting/protection polish

Scope:

- Freeze/filter editable tabs.
- Protect generated tabs/ranges.
- Add header notes/data validation where safe.

Why later:

- Google Sheets API formatting/protection can fail in ways pure unit tests do not catch.
- Should be QA’d against a real test sheet before relying on it.

## Phase 2 child task specs to spawn later

Do **not** spawn these until this plan is accepted/reviewed.

### Implementation task A — Spreadsheet wow slice 1

Scope:

- Implement Slice 1 only.
- No authoritative editable schema changes.
- Add generated `Data Quality` tab and dashboard health/daily-driver improvements.

Acceptance criteria:

- `Sheet1` visibly answers: what changed today vs yesterday, what drove it, and whether the data/sync looks healthy.
- `Data Quality` reports concrete issues with severity, item ID, reason, and suggested fix.
- Finance language uses metadata/canonical/category/wallet/tags before raw names.
- Generated tabs are not reconciled as authoritative inputs.
- Existing user data compatibility preserved.
- `npm test`, `npm run lint`, `npm run build` pass.

Handoff artifact:

- changed files
- screenshots or exported sheet row samples if browser/Sheets unavailable
- commands run
- residual risks

### QA task A — User POV + data-safety review

Scope:

- Review implementation A diff and generated spreadsheet data from a user POV.
- Try to find data-loss or reconciliation risks.
- Run targeted tests plus full validation if practical.

Acceptance criteria:

- Dashboard copy is actually useful, not just more rows.
- Data Quality flags are correct and not noisy.
- No new generated tab is accidentally fetched/reconciled as authoritative.
- No schema/range mismatch.
- If impact feels weak, request a revision implementation task.

Handoff artifact:

- pass/fail decision
- bugs/weaknesses with exact reproduction or code pointers
- recommended revision scope if needed

## Phase 0/1 self-review checklist

- Current state is grounded in inspected files: `spreadsheetService`, `spreadsheetReconciler`, `exportUtils`, `mergeUtils`, spreadsheet tests, Control Center/onboarding, changelog, and existing docs.
- Spreadsheet UI/value work is separated from spreadsheetService engineering hardening.
- The first implementation slice is intentionally low-risk: generated surfaces and pure diagnostics before editable schema changes or reconciliation refactors.
- Finance language is constrained to structured fields and observed patterns before raw names.
- Data-loss risks are explicit, especially authoritative deletion from reconciled sheets and invisible generated-tab overwrites.
- Follow-up orchestration should start with implementation task A assigned to `kevin-the-developer`; QA/review should be created after that implementation exists so the reviewer can inspect real diff/output.

## Test plan for future implementation

### Unit tests

- Dashboard contains health block and edit guidance.
- Today/yesterday finance driver calculation excludes transfers/savings and uses categories/wallets/tags/canonical metadata.
- Data Quality flags:
  - duplicate IDs
  - missing/unknown wallet
  - unknown budget category
  - transfer without `toWallet`
  - deep-work orphan child/parent links
  - done item missing completed timestamp
- Generated-only tabs are present in export but absent from fetch/reconcile ranges.

### Round-trip tests

- Existing `spreadsheetSchemaRoundTrip` cases stay green.
- Old Todos/Shopping/Event layouts still reconcile.
- Header-only tabs still do not delete local data/config.
- Any new editable column has tests for export -> reconcile -> same IDs/no recreation.

### Service tests

- System snapshot v2 still ignores stale trailing chunks.
- If generated formatting/chart requests fail, sync still writes data and records/warns appropriately.
- If a user-facing tab is partially cleared during `writing`, fetch trusts system snapshot.
- Later: large-delete guard catches suspicious missing rows.

### Manual QA checklist

- Connect a disposable Google Sheet via service account.
- Run initial sync with realistic data.
- Open spreadsheet only; verify the first tab answers:
  - current health
  - today vs yesterday movement
  - finance drivers
  - upcoming/task radar
  - data quality issues
- Edit an existing transaction in `Transactions`; refresh app; verify change persists.
- Add a manual transaction row with ID blank; refresh app; verify exactly one new item appears.
- Delete one known test row intentionally; verify behavior is understood/restorable.
- Confirm generated tabs are overwritten safely on next sync.
- Verify `App_State_History` still receives backup row.

## Explicit non-goals for next slice

- No remote push before implementation + QA loop completes.
- No destructive migration of existing user sheets.
- No removal of legacy header/date compatibility.
- No live multi-user conflict UI yet.
- No attempt to make Google Sheets formulas the source of truth.
- No inference of spending purpose from raw names alone.
- No broad redesign of the whole app UI.

## Definition of done for the overall mission

The mission is done only when:

- the spreadsheet is genuinely useful without opening the app;
- generated vs editable surfaces are clear;
- reconciliation and sync remain safe under realistic failure modes;
- backwards compatibility is proven by tests;
- Adan’s finance-reporting preferences are reflected in dashboard wording;
- docs/changelog/onboarding are updated where relevant;
- implementation and independent QA/review have looped until no meaningful blocker remains;
- final validation includes `npm test`, `npm run lint`, and `npm run build`;
- remote push is either completed confidently or explicitly left awaiting push.
