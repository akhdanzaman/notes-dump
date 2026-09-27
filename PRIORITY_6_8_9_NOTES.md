# Penyelesaian prioritas 6, 8, 9 — 27 September 2026

## 6. Pemisahan tanggung jawab

- `useReceiptWorkflow`: antrean scan nota, draft tersimpan, duplikat, konversi kurs, persetujuan/penolakan, retry, dan cleanup timer. Parser nota dimuat saat dibutuhkan.
- `useAppSecurity`: pengaturan keamanan lokal, permintaan/verifikasi password, dan dialog penguncian. Permintaan password yang diganti atau ditutup karena unmount selesai sebagai pembatalan, bukan Promise menggantung.
- `useReviewCenter`: jumlah badge, notifikasi aktivitas baru, status proses berjalan, serta buka/tutup panel.
- `useAppOnboarding`: onboarding, preview parsing, changelog, dan tutorial fitur.
- `useAppFeedback`: notice, timer, dan konfirmasi global beserta cleanup.
- `useBrowserIntegration`: reply URL/notifikasi, OAuth, tema, bahasa, dan integrasi notifikasi persisten. Efek reply URL duplikat dihapus.
- `utils/routineLifecycle.ts`: penentuan jadwal berikutnya, aktivasi manual, reset rutinitas, dan perlakuan subtugas. Tidak bergantung pada React.

App turun dari sekitar 2.824 menjadi 2.008 baris, hook data utama dari 2.769 menjadi 2.449 baris, dibanding ZIP tahap sebelumnya. Ini pemisahan tanggung jawab, bukan klaim bahwa total seluruh kode turun sebanyak itu. Hook baru dipisahkan berdasarkan workflow nyata; tidak menambahkan framework atau lapisan service generik.

## 8. Satu editor jadwal rutin

Card dan ShoppingItem kini memakai `RoutineScheduleEditor`. Interval harian/mingguan/bulanan/tahunan, pilihan hari 0–6, tanggal 1–31, dan bulan 0–11 ditampilkan oleh komponen yang sama. Tombol menggunakan `type="button"` dan status `aria-pressed`.

State dan patch tetap memakai `useRoutineDraft`. Pilihan tersimpan ketika berpindah interval. Default recurrence Card dan ShoppingItem tetap berbeda sesuai perilaku lama. Penyesuaian tanggal otomatis khusus Card tetap dilakukan oleh Card; perubahan pilihan bulan tahunan tidak tiba-tiba mengubah tanggal.

## 9. Strict seluruh proyek

`tsconfig.json` dan `api/tsconfig.json` mengaktifkan `strict: true`; `npm run lint` memeriksa keduanya. Konfigurasi domain-only dihapus karena redundan.

Perbaikan mencakup nilai nullable hasil AI, default konfigurasi spreadsheet, narrowing baris belanja/transaksi, daftar field canonical yang bertipe literal, metadata aktivasi rutin manual, snapshot undo parsing, dan merge konfigurasi. Penghapusan cast konteks menemukan ref/setter gambar tema yang belum diberikan ke deep-work; keduanya sekarang disertakan.

Tidak memakai `@ts-ignore` atau mematikan strict untuk melewati error. Explicit `any` legacy dan envelope metadata kompatibel masih ada; strict compile-time bukan pengganti validasi runtime semua data eksternal.

## Verifikasi dan batas

- `npm run lint`: lulus, strict aplikasi dan API.
- `npm test`: **396 lulus, 0 gagal**.
- `npm run build`: lulus, termasuk output PWA.
- Delapan test interaksi baru memakai React DOM + jsdom: editor jadwal, password salah/benar/batal, cleanup permintaan password, simpan nota gagal/berhasil dan kurs, validasi nota/duplikat, pusat tinjauan, onboarding, serta reply URL/tema/bahasa.
- Test reset rutinitas yang sudah ada sekarang menguji modul lifecycle secara langsung.
- Tidak menulis ke akun Google Sheets/Calendar asli. Interaksi jsdom bukan verifikasi visual browser atau pengujian OAuth/service-worker pada perangkat asli.
- Peringatan bundle besar Vite tetap ada. Instalasi dependency test juga melaporkan 31 kerentanan dependency (3 low, 8 moderate, 19 high, 1 critical); belum ditangani dalam refactor ini dan tidak dilakukan upgrade paksa yang dapat mematahkan kompatibilitas.
- Tidak ada perubahan schema spreadsheet, endpoint backend, maupun penghapusan fitur.
