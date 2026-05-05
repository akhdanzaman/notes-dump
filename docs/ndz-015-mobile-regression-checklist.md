# NDZ-015 Mobile regression checklist

Base SHA: `7965cd6`
Branch: `task/ndz-015-gesture-and-keyboard-avoidance-regression-pack`
Proof bundle: `docs/ndz-015-screenshots/`

## Result

- ✅ Keyboard avoidance still lifts the fixed bottom stack instead of trapping the composer.
- ✅ Mobile swipe flows still work for the current routed surfaces.
- ✅ Mobile subtab switching works through direct tap/click targets without any hover-only dependency.

## What was checked

### Keyboard avoidance
- Simulated `visualViewport.height = 520` while the mobile composer was focused.
- Verified `data-keyboard-open="true"` on the fixed bottom stack.
- Verified bottom stack transform moved to `matrix(1, 0, 0, 1, 0, -324)`.
- Verified composer stayed visible while the mobile bottom nav hid during keyboard-open state.
- Verified reset returns transform to `0` and bottom nav visibility to `true`.

Evidence:
- `docs/ndz-015-screenshots/keyboard-open.png`
- `docs/ndz-015-screenshots/metrics.json` (`keyboard-patch`, `keyboard-reset`)

### Swipe / touch regression pack
- Summary theme month swipe advanced `May 2026 -> Jun 2026`.
- Summary header swipe advanced `summary -> plan`.
- Plan shopping subtab changed by touch (`tasks -> shopping -> tasks`).
- Plan header swipe advanced `plan -> library`.
- Library journal subtab changed by touch (`general -> journal`).
- Library journal month swipe advanced `Mei 2026 -> Juni 2026`.
- Library header swipe advanced `library -> money`.
- Money month swipe advanced `2026May -> 2026June`.
- Money header swipe advanced `money -> calendar`.
- Calendar header swipe returned `calendar -> money`.

Evidence:
- `docs/ndz-015-screenshots/summary-initial.png`
- `docs/ndz-015-screenshots/summary-theme-swipe-next.png`
- `docs/ndz-015-screenshots/money-after-library-swipe.png`
- `docs/ndz-015-screenshots/money-month-swipe-next.png`
- `docs/ndz-015-screenshots/metrics.json`

## Notes

- Current `App.tsx` route wiring mounts `Summary`, `Plan`, `Library`, `Money`, and `Calendar` surfaces. Shopping and notes/journal behavior now live inside the `Plan` and `Library` subtabs, so this regression pack verifies those current mobile entry points directly.
- Legacy standalone `FocusView`, `NotesView`, and `ShoppingView` files still exist in the repo but are not mounted from `App.tsx` in the current shell, so they are not the shipped mobile path for this slice.
