# NDZ-020 through NDZ-024 completion proof

Branch: `task/ndz-020-library-empty-state-and-search-anchoring`
Base before this pass: `bfdfcef` (`Add NDZ-019 runtime proof`).

## NDZ-020 — Library empty state + search anchoring

- `LibraryView` now uses `contentSurface.libraryEmptyState` and `contentSurface.libraryEmptyActions` for intentional sparse desktop notes/journal states.
- `FloatingSearch` exposes `data-floating-search-anchor="composer-content-frame"` and expands from the same composer/content frame instead of a detached centered island.
- Mobile/tablet masonry baseline remains unchanged; only `lg:` desktop alignment was added.

## NDZ-021 — Calendar width policy

Decision: keep Calendar on the standard readable cap.

Reason: the month grid is a dense scan surface; widening it to the full workspace would increase eye travel more than label readability. `contentSurface.calendarFrame` caps the grid at `max-w-6xl` through `2xl`, while the surrounding shell remains standard and rail-aware.

## NDZ-022 — Responsive form-panel variants

Mapping:

| Flow | Variant | Reason |
| --- | --- | --- |
| Add Task | `responsiveModal.formPanel` | Simple creation/edit form; desktop can breathe at `lg:max-w-2xl`. |
| Add Note | `responsiveModal.formPanel` | Text-heavy but not dense; same simple form rhythm. |
| Add Shopping | `responsiveModal.denseFormPanel` | Category/amount/recurrence fields need denser desktop grouping at `lg:max-w-3xl`. |
| Add Expense | `responsiveModal.denseFormPanel` | Wallet/category/payment fields need denser desktop grouping at `lg:max-w-3xl`. |
| Destructive confirmation | `responsiveModal.destructiveConfirmPanel` | Compact risk dialog; must not inherit data-entry width. |

## NDZ-023 — Overlay layering and close semantics

Close matrix:

| Surface | Layer | Close behavior |
| --- | ---: | --- |
| Search panel | Composer/start-action overlay | Click outside, Escape/back via `BackHandler`, input focus collapses it. |
| Chat box | Composer overlay | Close button, Escape/back via `BackHandler`. |
| Review Center | z-95 portal overlay | Close button/backdrop, Escape/back via `BackHandler` when opened from input. |
| Control Center | z-60/z-70 panel | Backdrop, X, Escape/back via `BackHandler`. |
| Dialogs/confirms | z-80+ modal | Cancel/confirm and Escape/back through registered handlers. |

Regression proof added: `utils/__tests__/backHandlerStack.test.ts` verifies last-opened overlay handlers close first.

## NDZ-024 — Destructive confirmation separation

- `ConfirmDialog` now uses `responsiveModal.destructiveConfirmPanel`, keeping dangerous actions compact at `max-w-xs` with red border/ring.
- Control Center Danger Zone is visually capped (`max-w-xl`) and labeled as a compact destructive flow so it stays separated from wider form/data panels.

## Validation commands

Run from repo root:

- `npm test`
- `npm run lint`
- `npm run build`
