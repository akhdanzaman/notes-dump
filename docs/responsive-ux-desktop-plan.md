# NDZ-001 Responsive UX Desktop Contract

Task: NDZ-001  
Repo: `akhdanzaman/notes-dump`  
Purpose: shared responsive/mobile-baseline desktop UX source of truth for all NDZ follow-up work.

Repo-backed audit rerun: `2026-05-05` in `/home/ubuntu/.openclaw/workspace/notes-dump`. The contract below was checked against the real app shell, navigation, composer/search/chat stack, Control Center, add/edit modals, shared `Card` renderer, lazy-loading hooks, and primary feature views rather than written as a standalone concept.

## Baseline rule

The current UI is the mobile/tablet baseline. Responsive work must preserve the existing touch-first flow, bottom navigation, floating input/chat stack, modal behavior, card/list semantics, sync behavior, spreadsheet work, deep-work surfaces, and canonicalizer/review surfaces on mobile and tablet.

Desktop is an adaptation layer over the same Notes Dump system: wider layout, clearer navigation, higher information density, and better content organization. Desktop work must feel like Notes Dump, not a second app.

## Current-state UI map

### App shell and routing

- `App.tsx` owns primary tab state, tab sub-state, modal state, review/search/chat state, keyboard/visual-viewport handling, Android-style back handling, and data mutations.
- The mobile/tablet shell is a centered content column using the existing `max-w-2xl` pattern, with large bottom padding for the fixed capture/navigation stack.
- Global shell children include `Header`, routed view content, `FloatingChatBox`, `InputBar`, `FloatingSearch`, `BottomNav`, `ControlCenter`, review center overlay, confirmation/edit/add modals, onboarding, and feature tutorial popups.
- Current route taxonomy is the shared information architecture: Summary/Home, Plan family, Library family, Money, and Calendar.

### Header

- `components/Header.tsx` is a compact top status/action bar scoped to the centered mobile/tablet column.
- It exposes sync/fetch/save status, pending review count, settings, refresh, and sync actions.
- Desktop may reposition these signals, but cannot hide sync errors, pending writes, fetch state, or pending review count.

### Bottom navigation

- `components/BottomNav.tsx` is the primary mobile/tablet navigation surface.
- It is a floating bottom pill for Summary, Plan/Focus/Shopping/Goals, Library/Notes/Journal/Skills, Money, Calendar, and Menu.
- Dynamic Plan and Library labels are part of the current UX and must remain consistent wherever desktop navigation appears.
- Mobile/tablet bottom nav stays baseline behavior below the desktop breakpoint.

### Input, search, and chat

- `components/InputBar.tsx` is the global capture/chat/review composer and is part of core Notes Dump muscle memory.
- `components/FloatingChatBox.tsx` opens above the composer and uses the same item/data context as the rest of the app.
- `components/FloatingSearch.tsx` opens as a floating filter/search panel above the bottom stack.
- `App.tsx` handles mobile keyboard avoidance with `visualViewport`; desktop layout must not regress this.

### Cards, lists, and lazy content

- `components/Card.tsx` is the shared renderer for todos, finance items, notes/journals, shopping items, skills, and deep-work suggestions.
- Most views are card-first single-column feeds on mobile/tablet with rounded surfaces, chips, inline controls, and lazy loading.
- `components/views/LibraryView.tsx` and `components/views/NotesView.tsx` already use `columns-1 sm:columns-2`, creating an existing tablet masonry behavior.
- `hooks/useLazyItems.ts` and `components/LoadMoreButton.tsx` keep long lists manageable; desktop density must preserve item ordering and actions.

### Feature views

