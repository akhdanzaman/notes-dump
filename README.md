# Arkaiv

Aplikasi pencatatan harian dengan sinkronisasi Google Sheets, Google Calendar, dan bantuan Gemini.

## Menjalankan proyek

Prasyarat: Node.js 22 atau lebih baru.

```powershell
npm ci
copy .env.example .env
npm run dev
```

Server lokal berjalan di `http://localhost:3010` secara default. Variabel `PORT` dapat digunakan untuk mengganti port.

## Pemeriksaan sebelum rilis

```powershell
npm test
npm run lint
npm run build
```

`npm run lint` memeriksa TypeScript aplikasi dan fungsi API. Untuk menjalankan hasil build dengan server produksi:

```powershell
npm run build
$env:NODE_ENV="production" # PowerShell
npm start
```

Konfigurasi Google OAuth dan service account dijelaskan di `.env.example`. Endpoint publik tetap berada di bawah `/api/auth/google/*` dan `/api/spreadsheets/service-account/*`.

Lihat `REFACTOR_NOTES.md` untuk ringkasan penyederhanaan backend dan daftar pekerjaan frontend berikutnya.
