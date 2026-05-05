# NDZ-008 Desktop shell/container polish

Baseline audit: `docs/ndz-007-desktop-layout-observation.md` at commit `940ba2b`.

## NDZ-007 findings addressed

- **#1 Global shell/content origin:** `responsiveShellClass.content` no longer uses the single `lg:max-w-5xl lg:mx-auto` centered island. The default desktop content is rail-aware, left-origin, and steps from available post-rail width up to `2xl:max-w-7xl`.
- **#2 Global composer/fixed bottom:** the fixed bottom shell now has the same desktop gutter as `<main>`, and the composer/chat wrapper shares the content origin and stepped max width. Page/main desktop bottom padding was increased to reduce overlap with dense cards/forms.
- **#4 Shared split primitive:** `contentSurface.splitGrid` now uses explicit desktop minimum column widths (`minmax(18rem, 1fr)`) so widened workspaces improve multi-column comfort instead of only adding whitespace.
- **#5 Modal/form sizing:** Add Task and Add Note use `responsiveModal.formPanel` (`lg:max-w-2xl`); Add Shopping and Add Expense use `responsiveModal.denseFormPanel` (`lg:max-w-3xl`). Mobile sheet behavior keeps the existing `max-w-md` baseline.

## After-capture evidence

Generated with `node scripts/ndz008-capture.mjs` against the local Vite dev server on `127.0.0.1:5173`.

| Surface | Viewport | Evidence | Key metric |
|---|---:|---|---|
| Summary/Home | 390×900 | `docs/ndz-008-screenshots/summary-390x900.png` | Mobile remains centered/card-first: content `x=0`, `w=375`, no desktop rail. |
| Summary/Home | 820×900 | `docs/ndz-008-screenshots/summary-820x900.png` | Tablet baseline remains constrained: content `x=67`, `w=672`. |
| Summary/Home | 1440×900 | `docs/ndz-008-screenshots/summary-1440x900.png` | Content moved from NDZ-007 `x=345`, `w=1024` to `x=320`, `w=1073`. |
| Summary/Home | 1680×900 | `docs/ndz-008-screenshots/summary-1680x900.png` | Content moved from NDZ-007 `x=465`, `w=1024` to `x=320`, `w=1280`. |
| Plan/Focus | 1440×900 | `docs/ndz-008-screenshots/plan-focus-1440x900.png` | Content is rail-aligned at `x=320`, `w=1073`; the input surface also measures `x=320`, `w=1073`. |
| Plan/Focus wide | 1680×900 | `docs/ndz-008-screenshots/plan-focus-wide-1680x900.png` | Content is rail-aligned at `x=320`, `w=1280`; the input surface also measures `x=320`, `w=1280`. |
| Add Task modal wide | 1680×900 | `docs/ndz-008-screenshots/add-task-modal-wide-1680x900.png` | Form panel is `w=672` (`lg:max-w-2xl`) instead of `max-w-md`. |
| Add Expense modal wide | 1680×900 | `docs/ndz-008-screenshots/add-expense-modal-wide-1680x900.png` | Dense form panel is `w=768` (`lg:max-w-3xl`) instead of `max-w-md`. |

Full metrics: `docs/ndz-008-screenshots/metrics.json`.

## Validation

- `npm run lint` — pass.
- `npm test` — pass, 86/86.
- `npm run build` — pass; Vite/PWA build completed with the existing large chunk warning.
- `node scripts/ndz008-capture.mjs` — pass; generated 20 viewport/surface screenshots and metrics.

## Notes / deferred

- NDZ-009 still owns surface-specific Summary, Library empty-state, Money header, and Plan card-level polish. NDZ-008 only changed shared shell/surface/modal primitives and their direct wrappers.
