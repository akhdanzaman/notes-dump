# NDZ-020 — Desktop: make Library/Notes empty states intentional and anchor search to the content frame

- **Category:** desktop
- **Priority:** medium
- **Implementation repo:** `akhdanzaman/notes-dump`
- **Primary code area:** `components/views/LibraryView.tsx; components/FloatingSearch.tsx; components/layout/contentSurface.ts`

## Problem
When Library/Notes is empty on desktop, the screen feels unfinished and the floating search trigger looks detached from the content area.

## Countermeasure cepat
Add an intentional desktop empty-state card/action row and align Floating Search to the same content/composer container.

## Improvement struktural
Define how sparse states should look on wide desktop so empty screens feel designed rather than abandoned.

## Output yang diharapkan
Desktop Library/Notes empty-state polish with search anchoring proof.

## Acceptance / done criteria
- Empty Library/Notes looks intentional on 1440/1680.
- Search alignment feels connected to the active content surface.
- No mobile regression is introduced.

## Rollback-safe implementation rule
1. Simpan SHA dasar `main` saat mulai implementasi.
2. Kerjakan di branch terisolasi seperti `task/ndz-020-library-empty-state-and-search-anchoring`.
3. Validasi slice ini dulu sebelum push.
4. Kalau validasi atau push gagal, reset branch ke SHA dasar tadi.
5. Kalau implementasi sudah ter-push lalu terbukti regress, rollback pakai commit revert yang jelas.

## Push gate
- Jangan push implementasi sebelum gate slice ini lolos.
- Kalau push gagal, rollback ke SHA dasar task ini lalu buang perubahan yang gagal.
- Setelah push berhasil, rollback harus pakai commit revert yang eksplisit.

## Source refs
- docs/ndz-007-desktop-layout-observation.md issue #6
