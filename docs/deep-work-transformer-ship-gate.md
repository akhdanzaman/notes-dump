# Deep Work Transformer ship gate (NDC-013)

Date: 2026-05-03 (Asia/Jakarta)
Verdict: **reject ship / do not keep as shipped**

## Real-data source

Used the real Notes Dump backup snapshot at `../state/notes-dump-repair-backup-2026-04-14T23-45-43-290Z.json` because the current repo has already migrated away from tracked `db.json` and the live feature code has no Deep Work Transformer implementation to exercise.

Snapshot facts from `scripts/validate-deep-work-transformer-ship-gate.mjs`:

- Todos: 49 total, 43 done, 6 pending (`87.8%` completion).
- Abstract-ish todos matched by summary/research/regulasi patterns: 7 total, 6 done, 1 pending.
- Required real target tasks found:
  - `Selesaiin summary IIMS 2026` (`id=68b699ca-f3e9-4e9b-9628-ca5a97fb852d`)
  - `Lanjut summary regulasi` (`id=4d99ca3c-3aea-4cf4-be6a-8fea85af8456`)

## Before / after judgment on real abstract tasks

### 1) `Selesaiin summary IIMS 2026`

Before: a single vague todo. It says the topic, but not the first source, output format, or stop point.

Useful transformed version:

- Next action: open the IIMS 2026 source material and capture the top 5 automotive / regulation / market notes in bullets.
- Final requested output: one-page IIMS 2026 summary with key findings, implications for work, and 3 follow-up questions.
- Session estimate: 45-60 minutes.
- Blocker check: if source material is missing, first collect brochure/link/photos before summarizing.
- Optional subtasks: collect source links/photos; extract 5 facts; write final one-page summary.

Judgment: this is materially clearer. The value is not prettier wording; it removes the need to decide what “summary” means at task-start time.

### 2) `Lanjut summary regulasi`

Before: a single continuation todo. It does not preserve which regulation, what “lanjut” resumes from, or what completion means.

Useful transformed version:

- Next action: pick the exact regulation/doc number and write the current section heading + last completed paragraph before continuing.
- Final requested output: regulation summary with scope, obligations, deadlines, affected products/processes, and open questions.
- Session estimate: 60-90 minutes.
- Blocker check: if the regulation/doc is unspecified, do not start writing; first identify the document and source URL/file.
- Optional subtasks: identify regulation and source; extract obligations/deadlines; draft summary; list unresolved interpretation questions.

Judgment: this is even more useful than the IIMS case because it attacks the real “stuck” cause: missing source, missing restart point, and missing definition of done.

## Nested subtasks call

Optional nested subtasks **improve the outcome only if they stay compact and collapsed by default**.

- Good: 3-4 concrete checklist items that expose progress while keeping the parent task intentional.
- Bad: always-expanded boilerplate like “research / draft / review” on every abstract task; that becomes clutter.
- Product call: the mandatory value is `nextAction`, `finalOutput`, `sessionEstimate`, and `blockerCheck`. Nested subtasks should be optional support, not the main feature.

## Implementation scan

Static scan of app source (`types.ts`, `components`, `hooks`, `services`, `utils`, `App.tsx`) found only partial / unshipped Deep Work Transformer artifacts after concurrent implementation work landed in the workspace:

- `types.ts` has Deep Work metadata fields such as `parentTodoId`, `deepWorkParent`, `deepWorkPlanId`, `deepWorkNextAction`, `deepWorkFinalOutput`, `deepWorkBlockerCheck`, and `subtasks`.
- `services/geminiProService.ts` / `services/geminiService.ts` ask parser output to include `meta.subtasks` for abstract TODOs.
- `services/deepWorkTransformer.ts` contains a heuristic `buildDeepWorkPlan` helper, and `hooks/useBrainDumpData.ts` now imports it for create-item fan-out.
- `services/spreadsheetReconciler.ts` and `utils/exportUtils.ts` now contain Deep Work field mapping markers.
- But Plan/Card UI still has no Deep Work fields, no compact next action/final output/blocker display, and no nested subtask interactions.
- The sync/export markers are not backed by a real round-trip test or runtime sync proof in this gate.
- Changelog has no Deep Work Transformer entry.

This is still the shallow/gimmick risk: metadata and generated child todos exist, but the user-facing execution contract is not visible/proven enough to make stuck tasks easier to execute.

## Release evidence

- `npm run build` passes for the current app, but that only proves the bundle compiles.
- `npm run lint` is still blocked by an existing `utils/journalUtils.ts` status typing error.
- Static scan finds spreadsheet export/reconcile Deep Work markers, but no executed sync/refresh round-trip test.
- Changelog currently stops at `v0.3.17` and contains no Deep Work Transformer entry.
- Therefore, complete sync/refresh/changelog/build evidence for the **feature** does not exist, even though the general app build succeeds.

## Final call

The concept is useful on Adan's real failure mode, but the shipped behavior is incomplete and too shallow. Passing this gate would be fake. Reject ship and continue only with a narrower corrective implementation: first land the enhanced todo data contract + deterministic transformer + round-trip tests, then rerun this gate before UX polish.
