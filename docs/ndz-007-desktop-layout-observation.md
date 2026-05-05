# NDZ-007 Desktop Layout Observation

Baseline inspected: `940ba2b` (`Add responsive desktop UX polish`).  
Runtime inspected: Vite dev server on `127.0.0.1:5173` with seeded localStorage data; Chrome headless viewport captures in `docs/ndz-007-screenshots/`.

## Screenshot matrix / viewport notes

| Surface | Viewport | Evidence | Notes |
|---|---:|---|---|
| Summary/Home | 1280×900 | `docs/ndz-007-screenshots/summary-1280x900.png` | Rail consumes 288px; remaining content is still readable. Main area is 977px, content is 913px wide at x=320. This is the tightest desktop breakpoint and mostly works. |
| Summary/Home | 1440×900 | `docs/ndz-007-screenshots/summary-1440x900.png` | Main area is 1137px, but content is capped at 1024px and centered at x=345. Summary feels balanced enough, but does not use the full post-rail workspace. |
| Summary/Home | 1680×900 | `docs/ndz-007-screenshots/summary-1680x900.png` | Main area grows to 1377px; content remains 1024px and shifts to x=465. The work area becomes a centered island with ~177px empty gutter on both sides inside the post-rail region. |
| Summary/Home | 1920×900 | `docs/ndz-007-screenshots/summary-1920x900.png` | Main area grows to 1617px; content remains 1024px and shifts to x=585. The gap between the rail edge and content origin is ~297px, creating an awkward empty middle band. |
| Plan/Focus | 1440×900 | `docs/ndz-007-screenshots/plan-focus-1440x900.png` | Three workflow columns are squeezed into the 1024px cap; task edit cards feel narrow and the fixed composer overlaps the lower card/actions. |
| Plan/Focus | 1680×900 | `docs/ndz-007-screenshots/plan-focus-wide-1680x900.png` | Wide viewport does not improve column comfort because content still caps at 1024px. This surface wants to fill more than Summary. |
| Money/Transactions | 1440×900 | `docs/ndz-007-screenshots/money-transactions-1440x900.png` | Primary transaction form plus filter side card is coherent, but the header/stat area is sparse and the whole surface stays capped. |
| Money/Transactions | 1680×900 | `docs/ndz-007-screenshots/money-transactions-wide-1680x900.png` | Same 1024px cap; transaction/detail + filters would benefit from a slightly wider desktop variant, not full stretch. |
| Library/Notes | 1440×900 | `docs/ndz-007-screenshots/library-notes-1440x900.png` | Empty state sits in a large blank field; floating search appears detached near the composer. |
| Library/Notes | 1680×900 | `docs/ndz-007-screenshots/library-notes-wide-1680x900.png` | Blank center becomes more noticeable because the content island remains capped and centered. |
| Calendar | 1440×900 | `docs/ndz-007-screenshots/calendar-1440x900.png` | Month grid is legible and intentional at the current cap. No urgent fix. |
| Calendar | 1680×900 | `docs/ndz-007-screenshots/calendar-wide-1680x900.png` | Still usable. Could inherit a wider shell later, but should not be a first target. |
| Control Center | 1440×900 | `docs/ndz-007-screenshots/control-center-1440x900.png` | Desktop panel uses the rail-aware workspace well and should mostly be left alone. |
| Add Task modal | 1680×900 | `docs/ndz-007-screenshots/add-task-modal-wide-1680x900.png` | Form is still `max-w-md`; it reads as a mobile sheet floating on desktop. |
| Add Shopping modal | 1440×900 | `docs/ndz-007-screenshots/add-shopping-modal-1440x900.png` | Dense form uses two columns inside a narrow mobile-width panel. |
| Add Expense modal | 1680×900 | `docs/ndz-007-screenshots/add-expense-modal-wide-1680x900.png` | Wallet/category fields are cramped for desktop despite available space. |

## Issue inventory

