# NDZ-016 Tablet Baseline Acceptance Gate

Base SHA captured before implementation: `5df4ff440f92d8f56d97e14811ec556873569ae6`

## Locked tablet tier

Tablet is treated as the explicit `640-1023px` tier:

- `640px` enters the existing `sm` behavior.
- `1023px` is still tablet / bottom-stack-first.
- `1024px` (`lg`) is the first desktop rail breakpoint.

## Acceptance checks

The NDZ-016 gate is `scripts/ndz016-capture.mjs`. It combines static contract checks with runtime viewport checks at `640x900`, `820x1180`, and `1023x900`.

Required invariants:

1. **Tablet shell**
   - Desktop rail is not visible from `640-1023px`.
   - Mobile/tablet bottom nav stack stays visible from `640-1023px`.
   - Desktop rail offset classes remain `lg:*`, not `md:*`.

2. **Note/library masonry**
   - Shared tablet masonry baseline is `columns-1 sm:columns-2 gap-4`.
   - Shipped Library notes surface keeps `column-count: 2` across `640`, `820`, and `1023` widths.
   - Library may expand to desktop masonry only at `lg` (`1024px+`), via `lg:columns-3`.
   - Legacy standalone `NotesView` uses the same explicit tablet masonry baseline and does not add a desktop/tablet hybrid class.

3. **Modal centering**
   - Existing sheet overlay remains bottom-aligned below `sm` and centered at `sm` using `sm:items-center sm:p-4`.
   - Add-note/add-task modal proof hooks remain available for runtime acceptance.
   - Runtime add-note modal is visible, centered, and maxes at the existing `max-w-md` tablet width.

## Proof artifacts

Running the gate writes:

- `docs/ndz-016-screenshots/metrics.json`
- `docs/ndz-016-screenshots/runtime-proof.json`
- `docs/ndz-016-screenshots/runtime-proof.txt`
- `docs/ndz-016-screenshots/tablet-640x900-library.png`
- `docs/ndz-016-screenshots/tablet-640x900-add-note-modal.png`
- `docs/ndz-016-screenshots/tablet-820x1180-library.png`
- `docs/ndz-016-screenshots/tablet-820x1180-add-note-modal.png`
- `docs/ndz-016-screenshots/tablet-1023x900-library.png`
- `docs/ndz-016-screenshots/tablet-1023x900-add-note-modal.png`
