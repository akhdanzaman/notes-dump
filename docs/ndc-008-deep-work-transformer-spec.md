# NDC-008 Deep Work Transformer spec + anti-gimmick proof

Status: ship-ready implementation spec, pre-code
Scope: Notes Dump Plan/Todo flow only
Decision: ship as a **decision-support breakdown layer**, not as AI magic rewriting every task.

## 1. Product thesis

Deep Work Transformer turns abstract, stalled todos into a small execution contract:

1. What is the next physical/mental action?
2. What final output would make the parent todo done?
3. How long is the next session likely to take?
4. Is the task blocked by missing input/context?
5. Should the app create child todos, or only suggest them?

This is useful only if it changes the user's next decision. If it merely rewrites `summary regulasi` into prettier motivational text, reject it.

## 2. Real-data problem examples

Observed examples from the local Notes Dump task snapshot:

- `Selesaiin summary IIMS 2026` — TODO, done, progress 100%.
- `Lanjut summary regulasi` — TODO, done, no progress note.
- `summary kepmen komdigi no 569 tahun 2025` — TODO, done, no progress note.
- `Selesaiin summary sdppi` — TODO, done, no progress note.
- `cari tau gimana dapet update regulasi` — TODO, done, no final artifact captured.
- `Riset 10 referensi pasar atau kompetitor desk toys and decoration, lalu ringkas style, harga, material, audience, dan sinyal laku` — TODO, pending, high priority.
- `Rangkum temuan minggu ini lalu putuskan: lanjut, ubah angle, atau pivot kecil` — TODO, pending.
- `Review 30 menit: apa yang makin jelas, apa yang masih kabur, dan apa yang harus dibuang minggu depan` — TODO, pending.

The repeated pattern is not that these tasks are impossible. The issue is that several tasks do not encode the next session, done-state, or blocker. That makes Plan view less actionable even when the task title is accurate.

## 3. What counts as abstract or stuck

A todo qualifies for Deep Work review when at least one abstract-pattern signal and one usefulness signal are present.

### 3.1 Abstract-pattern signals

Pattern families that count:

- **Summary / synthesis:** `summary`, `summarize`, `rangkum`, `ringkas`, `resume`, `buat rangkuman`, `bikin summary`, `recap`, `synthesize`.
- **Regulation / compliance ambiguity:** `regulasi`, `peraturan`, `kepmen`, `komdigi`, `sdppi`, `legal`, `policy`, `update regulasi` when the title does not say which source, decision, or output is needed.
- **Research / discovery:** `research`, `riset`, `cari tau`, `pelajari`, `explore`, `benchmark`, `competitor`, `referensi`.
- **Review / reflection:** `review`, `evaluasi`, `retrospective`, `apa yang jelas`, `apa yang kabur`, `temuan minggu ini`.
- **Continue / vague continuation:** `lanjut`, `lanjutkan`, `selesaiin`, `beresin`, `kerjain`, `progress`, especially when the object is broad.
- **Create vague artifact:** `bikin`, `buat`, `prepare`, `mapping`, `plan`, `skema`, `briefing`, `proposal`, `deck`, when final artifact shape is missing.
- **Decision task:** `putuskan`, `decide`, `pilih`, `prioritize` when decision options or criteria are missing.

### 3.2 Usefulness signals

At least one must be true:

- No explicit final output, e.g. `summary regulasi` does not say `1-page brief`, `slides`, `table`, or `email draft`.
- No next action, e.g. the task says `lanjut` but not `open source doc and extract 5 changes`.
- No session size, e.g. a task can consume an indefinite evening.
- No blocker check, e.g. missing source file, target audience, deadline, or decision criteria.
- Stale or pressure-bearing: pending for more than 3 days, high priority, due/overdue, or progress unchanged.
- Previous completion left no progress note / artifact, so future similar tasks are likely to repeat the same ambiguity.

### 3.3 Counter-examples that should not transform

Do not transform these automatically:

- `Riset 10 referensi pasar atau kompetitor desk toys and decoration, lalu ringkas style, harga, material, audience, dan sinyal laku` — already has count, scope, dimensions, and final summary. It may only need a session estimate.
- `Review 30 menit: apa yang makin jelas, apa yang masih kabur, dan apa yang harus dibuang minggu depan` — already has timebox and review questions. It may only need an optional decision-output label.
- `Buat RFQ untuk parts kampas rem` — concrete work artifact; do not invent internal steps unless the user asks.
- `Packing buku-buku buat dibawa ke jakarta` — physical checklist task, not deep work.
- Any todo with an existing detailed checklist, explicit acceptance criteria, and a clear due date.

