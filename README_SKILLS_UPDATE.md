# Arkaiv Skills Subtab Update

Paket ini berisi file pengganti untuk memperbarui subtab **Skills** agar lebih dekat dengan mockup kursus + schedule yang diberikan.

## Ringkasan perubahan

- `Skills` sekarang punya metadata `description`, `imageUrl`, `weeklyTargetMinutes`, dan `schedule`.
- Gambar skill diambil dari input URL saat edit/add skill, bukan dari container/placeholder hardcoded.
- UI subtab `Library > Skills` dibuat menjadi layout dua kolom seperti mockup:
  - kiri: kartu skill/course dengan gambar, description, progress, target, dan aksi edit/delete.
  - kanan: panel schedule mingguan; otomatis turun ke bawah pada mobile.
- Tampilan memakai token existing seperti `bg-surface`, `bg-background`, `text-primary`, `text-muted`, dan `border-border` sehingga tetap mengikuti light/dark theme aplikasi.
- Modal skill memiliki pengaturan schedule `daily`, `weekly`, `monthly`, `yearly` dengan `startTime` dan `endTime`.
- Skill schedule otomatis dibuat sebagai routine di Focus Tasks dengan `type: "skills"`.
- Spreadsheet:
  - routine skill masuk tab `Todos` dengan kolom `Type` bernilai `skills`, bukan `TODO`.
  - konfigurasi skill masuk `Skills Config` dengan kolom baru untuk description, image URL, schedule, dan time range.
- Progress skill dihitung dari log `SKILL_LOG`, target mingguan dihitung dari total durasi session schedule dalam minggu berjalan.

## Cara pakai

Salin isi folder ini ke root project Arkaiv dan overwrite file dengan path yang sama. Setelah itu jalankan build/test project seperti biasa.

## File yang diubah/ditambahkan

- `App.tsx`
- `types.ts`
- `components/SkillModal.tsx`
- `components/Card.tsx`
- `components/views/LibraryView.tsx`
- `components/views/FocusView.tsx`
- `hooks/useBrainDumpData.ts`
- `services/spreadsheetService.ts`
- `services/spreadsheetReconciler.ts`
- `utils/exportUtils.ts`
- `utils/selectors.ts`
- `utils/selectors/index.ts`
- `utils/selectors/focusSelectors.ts`
- `utils/selectors/skillSelectors.ts`

## Catatan verifikasi

Saya melakukan pemeriksaan parse TypeScript pada file yang tersedia di paket ini. Karena archive yang diunggah tidak bisa diekstrak penuh dari container (RAR5 compressed source membutuhkan backend `unrar/unar` yang tidak tersedia), pengecekan full project build tidak bisa dijalankan di sini. Pemeriksaan yang dijalankan tidak menemukan error sintaks pada file hasil perubahan; error yang tersisa hanya terkait module/file project lain yang tidak ikut tersedia di paket partial ini.
