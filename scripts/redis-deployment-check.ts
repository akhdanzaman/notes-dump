import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { syncCache, scopeKey, receiptKey } from "../api/_lib/syncCoordination";

// Read-only deployment check; optional receipt IDs are from the synthetic copy test.
dotenv.config({ path: ".env.redis-live.local", quiet: true });
const args = process.argv.slice(2);
const option = (name: string) => args[args.indexOf(name) + 1];
for (const key of ["--deployment", "--scope", "--vercel-cli", "--output"])
  if (!args.includes(key)) throw new Error(`Missing ${key}`);
const scope = option("--scope");
assert.ok(
  [
    "1QI4JHaz0wIRDUjqqK8Ewnl17vrGv9B9sP9tPvsTKUMI",
    "12mIrkvY6ifFcn3drXOamo7T7yeFFC43cwQqWBsHpLoE",
  ].includes(scope),
);
const origin = new URL(option("--deployment")).origin;
const scratch = path.resolve("work", `redis-check-${randomUUID()}`);
await fs.mkdir(scratch, { recursive: true });
const cookies = path.join(scratch, "cookies.txt");
let csrf = "";
const exec = promisify(execFile);
async function call(route: string, payload: unknown = {}) {
  const body = path.join(scratch, "request.json");
  await fs.writeFile(body, JSON.stringify(payload));
  const { stdout } = await exec(
    process.execPath,
    [
      option("--vercel-cli"),
      "curl",
      route,
      "--scope",
      "akhdanzamans-projects",
      "--deployment",
      origin,
      "--",
      "--silent",
      "--show-error",
      "--cookie",
      cookies,
      "--cookie-jar",
      cookies,
      "--request",
      "POST",
      "--header",
      `Origin: ${origin}`,
      "--header",
      `Referer: ${origin}/`,
      "--header",
      "Content-Type: application/json",
      ...(csrf ? ["--header", `X-Arkaiv-Csrf: ${csrf}`] : []),
      "--data-binary",
      `@${body}`,
      "--write-out",
      "\n%{http_code}",
    ],
    { timeout: 60000, maxBuffer: 1000000 },
  );
  const split = stdout.lastIndexOf("\n");
  assert.equal(Number(stdout.slice(split + 1)), 200);
  return JSON.parse(stdout.slice(0, split));
}
const results: string[] = [];
try {
  csrf = (await call("/api/spreadsheets/service-account/session")).csrfToken;
  const capabilities = await call("/api/spreadsheets/sync/capabilities", {
    spreadsheetId: scope,
  });
  assert.equal(capabilities.coordination, "shared");
  assert.equal(capabilities.ready, true);
  results.push("deployed capabilities report shared coordination and ready");
  const version = await call("/api/spreadsheets/sync/version", {
    spreadsheetId: scope,
  });
  assert.equal(version.shared, true);
  const directVersion = (await syncCache.get(`${scopeKey(scope)}:version`)) || {
    revision: 0,
    tables: [],
  };
  assert.deepEqual(version.version, directVersion);
  results.push("deployed version matches the same Redis database");
  if (args.includes("--manifest")) {
    assert.equal(scope, "1QI4JHaz0wIRDUjqqK8Ewnl17vrGv9B9sP9tPvsTKUMI");
    const manifest = JSON.parse(
      await fs.readFile(option("--manifest"), "utf8"),
    );
    const ids = manifest.create.map(
      (op: { operationId: string }) => op.operationId,
    );
    const cached = await syncCache.getMany<{
      operationId: string;
      state: string;
    }>(ids.map((id: string) => receiptKey(scope, id)));
    assert.ok(cached.every((entry) => entry?.state === "committed"));
    for (let i = 0; i < 2; i++) {
      const response = await call("/api/spreadsheets/sync/status", {
        spreadsheetId: scope,
        operationIds: ids,
      });
      assert.ok(
        ids.every((id: string) =>
          response.receipts.some(
            (receipt: any) =>
              receipt.operationId === id && receipt.state === "committed",
          ),
        ),
      );
    }
    results.push(
      "20 committed Redis receipts match two fresh deployment status requests",
    );
    assert.ok(version.version.revision >= 2);
    assert.ok(version.version.tables.includes("Notes & Journals"));
    results.push(
      "create and cleanup published a shared changed-table revision",
    );
  }
  const report = {
    origin,
    scope,
    coordination: "shared",
    passed: results.length,
    results,
    version: version.version,
    readOnly: true,
    completedAt: new Date().toISOString(),
  };
  await fs.writeFile(option("--output"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
