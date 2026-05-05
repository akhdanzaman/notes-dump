# NDZ-004 Desktop polish implementation notes

Task: NDZ-004  
Repo: `akhdanzaman/notes-dump`  
Lane: engineering implementation

## Shared responsive contract followed

- Read `docs/responsive-ux-desktop-plan.md` and the NDZ-003 handoff before changing UI.
- Desktop-only behavior starts at `lg:` (`>=1024px`); mobile/tablet remain the baseline bottom-sheet / centered-modal flows.
- Reused and extended shared layout primitives via `components/layout/contentSurface.ts`; no spreadsheet sync/auth route behavior was changed.

## Implemented surfaces

- **Control Center / Settings:** desktop opens as a workspace inside the desktop shell area (`lg:left-72`) with a persistent section rail, status card, wider content pane, two-column config grids, and no duplicate phone-style settings list on desktop.
- **Spreadsheet connection/status:** service-account guidance copy stays intact; Google login remains explicitly optional fallback. Connect/disconnect handlers and spreadsheet link validation are unchanged.
- **Budget/config panels:** budget, notification, appearance, behavior, data, and connect tabs use shared two-column desktop density while preserving existing sections and controls.
- **Canonical/generated data panels:** canonical cleanup, database history, and danger zone stay visible and full-width on desktop so review/backfill/reset controls are not hidden behind hover-only affordances.
- **Onboarding/tutorials:** onboarding gains a desktop setup rail and wider content stages; feature tutorials widen to a two-column example layout at desktop.
- **Wallet/skill config modals:** dialogs now use shared responsive modal classes and wider desktop max-widths without changing save payloads.
- **Generated insight popover:** AI insight notifications widen on desktop and can use more vertical space while keeping the anchored popup behavior.

## Viewport notes

- `<1024px`: Control Center remains the existing bottom sheet (`h-[85vh]`, rounded top, mobile back button, mobile settings menu). Onboarding remains full-screen touch-first with the same step order and bottom navigation.
- `>=1024px`: Control Center is no longer an oversized phone modal; it becomes a rounded desktop panel beside the nav rail with persistent settings navigation and denser content sections.
- Desktop insight/tutorial/config panels keep all primary actions visible; no edit/sync/review/destructive action is hover-only.

## Changelog

- Added `v0.3.30` in `utils/changelog.ts` for Control Center desktop workspace, onboarding/tutorial/modal polish, and shared responsive surface helpers.
