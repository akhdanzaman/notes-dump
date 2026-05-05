# NDZ-016 — Mobile: preserve tablet baseline, existing sm modal centering, and current note masonry

- **Category:** mobile
- **Priority:** medium
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/views/LibraryView.tsx; components/views/NotesView.tsx; components/AddTaskModal.tsx; components/AddNoteModal.tsx`

## Problem
Tablet is the easiest breakpoint to accidentally hybridize: too wide for phone assumptions, too narrow for desktop rail patterns.

## Countermeasure cepat
Keep the current tablet shell, sm modal centering, and note/library two-column masonry exactly as baseline unless a task explicitly proves a benefit.

## Improvement struktural
Formalize tablet as a locked responsive tier rather than a side effect of desktop classes.

## Output yang diharapkan
Tablet-specific acceptance gate covering 640-1023 behavior and existing masonry/modal expectations.

## Acceptance / done criteria
- Tablet keeps the current bottom-stack-first interaction model.
- Existing note/library masonry remains intact.
- sm modal behavior remains centered where it already works today.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-016-tablet-baseline-no-rail-and-existing-masonry`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/responsive-ux-desktop-plan.md breakpoint contract
- docs/responsive-ux-desktop-plan.md QA checklist
