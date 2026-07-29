import { LibrarySubTab, MoneyView, PlanSubTab, Tab } from '../types';

export const FEATURE_TUTORIALS_STORAGE_KEY = 'braindump_seen_feature_tutorials_v1';
export const FEATURE_TUTORIALS_DISABLED_KEY = 'braindump_feature_tutorials_disabled';

export type FeatureTutorialKey =
  | 'summary'
  | 'plan.tasks'
  | 'plan.shopping'
  | 'plan.savings'
  | 'library.general'
  | 'library.skills'
  | 'library.journal'
  | 'money.transactions'
  | 'money.wallets'
  | 'money.budget'
  | 'money.savings'
  | 'calendar'
  | 'control-center';

export interface FeatureTutorial {
  key: FeatureTutorialKey;
  eyebrow: string;
  title: string;
  body: string;
  manualExample: string;
  inputBarExample: string;
  bullets: string[];
}

export const FEATURE_TUTORIALS: Record<FeatureTutorialKey, FeatureTutorial> = {
  summary: {
    key: 'summary',
    eyebrow: 'Ringkasan',
    title: 'Pusat kendali harian Anda',
    body: 'Beranda merangkum hal yang perlu diperhatikan hari ini, pergerakan uang, dan data yang perlu diperiksa.',
    manualExample: 'Manual: buka kartu yang disorot, lalu periksa atau ubah entri terkait.',
    inputBarExample: 'Input cepat: “Jurnal: hari ini fokus menyelesaikan laporan dan menindaklanjuti vendor”',
    bullets: [
      'Gunakan kartu sebagai jalan pintas ke Rencana, Pustaka, dan Keuangan.',
      'Perbandingan keuangan hari ini dan kemarin muncul setelah ada transaksi.',
      'Hasil AI yang belum pasti akan diminta untuk diperiksa sebelum memengaruhi data.',
    ],
  },
  'plan.tasks': {
    key: 'plan.tasks',
    eyebrow: 'Rencana / Tugas',
    title: 'Ubah tugas lepas menjadi langkah yang jelas',
    body: 'Rencana menampung tugas, rutinitas, dan pekerjaan mendalam yang membutuhkan struktur lebih dari sekadar centang.',
    manualExample: 'Manual: Rencana > Tugas > +, judul “Tindak lanjuti invoice vendor”, tenggat besok, prioritas normal.',
    inputBarExample: 'Input cepat: “Fokus: tindak lanjuti invoice vendor besok jam 10”',
    bullets: [
      'Gunakan Tugas untuk pekerjaan sekali jalan dan pekerjaan bertanggal.',
      'Tugas rutin dapat berulang tanpa menggandakan daftar secara manual.',
      'Saran Deep Work membantu mengubah tugas yang masih kabur menjadi langkah konkret.',
    ],
  },
  'plan.shopping': {
    key: 'plan.shopping',
    eyebrow: 'Rencana / Belanja',
    title: 'Pisahkan niat belanja dari pengeluaran aktual',
    body: 'Daftar Belanja menjaga rencana pembelian tetap terlihat sebelum menjadi transaksi sehingga catatan keuangan tetap akurat.',
    manualExample: 'Manual: Rencana > Belanja > +, item “Beli susu”, kategori mendesak, nominal 12000.',
    inputBarExample: 'Input cepat: “Belanja: beli susu besok 12000”',
    bullets: [
      'Kelompokkan item berdasarkan tingkat urgensi atau kebutuhan rutin.',
      'Gunakan sebagai daftar ringan untuk rencana pembelian.',
      'Pembelian yang selesai dapat dicatat kemudian di Keuangan.',
    ],
  },
  'plan.savings': {
    key: 'plan.savings',
    eyebrow: 'Rencana / Tabungan',
    title: 'Pantau target sebelum uang dipindahkan',
    body: 'Target tabungan adalah komitmen terencana yang memisahkan uang cadangan dari pengeluaran biasa.',
    manualExample: 'Manual: Rencana > Tabungan > +, target “Dana darurat”, sasaran 5000000, wallet khusus opsional.',
    inputBarExample: 'Input cepat: “Menabung untuk dana darurat 5 juta”',
    bullets: [
      'Tambahkan dana secara bertahap menuju target.',
      'Selesaikan target saat uang cadangan benar-benar digunakan.',
      'Pisahkan progres target dari pergerakan pengeluaran harian.',
    ],
  },
  'library.general': {
    key: 'library.general',
    eyebrow: 'Pustaka / Catatan',
    title: 'Ingatan yang mudah dicari, bukan sekadar tempat menumpuk',
    body: 'Pustaka menyimpan catatan dan referensi setelah AI merapikannya agar mudah digunakan kembali.',
    manualExample: 'Manual: Pustaka > Catatan > +, catatan “Vendor A lebih suka dihubungi lewat WhatsApp”, tag vendor dan operasional.',
    inputBarExample: 'Input cepat: “Catatan: Vendor A lebih suka dihubungi lewat WhatsApp sebelum siang”',
    bullets: [
      'Pencarian dan tag membantu menemukan konteks lama dengan cepat.',
      'Gunakan catatan untuk informasi yang bertahan lama, bukan tugas atau transaksi.',
      'Filter tersedia dari tombol pencarian mengambang.',
    ],
  },
  'library.skills': {
    key: 'library.skills',
    eyebrow: 'Pustaka / Keahlian',
    title: 'Pantau latihan dan perkembangan keahlian',
    body: 'Keahlian membantu Anda mencatat latihan terfokus dan membandingkannya dengan target mingguan.',
    manualExample: 'Manual: Pustaka > Keahlian > +, keahlian “Berbicara Bahasa Inggris”, target mingguan 120 menit.',
    inputBarExample: 'Input cepat: “Latihan keahlian: berbicara Bahasa Inggris 45 menit”',
    bullets: [
      'Buat keahlian dengan target mingguan opsional.',
      'Catat sesi latihan melalui input natural.',
      'Gunakan tren untuk melihat konsistensi latihan.',
    ],
  },
  'library.journal': {
    key: 'library.journal',
    eyebrow: 'Pustaka / Jurnal',
    title: 'Linimasa harian untuk hal yang terjadi',
    body: 'Jurnal mengelompokkan catatan, pekerjaan selesai, agenda, dan transaksi per hari agar refleksi memiliki konteks.',
    manualExample: 'Manual: Pustaka > Jurnal > +, entri “Hari ini rapat lancar, tinggal menindaklanjuti dokumen.”',
    inputBarExample: 'Input cepat: “Jurnal: hari ini rapat lancar, tinggal menindaklanjuti dokumen”',
    bullets: [
      'Awali input dengan “Jurnal:” untuk menambahkannya ke hari ini.',
      'Bagian harian dapat menyatukan aktivitas pribadi dan keuangan.',
      'Gunakan navigasi bulan untuk melihat periode sebelumnya.',
    ],
  },
  'money.transactions': {
    key: 'money.transactions',
    eyebrow: 'Keuangan / Transaksi',
    title: 'Catatan transaksi adalah sumber utama',
    body: 'Transaksi menentukan saldo wallet, total kategori, dan ringkasan keuangan. Data yang akurat membuat ringkasan lain ikut akurat.',
    manualExample: 'Manual: Keuangan > Transaksi > +, pengeluaran makan siang 50000, wallet Rekening Utama, kategori keinginan.',
    inputBarExample: 'Input cepat: “Pengeluaran: makan siang 50 ribu dari Rekening Utama”',
    bullets: [
      'ID wallet digunakan di balik layar agar perubahan nama tidak merusak transaksi lama.',
      'Transfer, pendapatan, tabungan, dan pengeluaran dihitung sesuai jenisnya.',
      'Filter membantu memeriksa wallet, kategori, atau periode tertentu.',
    ],
  },
  'money.wallets': {
    key: 'money.wallets',
    eyebrow: 'Keuangan / Wallet',
    title: 'Saldo wallet berasal dari catatan transaksi',
    body: 'Wallet menentukan saldo awal, sedangkan transaksi menjelaskan setiap pergerakan setelahnya.',
    manualExample: 'Manual: Keuangan > Wallet > +, nama “BCA”, jenis bank, saldo awal 2500000.',
    inputBarExample: 'Input cepat: “Buat wallet BCA jenis bank dengan saldo 2500000”',
    bullets: [
      'Tambahkan wallet bank, tunai, dompet digital, atau kartu kredit.',
      'Saldo diperbarui dari transaksi keuangan yang sudah selesai.',
      'Nama wallet dapat diubah tanpa memutus hubungan dengan data lama.',
    ],
  },
  'money.budget': {
    key: 'money.budget',
    eyebrow: 'Keuangan / Budget',
    title: 'Budget membantu mengambil keputusan, bukan menghakimi',
    body: 'Aturan budget membagi pendapatan ke beberapa kategori agar pengeluaran harian memiliki konteks yang jelas.',
    manualExample: 'Manual: Keuangan > Budget, isi pendapatan 10000000, lalu atur persentase Kebutuhan, Keinginan, dan Tabungan.',
    inputBarExample: 'Input cepat: “Atur pendapatan bulanan 10000000, kebutuhan 50, keinginan 30, tabungan 20”',
    bullets: [
      'Atur pendapatan bulanan dan persentase setiap kategori.',
      'Gunakan kategori untuk memahami pendorong perubahan total.',
      'Konteks rutin tetap tenang selama tidak ada perubahan penting.',
    ],
  },
  'money.savings': {
    key: 'money.savings',
    eyebrow: 'Keuangan / Tabungan',
    title: 'Tabungan menunjukkan progres dana cadangan',
    body: 'Tampilan ini menghubungkan target tabungan dengan pergerakan wallet agar progres tetap sesuai arus kas nyata.',
    manualExample: 'Manual: Keuangan > Tabungan, buka target, lalu tambah dana 500000 dari BCA.',
    inputBarExample: 'Input cepat: “Simpan 500 ribu untuk dana darurat dari BCA”',
    bullets: [
      'Periksa pendanaan target tanpa mencampurnya dengan pengeluaran biasa.',
      'Selesaikan target saat dana dilepas atau digunakan.',
      'Bandingkan dengan Rencana / Tabungan untuk melihat niat dan realisasinya.',
    ],
  },
  calendar: {
    key: 'calendar',
    eyebrow: 'Kalender',
    title: 'Semua aktivitas bertanggal dalam satu tempat',
    body: 'Kalender menggabungkan tugas, rutinitas, agenda, dan item bertanggal dalam tampilan bulanan.',
    manualExample: 'Manual: Rencana > Tugas > +, tambahkan “Telepon pemasok”, hari Jumat, mulai 09.00.',
    inputBarExample: 'Input cepat: “Agenda: telepon pemasok Jumat jam 9 pagi”',
    bullets: [
      'Geser area header untuk berpindah antarhalaman utama.',
      'Penyelesaian tugas berulang dicatat untuk setiap kemunculan.',
      'Gunakan Kalender untuk konteks waktu, bukan sebagai kotak masuk tambahan.',
    ],
  },
  'control-center': {
    key: 'control-center',
    eyebrow: 'Pusat Kontrol',
    title: 'Pengaturan, sinkronisasi, dan kontrol data ada di sini',
    body: 'Pusat Kontrol digunakan untuk menyesuaikan perilaku aplikasi, menghubungkan Sheets, menjalankan sinkronisasi, dan mengelola data.',
    manualExample: 'Manual: Pusat Kontrol > Spreadsheet, tempel tautan Google Sheets setelah memberikan akses Editor.',
    inputBarExample: 'Input cepat: “Catatan: spreadsheet utama sudah dibagikan ke akun layanan”',
    bullets: [
      'Spreadsheet dapat terhubung tanpa login Google jika akun layanan memiliki akses Editor.',
      'Login Google tetap tersedia sebagai pilihan cadangan.',
      'Tindakan berisiko dipisahkan agar tidak mudah terpicu tanpa sengaja.',
    ],
  },
};

export const getFeatureTutorialKey = (state: {
  activeTab: Tab;
  planSubTab: PlanSubTab;
  librarySubTab: LibrarySubTab;
  moneyView: MoneyView;
  isControlCenterOpen: boolean;
}): FeatureTutorialKey => {
  if (state.isControlCenterOpen) return 'control-center';
  if (state.activeTab === 'plan') return `plan.${state.planSubTab}` as FeatureTutorialKey;
  if (state.activeTab === 'library') return `library.${state.librarySubTab}` as FeatureTutorialKey;
  if (state.activeTab === 'money') return `money.${state.moneyView}` as FeatureTutorialKey;
  return state.activeTab;
};

export const parseSeenFeatureTutorials = (raw: string | null): FeatureTutorialKey[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((key): key is FeatureTutorialKey => typeof key === 'string' && key in FEATURE_TUTORIALS);
  } catch {
    return [];
  }
};
