# NDC-004 Canonical Review UX Handoff

## Outcome target
Make canonical ambiguity review feel like a small mobile inbox: one obvious raw → canonical decision at a time, with confidence, reason, source, and minimal-tap actions. The user should not need to understand canonicalizer internals to decide whether `gacoan` should become `Mie Gacoan`.

## Existing implementation read
- `components/PendingReviewList.tsx` already renders pending AI draft cards above `InputBar`, reads `primaryResult.canonicalReview`, and has a single `Use` action per suggestion.
- `services/canonicalizerService.ts` produces `CanonicalReviewSuggestion` entries with `field`, `rawValue`, `suggestedValue`, `confidence`, `reason`, `source`, and `ruleId`.
- `hooks/useBrainDumpData.ts` stores `pendingReviews`, approves through `handleApproveReview`, rejects through `handleRejectReview`, and learns canonical rules via `learnCanonicalRulesFromReview`.
- `components/ControlCenter.tsx` currently receives only `pendingCount` for parsing/sync status; it does not distinguish canonical-review workload from general parser pending work.

## IA changes

### Pending Review card hierarchy
1. **Card header**
   - Label: `Review suggestion` instead of generic `AI Draft` when `canonicalReview.length > 0`.
   - Compact metadata row: entity type, amount/finance type, and overall parser confidence.
   - Queue marker: `1 of N review fields` if multiple canonical suggestions exist on the draft.
2. **Raw item summary**
   - Keep the current content/title line, but allow two lines on mobile before truncation.
   - Show source text only when different from content: `From: “{review.text}”` in muted 11px copy.
3. **Canonical decision stack**
   - One cardlet per canonical suggestion.
   - Use visual diff format, not sentence format:
     - field chip: `Merchant`, `Payment`, `Subcommodity`
     - left raw pill: `Raw: gacoan`
     - arrow divider: `→`
     - right canonical pill: `Canonical: Mie Gacoan`
   - Supporting metadata row: `82% confidence • learned rule • alias match: “gacoan”`
4. **Actions**
   - Primary: `Apply` per suggestion.
   - Secondary: `Keep raw` per suggestion.
   - Tertiary/overflow: `Override` for manual canonical value edit.
   - Draft-level actions remain at the bottom: `Save draft`, `Edit all`, `Dismiss`.

### Control Center IA
Add a **Data quality** panel to the main Control Center view, above Settings and below the sync status card.

Panel contents:
- Title: `Data quality`
- Status chip:
  - `Clean` when no canonical reviews are pending.
  - `Review needed` when one or more canonical suggestions are pending.
  - `Piling up` when pending canonical suggestions exceed 5 or oldest review is older than 24h.
- Metric row:
  - `Canonical reviews` count = total unresolved canonical suggestion count across pending reviews.
  - `Drafts affected` count = pending review cards with `canonicalReview.length > 0`.
  - `Auto-applied` count if available later; otherwise omit until telemetry exists.
- CTA:
  - If pending: `Review now` scrolls/focuses the pending-review stack above the input.
  - If clean: disabled/quiet text `No canonical cleanup needed`.

## Interaction model

### Apply suggestion
User taps `Apply` on a suggestion.
- The suggestion cardlet changes to selected state:
  - right canonical pill gets indigo fill
  - action becomes `Applied ✓`
  - `Keep raw` remains available as undo
- Data behavior:
  - set `payload.meta.canonical[field]` or `payload.changes.canonical[field]` to suggestion value
  - set `needsReview: false`
  - set `source: manual_review`
  - preserve `rawValue`, `confidence`, `reason`, and `ruleId`
- The draft is not saved until user taps `Save draft`; this avoids accidental multi-field approval.

### Keep raw
User taps `Keep raw` on a suggestion.
- The suggestion cardlet changes to neutral selected state:
  - raw pill gets border emphasis
  - canonical pill fades
  - action becomes `Kept raw ✓`
  - `Apply` remains available as undo
- Data behavior:
  - remove `canonical[field]` for that field from the approved result, or set it undefined before save
  - when saved, `learnCanonicalRulesFromReview` can increment rejection for the original `ruleId` because original canonical suggestion had a rule and approved result no longer has a canonical value
- Copy below selected state: `Won’t group this alias next time unless you apply it later.`

### Override
User taps `Override`.
- Opens inline compact editor inside that suggestion cardlet, not a modal:
  - label: `Canonical value`
  - input prefilled with `suggestedValue`
  - actions: `Save override`, `Cancel`
- Data behavior:
  - save override as canonical value with `source: manual_review`, `needsReview: false`, same `rawValue`, and reason `Manual override during review`
  - after draft save, learned mapping should associate raw alias to override value
- Mobile behavior:
  - focus input and scroll cardlet into view
  - keep controls at least 44px high

### Save draft
User taps `Save draft`.
- If some canonical suggestions are undecided:
  - allow save, but show a one-line confirmation row: `2 suggestions not decided. Save using current defaults?`
  - actions: `Save anyway`, `Review remaining`
- If all suggestions have a selected decision:
  - save immediately through existing `onApprove(review.id, results)` flow
- Success feedback:
  - toast/snackbar: `Saved. Canonical rules updated.` when any apply/override happened
  - `Saved. Raw values kept.` when all were kept raw

