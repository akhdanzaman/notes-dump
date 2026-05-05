# NDZ-009 Summary and information-surface desktop polish

Baseline audit: `docs/ndz-007-desktop-layout-observation.md` at commit `940ba2b`.
Dependency handoff read: `docs/ndz-008-desktop-shell-polish.md`.

## Scope

NDZ-009 is a surface pass after NDZ-008 fixed the shared shell/container origin. This pass keeps mobile/tablet behavior intact and tunes only the NDZ-007 surfaces that had concrete information-density or grouping findings: Summary/Home, Plan/Focus, Money/Transactions, and Library/Notes. Calendar and Control Center were captured as regression checks but intentionally left structurally unchanged.

## NDZ-007 findings addressed

- **#3 Summary/Home underfills wide monitors:** `contentSurface.dashboardGrid` now uses wider desktop side-column steps (`22rem`, `24rem`, `26rem`) and Summary places the focus list and side stack into a clearer desktop dashboard rhythm. The quick-add side card is framed with desktop-only copy and a 2x2 action grid; Today’s Focus gets a desktop panel treatment; routine and finance sections gain stronger scan grouping without adding unrelated widgets.
- **#4 Plan/Focus cramped workflow columns:** `contentSurface.workflowGrid` and `contentSurface.workflowPanel` provide shared desktop minimums/panel framing for Plan lists. Focus, Shopping, and Goals now opt into this primitive so widened workspaces improve card/editor comfort instead of leaving loose columns.
- **#6 Library/Notes empty state looks unfinished:** Notes, Journal, and Skills empty states now use the shared `emptyStateCard` primitive with purposeful icon/copy/action treatment instead of a single centered line in a blank field.
- **#7 Money/Transactions sparse header and capped workspace:** Money keeps the existing transaction/filter layout but widens the detail split and densifies the hero stats with Income, Expense, and Used cards.

## Shared primitives added / updated

- `contentSurface.dashboardGrid` — wider Summary dashboard side-column rhythm.
- `contentSurface.sideStack` — consistent vertical rhythm for desktop side cards.
- `contentSurface.workflowGrid` — wider multi-panel workflow grid with stronger `minmax()` values.
- `contentSurface.workflowPanel` — reusable framed dense-list panel.
- `contentSurface.emptyStateCard` — reusable intentional empty-state shell.

## Files changed for NDZ-009

- `components/layout/contentSurface.ts`
- `components/views/SummaryView.tsx`
- `components/views/PlanView.tsx`
- `components/views/MoneyView.tsx`
- `components/views/LibraryView.tsx`
- `scripts/ndz009-capture.mjs`
- `docs/ndz-009-screenshots/*`
- `docs/ndz-009-runtime-proof.txt`
- `docs/ndz-009-summary-surface-polish.md`

## After-capture evidence

Generated with `NDZ_APP_URL=http://127.0.0.1:5174 node scripts/ndz009-capture.mjs` against a local Vite dev server. Full metrics: `docs/ndz-009-screenshots/metrics.json`.

| Surface | Viewport | Evidence | Key metric / behavior |
|---|---:|---|---|
| Summary/Home | 390×900 | `docs/ndz-009-screenshots/summary-390x900.png` | Mobile remains non-rail/card-first: content `x=0`, `w=375`. |
| Summary/Home | 820×900 | `docs/ndz-009-screenshots/summary-820x900.png` | Tablet remains constrained: content `x=67`, `w=672`. |
| Summary/Home | 1440×900 | `docs/ndz-009-screenshots/summary-1440x900.png` | Content `x=320`, `w=1073`; focus panel `w=661`; quick-add side card `w=384`. |
| Summary/Home | 1680×900 | `docs/ndz-009-screenshots/summary-1680x900.png` | Content `x=320`, `w=1280`; focus panel `w=836`; side card `w=416`. |
| Summary/Home | 1920×900 | `docs/ndz-009-screenshots/summary-1920x900.png` | Content stays rail-aligned/capped at `x=320`, `w=1280` instead of NDZ-007 `x=585`, `w=1024`. |
| Plan/Focus | 1440×900 | `docs/ndz-009-screenshots/plan-focus-1440x900.png` | Content `x=320`, `w=1073`; workflow lists use framed panels. |
| Plan/Focus wide | 1680×900 | `docs/ndz-009-screenshots/plan-focus-wide-1680x900.png` | Content `x=320`, `w=1280`; workflow grid has wider editor/card columns. |
| Money/Transactions | 1440×900 | `docs/ndz-009-screenshots/money-transactions-1440x900.png` | Header stat row includes month, Income, Expense, Used cards; content `x=320`, `w=1073`. |
| Money/Transactions wide | 1680×900 | `docs/ndz-009-screenshots/money-transactions-wide-1680x900.png` | Content `x=320`, `w=1280`; transaction/detail split has wider primary column. |
| Library/Notes | 1440×900 | `docs/ndz-009-screenshots/library-notes-1440x900.png` | Empty-state card is centered and intentional: `w=768`, `h=270`. |
| Library/Notes wide | 1680×900 | `docs/ndz-009-screenshots/library-notes-wide-1680x900.png` | Content `x=320`, `w=1280`; empty/list state inherits wider rail-aligned shell. |
| Calendar | 1440×900 / 1680×900 | `docs/ndz-009-screenshots/calendar-*.png` | Regression captured only; no structural change because NDZ-007 marked it low-priority/readable. |
| Control Center | 1440×900 | `docs/ndz-009-screenshots/control-center-1440x900.png` | Regression captured only; no structural change because NDZ-007 said to mostly leave it alone. |

## Fixed / deferred / intentionally unchanged

### Fixed

- Summary/Home now has an explicit wider desktop dashboard pass/fail improvement: NDZ-007 1920 content was `x=585`, `w=1024`; NDZ-009 is `x=320`, `w=1280` with a `836px` focus panel and `416px` side column.
- Plan/Focus now uses shared workflow panels/min-width grid instead of generic split columns for dense task/shopping/goal sections.
- Money/Transactions hero now uses the available row for Month + Income + Expense + Used rather than leaving sparse dead space.
- Library empty states now communicate what will happen next and provide direct add actions.

### Deferred / intentionally unchanged

- Calendar was left unchanged beyond inherited shell behavior because NDZ-007 marked it readable/low priority.
- Control Center was left unchanged because NDZ-007 called the desktop panel stable and useful.
- Desktop rail status/error card was left unchanged because NDZ-007 marked it low priority and runtime-state dependent.
- Business/sync/spreadsheet/canonicalizer/deep-work logic was intentionally not touched.

## Validation

- `npm run lint` — pass (`tsc --noEmit`).
- `npm test` — pass, `86/86` tests.
- `npm run build` — pass; existing Vite large chunk warning remains.
- `NDZ_APP_URL=http://127.0.0.1:5174 node scripts/ndz009-capture.mjs` — pass; generated screenshots and metrics in `docs/ndz-009-screenshots/`.
- Deterministic rerun proof saved at `docs/ndz-009-runtime-proof.txt`: HTTP shell check passed, capture command exited `0`, metrics assertions passed for Summary mobile/tablet/desktop widths and Plan/Money/Library rail origin, `20` PNG screenshots and `20` metric rows present.

## Runtime notes

- `npm run dev` started `server.ts` at `http://localhost:3000`, but that route served the existing Signal Press/news shell in this workspace runtime. For React app viewport checks, a direct Vite server was started with `npx vite --host 127.0.0.1 --port 5173`; Vite selected `5174` because `5173` was already occupied.
- Dev server also logged `WebSocket server error: Port 24678 is already in use`; the Vite app and captures still ran successfully.
