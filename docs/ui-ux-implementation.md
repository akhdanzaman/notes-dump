# UI/UX execution baseline

Source baseline: 5577346. Existing spreadsheet schema v3, durable queues, and operation IDs must remain compatible.

Sequential acceptance: 0 baseline -> 1 safe privacy/drafts/local saves/conflicts -> 2 shared shell and components -> 3 Summary, Plan, Library, Money, Calendar -> 4 motion -> 5 automated/browser acceptance and rollout.

States: empty/populated, dirty draft, local failure, offline/pending, accepted, committed, conflict. Main tabs and all sub-tabs are covered by the UI review saved outside this repository. Test surfaces: separate spreadsheet copy; synthetic local fixtures for offline/data volume. Production cells must not be used for UI tests.

Keyboard virtual behavior requires a physical device; record this limitation if not available. Browser width checks are not a substitute.

Phase 1: local-commit save contract, recoverable UI drafts, dirty-close guard, masked shopping/journal, per-entity/per-field conflict review with stale-value check. Validation: 430 tests pass, both TypeScript projects pass. Schema v3 unchanged.

Phase 2: single local subnav, readable metadata, wider responsive editors, fixed form scroll region/sticky entity actions, compact unfocused mobile capture, shared private amount primitive. TypeScript validation passes.

Phase 3: Summary priorities; Plan overdue/completed access, goals without duplicate milestones, safe funding editors; Library individual journal entries and session local save; Money wallet/category source navigation; Calendar day strip/navigation, time ranges and shared editor. Shopping completion collects actual amount/wallet/date and commits item + expense together. Task completion has a 10-second undo.

Phase 4: 160ms page fade, 200ms panel entry/140ms exit, no dashboard stagger, immediate local tab context and active-only panels. Main/content swipes removed; date swipe rejects vertical/input gestures. Nested dialogs retain inert background and topmost focus handling. TypeScript validation passes.

Phase 5 validation: 437 tests pass; app and API TypeScript checks pass; production build passes. Added behavior tests cover scoped draft recovery, dirty close, nested dialogs/Back, remote refresh, storage failure, failed editor save, per-field conflict, privacy, and 10,000-record pagination. Browser: five main tabs at 320/390/768/1280px; all sub-tabs; save/reload/temporary reveal/agenda navigation. Data: local synthetic onboarding fixtures, no production cell mutations. Physical iOS/Android keyboard and screen-reader/device performance remain unverified. Deployment begins with Preview; rollout results are recorded after verification.

Save follow-up: transaction detail now closes after local acknowledgement, matching Plan/Library/Calendar. Explicit settings Save awaits local persistence and closes; failure retains the panel. Added success/pending/failure regressions: 439 tests pass, TypeScript and build pass. Browser verified transaction save closes and edited content survives reload.
