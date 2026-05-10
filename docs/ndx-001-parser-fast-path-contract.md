# NDX-001 — Parser Architecture Baseline, Benchmark, and Fast-Path Contract

Date: 2026-05-09  
Repo: `notes-dump`  
Scope of this artifact: documentation, benchmark script, and proof artifacts only. No production runtime code was changed by this ticket.

## 1. Current input → parser → canonicalizer → review → save flow

### UI entry and task tracking

1. `App.tsx` passes `handleSend` from `hooks/useBrainDumpData.ts` into input surfaces.
2. `hooks/useBrainDumpData.ts::processItemInBackground(text, tempId)` creates/updates a `ParsingTask` with `status: pending` and then sets stage `router`.
3. The parser now enters `services/parserRouter.ts::routeParserInput` before any AI call.

### Router and local fast path

`routeParserInput` calls `classifyLocalIntent`:

- Route `local_save`: local parser produced a high-confidence `ParserResultV2`; current flow skips deep AI and continues to canonicalizer.
- Route `review`: local parser produced a medium/low-confidence structured result; current flow queues Review Center before save.
- Route `deep_ai`: local router detected mixed/complex/unknown input; current flow invokes the configured deep parser callback.

The finance-specific local parser is `services/localFinanceParser.ts::parseLocalFinanceCommand`. It handles explicit expense/income/transfer/saving commands, Indonesian amount suffixes, known wallet aliases, known saving goals, missing-field review reasons, and local timing telemetry.

### Deep parser paths

When `routeParserInput` chooses `deep_ai`, `hooks/useBrainDumpData.ts` uses the existing parser setting:

- `appSettings.useProParser === true`: call `services/geminiProService.ts::parsePro`, which performs Stage 1 intent/action/entity extraction and Stage 2 payload extraction via two Gemini `generateContent` calls.
- Otherwise: call `services/geminiService.ts::classifyText`, the current default deep fallback, with one Gemini `generateContent` call and legacy JSON-array output. `convertLegacyResultsToNative` converts legacy `Partial<BrainDumpItem>[]` into `ParserResultV2[]`.

### Canonicalizer, multiplicity guard, review, and save

After local or deep parser output:

1. `canonicalizeParserResults` applies system/learned canonical rules and may attach `canonicalReview` and `needsReview` metadata.
2. `guardParserResultMultiplicity` deduplicates repeated/variant finance results for a single logical input.
3. If router route is `review`, results are inserted into `pendingReviews` and rendered by `ReviewCenterPanel`/`PendingReviewList`.
4. If route is `deep_ai` and `enableDraftReview` is true, deep-parser results also go to Review Center.
5. Otherwise `executeParserResults` mutates local state and `saveAndSync` persists/syncs after parser in-flight coordination.

## 2. Slow paths and measurable baseline

Benchmark script: `scripts/parser-baseline-benchmark.ts`  
Artifacts:

- `docs/artifacts/ndx-001-parser-baseline-2026-05-09.json`
- `docs/artifacts/ndx-001-parser-baseline-2026-05-09.md`

This runtime has no `GEMINI_API_KEY` or `GOOGLE_API_KEY`, so mixed/long deep-AI cases record `deep_ai_missing_key`. Local routes still provide real measured router/canonicalizer/guard latency. Deep/pro token and call estimates are static from repo prompts.

Current benchmark summary from this runtime:

| Case | Current route | AI calls | Avoided AI calls | Latency ms | Est input tokens | Review? | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| simple expense | local_save | 0 | 1 | 45 | 0 | no | local phrase spend path |
| transfer | local_save | 0 | 1 | 4 | 0 | no | local finance transfer |
| saving | local_save | 0 | 1 | 1 | 0 | no | local finance saving matched known goal |
| todo | local_save | 0 | 1 | 1 | 0 | no | explicit todo prefix |
| shopping | local_save | 0 | 1 | 3 | 0 | no | obvious unpaid shopping intent |
| mixed batch | deep_ai | 1 expected | 0 | 1* | 2262 | no in missing-key fallback | semicolon/mixed complexity |
| long natural language | deep_ai | 1 expected | 0 | 0* | 2284 | no in missing-key fallback | mixed/complex natural language |

