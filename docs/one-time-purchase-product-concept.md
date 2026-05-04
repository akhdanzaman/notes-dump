# Notes Dump — One-Time Purchase Product Concept

## Premis produk

Notes Dump bisa dijual sebagai **personal life OS ringan**: pengguna menumpahkan catatan mentah, lalu app membantu merapikan menjadi todo, transaksi, event, jurnal, shopping list, skill log, dan insight harian. Fokusnya bukan “AI note app” generik, tapi **dump dulu, rapi otomatis, tetap bisa diedit manual**.

Positioning yang paling enak untuk jual lepas:

> “A self-hosted AI brain dump app for people who want their messy notes to become useful plans, money logs, and life records — without another subscription.”

## Siapa pembelinya

1. **Solo operators / freelancer / founder kecil**
   - Banyak urusan campur: kerjaan, uang, follow-up, ide.
   - Mau sistem pribadi, tapi tidak mau langganan banyak SaaS.

2. **Productivity nerd yang suka template self-hosted**
   - Sudah biasa beli Notion templates, Gumroad tools, Vercel templates.
   - Suka BYOK dan kontrol data.

3. **Orang yang butuh catatan + finance ringan dalam satu tempat**
   - Bukan akuntansi berat.
   - Lebih ke “uangku lari ke mana, task mana yang nyangkut, besok harus ngapain.”

4. **Agency / small team internal ops**
   - Bisa beli sekali lalu host sendiri untuk tim kecil.
   - Perlu white-label/simple deployment.

## Core promise

- Capture cepat tanpa mikir format.
- AI mengubah dump menjadi struktur yang bisa dipakai.
- Semua data tetap bisa dibuka, diedit, di-export.
- Bisa self-host di Vercel.
- Tidak wajib subscription: beli sekali, jalan sendiri.

## Produk utama

### 1. Capture Inbox

Tempat utama untuk dump:

- natural language input: “bayar parkir 10rb bni”, “besok call supplier jam 3”, “summary regulasi terbaru”, dll.
- multi-line dump untuk catatan panjang.
- preview hasil parsing sebelum/atau setelah masuk.
- quick undo dan edit manual.

### 2. Smart Parser

Parser mengklasifikasikan dump menjadi:

- Todo
- Event/calendar item
- Transaction
- Shopping item
- Journal/note
- Skill log / learning record
- Research/deep work item

Prinsip penting: **AI memberi struktur, user tetap punya kontrol**.

### 3. Plan View

Todo tidak cuma list biasa:

- Today / Upcoming / Stuck
- Deep Work Transformer untuk task abstrak
- next action
- final output
- estimated session length
- blocker check
- optional subtasks

Ini bisa jadi pembeda kuat dibanding notes app biasa.

### 4. Money View

Finance ringan, bukan accounting:

- transaction log
- wallet tracking
- budget category
- monthly income context
- spending trend
- top category
- normal/anomaly highlights

Selling angle: “catat transaksi pakai bahasa natural, dashboard kebentuk.”

### 5. Journal & Daily Timeline

Semua item bisa masuk ke narasi harian:

- apa yang dikerjakan
- uang keluar/masuk
- task selesai/stuck
- event
- catatan/jurnal

Bisa jadi fitur premium feel: “your day, reconstructed.”

### 6. Google Sheets Sync

Untuk versi jual lepas, ini penting karena Sheets terasa familiar dan portable:

- pengguna share spreadsheet ke service account
- app sync via backend/serverless API
- user bisa inspect/edit data di spreadsheet
- export/import tetap ada

OAuth yang rusak lebih baik dihapus total. Service account lebih predictable untuk Vercel/self-host.

## Deployment model

### Default recommended: Vercel self-host template

Pembeli dapat:

- source code / private repo access / zip package
- one-click Vercel deploy guide
- `.env.example`
- setup checklist
- Google Sheets template
- onboarding in-app

Alur setup:

1. Beli produk.
2. Deploy ke Vercel.
3. Masukkan env Gemini/API key + service account credentials.
4. Share Google Sheet ke service account.
5. Paste sheet link di app.
6. Mulai dump.

### Adan-provided hosting option

Adan bisa menyediakan hosting Vercel sebagai add-on:

- user beli produk + setup service
- Adan deploy-kan instance Vercel per user/client
- user tetap punya link app sendiri
- opsi custom domain

Ini cocok sebagai upsell, bukan core requirement.

## API key options

### Option A — BYOK only

User memasukkan API key sendiri.

**Pros**
- Aman untuk one-time purchase.
- Tidak ada biaya usage berjalan dari Adan.
- Margin jelas.
- Cocok untuk self-hosted audience.

**Cons**
- Setup lebih ribet.
- Ada friction karena user harus membuat Gemini/OpenAI key.
- Support ticket bisa naik.

**Cocok untuk**
- Gumroad/Lemon Squeezy one-time product.
- Developer/productivity nerd.
- Harga lebih rendah.

**UX yang wajib**
- Key disimpan lokal/browser atau server env.
- Test API key button.
- Clear error: invalid key, quota, rate limit.
- Guide singkat “cara ambil API key”.

