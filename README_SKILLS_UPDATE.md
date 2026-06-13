# Arkaiv Skills Update v2

Paket ini berisi full replacement files untuk memperbaiki save/fetch spreadsheet metadata Skills, schedule Skills, dan layout subtab Skills.

## File yang berubah

- `App.tsx`
- `components/views/LibraryView.tsx`
- `services/spreadsheetService.ts`
- `services/spreadsheetReconciler.ts`
- `utils/exportUtils.ts`
- `utils/selectors/skillSelectors.ts`

File lain di paket tetap disertakan dari update sebelumnya supaya patch Skills tetap lengkap.

## Perbaikan utama

1. **Skills Config spreadsheet sekarang save dan fetch metadata lengkap**
   - `Description`
   - `Image_URL`
   - `Weekly_Target_Minutes`
   - `Schedule_Enabled`
   - `Schedule_Interval`
   - `Schedule_Days_Of_Week`
   - `Schedule_Days_Of_Month`
   - `Schedule_Months_Of_Year`
   - `Schedule_Start_Time`
   - `Schedule_End_Time`
   - `Created_At`
   - `Color`

2. **Routine Skills di sheet Todos sekarang menyimpan metadata Skills**
   - Range fetch `Todos` diperluas dari `A:AV` menjadi `A:AZ`.
   - Kolom baru:
     - `Skill_ID`
     - `Skill_Name`
     - `Skill_Routine_ID`
     - `Duration_Minutes`
   - Saat fetch, metadata ini dikembalikan ke `item.meta` sehingga routine Skills tetap bisa dikenali sebagai routine bertipe `skills`.

3. **Schedule di panel Skills tidak hilang walau metadata Skills Config lama belum lengkap**
   - Selector Skills sekarang dapat meng-infer schedule dari routine item Focus bertipe `skills`.
   - Jadi ketika Focus routine sudah muncul, schedule panel Skills tetap bisa menampilkan jadwal berdasarkan metadata routine.

4. **UI/UX Skills diperbarui**
   - Layout desktop: area skill card dan schedule menjadi rasio 60/40.
   - Gambar skill dibuat lebih besar.
   - Padding utama card terhadap gambar dibuat sekitar `4px` (`p-1`).
   - Mobile: card skill stacked, gambar berada di atas informasi skill.
   - Bar tanggal schedule mobile hanya menampilkan 3 tanggal di layar kecil dan 4 tanggal di layar sedikit lebih lebar, lalu kembali 7 tanggal pada layar tablet/desktop agar tidak overflow.

## Cara pasang

Copy file dari paket ini ke path yang sama di project Arkaiv, lalu jalankan build/dev server seperti biasa.

Jika spreadsheet lama sudah punya sheet `Todos` dan `Skills Config`, sync berikutnya akan menulis header baru dan metadata baru. Setelah itu fetch berikutnya akan membawa schedule dan metadata Skills secara lengkap.