`*` Deep-AI latency is missing-key fallback latency, not provider latency and not an SLA. Re-run with a Gemini key for live provider calibration:

```bash
GEMINI_API_KEY=... npx tsx scripts/parser-baseline-benchmark.ts --include-pro
```

Static pro comparison in the artifact shows the two-stage path is 2 expected AI calls with ~3272–3343 estimated input tokens for these cases and up to 18 retry attempts in the worst recursive retry window.


## Benchmark methodology and validity notes

- Sample count: one run per benchmark case in this local Node/tsx runtime. The script is intentionally lightweight and reproducible, not a statistically significant perf suite.
- Cold/warm timing: no warm-up separation is reported. The first local case may include module/JIT/cache setup; later local cases are closer to warm-path timing. Downstream ship gates should add repeated cold/warm runs.
- Real vs estimated calls: local `local_save` rows are real current-runtime executions through `routeParserInput`, `canonicalizeParserResults`, and `guardParserResultMultiplicity`. Deep AI provider calls were not made in this runtime; deep rows record expected call counts and missing-key fallback behavior.
- Non-SLA estimates: deep-AI latency/tokens in this artifact are planning estimates only, not SLA or provider-billing truth. Live-provider calibration is queued for the downstream ship gate once a Gemini-keyed environment is available.
- Token estimates: input token estimates are static approximations from actual repo prompt text using `ceil(promptCharacters / 4)`. They are sizing/cost baselines, not provider billing records.
- Why `local_save` is current behavior: `hooks/useBrainDumpData.ts` currently imports and calls `routeParserInput` before `parsePro`/`classifyText`; `services/parserRouter.ts` can return `local_save`, `review`, or `deep_ai`; `services/localFinanceParser.ts` is already in the current repo. This artifact documents that current state and the contract downstream slices must preserve.

## 3. Shared parser result contract

`ParserResultV2` remains the downstream execution schema. The router decision metadata is separate and already typed as `ParserRouterDecisionMetadata` in `types.ts`.

Required execution fields:

- `action`: `create_item`, `update_item`, `complete_item`, `delete_item`, `create_skill`, `create_wallet`, `create_theme`, `transfer_money`, `add_saving_funds`, `query_only`, or `unknown`.
- `entityType`: typed target domain such as `finance`, `todo`, `shopping`, `wallet`, `saving_goal`, or `unknown`.
- `confidence`: coarse label `low | medium | high`.
- `needsReview`: boolean gate signal.
- `reviewReason`: human-readable reason when review is needed.
- `payload`: action-specific execution payload.
- `canonicalReview`: canonicalizer suggestion metadata when applicable.

Router metadata contract:

```ts
type ParserRouterRoute = 'local_save' | 'review' | 'deep_ai';
type ParserIntent = 'finance' | 'todo' | 'shopping' | 'note' | 'journal' | 'event' | 'query_only' | 'unknown' | 'mixed';

interface ParserRouterDecisionMetadata {
  route: ParserRouterRoute;
  intent: ParserIntent;
  confidenceScore: number;
  reasonCodes: string[];
}
```

Every parser implementation should preserve this split: `ParserResultV2[]` for execution; router metadata for observability, rollout, and review routing.

## 4. Local fast-path contract

A local atomic finance result may auto-save only when all invariants pass:

- Input is atomic: no newline/semicolon/bullet batch and no clear mixed intent.
- Exactly one amount is resolved.
- Finance kind is explicit or high-confidence: expense, income, transfer, or saving.
- Transfer has known source and destination wallets; source and destination cannot be the same.
- Saving has source wallet and a matched known saving/investment goal, or else it routes to Review Center.
- Unknown wallet hints do not silently become wallet IDs.
- Result is exactly one `ParserResultV2` with `entityType: finance`, high confidence, and typed payload.
- Canonicalizer and multiplicity guard still run after the local parser.

