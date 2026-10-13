# Sheets quota efficiency

Baseline: b0dd7d3. Sheets remains the authoritative store; durable receipts still commit atomically with entity mutations.

## Implemented

- Submit packs up to 20 operations / 200 KB into a queue envelope. The worker supports existing single-operation messages as well as batch messages.
- A batch reads one authoritative snapshot, topologically stages dependencies and three-way merges, then writes data and all receipts atomically. Duplicate IDs/scopes and cyclic dependencies reject. Failure before commit writes nothing. Failure after commit is recovered using Sheets receipts.
- Simple note/event changes do not fetch finance config. Financial/config batches retain formatted budget reads for compatibility. Managed ranges use schema widths, including receipt A:E.
- Terminal receipts are cached only after the Sheets commit. Accepted cache entries use NX so they cannot replace committed receipts. Status cache misses recover from Sheets under a scope lock and 30-second recovery throttle.
- Receipt cache publication and remote-version notification use one Redis script with an idempotent publication marker. Failure after the Sheets commit retries safely without another data write.
- Read and write requests pass through one transport coordinator. Redis server TIME plus atomic Lua controls spacing at 40 requests/minute per kind. A quota key identifies the Google service account, independent of workbook or deployment environment. 429 installs a shared cooldown (at least 60 seconds); the queue schedules retry with jitter.
- Browser and SW skip terminal conflicts, poll only sending/accepted operations, back off to 60 seconds, and resend unknown acceptance only after a minute / accepted operations after queue retention expiry. Web Locks coordinate tab/SW replay. HTTP status failure does not block new mutations from being accepted by the queue.
- Commit events carry changed operations/tables for selective refresh. Version checks read Redis, not Sheets. Metadata reads have a five-minute server cache, keyed by the committed revision; the browser uses its metadata cache. Explicit full data refresh remains available for manual Sheets edits.
- Google transport logs only hashed scope, operation kind, status and duration. Successful worker batch logs operation/receipt counts and actual root transport read/write counts; no cell contents or credentials.

## Shared Redis activation

Activated 13 October 2026: Vercel Marketplace resource `notes-dump-sync`, Upstash Free plan, primary region `iad1`, eviction disabled. The same resource is connected to Preview and Production with Sensitive environment variables. Vercel provides the supported `KV_REST_API_URL` / `KV_REST_API_TOKEN` aliases; no SDK dependency or client-side credentials are required.

Real Redis acceptance is reproducible using `scripts/redis-acceptance.ts`: PING, TTL cache round-trip, atomic publication/idempotency, NX protection, table union, owner-checked locks, concurrent reservation spacing, independent read/write budgets, and shared cooldown. It uses unique disposable keys and a synthetic principal so the test never cools down the real Google identity. Supply REST variables in ignored `.env.redis-live.local` and pass a report JSON path.

`scripts/redis-deployment-check.ts` verifies deployed shared capabilities and compares the version endpoint with the same Redis database. With the synthetic copy manifest it also checks 20 committed receipts through separate deployed status requests. It does not mutate Sheets. The live copy acceptance still verifies queue commit/readback/duplicate/cleanup. Redis status cache hits require no Google requests; cache misses retain canonical Sheets recovery.

Connect one Upstash Redis REST resource to both Preview and Production. The two environments must use **the same database** because they share the Google principal's quota. Use:

```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Existing `KV_REST_API_URL` / `KV_REST_API_TOKEN` aliases are supported. Keep the token server-side; never prefix it with VITE_. No migration secret or broader spreadsheet allowlist is needed. Redeploy after env changes.

When Redis is configured but unavailable, the coordinator fails closed: changes remain in the queue and it does not bypass the quota gate. When no Redis is configured, the existing application remains usable with bounded per-instance caches and rate scheduling. **That fallback does not enforce a shared 40/min cap across serverless instances or environments, nor provide shared receipt/version cache.** Capabilities reports `coordination: shared|instance`; idle remote-version sync is enabled only in shared mode.

Data snapshots are not stored in Redis. Cache data consists of terminal receipt status, metadata, revision/table names and quota scheduling state. Sheets receipts remain the recovery source. Direct Sheets edits require manual/normal refresh; an app-written revision cannot detect them automatically. Worker metadata and mutation data reads remain fresh for conflict checks.

## Validation and reproduction

Run `npm test`, `npm run lint`, `npm run build`. The benchmark runs:

```
node node_modules/tsx/dist/cli.mjs scripts/quota-comparison.ts <output.json>
```

It materializes the before-class from Git revision b0dd7d3 into ignored work/, runs identical synthetic workbooks/operations through before and after code, and records transport calls and payload bytes. It does not call Google, measure network latency, or prove distributed Redis behavior. Warm receipt-cache measurements are explicit.

Required live validation uses the designated copy spreadsheet only: batch create/delete, duplicate delivery, same-field conflict, dependency ordering, commit after HTTP 202, and queue recovery. Redis activation additionally needs PING, real EVAL/lock/publication tests, cross-instance status/version verification, and confirmed shared cooldown. Never issue a production test mutation solely to compare quotas.

Persistent row-position cache is deliberately unnecessary for this quota fix: writes resolve IDs from the fresh batch snapshot. This preserves correctness after manual sort/delete. Narrow table reads and batching deliver the measured quota reduction without trusting stale row indexes.