## 4. Mandatory structured output

Every accepted transformation must produce this object. Missing mandatory fields means the transform is rejected or routed to suggestion-only.

```ts
type DeepWorkTransform = {
  status: 'suggested' | 'applied' | 'rejected';
  trigger: {
    pattern: 'summary' | 'regulation' | 'research' | 'review' | 'continuation' | 'artifact' | 'decision';
    evidence: string[];
    confidence: 'low' | 'medium' | 'high';
  };
  nextAction: {
    text: string;                 // verb + object + source/context
    durationMinutes: number;      // 15, 25, 45, 60, 90 max for one session
    acceptanceCheck: string;      // how user knows this next action is done
  };
  finalRequestedOutput: {
    format: 'bullet_summary' | 'brief' | 'table' | 'decision_memo' | 'slides' | 'email_draft' | 'notes' | 'unknown';
    description: string;
    audience?: string;
  };
  sessionEstimate: {
    minutes: number;
    confidence: 'low' | 'medium' | 'high';
    reason: string;
  };
  blockerCheck: {
    blocked: boolean;
    questions: string[];
    missingInputs: string[];
  };
  subtasks?: Array<{
    title: string;
    estimateMinutes: number;
    doneCheck: string;
  }>;
  rejectionReasons?: string[];
};
```

Rules:

- `nextAction.text` must start with a concrete verb: open, read, extract, compare, list, draft, decide, send, ask, review.
- `finalRequestedOutput.description` must define a done-state, not a vibe.
- `blockerCheck.questions` must be zero to three questions max.
- `subtasks` are optional and capped at five in MVP.
- No subtask may be a synonym of the parent title.

## 5. Example transformations

### 5.1 `Selesaiin summary IIMS 2026`

Classification:

- Pattern: summary + continuation.
- Problem: no source, audience, or output format.
- Recommendation: suggest breakdown first; do not auto-create children unless user accepts.

Good suggestion:

```json
{
  "nextAction": {
    "text": "Open the IIMS 2026 notes/source material and mark the 5 points worth summarizing",
    "durationMinutes": 25,
    "acceptanceCheck": "Five candidate points are listed with source references"
  },
  "finalRequestedOutput": {
    "format": "brief",
    "description": "A concise IIMS 2026 summary with key highlights, implications, and any follow-up actions"
  },
  "sessionEstimate": {
    "minutes": 60,
    "confidence": "medium",
    "reason": "Summary task is clear, but source volume and audience are unknown"
  },
  "blockerCheck": {
    "blocked": true,
    "questions": ["Which IIMS source should be summarized?", "Who is the summary for?"],
    "missingInputs": ["source material", "audience/output format"]
  },
  "subtasks": [
    { "title": "Collect IIMS 2026 source notes", "estimateMinutes": 15, "doneCheck": "Sources are in one place" },
    { "title": "Extract 5-7 key IIMS points", "estimateMinutes": 25, "doneCheck": "Each point has a source reference" },
    { "title": "Draft final IIMS summary", "estimateMinutes": 20, "doneCheck": "Brief is readable without reopening sources" }
  ]
}
```

Bad transformation to reject:

- `Do summary IIMS with focus and discipline.`
- `Research IIMS.`
- `Make it better.`

Why rejected: no done-state, no blocker check, no decision improvement.

### 5.2 `Lanjut summary regulasi`

Classification:

- Pattern: regulation + summary + continuation.
- Problem: high ambiguity. The next session depends on which regulation and what changed.
- Recommendation: suggestion-only with blocker questions.

Good suggestion:

```json
{
  "nextAction": {
    "text": "Identify the exact regulation source and write the title/date/version at the top of the working note",
    "durationMinutes": 15,
    "acceptanceCheck": "The regulation source is named and linked or copied into the working note"
  },
  "finalRequestedOutput": {
    "format": "table",
    "description": "A regulation summary table: rule/reference, what changed, impact, required follow-up, owner/deadline if any"
  },
  "sessionEstimate": {
    "minutes": 75,
    "confidence": "low",
    "reason": "Regulation scope and output audience are missing"
  },
  "blockerCheck": {
    "blocked": true,
    "questions": ["Regulasi yang mana?", "Need summary for self, boss, or submission?", "Is the goal understanding, compliance action, or presentation?"],
    "missingInputs": ["specific regulation", "audience", "purpose"]
  },
  "subtasks": [
    { "title": "Confirm regulation source and purpose", "estimateMinutes": 15, "doneCheck": "Source + purpose are explicit" },
    { "title": "Extract clauses that affect work", "estimateMinutes": 30, "doneCheck": "Relevant clauses are listed with references" },
    { "title": "Write impact/action table", "estimateMinutes": 30, "doneCheck": "Each clause has impact and next action" }
  ]
}
```