Target path for common atomic finance input:

`InputBar/App -> handleSend -> routeParserInput -> parseLocalFinanceCommand/classifyLocalIntent -> canonicalizeParserResults -> guardParserResultMultiplicity -> executeParserResults -> saveAndSync`

Target budget: 0 AI calls, p50 local route/canonicalizer/guard under 50ms, p95 under 150ms on client hardware.

## 5. Ambiguity, fallback, and async enrichment contract

Ambiguous input must choose `review` or `deep_ai`, never silent guessing. Review/deep-AI triggers include:

- Multiple actions/entities in one sentence or semicolon/newline/bullet batches.
- Missing amount/source/destination/saving goal for finance actions.
- Unknown wallet hints that do not match known wallet IDs.
- Local confidence below threshold.
- Canonicalizer conflict or multiplicity guard collapse.
- Update/complete/delete without confident target item identity.

Async enrichment rules:

| Field class | Examples | Async behavior |
|---|---|---|
| Critical write facts | amount, financeType, paymentMethod, toWallet, savingGoalId, date | Do not silently mutate after save; queue Review Center if changed. |
| Analytics enrichment | merchant, commodity, subcommodity, tags | May auto-fill only with source/confidence metadata; otherwise queue review. |
| Telemetry/presentation | route, latency, token estimate, reason codes | Safe to attach/update for observability. |

## 6. Rollout flags / safe fallback behavior

Recommended flags and fallbacks for downstream slices:

| Flag | Default | Purpose | Safe fallback |
|---|---:|---|---|
| `parserFastPathEnabled` | true only after monitored rollout | Enables router/local parser. | Legacy/pro deep parser. |
| `parserFastPathShadow` | true during rollout | Compare local candidate against AI without writing from it. | No user-visible effect. |
| `parserLocalAtomicFinanceEnabled` | gated | Allows atomic finance local route. | Deep parser. |
| `parserLocalAtomicFinanceAutoSave` | gated | Permits high-confidence local save. | Review Center first. |
| `parserForceReviewOnAmbiguity` | true | Fails closed for uncertainty. | Review Center/deep AI. |
| `parserAsyncEnrichmentEnabled` | false until proven | Non-critical metadata enrichment after safe save. | Canonicalizer-only metadata. |
| `parserTelemetryEnabled` | true | Persist/log route, latency, call count, token estimate, reason codes. | Local console/artifact only. |

## 7. Acceptance matrix for P1/P2/P3

| Phase | Acceptance | Verification gate |
|---|---|---|
| P1 architecture baseline | Flow, slow paths, Review Center handoff, AI call counts, benchmark artifact, and schema decisions documented. | This doc + scan proof + benchmark artifacts. |
| P1 local finance fast path | Atomic finance can route with 0 AI calls; ambiguous finance does not silently save. | Unit/golden route matrix and call-count telemetry. |
| P1 confidence router | Router outputs route/intent/confidence/reason codes before execution. | Tests for `local_save`, `review`, and `deep_ai`. |
| P2 context slimming | Deep AI receives only route-relevant context. | Prompt token regression benchmark. |
| P2 behavior cache | Repeated merchant/wallet/category behavior can be reused with confidence/source metadata. | Cache hit/miss/rejection tests. |
| P2 async enrichment | Non-critical enrichment cannot rewrite critical facts silently. | Critical-field-change queues review. |
| P3 batch/model routing | Mixed batches split safely and route to appropriate model tier. | Batch golden tests + per-case telemetry. |
| P3 dashboard/ship gate | Parser latency/call/review pressure visible before ship. | Runtime telemetry summary and threshold gate. |

## 8. Production behavior note

This NDX-001 artifact does not modify runtime parser/review/save code. It only adds documentation, a benchmark script, and generated benchmark/proof artifacts. Changelog update is not required for this ticket because there is no user-visible parser/review behavior change from these files.
