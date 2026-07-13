# Receipt / Invoice Transaction Line Items

## Implementasi

- Input gambar nota/invoice pada modal transaksi pengeluaran.
- Input konteks tambahan berbentuk chat, misalnya wallet, tanggal, merchant, atau catatan lain.
- Ekstraksi multimodal melalui model Gemini yang dikonfigurasi aplikasi.
- Satu nota disimpan sebagai satu transaksi induk agar histori dan saldo wallet tidak terpecah.
- Setiap transaksi dapat memiliki banyak line item: nama, kuantitas, harga satuan, jumlah, jenis item, dan kategori budget.
- Kategori budget diterapkan pada level line item. Kategori transaksi induk hanya menjadi fallback untuk item yang belum dikategorikan.
- Nota dengan beberapa kategori budget tetap menjadi satu transaksi, tetapi pemakaian budget dibagi berdasarkan nilai masing-masing line item.
- Pajak, biaya, diskon, dan selisih rekonsiliasi dapat disimpan sebagai line item terpisah.
- Struktur line item dan metadata sumber nota disimpan dalam App State serta sheet Transactions.
- Filter, analytics, ekspor, kartu transaksi, dan sinkronisasi spreadsheet telah disesuaikan untuk transaksi multi-kategori.

## Aturan Perhitungan

- Saldo wallet dan total pengeluaran memakai total transaksi induk satu kali.
- Pemakaian kategori budget memakai jumlah setiap line item.
- Bila jumlah line item tidak sama dengan total nota, sistem menambahkan adjustment tanpa kategori agar selisih tidak diam-diam dibebankan ke kategori yang salah.
- Data transaksi lama tanpa line item tetap bekerja menggunakan kategori dan amount transaksi induk.

## Validasi

- TypeScript/lint: lulus.
- Build produksi Vite/PWA: lulus.
- Tes line-item, pembagian kategori campuran, kontrak fetch spreadsheet, dan round-trip spreadsheet: lulus.
- Full test suite: 280 dari 283 tes lulus. Tiga kegagalan tersisa berasal dari ekspektasi lama yang tidak terkait fitur ini (tablet rail class, local parsePro sebelum API key, dan kolom skill pada ekspor todo).
