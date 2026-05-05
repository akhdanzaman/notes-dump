# NDZ-013 — General: harden desktop status visibility so sync and review signals never get buried

- **Category:** general
- **Priority:** high
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/Header.tsx; components/layout/responsiveShell.ts; components/ControlCenter.tsx`

## Problem
Desktop shell changes can make sync/error/review indicators feel secondary or truncate them inside the rail.

## Countermeasure cepat
Reserve an always-visible desktop status zone for sync state, pending writes, refresh/manual sync, and pending reviews.

## Improvement struktural
Compact status copy for desktop while preserving the same callbacks and semantics as the mobile header, with no hidden failure state behind hover-only affordances.

## Output yang diharapkan
A desktop status pattern spec plus proof that sync failure and pending review counts remain visible across key surfaces.

## Acceptance / done criteria
- Sync failure and pending review count stay visible on desktop.
- Manual refresh/sync remains reachable in one action.
- Rail/topbar copy truncation does not hide the meaning of the alert.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-013-desktop-status-density-and-visibility`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/responsive-ux-desktop-plan.md
- docs/ndz-007-desktop-layout-observation.md issue #9
