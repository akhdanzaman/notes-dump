# Live Feature/UI Deep Identification — 2026-05-08

Scope: diagnosis of the features and UI currently live at `v0.3.71` after rollback of the accidental `v0.3.72` deep-identification feature. This is not a new product feature; it is an internal audit of shipped behavior and small repair targets.

## Executive result

- Current live baseline is `3f96d70 Revert "Add deep transaction identification"` on `beta`, matching `origin/main` and `origin/beta` before this audit.
- Money > Budget now has the intended structure: Spend Timeline first, then Budget Performance + Spend Anatomy side-by-side on desktop.
- Commodity-first analytics are live through `budgetCategory -> commodity -> subcommodity`, while raw merchant remains preserved for drilldown/export context.
- Two concrete bugs were found and repaired in this audit:
  1. Commodity backfill could infer spend commodities for non-money notes/todos if their text matched food/transport/etc. words.
  2. Saving/investment funding transactions stored `completed_at` but not `meta.date`, so date-filtered Money views could place a backdated saving transaction in the creation period instead of the chosen transaction date.

## Live surface map

### Money > Budget shell

Files/functions:
- `components/views/MoneyView.tsx:87-100` — budget mode state + period navigation.
- `components/views/MoneyView.tsx:123-156` — shared finance selector + budget analytics calls.
- `components/views/MoneyView.tsx:650-793` — standalone Spend Timeline card.
- `components/views/MoneyView.tsx:797-927` — Budget Performance card.
- `components/views/MoneyView.tsx:928-1135` — Spend Anatomy card.

Identification:
- Weekly/monthly/yearly navigation is centralized in `changePeriod()` and correctly switches week/year/month increments by selected Budget mode.
- Spend Timeline is no longer embedded inside Spend Anatomy.
- Hover detail is floating (`absolute`, `pointer-events-none`) for graph and anatomy tooltips.
- UI risk: line `MoneyView.tsx:720-788` uses mouse hover only for timeline bars. This matches the requested hover-only desktop behavior, but mobile discoverability remains weak unless tap/focus behavior is added intentionally later.

### Budget analytics model

Files/functions:
- `utils/budgetAnalytics.ts:79-95` — expense-like transaction filter excludes income/transfer/saving/achieved goals.
- `utils/budgetAnalytics.ts:109-115` — finance dates prefer `meta.date`, then `completed_at`, then `created_at`.
- `components/views/MoneyView.tsx:184-235` — aggregates top commodities/subcommodities for Spend Anatomy.

Identification:
- Spend Anatomy answers “uang habis buat apa” from commodity/subcommodity, not merchant.
- Merchant is still kept as lower-priority context in `BudgetCommodityBreakdown.merchants`.
- Inconsistency to watch: `getFinanceItems()` still counts done saving transactions into `totalExpense` for header/Budget Performance, while `getBudgetCategoryAnalytics()` excludes saving from anatomy. This may be intentional if “budget used” includes saving discipline, but it should stay explicit because Spend Timeline/Anatomy and header totals can diverge.

### Expense transaction edit: commodity/subcommodity

Files/functions:
- `components/views/MoneyView.tsx:236-252` — collects commodity/subcommodity suggestions from existing transaction-like items.
- `components/Card.tsx:553-557` — filters subcommodity suggestions by selected commodity.
- `components/Card.tsx:571` — fields show only for FINANCE expense transactions.
- `components/Card.tsx:1128-1155` — datalist inputs allow suggestions plus custom text.
- `components/Card.tsx:324-385` — save path passes `newCommodity`/`newSubcommodity` to update handler.
- `hooks/useBrainDumpData.ts:1872-1964` — update handler persists raw commodity/subcommodity.

Identification:
- Live UI matches requirement: dropdown suggestions from existing data, but custom text is allowed.
- Behavior signal is durable because edited raw fields are saved and later used by canonical behavior.
- Risk: if a transaction is changed from expense to income/transfer, existing commodity/subcommodity are preserved in metadata. It does not affect expense analytics because those transaction types are excluded, but stale metadata could appear in exports or future editing contexts.

### Canonical behavior adaptation

