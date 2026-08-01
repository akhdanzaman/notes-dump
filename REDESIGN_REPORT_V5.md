# Arkaiv Card Behavior Parity V5

## Ringkasan perubahan

- Kartu task, shopping, note, dan journal sekarang tetap ringkas di daftar lalu membuka detail saat dipilih, mengikuti pola progressive disclosure pada Money.
- Detail tampil sebagai bottom sheet di mobile dan contextual side panel di desktop.
- Layer detail memakai portal dan `z-100`, sehingga chatbar, quick input, bottom navigation, dan floating filter tidak menutup editor.
- Seluruh kartu saving goal, investment, dan skill dapat ditekan untuk membuka editor yang sudah tersedia; tombol status, kontribusi, edit, dan hapus di dalam kartu tetap bekerja mandiri.
- Editor task di panel tetap mempertahankan kontrol deep-work: edit, subtask, transform into steps, retrigger, dan remove subtasks.
- Save dan delete menutup detail secara terkontrol tanpa mengubah handler CRUD atau bentuk data.
- Card trigger memakai semantik `group` yang dapat difokuskan, sehingga tidak membuat elemen button bersarang ketika kartu memiliki action button sendiri.
- Money transaction detail ikut memakai token overlay/panel yang sama agar perilaku modal konsisten lintas workspace.
- Motion lama tetap dipertahankan melalui `PresencePanel`, `AnimatePresence`, layout motion, collapse variants, serta reduced-motion support yang sudah ada.

## File yang berubah pada V5

- `components/Card.tsx`
- `components/ShoppingItem.tsx`
- `components/layout/contentSurface.ts`
- `components/views/PlanView.tsx`
- `components/views/LibraryView.tsx`
- `components/views/MoneyView.tsx`
- `components/__tests__/transactionComposerAndCard.test.tsx`
- `components/layout/__tests__/tabletBaseline.test.ts`

## Keputusan desain utama

- Daftar dipakai untuk scanning cepat; editing kompleks dipindahkan ke detail surface yang konsisten.
- Mobile menggunakan sheet dari bawah dengan tinggi maksimum `92dvh` dan safe-area padding.
- Desktop menggunakan panel kanan penuh agar konteks daftar tetap terlihat.
- Layer editor sengaja lebih tinggi daripada composer untuk mencegah konflik visual dan touch target.
- Action button di dalam kartu menghentikan event propagation, sehingga menandai selesai atau menghapus tidak membuka editor secara tidak sengaja.
- Business logic, finance selectors, accounting policy, spreadsheet schema, sync, receipt flow, dan model data tidak diubah.

## Hasil validasi

- TypeScript (`npm run lint`): lulus.
- Tests (`npm test`): 313/313 lulus.
- Production build (`npm run build`): lulus; 2.428 module ditransformasi.
- Browser QA desktop: Plan, Library, Money wallet editor, dan Library note side panel.
- Browser QA mobile 390×844 px: Library card, note bottom sheet, Skill card editor, chatbar, dan bottom navigation.
- Detail panel terukur pada layer `z-100`, fixed terhadap viewport, dan menutup area composer dengan benar.
- Quick input tetap berupa tiga ikon di chatbar; tidak ada selector teks Capture/Ask/Scan yang kembali muncul.

## Risiko dan kebutuhan data tambahan

- Build masih memberi peringatan ukuran chunk utama sekitar 1,66 MB. Ini tidak menggagalkan build; code splitting sebaiknya ditangani sebagai pekerjaan performa terpisah.
- Dataset QA lokal tidak memiliki task Plan aktif, sehingga detail task/deep-work diverifikasi melalui renderer bersama, type checking, dan regression tests; Library note dan Skill divalidasi langsung di browser.
- Beberapa copy editor lama masih berbahasa Inggris. Opsi bahasa di Control Center sudah tersedia, tetapi penerjemahan seluruh field lama membutuhkan inventaris copy terpisah agar tidak mengubah alur secara tidak sengaja.
