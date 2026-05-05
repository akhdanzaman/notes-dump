# NDZ-003 Content Surfaces Desktop UX Handoff

Task: NDZ-003  
Repo: `akhdanzaman/notes-dump`  
Lane: Engineering implementation + UX/product handoff  
Depends on: NDZ-001 responsive contract + NDZ-002 shell primitives

## Coordination status

- I read the current shared contract in `docs/responsive-ux-desktop-plan.md`; the repo copy currently defines the mobile/tablet baseline, `lg` desktop rail, shell primitives in `components/layout/responsiveShell.ts`, and shared nav items in `components/navigationItems.ts`.
- I could not read Susanto's live NDZ-001 session because cross-agent session history is restricted, so this handoff stays inside the existing shared contract and marks final visual polish that should be confirmed with Susanto.
- Current repo already has NDZ-002 shell work in progress: `App.tsx`, `components/BottomNav.tsx`, `components/FloatingChatBox.tsx`, `components/InputBar.tsx`, `components/layout/DesktopNavRail.tsx`, `components/layout/responsiveShell.ts`, and `components/navigationItems.ts`.

## Product intent

Desktop should make Notes Dump easier to scan without changing what the app is: a fast capture-first personal dashboard with card feeds, soft rounded surfaces, and reliable add/edit/sync flows. Mobile and tablet remain the source behavior. Desktop adds layout and density, not new product semantics.

## Shared content-surface rules

1. **Use one desktop breakpoint:** all NDZ-003 layout changes start at `lg:` (`>=1024px`) so the phone/tablet card-first flow is untouched.
2. **Keep primary actions visible:** complete/edit/delete/add-funds/retry/review actions must remain visible or keyboard reachable; hover may only add shortcuts.
3. **Densify with containers, not tiny controls:** reduce repeated whitespace and use multi-column regions, but keep existing rounded cards, chip actions, and comfortable hit areas.
4. **Use shared wrappers/classes:** implement a small shared surface helper before per-view edits, e.g. `components/layout/contentSurface.ts` exporting page/header/grid/list/form class strings. Avoid one-off desktop breakpoints scattered across every feature.
5. **Preserve data behavior:** do not change selectors, sorting, lazy-load reset keys, sync callbacks, spreadsheet fields, deep-work metadata handling, canonical review callbacks, or wallet/budget/category semantics.

## Highest-traffic desktop adaptations

### 1. Home / dashboard (`components/views/SummaryView.tsx`)

Current read path:
- Header block uses `rounded-b-[32px] p-6 pt-12`.
- Quick actions are a 4-column icon row.
- Main content is `px-4 space-y-8` with stacked sections and `Card` feeds.

Desktop target:
- Keep the header visually Notes Dump, but at `lg` make it a rounded card inside the desktop canvas instead of a full-width mobile bottom-rounded hero: `lg:rounded-[32px] lg:mt-6 lg:pt-6 lg:border lg:border-border`.
- Change the body from one long stack to a two-column dashboard at `lg`:
  - primary column: today focus, rituals, pending work, review/retry cards;
  - secondary column (`lg:w-80`/`xl:w-96`): quick actions, daily money highlight, sync/review status, compact calendar/upcoming events.
- Keep quick actions labels and order (`Task`, `Buy`, `Note`, `Expense`) stable. On desktop they can become two-by-two compact action cards in the side column.

Implementation guidance:
- Introduce a shared `ContentDashboardGrid`/class: `space-y-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem] lg:gap-6 lg:space-y-0`.
- Move only existing Summary sections into columns; do not create new data sources in this slice.

States to verify:
- Empty today state still says `All clear!` and remains in the primary column.
- Pending parsing/review cards remain above the composer and are not hidden in the side column only.
- Swipe date/tab behavior still works below `lg`.

### 2. Plan / todos / deep-work (`components/views/PlanView.tsx`)

Current read path:
- Task cards use shared `Card`.
- Deep-work cards wrap `Card` with a purple metadata shell and detail grid (`sm:grid-cols-2`).
- Savings goals have inline edit forms inside rounded cards.

Desktop target:
- At `lg`, use a planning split pane:
  - primary feed: current task/routine/deep-work card list, still ordered exactly as selectors return it;
  - side panel: month/day summary, add routine/task controls, selected filters/tags, and collapsed done counts.
