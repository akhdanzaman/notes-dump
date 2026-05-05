# NDZ-017 — Desktop: widen Summary/Home rhythm without inventing new widgets

- **Category:** desktop
- **Priority:** high
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/views/SummaryView.tsx; components/layout/contentSurface.ts`

## Problem
Summary is coherent but under-dense on 1680-1920 widths because the dashboard does not scale with the available post-rail workspace.

## Countermeasure cepat
Move Summary to a wider desktop dashboard variant and retune side-column widths before adding any new content.

## Improvement struktural
Keep the current hierarchy while increasing scan efficiency through layout rhythm, card grouping, and better use of the right-side context area.

## Output yang diharapkan
A wider Summary surface with before/after captures proving better use of space without adding filler widgets.

## Acceptance / done criteria
- Summary still feels like Notes Dump, not a new dashboard product.
- The first screen uses wide desktop space better at 1680/1920.
- No unrelated surface is widened just because Summary needed it.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-017-summary-wide-dashboard-density`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/ndz-007-desktop-layout-observation.md issue #3
- docs/responsive-ux-desktop-plan.md desktop examples
