# NDZ-012 — General: align the desktop composer with content and remove bottom overlap hotspots

- **Category:** general
- **Priority:** critical
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/InputBar.tsx; components/FloatingChatBox.tsx; App.tsx; components/layout/responsiveShell.ts`

## Problem
The desktop composer can feel detached from the active content width and can overlap edit-heavy surfaces near the bottom.

## Countermeasure cepat
Tie the fixed composer/chat wrapper to the same desktop gutter and width rules as the main content frame.

## Improvement struktural
Add shared bottom-safe spacing rules for edit-heavy surfaces so dense task and finance cards keep their last actions visible without changing mobile composer behavior.

## Output yang diharapkan
Shared desktop composer container plus view-safe bottom padding rules plus overlap proof on Plan and Money.

## Acceptance / done criteria
- Composer x-position and width follow the active desktop content container.
- Plan/Focus bottom actions remain tappable/clickable without composer collision.
- Mobile bottom-docked composer behavior is unchanged.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-012-composer-alignment-and-anti-overlap`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/responsive-ux-desktop-plan.md
- docs/ndz-007-desktop-layout-observation.md issue #2