- Deep-work cards should stay visually connected to the parent task but become easier to scan:
  - keep the purple wrapper;
  - make metadata/detail cells `lg:grid-cols-4` when enough values exist;
  - keep child todo/progress messaging directly under the parent card.
- Savings goal edit forms may use two-column fields on desktop, but save/delete/complete actions stay in the same card.

Implementation guidance:
- Add a shared `contentSurface.split` class: `lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6`.
- Use `lg:sticky lg:top-6` for the Plan side panel only after confirming the NDZ-002 shell top offset; do not make sticky regions under the mobile composer.
- Keep `renderTaskCard` and `renderGoalCard` as the only places where card density changes, so deep-work metadata is not forked elsewhere.

States to verify:
- Deep-work parent remains separate from nested steps; `Accept`, `dismiss`, `retrigger`, and `keep raw` callbacks still fire from the same card path.
- Lazy loading and `taskResetKey` are unchanged.
- Done-state opacity/grayscale still applies to done groups.

### 3. Money / transactions / wallets (`components/views/MoneyView.tsx`)

Current read path:
- Mobile header carries total net worth and month expense.
- Wallet, transactions, and budget are switched through an internal pill tab.
- Finance transaction list uses shared `Card`; filters come through `FloatingSearch`.

Desktop target:
- Keep the top money summary, but at `lg` use a dense overview row: net worth wide card + month expense/assets/debt/savings stat cards.
- For `transactions`, use a desktop two-column layout:
  - primary column: transaction cards in a tighter feed (`lg:space-y-2`), no table-only rewrite in first pass;
  - side panel: persistent filter summary/search entry, wallet filter chips, month navigation, and budget/category quick stats.
- For `wallets`, use `lg:grid-cols-2 xl:grid-cols-3` wallet cards when card count is high.
- For `budget`, keep charts readable; do not squeeze legends into tiny columns.

Implementation guidance:
- Keep finance cards as `Card` in this slice to avoid duplicating wallet/category/financeType display logic.
- If a future row-style transaction view is added, it must call the same edit/delete/update callbacks and show wallet/category/date without hiding actions behind hover.
- Do not infer expense meaning from names; preserve the finance metadata-first analysis principle already used elsewhere in the project.

States to verify:
- Balance masking (`showBalance`) masks every desktop stat too.
- Transfer/saving/income/expense types keep current colors and labels.
- FloatingSearch still controls the same filter state; desktop persistent filter UI must write to the same state variables.

### 4. Library / notes / journal / skill log (`components/views/LibraryView.tsx`, legacy `components/views/NotesView.tsx`)

Current read path:
- Notes use `columns-1 sm:columns-2` masonry and shared `Card`.
- Journal groups aggregate completed todos, shopping, events, and transactions into section cards.
- Skill cards are rounded surfaces with inline edit/delete actions and progress context.

Desktop target:
- Extend note masonry to `lg:columns-3 2xl:columns-4` only for note/general surfaces; keep long journal prose capped to readable width.
- Journal desktop should become a day-review layout:
  - primary column: merged journal text / daily narrative;
  - secondary grid: completed todos, shopping, events, transactions.
- Skills can use `lg:grid lg:grid-cols-2 xl:grid-cols-3` card grid if it does not break progress readability.

Implementation guidance:
- Apply `break-inside-avoid` consistently to note and skill cards.
- Date sticky headers should remain readable and not sit under the desktop rail; use local sticky only inside the content column.
- Do not change journal grouping selectors or completed item inclusion rules.

States to verify:
- Empty states for notes, journal, and skills still expose add actions.
- Card edit mode in masonry does not overflow column width.
- Long markdown/note text remains around `65-80ch`.

### 5. Shopping / events / calendar (`components/views/ShoppingView.tsx`, `components/views/CalendarView.tsx`)

Current read path:
- Shopping has category sections and savings goal cards with add-funds/completion flows.
- Calendar already has a responsive month grid and item detail modal.

Desktop target:
- Shopping should use category columns only when each column remains scannable: `lg:grid lg:grid-cols-2 xl:grid-cols-3` for category lists, with savings goals staying in a separate full-width/primary section.
- Add-funds modal remains simple; do not convert it to a complex desktop form.
- Calendar should not stretch cells indefinitely. At desktop, add a selected-day/detail side panel before increasing cell height/width further.

Implementation guidance:
- Shopping category section headers and add buttons stay visible at the top of each category.
- Calendar item detail may become a right panel at `xl`, but the existing centered detail modal remains acceptable for NDZ-003 if time is tight.

