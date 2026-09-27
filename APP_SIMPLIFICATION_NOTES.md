# Penyederhanaan aplikasi — 27 September 2026

## Cakupan sembilan poin

1. **Retry AI:** hapus retry rekursif seluruh pipeline. Pro menjalankan maksimal tiga percobaan per tahap dan tidak mengulang tahap pertama yang sudah berhasil ketika tahap kedua gagal. Flash memakai satu lapisan retry yang mencakup request dan parsing JSON. Kegagalan permanen tetap menghasilkan fallback/review tanpa membuang input. Parameter retry internal di API parser dan pemanggilnya dihapus.
2. **Google Calendar:** bandingkan isi event sebelum PATCH; event yang tidak berubah dihitung sebagai skipped. Waktu dengan offset berbeda tetapi instant sama dianggap setara. Penghapusan recurrence mengirim array kosong. Create/delete tetap tersedia. Calendar menerima snapshot yang sudah diakui save, bukan perubahan lokal yang belum tersimpan. List remote tetap dilakukan agar edit/hapus manual di Calendar bisa terdeteksi; tidak ada cache permanen yang menutupi perubahan tersebut.
3. **Perhitungan keuangan:** memoize selector saldo dan transaksi di Money/Summary dengan dependensi data/filter/tanggal. Bangun indeks wallet sekali per pemanggilan selector, menggantikan pencarian linear berulang. Prioritas alias ID/nama lama tetap dipertahankan.
4. **Pemuatan UI:** Plan, Library, Money, Calendar dan dialog fitur berat dimuat melalui lazy import/Suspense. Dialog tertutup tidak langsung dimuat. Summary tetap eager sebagai halaman awal. Bundle utama berubah dari 1.706.252 menjadi 1.403.830 byte (turun sekitar 17,7%); ini ukuran chunk utama, bukan pengurangan total seluruh aset atau jaminan persentase waktu startup.
5. **Kontrak save:** `saveAndSync({ data, budgetConfig, ... })` dan `syncData({ data, ... })` menggantikan argumen posisi panjang. Seluruh pemanggil internal ikut dimigrasi. Hasil save menerapkan kembali budget, settings, prompt, chat, themes, dan koleksi lain. Three-way merge menjaga edit lokal saat request berjalan, termasuk perubahan pada field konfigurasi yang berbeda. Save deferred mempertahankan nilai kosong yang disengaja dan flag force overwrite.
6. **Tanggung jawab modul:** lifecycle save/queue/progress/error/Calendar dipindah ke `useDatabaseSave`; hook workspace menyediakan snapshot dan penerapan state. Registrasi back handler dialog/navigasi di App memakai `useBackHandler`, termasuk cleanup dan callback terbaru. Ref data tetap dipakai untuk operasi async—bukan dihapus secara mekanis. App dan hook utama masih cukup besar; perubahan ini memisahkan dua tanggung jawab konkret, bukan mengklaim seluruh komponen sudah kecil.
7. **Spreadsheet:** parsing konfigurasi wallet/skill/settings dipusatkan di `utils/spreadsheetConfig.ts` dan dipakai service maupun reconciler. Header-aware reading, format legacy, inference schedule skill, dan schedule nonaktif tetap didukung. Writer system snapshot yang tidak dipakai, chunk helper mati, dan parser schedule duplikat dihapus. Jalur baca data legacy tetap ada.
8. **Editor recurrence:** Card dan ShoppingItem memakai `useRoutineDraft` serta fungsi pembentukan patch yang sama. Default masing-masing editor, interval, daftar hari/tanggal/bulan, dan perilaku tanggal khusus Card tetap dipertahankan. Nilai recurrence kosong/tidak valid tidak lagi berubah menjadi NaN.
9. **Tipe domain:** metadata dipisahkan menjadi `FinanceMeta`, `TaskMeta`, dan `RoutineMeta`. `ItemMeta` menjadi envelope kompatibilitas penyimpanan lama. Modul draft rutin, lookup wallet, back handler, serta kontrak tipe diperiksa dalam mode TypeScript strict melalui `tsconfig.domain.json`, dan pemeriksaan ini menjadi bagian dari `npm run lint`. Ini migrasi strict bertahap, bukan strict untuk seluruh proyek.

## Verifikasi

- `npm run lint`: lulus (aplikasi, API, dan domain strict).
- `npm test`: **388 lulus, 0 gagal**.
- `npm run build`: lulus, termasuk output PWA.
- Regresi tambahan: batas retry melalui mock request Gemini, skip/PATCH/POST/DELETE Calendar, recurrence clearing, merge konfigurasi konkuren, acknowledgement parsial, draft recurrence, alias wallet, header spreadsheet, dan schedule skill nonaktif.
- Server lokal di port 3010 dijalankan kembali dan HTTP `/` merespons 200.
- Uji interaksi browser sesudah reload belum tuntas: browser menampilkan kegagalan koneksi pada tab lama. Hasil tidak diklaim sebagai verifikasi seluruh interaksi UI.
- Tidak melakukan write ke akun Google Sheets/Calendar asli; pengujian request eksternal memakai data dan response sintetis.

## Batas yang masih relevan

- Bundle utama dan ExcelJS masih melampaui peringatan 500 kB Vite; menu sudah dipisah tetapi library inti tetap besar. PWA masih dapat melakukan precache chunk terpisah.
- Strict TypeScript baru diberlakukan pada domain terpilih. Envelope ItemMeta tetap diperlukan untuk data lama dan fitur lintas domain.
- Jaminan distributed locking Google Sheets tidak berubah oleh refactor ini.
- Skrip transformasi sekali pakai sudah dihapus; tidak dibutuhkan untuk menjalankan aplikasi.
