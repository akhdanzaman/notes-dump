# Notes Dump Fixes v3

Paket ini berisi patch lanjutan dari v2.

## File yang diubah

- `components/views/SummaryView.tsx`
- `components/ShoppingItem.tsx`
- `hooks/useBrainDumpData.ts`

## Perubahan baru di v3

- `Today's Focus` tidak lagi mengambil item dari daily routine/routine task.
- `Today's Focus` hanya mengambil task non-routine dan shopping non-routine.
- Mobile Summary view dibersihkan dari container lama yang masih tampil di bawah dashboard:
  - section focus/list lama dihapus,
  - quick add buttons lama dihapus,
  - routine carousel lama dihapus.
- Mobile sekarang memakai card dashboard yang sama: hero, goals, routine, money, dan weekly win.

## Perubahan dari v2 yang tetap dipertahankan

- Month/year di atas jam memakai kalender hari ini.
- Tombol `Theme` menampilkan informasi month/year slider theme.
- Toggle `Savings / Skills` berada di header Goals Progress.
- Saving goals yang sudah selesai disembunyikan dari Goals Progress.
- Edit routine task dan routine shopping menghitung ulang due date sesuai schedule baru saat save.
- Shopping routine yang sudah done tetap disabled/marked done sampai next due.
- Shopping/routine item punya opsi `Hide from Calendar`.

## Cara pakai

Salin file di paket ini ke project kamu sesuai path masing-masing, atau apply `changes.patch` dari root project.

## Validasi

Syntax TSX `SummaryView.tsx` sudah dicek dengan TypeScript `transpileModule` dan tidak ada syntax error. Full TypeScript build belum divalidasi karena workspace sandbox tidak punya `node_modules` project.
