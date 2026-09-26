# Spreadsheet service — 27 September 2026

## Changes

- `Budget Rules` uses `ID | Name | Percentage | Color`. Each category occupies one row. Enter `50` or `50%` for fifty percent; decimal comma or point is supported. A plain numeric `0.5` means half a percent. Existing native percent-formatted cells are read using their displayed percentage, so a displayed `50%` is interpreted correctly even when Sheets stores `0.5`.
- Monthly income is a numeric value in `Themes & Settings`, under `Setting | Monthly Income`. It is no longer mixed with category records.
- Initial loading and reconciliation share the same budget parser. The old `Property | Value | Color` format remains readable and is rewritten into the structured format on a successful sync.
- Budget columns retain frozen headers, filtering, and configured widths. IDs are visible with instructions to keep them stable when renaming categories. Missing or duplicate IDs and invalid percentages stop the sync with a row-specific error instead of silently dropping records. Percentage cells use plain-text formatting and validation for manual entry. Only this tab needs the new presentation version; other tabs keep their existing presentation.
- Header-only Budget Rules means no categories. Income is retained when the settings tab is absent from a partial read. An explicit local change to zero wins a concurrent income edit. A remote income edit is accepted when local income has not changed from the common baseline.
- Routine saves reuse reliable metadata already fetched during remote merging, avoiding a second metadata request.
- Incremental planning uses the physical rows already fetched rather than generating another complete export just to index rows.
- Generated reports are compared in physical row order and written only when different. Omitted trailing empty cells/rows do not cause unnecessary rewrites. Without a physical snapshot, reports refresh conservatively.
- The dashboard shows the report date instead of a changing per-second timestamp. Exact save times and results remain in Event Log. Date-dependent content still recalculates on each export.
- Failed metadata reads, failed row reads, and incomplete API responses stop a normal save. No assumed sheet list is used to continue writing. Local pending data remains available for retry.
- Before writing, source rows are compared again with the original physical snapshot, including row order. If another edit is detected, the app reads and merges again, with at most two retries. Continued changes postpone the save.
- Existing headers come from the original row snapshot, removing the separate header-read request. Budget percentage display parsing uses a small separate read of the budget tab.
- Routine verification reads changed tabs only. The first write in a session, periodic writes (after each ten verified saves), full rewrites, and recovery after an error use full verification. A save without value changes adds no success log row and performs no post-write value read.
- A tab rewrite sends replacement values and explicit empty cells covering its old tail in one Values batch request. There is no separate clear request that can leave the tab empty if the subsequent write fails.

## Concurrency and write limits

The pre-write comparison is optimistic concurrency protection, not a distributed lock. Another client can still edit between the final comparison and the write. Different item fields are merged against the common baseline; if the same field changes on both sides, the existing merge policy prefers the local value. Force overwrite intentionally bypasses the concurrent-edit comparison.

The atomic rewrite guarantee applies to each tab's replacement request, not to the whole multi-tab sync. Partial progress across multiple tabs is still possible and is verified/retried through the existing pending-write flow. See [Google Sheets request atomicity](https://developers.google.com/workspace/sheets/api/limits#quota_limits) for the API behavior used by the rewrite.

## Scope and verification

The existing editable tabs remain the source of truth. No duplicate editable `DB_*` layer, source-tab renaming, or removal of transaction/task detail was introduced. User custom tabs are not removed.

Validation: 374 tests pass. The added coverage exercises failed metadata/row reads, incomplete responses, failed rewrites, native percentage formatting, missing and duplicate budget IDs, concurrent edits with remerge, continued conflicts, changed-tab verification, and remote income edits. TypeScript checks and production build pass. Existing build warnings remain for large chunks and outdated Browserslist data.

No authenticated live Google Sheets write was performed during this work. The new schema and formatting take effect after this app version completes a successful spreadsheet sync. Keep a spreadsheet backup before first migrating production data, and use the new app version on other devices too.
