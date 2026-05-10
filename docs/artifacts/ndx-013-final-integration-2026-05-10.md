# NDX-013 Final integration and release handoff

Status: integrated and ready to mark done.

## Ticket disposition

| Ticket | Disposition | Evidence |
|---|---|---|
| NDX-001 | included | Parser baseline contract/docs/artifacts regenerated. |
| NDX-002 | included | Local finance parser/router tests passing. |
| NDX-003 | included | Router confidence/local-save/review/deep-AI tests passing. |
| NDX-004 | included | Context builder + strict field validator tests and benchmark passing. |
| NDX-005 | included | Behavior cache service/doc/tests passing. |
| NDX-006 | included | Async enrichment queue and merge-safe tests passing. |
| NDX-007 | included | Review Center cleanup tests and proof HTML regenerated. |
| NDX-008 | included | Parser telemetry/benchmark harness evidence represented by baseline/context/model-routing benchmark scripts. |
| NDX-009 | included | Batch parser coordinator, tests, and DOM proof regenerated. |
| NDX-010 | included | Fast-then-deep model routing policy, tests, docs, and benchmark regenerated. |
| NDX-011 | included | Parser Health card, aggregate metrics selector, guardrails, and tests added. |
| NDX-012 | included | Final QA report and validation logs generated. |

## Integrated commits already shipped before this handoff

- `a8ba537` Close NDX-002 income and date proof gaps
- `6d60820` NDX-006 async enrichment queue
- `0c85b05` Finish NDX parser workflow tasks

## This handoff adds

- Control Center Parser Health surface.
- `buildParserHealthSummary` aggregate metrics/guardrail selector.
- Parser Health unit tests.
- NDX-011/012/013 proof artifacts.
- Changelog entry `v0.3.84`.

## Release target

- Push target: `origin/beta` and `origin/main`.
- Validation required before push: `npm run lint`, `npm test`, `npm run build`.
