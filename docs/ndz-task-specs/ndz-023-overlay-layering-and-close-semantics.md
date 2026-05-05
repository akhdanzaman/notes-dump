# NDZ-023 — Modal: harden overlay layering and Escape/back/close semantics across search, chat, review, and dialogs

- **Category:** modal
- **Priority:** high
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `App.tsx; components/FloatingSearch.tsx; components/FloatingChatBox.tsx; components/ControlCenter.tsx`

## Problem
Search, chat, review, Control Center, and dialogs already share a layered overlay system that can regress when desktop alignment changes.

## Countermeasure cepat
Create an explicit layering and close-behavior matrix, then verify it against desktop-aligned overlays.

## Improvement struktural
Preserve shared state and close semantics across mobile and desktop so new panel positions do not create stuck or unreachable overlay states.

## Output yang diharapkan
Overlay interaction matrix plus regression proof for Escape/back/close behavior.

## Acceptance / done criteria
- Search/chat/review/control-center/dialog layering is deliberate and conflict-free.
- Escape/back closes the right surface in the right order.
- Desktop alignment does not create unreachable overlay states.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-023-overlay-layering-and-close-semantics`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/responsive-ux-desktop-plan.md risk zones
- docs/responsive-ux-desktop-plan.md desktop improved