Files/functions:
- `services/canonicalizerService.ts:139-178` — builds behavior keys from merchant/content/tags.
- `services/canonicalizerService.ts:180-188` — uses repeated behavior to infer commodity/subcommodity.
- `services/canonicalizerService.ts:191-213` — repaired guard: only transaction candidates receive contextual commodity fill.
- `utils/canonicalization/defaults.ts:48-63` — weak/default `others` canonical coverage.
- `utils/canonicalization/transactionInference.ts` — fallback domain inference when behavior has no signal.

Identification:
- Behavior adaptation is live and fills blank/weak `others` commodity/subcommodity from current user history.
- Manual review canonical values remain final and are not rematched.
- Bug fixed: prior path ran commodity context inference on every parser result/sweep item. A non-money note like “sarapan ideas” could get `food/breakfast`. Added `isCommodityContextCandidate()` to restrict contextual fill to FINANCE, or SHOPPING/TODO with money/canonical signals.
- Performance risk: `inferCommodityFromUserBehavior()` rebuilds the behavior index per inference call. Fine at current size, but historical sweeps can become O(n²). Future repair should precompute the behavior index once per sweep/parser batch if data grows.

### Investment saving flow + wallet P/L

Files/functions:
- `components/AddExpenseModal.tsx` — investment saving supports capital-only, units-only-with-price, or capital+units+price.
- `components/views/PlanView.tsx:262-278` — Plan investment funding passes resolved amount/units/unit price.
- `hooks/useBrainDumpData.ts:2161-2205` — creates saving finance item and applies investment units/average buy.
- `utils/selectors/moneySelectors.ts:75-85` — investment saving moves source wallet down and destination investment wallet up.
- `utils/selectors/moneySelectors.ts:99-118` — linked investment P/L adjusts investment wallet balance.

Identification:
- Wallet movement is transfer-like for investment funding.
- Investment wallet balance reflects transferred capital plus linked investment P/L.
- Bug fixed: `handleAddSavingTransaction()` now writes `meta.date` from the chosen funding date, not just `completed_at`, so Money transaction filters and saving rows respect the user-selected date.

### Task UI: Summary/Focus/Deep Work

Files/functions:
- `components/views/SummaryView.tsx:625-700` — Summary focus cards share task panel controls.
- `components/views/PlanView.tsx` task-card rendering mirrors the Summary task workspace pattern.
- `components/Card.tsx` task workspace edit surface and `extraExpandedContent` keep subtasks inside the card.

Identification:
- Deep Work subtasks visually live inside the expanded task card, not in a separate purple external container.
- Summary focus cards use the same card-edit controls pattern as Focus/Plan task cards.
- No live code-level blocker found in this pass.

## Repairs applied in this audit

1. `services/canonicalizerService.ts`
   - Added `isCommodityContextCandidate()`.
   - Prevents non-money notes/todos/events/journals from receiving spend commodity/subcommodity inference just because their text contains words like “sarapan”, “makan”, “ojek”, etc.

2. `hooks/useBrainDumpData.ts`
   - `handleAddSavingTransaction()` now saves `meta.date` using the selected transaction date.
   - Keeps saving/investment funding transactions aligned with Money period filters.

3. `services/__tests__/canonicalizerService.test.ts`
   - Added regression coverage for non-money notes and non-money todos staying out of commodity backfill.

## Priority backlog after this pass

P1 — clarify budget totals semantics:
- Decide whether saving should count in Budget header/Budget Performance `totalExpense`. Currently Budget Anatomy excludes saving while `getFinanceItems()` header totals include done saving.

P2 — mobile discoverability for hover-only details:
- If mobile Budget drilldown matters, add an intentional non-sticky press/focus affordance instead of accidental tap-sticky behavior.

P2 — canonical sweep performance:
- Precompute behavior commodity index once per sweep/parser batch instead of rebuilding in `inferCommodityFromUserBehavior()`.

P3 — stale commodity metadata on finance-type change:
- If exports should be pristine, clear commodity/subcommodity when a FINANCE item is changed away from `expense`; leave untouched for now because analytics already excludes those types.

## Validation

Targeted validation run after repairs:

```bash
npm test -- --test-reporter=spec services/__tests__/canonicalizerService.test.ts utils/__tests__/investmentSavingFlow.test.ts
```

Result: 21 tests passed.

Full release gate before commit:

```bash
npm run lint && npm test -- --test-reporter=spec && npm run build
```

Result: lint passed, 129 tests passed, production build passed. Existing Vite chunk-size warning remains unchanged.
