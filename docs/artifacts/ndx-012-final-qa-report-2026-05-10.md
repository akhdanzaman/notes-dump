# NDX-012 Final QA report

Status: passed.

## Ship gate evidence

| Gate | Result | Evidence |
|---|---:|---|
| Type/lint | Pass | `.mission-control-proof/ndx-012/lint-final-2026-05-10.log` |
| Full test suite | Pass, 179/179 | `.mission-control-proof/ndx-012/test-final-2026-05-10.log` |
| Production build | Pass | `.mission-control-proof/ndx-012/build-final-2026-05-10.log` |
| Parser baseline benchmark | Regenerated | `docs/artifacts/ndx-001-parser-baseline-2026-05-09.md` |
| Context slimming benchmark | Regenerated | `docs/artifacts/ndx-004-context-benchmark-2026-05-09.json` |
| Model routing benchmark | Regenerated | `docs/artifacts/ndx-010-model-routing-benchmark-2026-05-09.md` |
| Review Center DOM proof | Regenerated | `docs/artifacts/ndx-007-review-center-proof.html`, `docs/artifacts/ndx-009-review-center-dom-proof.html` |

## Current benchmark highlights

- Local obvious parser rows avoid deep AI calls for simple expense, transfer, saving, todo, and shopping inputs.
- Context slimming reduces prompt context sharply for intent-scoped parser calls: stage1 97.2%, finance 68%, task 45.1%, general 58.9% in the generated benchmark.
- Fast-then-deep routing keeps local rows local, accepts fast extraction when sufficient, and escalates to deep parse only for ambiguous mocked outputs.
- Model-routing benchmark planning cost moved from 40 static deep cost units to 24 routed cost units in the representative offline set.

## Data-safety audit

- Strict field validation tests cover invalid wallet/category/date/commodity references and force ambiguous values into review instead of silent overwrite.
- Canonicalizer tests cover behavior-cache reuse, manual review precedence, rejection guardrails, and learned-rule rehabilitation.
- Duplicate parser guard tests cover single expense collapse and distinct multi-entry preservation.
- Review Center tests cover non-empty success summaries, batch traceability, duplicate evidence, and hidden canonical internals.
- Parser health metrics are aggregate-only and avoid returning source text or private content.

## Rollback plan

- Main release commits are regular git commits on `beta`/`main`; rollback is `git revert <commit>` followed by validation and push.
- NDX implementation is modularized around parser router/coordinator/context/model-routing/health utilities, so a targeted revert is viable if a specific slice regresses.

## Remaining risks

- Live Gemini latency/cost calibration still requires a Gemini-keyed environment; offline benchmarks intentionally mark provider latency as non-SLA.
- Build still emits the existing large chunk warning; this is unrelated to NDX parser correctness and was present as a Vite optimization recommendation.