Bad transformation to reject:

- `Read regulasi, summarize regulasi, finish regulasi.`
- `Make a regulation summary.`
- Any transform that assumes a specific regulation without evidence.

### 5.3 `summary kepmen komdigi no 569 tahun 2025`

Classification:

- Pattern: regulation + summary.
- Better than `summary regulasi` because source is specific.
- Recommendation: auto-suggest with higher confidence; still ask output audience if unknown.

Good next action:

- `Open Kepmen Komdigi No. 569/2025 and extract the 5 clauses that change obligations or workflow.`

Final output:

- `A brief or table summarizing key clauses, impact, and follow-up actions.`

### 5.4 `Riset 10 referensi pasar atau kompetitor desk toys...`

Classification:

- Pattern: research, but already concrete.
- Recommendation: no transform by default. Offer `Start 45-min session` or `Create checklist` only if user taps.

Why this proves anti-gimmick behavior: the detector must avoid touching a task just because it contains `riset`. The task already says count, dimensions, audience-ish scope, and final artifact.

## 6. Auto-transform vs suggest-only

### 6.1 Recommended product behavior

MVP default:

- **Auto-detect and visually flag** abstract/stuck tasks.
- **Auto-generate a non-mutating suggestion preview** when confidence is medium/high.
- **Do not auto-create child todos** unless the user taps `Create subtasks`.
- **Do not rewrite the parent title automatically**. Preserve the original user wording.

This keeps the feature useful without pretending the app knows more than it does.

### 6.2 Auto-apply allowed

Auto-apply is allowed only for metadata enrichment, not task creation, when all are true:

- Single existing TODO.
- Confidence is high.
- No blocker questions.
- Final output is explicit or inferable from a specific source.
- Generated next action is concrete and under 90 minutes.
- No dates, money, external communications, deletes, completions, or private/public writes are involved.

Allowed auto-applied metadata examples:

- `deepWork.status = suggested`
- `deepWork.nextAction`
- `deepWork.finalRequestedOutput`
- `deepWork.sessionEstimate`
- `deepWork.blockerCheck`

### 6.3 Suggest-only required

Suggest-only is required when:

- Confidence is medium or low.
- The task mentions regulation/legal/compliance but not the exact source.
- The output audience is missing and changes the shape of the answer.
- More than five subtasks would be needed.
- The task asks for a decision but criteria/options are missing.
- The user explicitly says they want todos inside one todo.
- The proposed transform would add due dates or commitments.

### 6.4 No transform

No transform when:

- Task is already concrete enough.
- Task is physical/simple.
- Task has explicit checklist/acceptance criteria.
- Task is a transaction, event, shopping item, completed routine, or journal entry.
- The generated plan would be generic filler.

## 7. Nested todo behavior

MVP should support one parent-child level for TODO only.

### 7.1 Data semantics

Parent todo:

- Keeps the original title/content.
- Stores the deep work plan and completion mode.
- Represents the final requested output, not every small step.

Child todos:

- Are normal TODO items.
- Carry `parentId` metadata pointing to the parent.
- Are independently completable and visible in Plan view under the parent.
- Should not be exported as separate top-level work without parent context.

Recommended optional metadata additions:

```ts
type TodoCompletionMode = 'manual' | 'all_subtasks' | 'final_output_check';

type DeepWorkMeta = {
  parentId?: string;
  childIds?: string[];
  completionMode?: TodoCompletionMode;
  deepWork?: DeepWorkTransform;
};
```

Implementation can add these as optional `ItemMeta` fields so old records remain valid.

### 7.2 Completion semantics

- Default completion mode: `final_output_check` for deep work parents.
- Parent is not automatically done just because the first next action is done.
- If `completionMode = all_subtasks`, parent completes when all child TODOs are done.
- If `completionMode = final_output_check`, app shows a final done check: `Is the final requested output complete?`.
- If the user manually completes the parent while children remain pending, show confirmation: `Complete parent and keep subtasks open?`.
- Completing parent does not delete children.
- Deleting parent asks whether to detach or delete children.

