# UI/UX Modernization

Pembaruan ini menyelaraskan tampilan aplikasi menjadi lebih modern, efisien, menarik, dan tetap minimalis tanpa mengubah fungsi utama.

## Perubahan utama

- Sistem warna, permukaan, border, bayangan, fokus, dan mode gelap dibuat konsisten.
- Navigasi desktop dan mobile disederhanakan dengan target sentuh serta status aktif yang lebih jelas.
- Composer/input utama dibuat lebih ringkas, stabil, dan nyaman pada layar besar maupun kecil.
- Dashboard serta halaman Money, Plan, Library, dan Calendar mendapat hierarki informasi yang lebih bersih.
- Modal, dialog, form, pencarian, onboarding, dan AI chat menggunakan pola interaksi yang seragam.
- Responsivitas, safe-area perangkat, dukungan zoom, fokus keyboard, kontras, dan reduced-motion ditingkatkan.
- Artefak `dist` lama dihapus agar tidak tertukar dengan hasil build dari sumber terbaru.

## Menjalankan proyek

```bash
npm install
npm run dev
```

Untuk build produksi:

```bash
npm run build
```

## Validasi yang dilakukan

- Seluruh 197 file TypeScript/TSX berhasil diparse tanpa error sintaks.
- Struktur CSS utama telah diperiksa dan kurung deklarasinya seimbang.
- Tidak ditemukan conflict marker yang tertinggal.

Build penuh perlu dijalankan kembali setelah dependency tersedia pada lingkungan lokal.
