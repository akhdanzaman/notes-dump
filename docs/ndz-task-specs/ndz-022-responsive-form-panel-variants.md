# NDZ-022 — Modal: standardize responsive form-panel variants for task, note, shopping, and expense flows

- **Category:** modal
- **Priority:** high
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/AddTaskModal.tsx; components/AddNoteModal.tsx; components/AddShoppingModal.tsx; components/AddExpenseModal.tsx; components/layout/contentSurface.ts`

## Problem
Desktop creation/edit forms still inherit mobile-like panel widths too often, especially on dense two-column forms.

## Countermeasure cepat
Create shared modal variants for simple, form, and dense-form layouts instead of repeating one-off width choices per modal.

## Improvement struktural
Keep mobile bottom sheets intact while making desktop forms wide enough to breathe, validate, and group fields clearly.

## Output yang diharapkan
Shared responsiveModal variants plus a modal-to-variant mapping table.

## Acceptance / done criteria
- Dense forms use wider desktop panels than simple confirmations.
- Mobile bottom-sheet behavior is preserved.
- No modal relies on an unexplained per-file width hack.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-022-responsive-form-panel-variants`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/ndz-007-desktop-layout-observation.md issue #5
- docs/responsive-ux-desktop-plan.md forms and modals