### 7.3 Nesting limit

MVP supports only one level:

- Parent TODO -> child TODOs.
- No child-of-child UI in MVP.
- If a child is also abstract, show `Break this down separately` inside that child rather than nesting deeper.

## 8. Failure modes and rejection criteria

Reject or suppress transformation when any is true:

1. **Fluff:** Next action is motivational, vague, or a synonym of the parent.
2. **Invented facts:** It assumes source documents, deadlines, audience, regulation details, or business decisions not present in task/context.
3. **Misleading confidence:** Confidence high despite missing source/audience/criteria.
4. **No decision improvement:** User still cannot choose what to do in the next 15-90 minutes.
5. **Over-decomposition:** Creates many tiny todos that increase maintenance more than clarity.
6. **Semantic drift:** Changes `summary` into `research` or `compliance decision` without evidence.
7. **False completion:** Parent marked done after a subtask even though final output is missing.
8. **Sync/export loss:** Parent-child relationship or final output disappears in spreadsheet/export.
9. **Analytics pollution:** Child todos inflate productivity counts without parent context.
10. **Review fatigue:** App repeatedly suggests breakdowns for concrete tasks.

A transformation is accepted only when it passes all checks:

- Concrete next action present.
- Final output present.
- Estimate present.
- Blocker status present.
- No invented facts.
- User can either start now, answer blocker questions, or reject the suggestion.

## 9. Acceptance criteria for implementation

### 9.1 Parser / detector

- Detects abstract patterns using title/content + metadata, not only keywords.
- Produces `DeepWorkTransform` with mandatory fields for accepted suggestions.
- Emits explicit `rejectionReasons` for concrete counter-examples.
- Test fixtures include: `Selesaiin summary IIMS 2026`, `Lanjut summary regulasi`, `summary kepmen komdigi no 569 tahun 2025`, desk-toys research counter-example, and packing-books counter-example.
- Must not create child todos from parser alone; creation requires user action.

### 9.2 Data model

- Adds optional metadata fields only; no breaking migration for existing TODOs.
- Parent-child linkage survives app reload and sync reconciliation.
- Parent stores original content plus `deepWork.finalRequestedOutput`.
- Child stores `parentId` and its own done check/estimate.
- Migration/backfill should not transform historical done tasks automatically; historical examples are fixtures only.

### 9.3 UX

- Plan cards can show a small `Needs first action` / `Deep Work` prompt for eligible todos.
- Suggestion panel shows: next action, final output, estimate, blockers, and optional subtasks.
- Primary actions: `Start next action`, `Create subtasks`, `Dismiss`, `Edit suggestion`.
- For blocker cases, primary action becomes `Answer blockers` or `Add source`.
- Parent card shows child progress without hiding the final output check.
- Concrete tasks should remain visually quiet.

### 9.4 Sync / export

- Spreadsheet system snapshot already stores full JSON; visible `Todos` sheet must also preserve parent/deep-work fields needed for human-readable export.
- Add visible columns or export fields for: `Parent_ID`, `Child_Count`, `Completion_Mode`, `Deep_Work_Status`, `Next_Action`, `Final_Output`, `Session_Estimate_Min`, `Blocker_Status`.
- Reconciler must round-trip those fields without duplicating child todos.
- XLSX export includes parent context for child tasks.
- Analytics selectors must be able to count parent projects separately from child steps or exclude child steps from top-level throughput when needed.

### 9.5 Changelog / release gate

- Changelog entry must say this is a breakdown aid for abstract/stuck todos, not a universal AI planner.
- Release notes must mention opt-in subtask creation and parent completion semantics.
- Release gate must include real-data dry run on the examples above.
- If dry run produces generic output for `summary IIMS` or invents facts for `summary regulasi`, feature does not ship.

## 10. Implementation recommendation

Ship narrow:

1. Add detector + transform model/tests.
2. Add suggestion UI on Plan cards.
3. Add opt-in child todo creation with one-level parent semantics.
4. Add sync/export fields.
5. Run real-data dry gate against abstract examples and counter-examples.

Do not ship as a broad `AI transforms your todos` feature. That would be shallow. The useful version is more specific: **find the stuck abstract task, define done, pick the next session, surface blockers, and only create subtasks after consent**.
