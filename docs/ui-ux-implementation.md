# UI/UX execution baseline

Source baseline: 5577346. Existing spreadsheet schema v3, durable queues, and operation IDs must remain compatible.

Sequential acceptance: 0 baseline -> 1 safe privacy/drafts/local saves/conflicts -> 2 shared shell and components -> 3 Summary, Plan, Library, Money, Calendar -> 4 motion -> 5 automated/browser acceptance and rollout.

States: empty/populated, dirty draft, local failure, offline/pending, accepted, committed, conflict. Main tabs and all sub-tabs are covered by the UI review saved outside this repository. Test surfaces: separate spreadsheet copy; synthetic local fixtures for offline/data volume. Production cells must not be used for UI tests.

Keyboard virtual behavior requires a physical device; record this limitation if not available. Browser width checks are not a substitute.
