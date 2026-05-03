# Deep Work Transformer ship gate (NDC-013/NDC-014 rerun)

Date: 2026-05-03 (Asia/Jakarta)
Verdict: **pass corrective ship gate after NDC-014**

## Real-data source

Used the real Notes Dump backup snapshot at `../state/notes-dump-repair-backup-2026-04-14T23-45-43-290Z.json` because the repo has migrated away from tracked `db.json`.

Rerun command:

```bash
node scripts/validate-deep-work-transformer-ship-gate.mjs
```

Snapshot facts from the rerun:

- Todos: 49 total, 43 done, 6 pending (`87.8%` completion).
- Abstract-ish todos matched by summary/research/regulasi patterns: 7 total, 6 done, 1 pending.
- Required real target tasks found:
  - `Selesaiin summary IIMS 2026` (`id=68b699ca-f3e9-4e9b-9628-ca5a97fb852d`)
  - `Lanjut summary regulasi` (`id=4d99ca3c-3aea-4cf4-be6a-8fea85af8456`)

## Corrective rerun output from actual transformer

The validation script now invokes the real implementation in `services/deepWorkTransformer.ts` with `node --import tsx`, not a handwritten before/after fixture.

### 1) `Selesaiin summary IIMS 2026`

Before: single vague todo; no first source checkpoint, output shape, or stop point.

Actual transformed contract:

- Next action: `Open the IIMS 2026 notes/source material and mark the 5 points worth summarizing`
- Final requested output: `A concise IIMS 2026 summary with key points, implications, and follow-up questions or actions.`
- Session estimate: `60 minutes (medium)`
- Blocker check: `Who is the summary for?`
- Optional subtasks:
  - Open the IIMS 2026 notes/source material and mark the 5 points worth summarizing
  - Extract the key points, numbers, dates, and unresolved questions
  - Draft the final summary in the target format

Judgment: pass. This is not boilerplate because the output names IIMS 2026 and starts with source-backed points before drafting.

### 2) `Lanjut summary regulasi`

Before: single vague continuation todo; no regulation source, restart point, audience, or completion shape.

Actual transformed contract:

- Next action: `Identify the exact regulation source and write the title/date/version at the top of the working note`
- Final requested output: `A regulation summary table: rule/reference, what changed, impact, required follow-up, and open questions.`
- Session estimate: `75 minutes (low)`
- Blocker check: `Regulasi yang mana? | Need summary for self, boss, or submission? | Is the goal understanding, compliance action, or presentation?`
- Missing inputs: `specific regulation`, `audience`, `purpose`
- Optional subtasks:
  - Identify the exact regulation source and write the title/date/version at the top of the working note
  - Extract clauses that affect work, obligations, deadlines, or decisions
  - Write the impact/action table

Judgment: pass. This directly catches the stuck cause: source ambiguity and missing audience/purpose before continuing.

## NDC-014 corrective evidence

1. Structured Deep Work contract exists in `services/deepWorkTransformer.ts` and `types.ts`:
   - `nextAction`
   - `finalRequestedOutput` / `deepWorkFinalOutput`
   - `sessionEstimate`
   - `blockerCheck`
   - optional compact `subtasks`
2. Create/update/read paths are wired:
   - Parser/manual create path builds Deep Work suggestion metadata in `hooks/useBrainDumpData.ts`.
   - Parser/manual update path refreshes suggestions through `refreshDeepWorkSuggestionForTodo` when a pending root todo becomes vague deep work.
   - Accept/retrigger/keep-raw paths are implemented in `hooks/useBrainDumpData.ts`.
3. Plan/Card UX is visible/actionable:
   - `components/views/PlanView.tsx` renders the Deep Work panel with next action, final output, estimate, blocker check, progress, preview/edit, transform, keep raw, and retrigger actions.
   - `components/Card.tsx` shows compact Deep Work suggestion metadata in expanded cards.
4. Sync/export/reconcile preservation is covered:
   - `utils/exportUtils.ts` writes parent/child IDs, step order/count, completion mode, status, next action, final output, estimate, blocker fields, and subtasks.
   - `services/spreadsheetReconciler.ts` reads those fields back and preserves legacy rows when new columns are absent.
   - `services/__tests__/deepWorkTransformerIntegration.test.ts` and `utils/__tests__/deepWorkTodoModel.test.ts` cover deterministic round trips.
5. Changelog is present:
   - `utils/changelog.ts` includes v0.3.20 for update-path validation and actual ship-gate proof.

## Validation commands

- `npm run test -- services/__tests__/deepWorkTransformer.test.ts services/__tests__/deepWorkTransformerIntegration.test.ts utils/__tests__/deepWorkTodoModel.test.ts` — pass.
- `npm run build` — pass.
- `node scripts/validate-deep-work-transformer-ship-gate.mjs` — pass with `verdict=pass_corrective_ship_gate`.

## Final call

The NDC-013 rejection was valid at the time: metadata and child todos were not enough. After NDC-014, the feature has a visible execution contract, actionable Plan/Card UX, update-path refresh, sync/export/reconcile proof, changelog coverage, and real-data validation against the IIMS/regulasi todos. Keep shipped, with the important product constraint that subtasks remain optional/compact and the parent completion remains tied to the final requested output unless explicitly configured otherwise.
