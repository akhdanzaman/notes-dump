# NDZ-014 — Mobile: lock the bottom-nav and composer baseline below lg

- **Category:** mobile
- **Priority:** high
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/BottomNav.tsx; components/InputBar.tsx; App.tsx`

## Problem
Desktop shell work can accidentally regress the touch-first bottom stack that is core to Notes Dump muscle memory.

## Countermeasure cepat
Add explicit responsive guards so bottom nav, composer, and menu behavior remain the primary navigation/capture path below lg.

## Improvement struktural
Document and enforce the exact mobile breakpoints where desktop rail/sidebar logic must not appear.

## Output yang diharapkan
Regression guard task covering nav labels, active states, menu flow, and fixed composer behavior below lg.

## Acceptance / done criteria
- No desktop rail/sidebar appears below 1024px.
- Bottom nav labels and tab switching match the current mobile baseline.
- Composer remains bottom-docked and usable on phone widths.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-014-bottom-nav-and-composer-baseline-lock`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/responsive-ux-desktop-plan.md QA checklist