| # | Surface | Viewport | Symptom | Why it feels awkward | Severity | Suggested fix direction | Owner task |
|---:|---|---:|---|---|---|---|---|
| 1 | Global shell/content origin | 1680, 1920 | Post-rail main area expands, but `responsiveShellClass.content` stays `lg:max-w-5xl lg:mx-auto`. | The app creates a 1024px centered island in a 1377–1617px post-rail workspace. At 1920 the content starts ~297px after the rail edge, so the visual origin drifts toward the middle instead of feeling rail-aligned. | High | Replace the single centered content cap with shared desktop container variants: standard, wide, and full/workspace. Keep mobile/tablet unchanged. For desktop, consider rail-aware left alignment with max widths that step up (`xl/2xl`) only for surfaces that need it. | NDZ-008 global/container |
| 2 | Global composer / fixed bottom | 1440–1920; Plan especially | Composer is centered independently and stays narrower than the content; in Plan it overlaps editable task cards/actions near the bottom. | The primary input is visually disconnected from the content container and can obscure forms in dense views. It feels like a mobile floating control carried onto desktop without enough desktop-specific spacing. | High | Add a shared desktop composer container tied to the active content width/origin. Increase bottom padding for form-heavy views or allow surface-level composer avoidance. Do not change mobile composer behavior. | NDZ-008 global/container |
| 3 | Summary/Home | 1680, 1920 | Summary information remains readable but sparse; right-side quick actions/financials help, yet the whole dashboard underfills wide monitors. | The side column is useful, but the outer cap makes the dashboard look like it is floating in empty space. Important daily info could scan better with a wider two-column rhythm or additional density in the side rail. | Medium | Keep the current information hierarchy, but let Summary use a wider dashboard container (for example 1120–1280px) and tune `dashboardGrid` side column widths. Avoid adding unrelated widgets just to fill space. | NDZ-009 surface/summary |
| 4 | Plan/Focus | 1440, 1680 | Three columns fit into 1024px, making task cards and embedded edit controls narrow. | Date/time fields, priority buttons, progress controls, and save/delete actions feel cramped even on wide desktop. Wide viewport gives no relief because global cap blocks it. | High | Give Plan a wider workspace variant and set columns with stronger minimums (`minmax(18rem,1fr)` or a 2+1 responsive layout). Consider keeping edit-heavy task cards wider than passive list cards. | NDZ-009 surface/summary |
| 5 | Modal/form sizing | 1440, 1680 | Add Task/Shopping/Expense/Note modals use mobile-ish `max-w-md` panels. | Desktop users get narrow forms despite abundant space. Shopping and Expense already use two-column field groups, but the panel is too small for them to breathe. | High | Introduce/extend a shared `responsiveModal` form panel: simple confirmations can stay narrow; creation/edit forms should use `lg:max-w-2xl`/`lg:max-w-3xl` with existing `fieldGrid`. Avoid per-modal one-off widths. | NDZ-008 global/container |
| 6 | Library/Notes empty state | 1440, 1680 | Empty state is a single centered line in a large blank field; search trigger floats low and detached. | When there are no visible notes, the view looks unfinished rather than intentionally empty. The composer/search controls draw more attention than the state. | Medium | Add a desktop empty-state card/action row within the content surface, or constrain empty states intentionally. Align Floating Search with the content/composer container. | NDZ-009 surface/summary |
| 7 | Money/Transactions | 1680 | Form + filter side card is directionally good, but the financial header is sparse and the content cap prevents better use of width. | The transaction surface has enough complexity to justify a wider working area, but not a full-bleed stretch. Current header stats leave dead space. | Medium | Let Money inherit the wider desktop workspace; preserve the filter side card but rebalance hero/stat density. Consider a fixed side-card width with a wider primary form. | NDZ-009 surface/summary |
| 8 | Calendar | 1440, 1680 | Month grid remains capped at 1024px. | It is legible and not obviously broken. Widening could help event labels, but it is not as awkward as Plan or Library. | Low | Defer unless NDZ-008 changes shell primitives globally. If widened, cap calendar separately to preserve scanability. | NDZ-009 surface/summary |
| 9 | Desktop rail error/status area | 1440–1920 | Error and sync failed cards stack near bottom, and text truncates. | This is not mainly a layout/container bug; it reflects seeded no-spreadsheet runtime state. The rail itself is stable and useful. | Low | Do not redesign rail now. If touched, only refine status message density/truncation after container fixes. | NDZ-008 only if already touching rail |

## Explicit calls

### Empty middle space
- Real issue at 1680/1920: the rail ends at x=288, while Summary content begins at x=465 (1680) and x=585 (1920). The empty band is inside the main work area, not just harmless page margin.
- The cause is shared shell centering: `components/layout/responsiveShell.ts` uses `lg:max-w-5xl lg:mx-auto` for all content.

### Containers that should fill vs stay constrained
- Should fill/widen: Plan/Focus, Summary dashboard, Money transaction workspace, Library empty/list states, composer container.
- Can stay constrained: Calendar can remain moderately capped; Control Center already fills its rail-aware modal space; confirmation dialogs and tiny utility modals can stay narrow.
- Needs variant-based handling: creation/edit forms should be wider than confirmations, but not full-width.

### Centering/alignment
- Current centering is acceptable at 1280/1440 but becomes awkward at 1680/1920.
- Preferred direction: rail-aware desktop alignment with stepped max widths, not arbitrary full stretch. Keep content origin stable enough that the desktop rail and main work area feel connected.

### Summary layout
- Summary is not broken: the hero, focus list, quick actions, and financials create a coherent first screen.
- It is under-dense on wide monitors because the whole dashboard is capped. Fix by widening/tuning the existing dashboard grid, not by adding a new design language.

### Modal/form sizing
- Add Task, Shopping, Expense, and Note use `max-w-md` desktop panels in source (`components/AddTaskModal.tsx`, `components/AddShoppingModal.tsx`, `components/AddExpenseModal.tsx`, `components/AddNoteModal.tsx`).
- This is the clearest shared primitive gap: use `responsiveModal` variants instead of one-off modal classes.

### Information-density mismatch
- Plan has the strongest mismatch: many controls are squeezed into narrow columns even on wide desktop.
- Library has the opposite mismatch: very little content floats in a large dark field.
- Summary and Money are medium: useful grouping exists, but their desktop density does not scale beyond 1440.

## Do not fix / leave alone for now

- Mobile/tablet shell and bottom nav: not inspected as part of this desktop follow-up and should be preserved.
- Control Center desktop panel: the rail-aware overlay and internal sidebar/content split are working well at 1440.
- Calendar month grid: readable and intentional enough; only widen if it naturally inherits a safer shared container.
- Desktop rail structure/navigation: it gives clear app origin and primary actions. Avoid redesigning it in NDZ-008/009.
- Summary quick actions card: useful and understandable; tune container/grid before changing the actions themselves.

## Implementation handoff hints

- Start NDZ-008 in `components/layout/responsiveShell.ts` and `components/layout/contentSurface.ts` with named desktop container/modal variants.
- Then let NDZ-009 opt high-density surfaces into wider variants instead of changing every page at once.
- Use the screenshots and `docs/ndz-007-screenshots/metrics.json` to verify the before/after content x/width deltas at 1280, 1440, 1680, and 1920.