- `components/views/SummaryView.tsx`: dashboard/date summary, review entry points, quick stats, and swipe tab/date behavior.
- `components/views/PlanView.tsx`: today tasks, routines, shopping/savings routing, deep-work parent/child flows, add-funds flow, and date swipe behavior.
- `components/views/FocusView.tsx`: focused task/day workflow with dense task controls and swipe navigation.
- `components/views/ShoppingView.tsx`: shopping/saving goal workflow with add-funds modal and card list behavior.
- `components/views/LibraryView.tsx`: journal/note/library sub-tabs, journal date swipe, note masonry, and shared item cards.
- `components/views/NotesView.tsx`: dedicated notes/journals masonry surface.
- `components/views/MoneyView.tsx`: wallets, transactions, budget surfaces, date navigation, finance cards, and charts/stats.
- `components/views/CalendarView.tsx`: month grid, dated content, and selected event/task modal behavior.

### Modals and overlays

- Add flows (`AddTaskModal`, `AddNoteModal`, `AddShoppingModal`, `AddExpenseModal`, `RoutineTaskModal`) use mobile bottom sheets with `items-end`, `p-0`, and `rounded-t-[32px]`, then center via `sm:` behavior where implemented.
- Edit/settings/wallet/skill/confirm dialogs use centered overlays with `max-w-sm`, `max-w-md`, or `max-w-2xl` patterns.
- Chat, search, review center, Control Center, and modal z-index interactions are already layered; desktop overlays need deliberate alignment to avoid collisions.

### Control Center

- `components/ControlCenter.tsx` is the settings/data/sync workspace and is currently bottom-sheet oriented on mobile/tablet.
- It contains sync/import/export, service-account/data settings, theme, budget, parser/history, canonical cleanup, learned canonical rules, pending review counts, and advanced/deep surfaces.
- It is the highest-risk desktop adaptation because it combines benign preferences, diagnostics, sync state, and destructive/data operations.

## Responsive principles

1. Mobile/tablet is the regression target; below `lg`, current behavior should remain visually and functionally stable.
2. One responsive UX system: use shared state, shared components, and responsive variants instead of separate desktop-only feature forks.
3. Same information architecture: desktop can expose more context, but tab names, feature groupings, and workflows stay recognizable.
4. Desktop adds space and clarity, not ceremony; reduce scrolling and improve scanning without adding extra steps.
5. Capture remains global and prominent on every viewport.
6. Touch and mouse affordances coexist; hover/focus enhancements are additive and never the only way to reach an action.
7. Sync, parsing, review, canonical cleanup, deep-work, and spreadsheet-backed state behave identically across breakpoints.
8. Implement progressively: shell/navigation first, then content density, then overlays/forms, then Control Center hardening.

## Read-path and bypass-sensitive guardrails

Responsive UX work must not create alternate data paths or bypass existing stateful flows. Desktop variants are layout adaptations only unless a later task explicitly updates this contract first.

- Spreadsheet/auth/sync read path stays in `useBrainDumpData`, `syncFacade`, spreadsheet services, `Header`, and Control Center callbacks; desktop may relocate status/actions but not add a separate sync mechanism.
- Parser/review/canonicalizer read path stays in `useBrainDumpData`, `ReviewCenterPanel`, `ControlCenter`, and shared review callbacks; desktop must not skip `pendingReviews`, canonical backfill reviews, learned-rule toggles, or parser retry semantics.
- Deep-work read path stays in the existing todo metadata and `PlanView`/`Card` callbacks for accept, dismiss, retrigger, keep raw, child creation, and progress updates.
- Import/export/clear/destructive operations remain wired to their existing handlers and must stay visually separated from simple preferences on desktop.
- New desktop panels may mirror, summarize, or reposition state, but they must write through the same props/callbacks as mobile and must remain reachable without hover-only controls.

## Breakpoint/layout contract

| Tier | Width | Layout contract |
| --- | --- | --- |
| Mobile | `<640px` | Current single-column, touch-first UI: centered content, bottom nav, floating composer/chat/search, bottom-sheet add flows, swipe tab/date gestures. |
| Tablet | `640px-1023px` | Current UI remains baseline: bottom nav/composer stay primary, `sm:` dialog behavior remains, existing note/library two-column masonry can remain. |
| Desktop | `1024px-1439px` | Add desktop shell adaptation: persistent sidebar/rail or topbar, wider content frame, desktop-aligned composer/search/chat, optional right context panel. Bottom nav is no longer primary once desktop nav exists. |
| Wide desktop | `>=1440px` | Allow two/three-column compositions: nav + primary content + contextual/review/filter panel. Never stretch text or cards across full viewport just because space exists. |

