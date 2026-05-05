# NDZ-015 — Mobile: preserve swipe flows and keyboard avoidance during responsive refactors

- **Category:** mobile
- **Priority:** high
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `App.tsx; components/views/SummaryView.tsx; components/views/PlanView.tsx; components/views/MoneyView.tsx; components/views/CalendarView.tsx`

## Problem
Layout changes can break visualViewport handling or swipe-based date/tab navigation even when the UI still looks roughly correct.

## Countermeasure cepat
Regression-test visualViewport keyboard avoidance and swipe gestures on Summary, Plan, Focus, Money, Calendar, Library/Notes, and Shopping.

## Improvement struktural
Capture these flows as explicit mobile gates so desktop work cannot ship on screenshots alone.

## Output yang diharapkan
Mobile regression checklist plus proof notes for keyboard avoidance and swipe behavior.

## Acceptance / done criteria
- Keyboard opening does not trap the composer or hide active input controls.
- Swipe tab/date interactions still work where they currently exist.
- Desktop-only focus/hover enhancements do not become required on mobile.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-015-gesture-and-keyboard-avoidance-regression-pack`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/responsive-ux-desktop-plan.md QA checklist
- docs/responsive-ux-desktop-plan.md risk zones
