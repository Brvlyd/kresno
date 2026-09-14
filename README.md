# SITOMAS — Sistem Toko Mas Kresno 🧾

SITOMAS adalah sistem manajemen toko emas milik Kresno, dibangun dengan Next.js, TypeScript, dan Supabase. Aplikasi ini menyatukan seluruh alur operasional toko dalam satu tempat: kasir, inventori, pembelian, pegadaian, hutang-piutang, keuangan, hingga servis.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)

## Fitur 

### Modul Utama
- 🧾 **POS** — transaksi kasir beserta riwayat penjualan
- 📦 **Inventori** — pencatatan stok barang & konfirmasi barang keluar
- 🛒 **Pembelian** — pencatatan pembelian barang
- 🏷️ **Pegadaian** — pencatatan transaksi gadai barang
- 💳 **Hutang-Piutang** — pencatatan hutang dan piutang
- 📊 **Keuangan** — ringkasan keuangan toko
- 🔧 **Servis** — pencatatan servis/perbaikan barang
- ⚖️ Kalkulasi harga & berat emas otomatis

### Keamanan & Akses 🔐
- Login dengan verifikasi OTP dan reset password
- PIN tambahan untuk mengakses data-data yang lebih sensitif
- Auto logout otomatis saat sesi idle terlalu lama

### Lainnya
- 🖨️ Cetak invoice (gadai, buyback, servis) dengan pilihan ukuran kertas
- 📷 Dukungan barcode scanner
- 📤 Export/import data lewat CSV
- 👵 Desain ramah pengguna lansia — teks besar, kontras tinggi, navigasi sederhana
- 🇮🇩 Seluruh antarmuka berbahasa Indonesia

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL)

## Testing

- **Unit test**: Jest (`npm run test`)
- **Property-based test**: fast-check
- **End-to-end**: Playwright (`npm run test:e2e`)

## Tooling Tambahan

- **CLI figma-import** — mengimpor desain dari Figma menjadi kode React/Next.js. Detail requirement & desainnya ada di `.kiro/specs/figma-import/`.
- **Load test inventori** — `npm run loadtest:inventori`

## Prasyarat

- Node.js versi 18 atau lebih baru
- npm
- Akun Supabase sendiri (jangan pakai kredensial punya orang lain/proyek lama)

## Setup di Device Baru

### 1. Clone & Install

```bash
git clone <url-repository-kresno>
cd kresno
npm install
```

### 2. Environment Variables

Buat file `.env.local` di root folder (jangan pernah commit file ini), lalu isi dengan kredensial Supabase **milik project kamu sendiri**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ Jangan bagikan URL/anon key project production ke pihak yang tidak berkepentingan, dan pastikan Row Level Security (RLS) aktif di semua tabel Supabase.

### 3. Run Development Server

```bash
npm run dev
```

Buka http://localhost:3000 di browser.

## Menjalankan dengan Docker 🐳

```bash
docker compose up --build
```

Karena variabel `NEXT_PUBLIC_*` di-inline ke bundle JavaScript saat build (bukan saat container jalan), pastikan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sudah tersedia di environment sebelum menjalankan `docker compose up` — lihat komentar di `Dockerfile` untuk detailnya.

## Deployment

Project ini sudah dikonfigurasi untuk deploy ke [Vercel](https://vercel.com) lewat `vercel.json`. Tambahkan environment variables yang sama di dashboard Vercel sebelum deploy.

## Struktur Project

```
kresno/
├── app/
│   ├── dashboard/         # Dashboard utama
│   ├── pos/               # Kasir & riwayat transaksi
│   ├── inventori/         # Stok barang
│   ├── pembelian/         # Pembelian barang
│   ├── pegadaian/         # Transaksi gadai
│   ├── hutang-piutang/    # Pencatatan hutang & piutang
│   ├── keuangan/          # Ringkasan keuangan
│   ├── servis/            # Servis/perbaikan barang
│   ├── login/, otp/, reset-password/   # Autentikasi
│   └── layout.tsx
├── components/            # React components (invoice, sidebar, auth guard, dll.)
├── lib/                   # Utilities & services (auth, harga emas, gadai, dll.)
├── scripts/               # Script maintenance & load test
├── __tests__/             # Unit test
├── e2e/                   # Test end-to-end (Playwright)
└── package.json
```

## Catatan Keamanan 🔒

- **Jangan** commit `.env.local` atau kredensial apa pun ke repository.
- Selalu aktifkan Row Level Security (RLS) di Supabase untuk semua tabel.
- Modul dengan data sensitif dilindungi PIN tambahan di level aplikasi — tetap jangan bagikan PIN atau akun admin ke pihak luar.
- Gunakan environment variables yang berbeda antara development dan production.
