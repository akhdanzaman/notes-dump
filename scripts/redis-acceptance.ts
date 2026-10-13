import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import {
  SyncCache,
  redisCommand,
  scopeKey,
  receiptKey,
  hashKey,
  reserveSheetsRequest,
  sheetsCooldown,
  QuotaDeferred,
  RESERVE_SCRIPT,
} from "../api/_lib/syncCoordination";

// Only disposable keys: never apply cooldown to the real Google principal.
dotenv.config({ path: ".env.redis-live.local", quiet: true });
const scope = `redis-acceptance-${randomUUID()}`;
const prefix = scopeKey(scope);
const principal = `${scope}@synthetic.invalid`;
const quotaKey = `arkaiv:google-quota:${hashKey(principal)}`;
const keys = new Set<string>([quotaKey]);
const results: { name: string; passed: true; details?: unknown }[] = [];
const pass = (name: string, details?: unknown) => {
  results.push({ name, passed: true, ...(details ? { details } : {}) });
  console.log(`PASS ${name}`);
};
const command = async (args: (string | number)[]) => {
  if (args[0] === "EVAL") {
    for (const key of args.slice(3, 3 + Number(args[2]))) keys.add(String(key));
  } else if (["SET", "GET", "PTTL", "MGET"].includes(String(args[0]))) {
    if (args[0] === "MGET")
      args.slice(1).forEach((key) => keys.add(String(key)));
    else keys.add(String(args[1]));
  }
  return redisCommand(args);
};
const clientA = new SyncCache(command);
const clientB = new SyncCache(command);
try {
  assert.equal(await redisCommand(["PING"]), "PONG");
  pass("REST authentication and PING");
  const sample = `${prefix}:sample`;
  await clientA.set(sample, { ok: true }, 60);
  assert.deepEqual(await clientB.get(sample), { ok: true });
  assert.ok(Number(await command(["PTTL", sample])) > 0);
  pass("shared cache round-trip with TTL");
  const receipts = [{ operationId: "synthetic-op", state: "committed" }];
  await clientA.publish(scope, receipts, ["Notes & Journals"]);
  await clientB.publish(scope, receipts, ["Notes & Journals"]);
  await clientB.setMany(
    [{ key: receiptKey(scope, "synthetic-op"), value: { state: "accepted" } }],
    120,
    true,
  );
  assert.deepEqual(
    await clientB.getMany([receiptKey(scope, "synthetic-op")]),
    receipts,
  );
  assert.deepEqual(await clientB.get(`${prefix}:version`), {
    revision: 1,
    tables: ["Notes & Journals"],
  });
  pass(
    "atomic receipt/version publication, retry idempotency and NX protection",
  );
  await clientA.changed(scope, ["Events", "Notes & Journals"]);
  assert.deepEqual(await clientB.get(`${prefix}:version`), {
    revision: 2,
    tables: ["Notes & Journals", "Events"],
  });
  pass("shared changed-table union");
  const lockKey = `${prefix}:lock`;
  const owner = await clientA.lock(lockKey);
  assert.ok(owner);
  assert.equal(await clientB.lock(lockKey), undefined);
  await clientB.unlock(lockKey, "wrong-owner");
  assert.equal(await clientB.lock(lockKey), undefined);
  await clientA.unlock(lockKey, owner);
  const ownerB = await clientB.lock(lockKey);
  assert.ok(ownerB);
  await clientB.unlock(lockKey, ownerB);
  pass("exclusive lock and owner-checked release");
  const started = Date.now();
  const reservations = await Promise.all(
    Array.from({ length: 4 }, async () => {
      await reserveSheetsRequest(principal, "read", undefined, command);
      return Date.now();
    }),
  );
  reservations.sort((a, b) => a - b);
  const spacingMs = reservations
    .slice(1)
    .map((value, i) => value - reservations[i]);
  assert.ok(spacingMs.every((value) => value >= 1350));
  pass("concurrent read reservations spaced at 40/minute", {
    spacingMs,
    elapsedMs: Date.now() - started,
  });
  // Use the authoritative Lua result, not local network RTT to iad1.
  await reserveSheetsRequest(principal, "read", undefined, command);
  assert.equal(
    Number(await command(["EVAL", RESERVE_SCRIPT, 1, quotaKey, "write", 1500])),
    0,
  );
  pass("independent read/write quota budgets");
  await sheetsCooldown(principal, 60, command);
  let deferred: unknown;
  try {
    await reserveSheetsRequest(principal, "write", undefined, command);
  } catch (error) {
    deferred = error;
  }
  assert.ok(deferred instanceof QuotaDeferred);
  assert.ok(deferred.retryAfterSeconds >= 50);
  pass("shared 60-second cooldown without bypassing the limiter", {
    retryAfterSeconds: deferred.retryAfterSeconds,
  });
} finally {
  // These keys are unique to this disposable acceptance run.
  await redisCommand(["DEL", ...keys]);
}
const output = process.argv[2];
if (output)
  await fs.writeFile(
    output,
    JSON.stringify(
      {
        backend: "Upstash Redis REST",
        passed: results.length,
        results,
        syntheticKeysCleaned: true,
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