States to verify:
- Routine shopping validation (`daily/weekly/monthly/yearly`) stays unchanged.
- Shopping goal complete flow still records achieved goals and releases reserved savings via existing callbacks.
- Calendar selected item detail shows type/status/schedule and remains closeable by click/back/Escape.

### 6. Add/edit modals and common forms

Current read path:
- Add task/note/shopping/expense/routine modals are mobile bottom sheets and `sm:` centered dialogs.
- `EditModal.tsx`, `WalletModal.tsx`, and `SkillModal.tsx` use narrow centered dialogs.

Desktop target:
- Preserve mobile bottom sheets exactly below `sm` and current tablet centering.
- At `lg`, standard add modals should use shared desktop form width:
  - task/note/wallet/skill: `lg:max-w-lg`;
  - expense/shopping/routine/edit note: `lg:max-w-2xl` if fields wrap into two columns;
  - note/journal textareas may become wider, not shorter.
- Field groups may become two-column only when labels remain clear and tab order stays logical.
- Sticky footer actions stay: cancel/close secondary, primary save/add full or right-aligned depending on modal type.

Implementation guidance:
- Extract shared classes before editing many modals: `modalOverlay`, `modalPanel`, `modalBody`, `modalFooter`, `formGrid`.
- Do not alter validation alerts, default dates, wallet constraints, dedicated wallet logic, or finance category fallbacks.

States to verify:
- Add task with start/end/hide-from-calendar still saves the same payload.
- Add expense transfer still requires from/to wallet paths and preserves category behavior.
- Add shopping saving goal still requires dedicated wallet.
- Note/journal add still calls `handleAddNote(content, tags, mode)`.

## Deferred intentionally

- Full desktop Control Center/settings workspace: defer to NDZ-004 because it is a complex settings/data/canonicalizer surface.
- Dedicated row/table transaction renderer: defer until shared `Card` desktop density has been tested; avoid duplicating finance semantics now.
- Permanent right-side chat/search panels at wide desktop: defer to NDZ-004/NDZ-005 after overlay layering is verified.
- Any visual redesign of mobile/tablet cards, nav, bottom composer, or bottom-sheet add flows.

## Acceptance criteria for implementation owner

- Mobile/tablet viewport below `lg` has no intentional IA change: same bottom nav, same composer, same card-first flow, same modal entry points.
- Desktop has at least Summary, Plan, Money, and Library adapted with shared `lg:` content grids/density patterns.
- Shared surface classes/components are introduced once and reused across views/forms.
- `Card` remains the default renderer for todos, finance records, notes, shopping, and deep-work parents unless a view has a documented exception.
- No destructive/edit/review/sync action is hidden behind hover-only UI.
- Verification includes `npm test`, `npm run lint`, `npm run build`, plus viewport inspection at mobile/tablet/desktop.

## Implementation pass completed 2026-05-05

Concrete NDZ-003 code pass now applies the shared content-surface contract in the repo, not just this handoff:

- `components/layout/contentSurface.ts` now exports shared page shell, desktop header hero, content padding, dashboard grid, split/card/masonry/dense-list, and modal sheet primitives used by multiple views.
- `components/views/SummaryView.tsx` uses the shared desktop dashboard grid: today focus stays primary, while quick actions, rituals, and financial summary move into the desktop side column at `lg` without changing mobile card flow.
- `components/views/PlanView.tsx` uses shared content padding, split grids, dense lists, desktop deep-work metadata (`lg:grid-cols-4`), card-grid savings, and shared add-funds modal shell classes.
- `components/views/MoneyView.tsx` uses shared page/header/padding/card-grid/dense-list primitives, a denser desktop stat row, wallet card grid, and a desktop-only mirrored filter summary panel wired to existing filter state.
- `components/views/LibraryView.tsx` uses shared page/header/padding primitives, extends notes masonry to `lg:columns-3 2xl:columns-4`, and turns skill cards into a shared desktop card grid.
- `components/views/ShoppingView.tsx` uses shared page/header/padding primitives, category split grids, dense item lists, savings goal card grid, and shared add-funds modal shell classes.
- `components/views/CalendarView.tsx` now shares the desktop header/content/modal primitives and adds modest desktop cell/detail density without changing item selection behavior.

Verification performed for this pass: `npm run lint`, `npm test`, `npm run build`.