### Shared layout primitives

- Keep mobile/tablet primary content at the existing `max-w-2xl` scale.
- Desktop app frame target: left rail/sidebar around `16rem-18rem`, primary content `minmax(0, 1fr)`, optional context panel around `20rem-28rem`.
- Desktop content max: use readable containers (`max-w-5xl`, `max-w-6xl`, or `max-w-7xl` at the frame level) and keep text-heavy surfaces around `65-80ch`.
- Use `lg:` as the first desktop adaptation breakpoint. Do not add desktop layout changes below `1024px` unless preserving the current tablet behavior is explicitly verified.
- Preserve mobile safe-area and bottom padding while the mobile bottom stack exists; remove/reduce it only in desktop layouts that replace the bottom stack.

### Navigation and shell behavior

- Mobile/tablet: `Header` + routed content + fixed bottom composer/search/chat + `BottomNav` remain the baseline.
- Desktop: navigation should reuse the same tab/sub-tab state as mobile; Control Center entry should be visible in the rail/topbar; status indicators remain globally visible.
- Wide desktop: secondary panels can show review queue, selected date/detail, filters, charts, or assistant/search context, but they must not create unreachable desktop-only states.

## Shared component rules

### Navigation

- Reuse the existing tab model: Summary/Home, Plan family, Library family, Money, Calendar, Menu/Control Center.
- Dynamic Plan and Library labels/icons must stay consistent between mobile bottom nav and desktop nav.
- Desktop nav may show helpers, badges, and status text, but active state semantics must match mobile.

### Header and status

- Sync, save, fetch, error, pending review, settings, refresh, and manual sync controls remain visible and reachable.
- Do not bury sync failures or local pending changes in desktop-only secondary panels.
- Desktop may compress the mobile header into topbar/sidebar status, but must preserve the same actions.

### Input, search, and chat

- `InputBar` remains globally reachable in one action.
- Mobile/tablet bottom composer behavior and keyboard avoidance remain unchanged.
- Desktop composer can stay bottom-centered in the content frame or become a command/composer dock aligned to the primary content column.
- Search/chat overlays should align to the desktop frame; wide desktop may use side panels only if close/back/escape behavior and state remain shared.

### Cards, lists, and grids

- Preserve the Notes Dump card language: rounded surfaces, clear title/content hierarchy, muted metadata, chips, calm density, and visible actions.
- Mobile/tablet feeds stay single-column except existing note/library `sm:` masonry.
- Desktop may use two-column dashboards, card grids, masonry, or dense finance rows where they improve scanning.
- Never hide edit/delete/complete/review/sync actions behind hover-only UI; keyboard and touch access remain present.
- Empty states keep the same action/voice across tiers; desktop may add secondary hints or illustration space.

### Forms and modals

- Mobile add/edit flows remain bottom sheets or current centered dialogs according to existing behavior.
- Tablet keeps current `sm:` modal centering unless a specific modal becomes unusable.
- Desktop forms may use centered dialogs (`max-w-lg`/`max-w-xl`), wider edit dialogs, or right drawers for contextual flows.
- Long forms may group fields into two columns at `lg`, but validation, defaults, date handling, wallet/budget behavior, parser review semantics, and save/cancel actions remain unchanged.

### Control Center

- Mobile/tablet Control Center remains bottom-sheet oriented and all sections stay reachable.
- Desktop Control Center should become a sectioned settings workspace with a section list/tabs and a main scroll panel.
- Suggested section groups: Sync, Appearance, Data, Budget, Canonical Cleanup, History/Diagnostics, Advanced.
- Dangerous/data operations must be visually separated from simple preferences.
- Canonical cleanup, learned-rule toggles, pending suggestion counts, import/export, and sync diagnostics must keep identical callbacks and semantics.

### Typography, spacing, density, and affordances

