# NDX-005 behavior cache QA notes

## What changed

Finance canonicalization now builds an in-memory behavior cache from recent approved `FINANCE` transactions before parser results are saved. The cache can locally fill repeated-pattern metadata for:

- `paymentMethod` (wallet id)
- `budgetCategory` (budget rule id)
- `commodity`
- `subcommodity`

The cache is used by `canonicalizeParserResults` for new parser output and by `sweepHistoricalCanonicalMeta` for historical backfill. It is intentionally runtime-only: no migration or persistent learned table is introduced.

Historical sweep safety: the sweep is bounded to structured metadata enrichment. It does not rewrite item `content` or raw `merchant`; high-confidence accepted fields can be added to metadata, while ambiguous canonical matches are emitted as review drafts and are not applied to saved history until approved.

## Inputs

Behavior evidence comes from an explicit bounded source window: the most recent 120 approved finance transactions, sorted by `completed_at` then `created_at` descending after source filters are applied.

A source row is eligible only when:

- item type is `FINANCE`
- status is `done`
- parser review/error flags are absent (`parserNeedsReview` and `parsingError` are excluded)
- wallet evidence must resolve to a configured wallet id/name
- budget evidence must resolve to a configured budget rule id/name when budget rules exist
- commodity/subcommodity evidence uses accepted canonical values first, then raw values
- weak values such as blank, `unknown`, `other`, and `others` are ignored

Match keys are derived from repeated transaction shape, not hardcoded finance guesses:

- normalized merchant
- normalized content with amounts/currency removed
- merchant + content
- payment method + content
- merchant + payment method

## Confidence and review rules

Auto-apply requires both:

1. at least 2 matching recent approved transactions for the winning value, and
2. at least 80% agreement for that value within the matching key.

Confidence is scored from agreement and evidence count. Suggestions below the auto-apply threshold are not written as authoritative metadata; the parser remains responsible for review/AI fallback. This avoids turning one-off or conflicted behavior into saved defaults.

## Override rules

Precedence from strongest to weakest:

1. manual review canonical values (`source: manual_review`)
2. explicit parser/user fields already present on the incoming transaction
3. high-confidence behavior cache inference
4. transaction signal inference from text
5. canonical `others` analytics fallback

Behavior inference only fills missing fields, or weak commodity/subcommodity values (`others`/`unknown`). It does not overwrite explicit wallet, budget category, merchant, content, or manual canonical decisions.

## Finance QA notes from Shesya

These are drafted QA notes from Shesya-the-finance based on the implementation and unit/regression tests in this repo; they are not a separate human acceptance sign-off.

- Repeated merchant/content transactions with the same wallet/category/commodity now fill `paymentMethod`, `budgetCategory`, `commodity`, and `subcommodity` locally on the next similar transaction.
- The behavior source window is explicitly the newest 120 approved `FINANCE` rows; pending rows, parser-review rows, and parser-error rows are excluded before recency is applied.
- Stable `others`/`unknown` history is ignored so unclear transactions do not poison future suggestions.
- Conflicted history such as a 50/50 merchant split between food and home categories stays unfilled instead of guessing.
- Raw merchant and transaction content are preserved in historical sweeps; behavior only adds structured metadata.
- Manual review values remain final and are not replaced by behavior inference.
