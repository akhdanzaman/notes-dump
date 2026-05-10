# NDX-011 Parser Health proof

Status: implemented.

## Delivered

- Added `utils/parserHealth.ts` as a privacy-safe parser metrics selector.
- Added Control Center > Data parser health card with:
  - local fast-path rate
  - AI fallback count
  - average completed-task latency
  - Review Center pressure / review-needed rate
- Added guardrails for failed parser tasks, high review pressure, low fast-path rate, and repeated AI fallback pressure.
- Added unit tests in `utils/__tests__/parserHealth.test.ts` to verify aggregation and that source text is not surfaced in the summary.

## Privacy boundary

The selector only returns aggregate counts/rates/latency/warning text. It does not return raw parser input, item content, wallet names, categories, or review source text.

## Validation commands

- `npm run lint`
- `npm test -- utils/__tests__/parserHealth.test.ts components/__tests__/reviewCenterParserDetails.test.tsx`
- Full gate before release: `npm test`, `npm run build`