- Mobile typography and spacing stay as-is.
- Desktop can reduce vertical padding in dense lists by roughly `10-20%`, but keep comfortable touch/keyboard target sizes.
- Use hover to preview or shortcut, not to hide required actions.
- Add visible focus states for nav, modal close, search, chat, and form actions.
- Preserve `BackHandler`, Escape, overlay close, and swipe behavior according to current platform expectations.

## Desktop examples by surface

### App shell

- Introduce desktop rail/sidebar at `lg` using the same tab state/handlers as `BottomNav`.
- Hide mobile bottom nav only after desktop nav exists.
- Expand the `main` frame from phone-column-only to desktop container while keeping readable content max widths.
- Keep sync/pending review status in header/topbar/sidebar status.

### List/card pages

- Summary/Home: primary dashboard column plus right review/stats/context panel on desktop.
- Plan/Focus: primary task feed plus date/deep-work/detail context panel.
- Money: wallet/budget summary plus transaction list/filter/chart context, without changing finance item semantics.
- Library/Notes: extend masonry cautiously (`lg:` columns) while keeping card readability.
- Calendar: keep month grid readable and use desktop space for selected-day detail, not oversized cells.

### Forms/modals

- Add task/note/expense/shopping/routine: mobile bottom sheets; desktop centered dialogs or drawers with same fields/defaults/actions.
- Edit note/journal may use wider desktop width; finance/task edit remains compact unless grouped fields improve clarity.
- Confirmation and add-funds modals remain simple centered overlays.

### Control Center

- First desktop pass is layout-only: section navigation + main panel.
- Do not refactor sync/import/export/canonical behavior in the same slice.
- Canonical Cleanup receives explicit QA because it can mutate historical items and queue reviews.

## Risk zones

- Bottom nav/composer stack: fixed positioning, keyboard avoidance, and mobile muscle memory are fragile.
- Control Center: many unrelated operations share one overlay; layout changes can accidentally obscure destructive controls or callback wiring.
- Review/canonicalizer/deep-work: stateful accept/reject/retry/backfill flows must not change semantics.
- Spreadsheet sync/status: desktop relocation must not hide errors, pending writes, fetch state, or refresh/sync actions.
- Swipe hooks: mobile/date/tab gestures must remain intact below `lg`.
- Lazy loading and masonry: desktop columns must preserve order, grouping, load-more behavior, and action reachability.
- Overlay layering: chat, search, review center, Control Center, and modals need a deliberate z-index/alignment map.

## Ordered implementation slices

### NDZ-002: Responsive shell and navigation foundation

Dependencies: NDZ-001 only.

- Add shared shell primitives for mobile container, desktop frame, sidebar/rail, content area, and optional context region.
- Implement desktop navigation using existing tab/sub-tab state and handlers.
- Preserve `BottomNav` and the mobile bottom stack below `lg`.
- Align header/status/composer behavior for desktop without hiding sync errors or pending review counts.
- Verification focus: mobile/tablet screenshots unchanged; desktop has persistent navigation and no duplicate route state.

### NDZ-003: Desktop list/card density and view grids

Dependencies: NDZ-002 shell primitives.

- Apply desktop content containers to Summary, Plan, Focus, Shopping, Library/Notes, Money, and Calendar.
- Add two-column/context layouts where useful: Summary + review/stats, Plan + deep-work/detail, Money + filters/charts, Library/Notes masonry.
- Keep shared `Card` behavior and avoid desktop-only action hiding.
- Verification focus: item ordering, lazy loading, mobile swipe behavior, and keyboard/mouse access.

### NDZ-004: Desktop forms, modals, search, chat, and Control Center workspace

Dependencies: NDZ-002 shell primitives and NDZ-003 content-density decisions.

- Standardize modal/drawer rules for add/edit flows while preserving mobile bottom sheets.
- Align `InputBar`, `FloatingSearch`, and `FloatingChatBox` to desktop containers or context panels.
- Convert desktop Control Center into a sectioned settings workspace while preserving mobile/tablet bottom-sheet behavior.
- Verification focus: task/note/expense/shopping/routine/wallet/skill flows, chat/search layering, Escape/back close behavior, and Control Center section reachability.

