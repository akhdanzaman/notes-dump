# NDZ-024 — Modal: keep destructive confirmations narrow, obvious, and separated from dense form workflows

- **Category:** modal
- **Priority:** medium
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/ControlCenter.tsx; confirmation dialog wrappers; add/edit modal wrappers`

## Problem
As desktop forms get wider, destructive confirmation patterns can accidentally inherit the same visual weight and feel less intentionally risky.

## Countermeasure cepat
Keep destructive confirms as compact focused dialogs even while data-entry forms become wider on desktop.

## Improvement struktural
Define a visual and interaction split between dense-form work and risky irreversible actions, especially around Control Center/data operations.

## Output yang diharapkan
Confirmation dialog policy with explicit separation from form-panel variants.

## Acceptance / done criteria
- Destructive confirms remain compact and high-signal.
- Control Center dangerous operations stay visually separated from preferences.
- Form widening does not dilute risk signaling.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-024-destructive-confirmation-separation`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/responsive-ux-desktop-plan.md control center
- docs/responsive-ux-desktop-plan.md risk zones
