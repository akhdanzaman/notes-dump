# Penyederhanaan aplikasi — 27 September 2026

## Cakupan sembilan poin

1. **Retry AI:** hapus retry rekursif seluruh pipeline. Pro menjalankan maksimal tiga percobaan per tahap dan tidak mengulang tahap pertama yang sudah berhasil ketika tahap kedua gagal. Flash memakai satu lapisan retry yang mencakup request dan parsing JSON. Kegagalan permanen tetap menghasilkan fallback/review tanpa membuang input. Parameter retry internal di API parser dan pemanggilnya dihapus.
2. **Google Calendar:** bandingkan isi event sebelum PATCH; event yang tidak berubah dihitung sebagai skipped. Waktu dengan offset berbeda tetapi instant sama dianggap setara. Penghapusan recurrence mengirim array kosong. Create/delete tetap tersedia. Calendar menerima snapshot yang sudah diakui save, bukan perubahan lokal yang belum tersimpan. List remote tetap dilakukan agar edit/hapus manual di Calendar bisa terdeteksi; tidak ada cache permanen yang menutupi perubahan tersebut.
3. **Perhitungan keuangan:** memoize selector saldo dan transaksi di Money/Summary dengan dependensi data/filter/tanggal. Bangun indeks wallet sekali per pemanggilan selector, menggantikan pencarian linear berulang. Prioritas alias ID/nama lama tetap dipertahankan.
4. **Pemuatan UI:** Plan, Library, Money, Calendar dan dialog fitur berat dimuat melalui lazy import/Suspense. Dialog tertutup tidak langsung dimuat. Summary tetap eager sebagai halaman awal. Bundle utama berubah dari 1.706.252 menjadi 1.403.830 byte (turun sekitar 17,7%); ini ukuran chunk utama, bukan pengurangan total seluruh aset atau jaminan persentase waktu startup.
5. **Kontrak save:** `saveAndSync({ data, budgetConfig, ... })` dan `syncData({ data, ... })` menggantikan argumen posisi panjang. Seluruh pemanggil internal ikut dimigrasi. Hasil save menerapkan kembali budget, settings, prompt, chat, themes, dan koleksi lain. Three-way merge menjaga edit lokal saat request berjalan, termasuk perubahan pada field konfigurasi yang berbeda. Save deferred mempertahankan nilai kosong yang disengaja dan flag force overwrite.
6. **Tanggung jawab modul:** lifecycle save/queue/progress/error/Calendar memakai `useDatabaseSave`. Workflow nota, keamanan, pusat tinjauan, onboarding/tutorial, feedback, dan integrasi browser sekarang masing-masing memiliki hook sendiri. Logika lifecycle rutinitas dipindah ke `utils/routineLifecycle.ts` dan diuji langsung tanpa mengimpor hook utama. App fokus pada navigasi, komposisi tampilan, dan penghubung callback. Registrasi back handler tetap memakai `useBackHandler`. Detail penyelesaian ada di `PRIORITY_6_8_9_NOTES.md`.
7. **Spreadsheet:** parsing konfigurasi wallet/skill/settings dipusatkan di `utils/spreadsheetConfig.ts` dan dipakai service maupun reconciler. Header-aware reading, format legacy, inference schedule skill, dan schedule nonaktif tetap didukung. Writer system snapshot yang tidak dipakai, chunk helper mati, dan parser schedule duplikat dihapus. Jalur baca data legacy tetap ada.
8. **Editor recurrence:** Card dan ShoppingItem memakai `useRoutineDraft`, fungsi pembentukan patch, serta komponen UI `RoutineScheduleEditor` yang sama. JSX interval/hari/tanggal/bulan tidak lagi diduplikasi. Default masing-masing editor dan perilaku penyesuaian tanggal khusus Card tetap dipertahankan. Nilai recurrence kosong/tidak valid tidak lagi berubah menjadi NaN.
9. **Tipe domain:** metadata dipisahkan menjadi `FinanceMeta`, `TaskMeta`, dan `RoutineMeta`. Mode TypeScript strict sekarang aktif di seluruh aplikasi dan API, bukan hanya domain terpilih. Konfigurasi subset `tsconfig.domain.json` yang redundan dihapus. Snapshot undo dan konteks deep-work memiliki tipe eksplisit; cast konteks `as any` dihapus. `ItemMeta` tetap menjadi envelope kompatibilitas penyimpanan lama.

## Verifikasi tahap awal (sebelum penyelesaian 6/8/9)

- `npm run lint`: lulus (aplikasi, API, dan domain strict).
- `npm test`: **388 lulus, 0 gagal**.
- `npm run build`: lulus, termasuk output PWA.
- Regresi tambahan: batas retry melalui mock request Gemini, skip/PATCH/POST/DELETE Calendar, recurrence clearing, merge konfigurasi konkuren, acknowledgement parsial, draft recurrence, alias wallet, header spreadsheet, dan schedule skill nonaktif.
- Server lokal di port 3010 dijalankan kembali dan HTTP `/` merespons 200.
- Uji interaksi browser sesudah reload belum tuntas: browser menampilkan kegagalan koneksi pada tab lama. Hasil tidak diklaim sebagai verifikasi seluruh interaksi UI.
- Tidak melakukan write ke akun Google Sheets/Calendar asli; pengujian request eksternal memakai data dan response sintetis.

## Batas yang masih relevan

- Bundle utama dan ExcelJS masih melampaui peringatan 500 kB Vite; menu sudah dipisah tetapi library inti tetap besar. PWA masih dapat melakukan precache chunk terpisah.
- Strict TypeScript sudah berlaku untuk proyek. Envelope ItemMeta dan beberapa explicit `any` legacy masih ada; strict tidak berarti semua data eksternal sudah tervalidasi runtime.
- Jaminan distributed locking Google Sheets tidak berubah oleh refactor ini.
- Skrip transformasi sekali pakai sudah dihapus; tidak dibutuhkan untuk menjalankan aplikasi.