### Option B — Included API key dari Adan

Adan menyediakan API key melalui backend/proxy.

**Pros**
- Setup jauh lebih mudah.
- Lebih cocok untuk non-technical buyer.
- Bisa demo instan.

**Cons**
- Secara ekonomi bukan pure one-time kecuali ada limit.
- Risiko abuse/share link.
- Perlu rate limit, auth, usage cap, monitoring.
- Kalau user aktif berat, biaya bisa makan margin.

**Harus ada guardrail**
- License key / account token.
- Daily/monthly usage quota.
- Rate limit per instance/user.
- Model fallback murah.
- Admin kill switch.
- “Included AI credits” bukan unlimited.

**Packaging aman**
- “One-time purchase includes X AI credits / Y parses.”
- Setelah habis, user pindah ke BYOK atau beli credit pack.

### Option C — Hybrid recommended

Default BYOK, tapi ada optional included key untuk onboarding/demo.

**Recommended offer**
- App bisa jalan BYOK selamanya.
- Purchase include small starter credits via Adan-hosted proxy.
- Setelah credits habis, user connect key sendiri.
- Untuk hosted-by-Adan customers, bisa include monthly maintenance/credit package terpisah.

Ini paling sehat: one-time purchase tetap masuk akal, tapi UX pertama tetap gampang.

## Suggested packages

### Personal Self-Hosted License

- One-time purchase.
- BYOK.
- Vercel deploy guide.
- Google Sheets service-account sync.
- Lifetime app usage for personal instance.
- Updates for 1 year.

### Personal Plus Setup

- Semua Personal.
- Adan bantu deploy ke Vercel.
- Basic customization.
- Starter AI credits optional.

### Agency / Small Team License

- Multi-user/internal use.
- White-label light.
- Priority setup docs.
- Higher price.

### Hosted Convenience Add-on

- Not one-time pure; better as service fee.
- Adan hosts/maintains Vercel instance.
- Optional included API credits.
- Custom domain/support.

## Pricing rough cut

- Personal BYOK: USD 29–59
- Personal Plus setup: USD 99–199
- Agency/small team: USD 249–499
- Hosted/setup add-on: USD 10–29/mo or annual maintenance
- Extra AI credits: small packs if using Adan key

Kalau mau benar-benar “jual lepas”, jangan include unlimited API. Pakai BYOK atau included starter credits only.

## MVP sellable scope

Must-have before selling:

1. Clean OAuth removal, service-account sync only.
2. First-run onboarding that explains:
   - paste Gemini key / use included starter
   - share spreadsheet
   - paste link
   - test sync
3. Demo mode with sample data.
4. Import/export backup.
5. Clear “Data & Privacy” page.
6. License/setup docs.
7. Error states that non-technical users understand.
8. One-click deploy guide.
9. Changelog and update path.

Nice-to-have:

- Stripe/Lemon Squeezy license validation.
- Admin proxy for included credits.
- Templates for Sheets.
- Custom branding.
- PWA install guide.

## Product architecture

### Self-host BYOK architecture

- Frontend: React/Vite PWA.
- Hosting: Vercel.
- AI key: user-provided Gemini key.
- Data: browser local storage + Google Sheets sync.
- Sheets access: service account serverless API.
- Export: JSON/XLSX.

### Included-key architecture

- Frontend calls `/api/ai/parse` instead of direct provider.
- Backend validates license token.
- Backend injects Adan API key.
- Usage is metered.
- Rate limit protects cost.
- User can switch to BYOK anytime.

## License / anti-abuse ideas

For one-time product:

- License key required for updates, not necessarily runtime.
- Runtime should not hard-fail if license server is down.
- Included credits require server validation.
- BYOK mode can be fully offline/self-hosted.

This feels fair and reduces support drama.

## Copywriting angles

- “Turn chaotic notes into an actual life system.”
- “Dump now, organize later — automatically.”
- “A self-hosted AI planner + money log for messy humans.”
- “No subscription required. Bring your own AI key or use starter credits.”
- “Your data stays in your app and your spreadsheet.”

## Key risks

1. **Setup friction** — solved by setup wizard + optional paid setup.
2. **AI cost abuse** — solved by BYOK/default credits cap.
3. **Data sync bugs** — sell only after real-world sync gates pass.
4. **Too many features** — market as capture-to-clarity, not everything app.
5. **Support burden** — docs, screenshots, diagnostics, demo mode.

## Recommended direction

Ship as a **self-hosted BYOK Vercel product** first, with optional Adan-hosted setup and optional starter credits. Jangan jual “unlimited included API” dalam one-time purchase. Itu kelihatan enak di depan, tapi bisa jadi cost trap.

Best first offer:

> Notes Dump Personal — one-time self-hosted license, BYOK, Google Sheets sync, Vercel deploy guide, optional setup service.

Then later:

> Notes Dump Hosted — Adan-managed instance with included limited AI usage, sold as maintenance/subscription or annual support.
