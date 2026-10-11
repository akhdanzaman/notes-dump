# Durable spreadsheet sync

Sheets is the main store. IndexedDB atomically preserves entity changes and pending operations. Vercel Queues owns completion after HTTP 202. Data and commit receipt are one Sheets batch. Stable operation IDs support replay; concurrent edits to the same field require review. Writes use entity IDs and changed cells; reads use the affected table plus configuration and receipts. Initial load and report refresh still read the wider dataset. No permanent row index is assumed.

## Rollout

Use Node 22, one consumer in iad1, maxConcurrency 1. Explicitly configure SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS. Test a separate copy, including rollback and real queue acceptance. Deploy SPREADSHEET_DURABLE_SYNC=true and SPREADSHEET_DURABLE_READY_IDS=migration-paused to block ordinary writers. Drain accepted work before migration or deployment cutover.

Capture a full typed backup with scripts/spreadsheet-migration.ts capture --target ID --app-origin URL --output FILE. Review dry-run FILE --output DIRECTORY. Apply requires the current snapshot hash; the original also requires --production. A temporary server-only SPREADSHEET_MIGRATION_SECRET of at least 32 characters allows the migration tool through the existing session, origin, and allowlist checks. Remove this environment variable after migration and redeploy. Activate the verified ID in SPREADSHEET_DURABLE_READY_IDS, run queue-acceptance.ts, and compare user data after synthetic test cleanup.

Rollback restores typed user-entered values and clears newly introduced technical tabs. Keep backups outside source control. Never commit environment files, cookies, or credentials. Preview and Production must use separate test/original IDs.

## Limits and validation

Unsent offline edits need Background Sync support or reopening the app. Accepted jobs finish without the page. Queue retention is seven days; local operations remain until a receipt. Sheets cannot compare-and-swap against concurrent manual cell edits: avoid sorting/editing affected tables during a worker write. Do not run multiple writer deployments or alternate OAuth writers against the same workbook. Reports and Calendar are separate from saves.

Run npm test, npm run lint, and npm run build. Acceptance scripts create synthetic entities, exercise replay and concurrent snapshots, and delete their test entities. Technical receipts remain for deduplication. Completed shopping has one active owner in Transactions; migration archives legacy mirrors. Lossless JSON preserves metadata not represented by visible columns.
