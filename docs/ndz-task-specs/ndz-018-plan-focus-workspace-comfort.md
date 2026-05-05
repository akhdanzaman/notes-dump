# NDZ-018 — Desktop: give Plan and Focus a wider workspace and more comfortable edit surfaces

- **Category:** desktop
- **Priority:** critical
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/views/PlanView.tsx; components/views/FocusView.tsx; components/layout/contentSurface.ts`

## Problem
Plan/Focus packs too many controls into narrow columns, so wide viewports give almost no comfort improvement over smaller desktop widths.

## Countermeasure cepat
Adopt a wider workspace variant and stronger column minimums for edit-heavy Plan/Focus layouts.

## Improvement struktural
Separate passive list density from edit-card comfort so task editing stays legible without sacrificing overview scanning.

## Output yang diharapkan
Desktop Plan/Focus layout polish with proof that bottom actions, date controls, priority buttons, and progress fields breathe on 1440/1680.

## Acceptance / done criteria
- Wide desktop materially improves edit comfort vs the 1024px cap baseline.
- Primary actions remain visible without composer overlap.
- Mobile/tablet task flows remain unchanged.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-018-plan-focus-workspace-comfort`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/ndz-007-desktop-layout-observation.md issue #4
