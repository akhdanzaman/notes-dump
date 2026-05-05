# NDZ-011 — General: replace the centered desktop island with rail-aware container variants

- **Category:** general
- **Priority:** critical
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/layout/responsiveShell.ts; components/layout/contentSurface.ts`

## Problem
Desktop content still drifts toward the middle on wide viewports because a shared centered max-width keeps the post-rail workspace under-used.

## Countermeasure cepat
Swap the single centered desktop cap for named container variants that keep mobile/tablet untouched and align desktop content to the rail origin.

## Improvement struktural
Define reusable shell/container variants for standard, wide, and workspace surfaces so Summary, Plan, Money, and Library can opt into the right width without one-off overrides.

## Output yang diharapkan
Shared container primitives plus explicit surface mapping plus screenshot proof at 1280/1440/1680/1920.

## Acceptance / done criteria
- Below lg there is no visual regression.
- At 1680 and 1920 the main content starts close to the rail edge instead of floating as a centered 1024px island.
- No view silently stretches to unreadable full width.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-011-rail-aware-container-variants`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/responsive-ux-desktop-plan.md
- docs/ndz-007-desktop-layout-observation.md issue #1
