# Receipt transaction visibility and Review Center fixes

## Fixed behavior

- Approving a receipt review now opens **Money > Transactions**, selects the receipt's transaction month, and clears active transaction filters so the newly saved card is visible immediately.
- Receipt scans follow `appSettings.enableDraftReview`:
  - enabled: queue a receipt draft in Review Center;
  - disabled: save the receipt directly as a finance transaction without creating a review draft.
- Direct receipt saves keep the same line-item, category allocation, attachment, duplicate, and currency validation path as reviewed saves.
- Approving or rejecting a parser/canonical review now removes its related parsing and enrichment activity cards.
- An enrichment run with no new ambiguous results removes obsolete enrichment review drafts.
- Receipt review storage is written immediately on approve/reject/change.
- On load, persisted receipt drafts are pruned when a transaction with the same attachment ID already exists. This repairs drafts left behind after an earlier successful approval.
- Review Center badge counts only unresolved work instead of completed parser/enrichment history.

## Validation

- TypeScript (`tsc --noEmit`): passed.
- Production build (`vite build`): passed.
- Focused receipt/review regression tests: 11 passed.
- Full test suite: 287 passed, 4 pre-existing unrelated failures.
