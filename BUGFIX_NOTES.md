# Bug fixes — 26 September 2026

Six issues from the backend/feature audit have been addressed:

1. **Remote edits overwritten during save:** the three-way item merge now accepts remote content/metadata when the local item is unchanged. Independent concurrent field edits still merge; local changes win same-field conflicts.
2. **Deleted records returning after offline reload:** pending writes now persist their original base snapshot and retain it across retries. Fetch and save both use that baseline to recognize deletions while preserving new remote records. A cache fallback never acknowledges a pending write. Legacy pending records without a baseline keep the non-destructive merge behavior because past deletions cannot safely be inferred.
3. **Deleted budget categories returning:** budget rules now use ID-based three-way merging, including deletions and independent field edits. An omitted budget config is not treated as an explicit deletion.
4. **Plan search ignored for shopping/goals/investments:** search and tags now filter these lists. Contribution calculations still use all transactions, so searching cannot change the saved balance. Lazy-list pagination resets when filters change.
5. **All-day Calendar events one day early:** timestamp dates now follow the device's local calendar, while date-only strings retain their literal date. The exclusive end date advances one calendar day, including DST and year boundaries. Timed events retain their existing timestamp behavior.
6. **Task modal retaining an old date:** opening the modal or changing its supplied date updates the date input. Default dates and saved task dates now use local calendar days. Empty date input cannot be saved.

## Verification

- Regression coverage includes remote-only edits, rule deletion/concurrent edits, persisted offline deletion with a mocked failed fetch, repeated offline edits, legacy pending data, search/tag filtering, contribution totals, rendered Plan search, Jakarta midnight timestamps, DST and year rollover.
- Browser check: opened Add Task with 26 September, closed it, selected 28 September in Calendar and reopened Add Task. Due Date correctly changed to 28 September. No test record was saved; the app was returned to Home.
- All 352 tests pass (9 additional regression tests), along with TypeScript and the production build. Existing build warnings remain for large chunks and an outdated Browserslist dataset.
- No authenticated Google Sheets or Calendar writes were performed. Cloud payload/merge behavior is covered by local tests; live end-to-end cloud verification remains to be done with a connected test account.

The original archive and prior UI package remain untouched. No feature was intentionally removed.
