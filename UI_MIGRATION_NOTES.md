# Arkaiv UI migration

The active frontend now uses the reference's warm neutral workspace, compact green navigation, thin dividers, smaller panel radii, restrained motion and contextual detail panels.

## Changed surfaces

- Shared desktop frame and 224px navigation rail; touch layouts retain bottom navigation and capture.
- Desktop command bar with workspace search, filtering, review, capture/AI/receipt access, and a creation menu connected to existing forms.
- Home: compact financial metrics, cash-flow/budget summary, context rail and the existing personal/routine/goal sections in one responsive rendering path.
- Plan: compact task rows with status, progress, priority, next action and subtask indicators. Full editing, routines and deep-work actions remain in the detail panel. Shopping, savings, investments and loans use the shared visual system.
- Library: note rows replace note masonry; full note editing, journal grouping and skill workflows remain available.
- Money: one transaction ledger replaces the previous grouped card-like blocks. Desktop columns expose category, wallet, status and amount; smaller screens move metadata beneath the description. Receipt indicators and line-item counts open the full detail editor. Its outer card decoration has been removed.
- Calendar, onboarding, settings, review, receipt and creation/edit forms share the new surface, radius and accent vocabulary.
- The previous duplicate desktop/mobile dashboard and unused task-card browsing branches were removed. No second legacy theme or migration switch remains.

## Preserved contracts

No storage schema, spreadsheet mapping, parser contract, server route or financial calculation was changed by the UI migration. Existing create/edit/delete, receipt, AI, routine, nested task, loan, investment, privacy, language and sync handlers remain connected.

The detail-only task editor now displays edit and subtask controls without depending on inline-card expansion. Transaction detail reads the current item by ID, so saves and receipt changes no longer leave a stale selected object.

## Verification

- TypeScript checks and production build pass.
- Existing backend/parser/persistence/sync and component regression tests pass; additional tests cover ledger line-item totals, privacy and task detail controls.
- Browser checks cover desktop (1440px), tablet (768px), phone (390px), transaction navigation/search/filter/detail access, and creation menu wiring.
- Live authenticated Google Sheets and AI calls were not exercised: the preview reports local device storage. Their existing mocked regression coverage passes.
- Vite still reports the existing large JavaScript bundle warning. This migration does not change the deployment setup.

## Follow-up UI fixes — 26 September 2026

- Desktop headers are viewport-fixed across Home, Plan, Library, Money and Calendar, aligned with the sidebar at 17px. Content reserves the header height.
- Moved form font inheritance into the CSS base layer so Tailwind typography is no longer overridden. Goal toggles use readable 12px medium-weight text, with a separate filter row and an aligned section icon.
- Composer shortcuts, feedback and content now use normal vertical flow instead of sharing an absolute overlay position. The text area occupies its own full-width row; capture/ask/scan and send actions sit underneath.
- Compact shortcut chips scroll horizontally. Mobile text is 16px to avoid focus zoom; the input retains at least 64px height. Mobile page padding follows the actual composer height through ResizeObserver.
- Browser verification: all five desktop headers stay fixed; after 531px page scroll header and sidebar remain at 17px. At 390px and 768px widths, shortcut/input rectangles remain separated and there is no page-level horizontal overflow. Shortcut insertion works; the synthetic draft was cleared without submission.
- Desktop overflow follow-up: the 16px framed shell now owns the viewport height and clips its edges. Only the main content pane scrolls; the document itself stays at scroll position 0. At both scroll limits, the header/rail remain inside 17–883px while the frame remains inside 16–884px at a 900px viewport. Content begins exactly below the 76px header and can no longer appear above or below the shell.
- Regression tests cover fixed headers, content inset, separated composer rows/feedback and CSS font layering. No backend handlers or persistence contracts changed.

## Run

Use Node.js with `npm install`, then `npm run dev` (port 3010). Run `npm run lint`, `npm test`, and `npm run build` to verify. Configure backend credentials using `.env.example` and the existing README when testing connected services.

The original user-supplied archive remains untouched. The new source package includes the earlier backend simplification and this UI migration; it excludes node_modules, build output and private environment files.
