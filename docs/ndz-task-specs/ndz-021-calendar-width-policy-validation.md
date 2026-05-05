# NDZ-021 — Desktop: validate Calendar width policy and only widen if scanability improves

- **Category:** desktop
- **Priority:** medium
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/views/CalendarView.tsx; components/layout/contentSurface.ts`

## Problem
Calendar is not obviously broken, but it may inherit shell changes that either help or hurt scanability.

## Countermeasure cepat
Treat Calendar as a validation-first task: only widen it if event readability improves without making the month grid harder to scan.

## Improvement struktural
Establish a separate width policy for calendar-like dense grids instead of assuming every surface should expand with the shell.

## Output yang diharapkan
A calendar width decision backed by before/after captures and a documented keep-as-is outcome if widening is not better.

## Acceptance / done criteria
- Calendar stays intentionally readable at desktop widths.
- Any widening is justified by real label/detail improvement.
- If not better, the task explicitly keeps the prior cap.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-021-calendar-width-policy-validation`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/ndz-007-desktop-layout-observation.md issue #8