### Dismiss
User taps `Dismiss`.
- Keep existing reject behavior, but copy should be explicit: `Dismiss draft`, not just `X`.
- Confirmation only if the draft includes applied/override decisions not saved yet: `Discard this draft and your review choices?`

## States

### Empty
Pending review stack hidden.
Control Center Data quality panel shows:
- `Clean`
- `0 canonical reviews`
- helper copy: `Aliases are being grouped automatically.`

### One canonical suggestion
Show one decision cardlet expanded by default.
Primary action order: `Apply`, `Keep raw`, `Override`.

### Multiple suggestions on one draft
Show all cardlets, but keep them compact:
- first suggestion expanded
- remaining suggestions collapsed to raw → canonical row
- tapping a collapsed row expands it
- draft-level `Save draft` is sticky within the card footer after the first decision

### Low confidence / risky suggestion
When confidence `< 0.70`:
- use amber border
- copy: `Low confidence — check before applying`
- primary action becomes `Review` until the cardlet is expanded; then show `Apply`

### Missing raw or canonical value
- raw missing: `Raw: —` and helper `Parser did not capture a raw value.`
- canonical missing: hide Apply and show `Override` as primary

### Source display
Use user-friendly source labels:
- `system` → `system rule`
- `learned` → `learned rule`
- `manual` → `manual rule`
- unknown/fallback → `canonicalizer`

## Mobile-fit visual guidance
- Pending review container: keep `max-w-2xl`, but use `px-3` on screens under 390px to reduce cramped cards.
- Decision cardlets: vertical stack on mobile; avoid `justify-between` rows that squeeze long merchant names.
- Use 11-12px metadata, 14px values, and 44px minimum action targets.
- Use two primary visual tokens only:
  - indigo for applied canonical choice
  - amber for needs-review risk
- Avoid admin tables, rule IDs as primary text, or dense debug JSON. `ruleId` may be in a long-press/copy/debug affordance later, not visible by default.

## Recommended implementation slices

### Slice 1 — Pending Review card polish
Path: `components/PendingReviewList.tsx`
- Add local per-suggestion decision state: `applied | kept_raw | override | undecided`.
- Replace current single-line `{field}: {raw} → {suggested}` rendering with a reusable `CanonicalDecisionCardlet` inside the same file or a new small component.
- Add `handleKeepRawCanonicalSuggestion` and `handleOverrideCanonicalSuggestion` alongside existing `handleApplyCanonicalSuggestion`.
- Move draft-level approve/reject controls to a labeled footer on cards with canonical suggestions: `Save draft`, `Edit all`, `Dismiss`.

### Slice 2 — Control Center workload visibility
Paths: `hooks/useBrainDumpData.ts`, `App.tsx`, `components/ControlCenter.tsx`
- Derive a `canonicalReviewSummary` from `pendingReviews`:
  - `suggestionCount`
  - `draftCount`
  - optional `oldestCreatedAt` if pending reviews gain a timestamp
- Pass summary to `ControlCenter` as a prop.
- Render the Data quality panel on the main Control Center screen.
- Wire `Review now` to close Control Center and focus/scroll the Pending Review stack; if wiring is too large, first release can close Control Center only because the stack already lives above InputBar.

### Slice 3 — Microcopy and accessibility
Paths: `components/PendingReviewList.tsx`, `components/ControlCenter.tsx`
- Replace icon-only canonical actions with text labels.
- Add `aria-label` text for icon buttons that remain.
- Ensure action buttons have visible text or accessible labels: `Apply canonical merchant Mie Gacoan`, `Keep raw merchant gacoan`, `Override canonical merchant`.

## Suggested copy

### Pending Review labels
- Header with canonical suggestions: `Review suggestion`
- Header without canonical suggestions: `AI draft`
- Section title: `Canonical cleanup`
- Helper: `Group aliases without changing what you originally typed.`
- Confidence row: `{confidence}% confidence • {sourceLabel} • {reason}`

### Actions
- `Apply`
- `Keep raw`
- `Override`
- `Save draft`
- `Edit all`
- `Dismiss`
- Confirmation: `Save with undecided suggestions?`
- Success: `Saved. Canonical rules updated.`

### Control Center
- Panel title: `Data quality`
- Clean body: `No canonical cleanup needed.`
- Pending body: `{suggestionCount} alias decisions waiting across {draftCount} drafts.`
- Piling up body: `Canonical reviews are piling up. Clear them to keep insights grouped correctly.`
- CTA: `Review now`

## Acceptance criteria
- Pending Review cards show raw and canonical values as separate labeled pills with an arrow between them.
- Every canonical suggestion exposes confidence percentage, reason, and source label without opening edit mode.
- User can choose Apply, Keep raw, or Override for each suggestion from the card.
- User can save a reviewed draft without opening the full edit form when suggestions are straightforward.
- Control Center main view shows canonical-review workload separately from parsing/sync pending count.
- Mobile layout uses stacked cardlets and text actions, with no table layout or debug-first presentation.
- Empty and clean states are explicit, so data quality feels managed rather than invisible.

## Non-goals
- Building a full canonical rule management table.
- Exposing raw rule IDs in the main mobile UI.
- Rewriting canonicalizer scoring or parser behavior.
- Adding analytics unless needed later for trend history.
