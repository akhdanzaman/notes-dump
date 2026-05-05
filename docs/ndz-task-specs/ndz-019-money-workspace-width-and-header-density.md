# NDZ-019 — Desktop: rebalance Money workspace width and header density

- **Category:** desktop
- **Priority:** high
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/views/MoneyView.tsx; components/layout/contentSurface.ts`

## Problem
Money already has a decent form plus filter split, but the header feels sparse and the shared cap prevents the surface from using desktop width well.

## Countermeasure cepat
Let Money inherit a wider workspace variant with a fixed side-card width and a more purposeful header/stat rhythm.

## Improvement struktural
Improve scan efficiency without turning the finance area into a full-bleed spreadsheet-like layout.

## Output yang diharapkan
Money desktop polish with width tuning and metric proof that the primary workspace uses the post-rail area better.

## Acceptance / done criteria
- Money uses desktop width better than the centered-cap baseline.
- Filter/context card remains coherent and reachable.
- Finance semantics and data paths stay unchanged.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-019-money-workspace-width-and-header-density`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/ndz-007-desktop-layout-observation.md issue #7
- docs/responsive-ux-desktop-plan.md guardrails
