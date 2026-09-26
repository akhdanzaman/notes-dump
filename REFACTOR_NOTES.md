# Catatan Penyederhanaan

## Backend yang sudah disederhanakan

- Server Express lokal sekarang memakai enam handler API yang sama dengan Vercel. Jalur publik, payload, cookie, CSRF, status akses spreadsheet, dan penerusan status/content-type upstream tetap dipertahankan.
- OAuth Google memiliki satu implementasi bersama untuk origin allowlist, state bertanda tangan yang berlaku 10 menit, scopes, pertukaran authorization code, dan refresh token.
- Implementasi service-account yang sebelumnya tersalin identik di dua tempat dijadikan satu sumber di `api/_lib/googleServiceAccount.ts`.
- `npm start` kembali dapat dijalankan melalui `tsx`, port dapat diatur lewat `PORT`, import Vite hanya dilakukan saat mode development, dan fallback SPA sudah kompatibel dengan Express 5.
- Validasi path proxy Sheets tetap menerima metadata, `:batchUpdate`, `/values/...`, `/values:batchGet`, dan `/values:batchUpdate`, tetapi menolak path traversal, fragment, backslash, dan prefix palsu seperti `/values-private`.
- Sinkronisasi spreadsheet internal sekarang membawa satu objek `{ db, forceOverwrite, onProgress }`, bukan tuple 12 posisi yang memecah lalu membentuk ulang objek database.
- Tipe sinkronisasi kecil digabung ke `types.ts`; ekspor helper yang tidak memiliki pemakai dihapus.
- Empat modul parser eksperimental yang sudah di-rollback dan tidak masuk runtime dihapus bersama benchmark/test khususnya. Alur aktif tetap: parser finansial lokal → parser AI terpilih → validasi/canonicalization → duplicate guard → optional review → enrichment.
- Konversi file gambar ke base64 disatukan untuk chat dan pembacaan nota.
- Dependensi langsung yang tidak dipakai (`recharts`, `autoprefixer`, dan `postcss`) dihapus. Tailwind tetap dibangun melalui plugin Vite resminya.

## Kontrak yang sengaja tidak diubah

- Enam URL API Google/Vercel tetap sama.
- Service-account masih memakai cookie `HttpOnly`, `SameSite=Strict`, header CSRF, origin guard, dan allowlist spreadsheet opsional.
- Jika allowlist spreadsheet kosong, perilaku lama tetap berlaku: spreadsheet apa pun yang sudah dibagikan ke service account dapat diakses oleh sesi aplikasi same-origin yang valid. `.env.example` sekarang menjelaskan kontrak ini secara eksplisit.
- Debounce sinkronisasi 1.200 ms, antrean operasi, pending-write cache, merge remote, force overwrite, dan verifikasi write tetap aktif.
- Parser lokal, parser Gemini Flash/Pro, receipt parsing, Calendar sync, Drive config, dan seluruh format spreadsheet tetap tersedia.

## Backend yang layak dikerjakan berikutnya

1. `services/spreadsheetService.ts` masih terlalu besar. Pecah berdasarkan tanggung jawab (transport/auth, read/reconcile, write plan, dan presentation formatting); jangan gabungkan dengan `spreadsheetReconciler.ts` atau `syncFacade.ts`.
2. Tetapkan satu kebijakan retry AI. Saat ini retry request dan retry seluruh pipeline masih dapat bertumpuk; ubah setelah ada test jumlah panggilan, error parsing, dan fallback.
3. Tambahkan CI dan coverage untuk token service-account, cache token, upstream fetch gagal/sukses, debounce/flush sync, dan handler API end-to-end.
4. Aktifkan TypeScript `strict` bertahap. Script bernama `lint` saat ini adalah type-check, bukan ESLint.
5. Tinjau temuan `npm audit` secara terpisah dan lakukan upgrade terukur; jangan memakai `npm audit fix --force` tanpa regression test.

## Frontend yang sudah disederhanakan

- Smoke characterization test ditambahkan untuk empty-state dan aksi utama Summary, Money, Plan, dan Library.
- Script `npm test` sekarang benar-benar menjalankan `*.test.ts` dan `*.test.tsx`; sebelumnya seluruh test komponen TSX terlewat oleh discovery default.
- Callback update item yang sebelumnya disalin di empat view dan membawa puluhan argumen posisi diganti dengan satu `ItemUpdatePatch` bertipe.
- `Card.tsx` dan `RoutineTaskModal.tsx` sekarang memakai satu implementasi `calculateFirstDueDate`; edge case akhir bulan tetap dilindungi test.
- Barrel `utils/selectors.ts` dan `utils/selectors/index.ts` dijadikan satu file. Token `motion/config.ts` juga digabung ke `motion/transitions.ts`.
- Akses cache `localStorage` di Summary diberi guard sehingga dashboard aman pada SSR/test environment dan saat storage browser tidak tersedia.
- State, panel, editor draft, dan perilaku collapse workspace task/subtask yang sama di Summary dan Plan dipindahkan ke satu hook `useTaskWorkspace`.
- Formatter mata uang yang tersebar di komponen, selector insight, dan ekspor spreadsheet sekarang memakai satu `formatCurrencyAmount`; perilaku sembunyikan nominal tetap berada di view terkait.
- Pengelompokan tanggal serta comparator fokus yang berulang di `focusSelectors` disatukan tanpa mengubah urutan pending/done, prioritas, atau tanggal.
- Test unit ditambahkan untuk fallback panel/draft subtask dan format mata uang. Pemindaian clone frontend dengan ambang 15 baris/100 token turun dari 9 clone/232 baris menjadi 8 clone/186 baris.

## Prioritas frontend berikutnya

Coverage berikutnya tetap perlu mencakup interaksi (bukan hanya render) untuk Control Center, panel task/subtask, recurrence editor, receipt review, dan settings.

Setelah coverage tersedia:

1. Jadikan `App.tsx` shell/composition saja. Pisahkan receipt background workflow, review center, security, onboarding/PWA, import, dan modal state berdasarkan fitur.
2. Pecah komponen terbesar menurut layar nyata, bukan menjadi micro-component: `SummaryView.tsx`, `MoneyView.tsx`, `PlanView.tsx`, `ControlCenter.tsx`, dan `Card.tsx`.
3. Ekstrak bagian tampilan nyata yang masih berulang antara `Card.tsx` dan `ShoppingItem.tsx`, terutama editor recurrence; jangan membuat komponen kecil hanya untuk mengejar angka duplikasi.
4. Sentralisasi formatter tanggal setelah kontrak locale Indonesia/Inggris diberi test yang eksplisit.
5. Hapus kompatibilitas metadata router/batch lama dari `types.ts`, Review Center, dan parser health dalam satu perubahan frontend yang dilindungi test.
6. Jangan menyuntikkan `GEMINI_API_KEY` server ke bundle browser pada deployment bersama. Pertahankan input key pengguna, atau pindahkan panggilan AI berkunci server ke endpoint backend.