### NDZ-005: Integrated responsive QA and risk hardening

Dependencies: NDZ-002, NDZ-003, and NDZ-004.

- Run integrated viewport QA for mobile, tablet, desktop, and wide desktop.
- Add targeted regression checks for canonical backfill, pending reviews, import/export, refresh/sync, theme/settings, deep-work, finance, and calendar flows.
- Validate no hidden destructive operations, no lost status indicators, and no desktop-only unreachable states.
- Update release/changelog notes only after the responsive system is verified.

## QA checklist

### Mobile/tablet unchanged

- [ ] `<640px`: bottom nav labels, active states, Menu behavior, and tab switching match current UI.
- [ ] `<640px`: composer stays bottom-docked, keyboard avoidance works, and suggestion chips remain usable.
- [ ] `640px-1023px`: current tablet behavior remains; no desktop rail/sidebar appears.
- [ ] Existing `sm:` modal centering and note/library two-column masonry remain intact.
- [ ] Swipe tab/date gestures still work in Summary, Plan, Focus, Money, Calendar, Library/Notes, and Shopping.
- [ ] Add/edit flows for task, note/journal, shopping, expense, routine, wallet, and skill keep current defaults and save behavior.
- [ ] Control Center remains reachable and bottom-sheet oriented.
- [ ] Sync/fetch/save statuses and errors remain visible.

### Desktop improved

- [ ] `1024px+`: persistent desktop navigation uses the same tab model and mobile bottom nav is no longer primary.
- [ ] Main content uses a desktop frame with readable max widths instead of a phone column stranded in empty space.
- [ ] List/card pages gain useful density or context without changing item semantics.
- [ ] Forms/modals use desktop-appropriate width/drawer behavior while preserving labels, defaults, and validation.
- [ ] Control Center is easier to scan through section navigation and separated dangerous/data operations.
- [ ] Search/chat/review overlays align to the desktop frame and do not collide with Control Center or modals.
- [ ] Keyboard focus, Escape/close, and mouse hover states are usable without making actions hover-only.

### Feature regression gates

- [ ] Spreadsheet refresh/sync and pending save indicators still work and stay visible.
- [ ] Review Center approvals/rejections still work from Summary/global overlay.
- [ ] Canonical cleanup backfill, learned-rule toggles, pending suggestion counts, and review queue behavior are unchanged.
- [ ] Deep-work suggestions can still expand, dismiss, retrigger, and accept subtasks.
- [ ] Finance wallet/transaction/budget flows still create and display the same data.
- [ ] Calendar selected-day modal/detail still works on mobile and desktop.

## Current follow-up implementation notes

These notes record downstream conventions already referenced by later NDZ work; they do not weaken the NDZ-001 baseline rule.

- Shell constants may live in `components/layout/responsiveShell.ts` when implementing NDZ-002.
- Primary navigation item definitions may live in `components/navigationItems.ts` and be shared by mobile bottom nav and desktop rail.
- Content-surface helpers may live in `components/layout/contentSurface.ts` for NDZ-003 dashboard grids, split panes, section cards, modal panels, and form grids.
- Source handoff for NDZ-003 content-density details: `docs/ndz-003-content-surfaces-desktop-handoff.md` if present.

## Acceptance handoff for later NDZ tasks

Every later NDZ task must read this document before implementation, name the slice it belongs to, and state how it preserves the current mobile/tablet baseline. If a task needs a new responsive pattern not covered here, update this contract first or explicitly document the exception in the task output.

## NDZ-003 implementation addendum

NDZ-003 content-density implementation is now represented by shared primitives in `components/layout/contentSurface.ts` and reused in Summary, Plan, Money, Library, Shopping, and Calendar. The implementation remains `lg:`-first, preserves mobile/tablet card-first flows, keeps shared `Card` render paths for task/finance/note records, and uses mirrored desktop context only where it reads existing state (for example Money filter summary) rather than creating alternate data paths.
