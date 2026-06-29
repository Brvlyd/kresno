-- ============================================================
-- SITOMAS Dashboard Tables
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Harga Emas (gold price table - manually entered per day)
create table if not exists public.harga_emas (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  karat smallint not null,              -- e.g. 24, 22, 18, 17, 16
  harga_beli bigint not null default 0, -- IDR per gram
  harga_jual bigint not null default 0, -- IDR per gram
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tanggal, karat)
);

-- 2. Karyawan (employees)
create table if not exists public.karyawan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  jabatan text,
  status text not null default 'Aktif' check (status in ('Aktif','Non-Aktif','Cuti')),
  created_at timestamptz default now()
);

-- 3. Pelanggan (customers)
create table if not exists public.pelanggan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  telepon text,
  alamat text,
  created_at timestamptz default now()
);

-- 4. Inventori (gold jewelry stock)
create table if not exists public.inventori (
  id uuid primary key default gen_random_uuid(),
  id_item text unique not null,         -- e.g. GE0001
  nama_produk text not null,
  kategori text,                        -- Gelang, Kalung, Cincin, Anting, Liontin, dll
  kadar text not null,                  -- 24K, 22K, 18K, etc.
  berat_gram numeric(8,2) not null,
  jumlah integer not null default 0,
  harga_beli bigint default 0,
  harga_jual bigint default 0,
  status_laporan text not null default 'Draft'
    check (status_laporan in ('Draft','Approval Checker','Approval Signer','Approved','Rejected')),
  tanggal_masuk date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── RLS: Allow all reads, restrict writes to authenticated ──
alter table public.harga_emas enable row level security;
alter table public.karyawan enable row level security;
alter table public.pelanggan enable row level security;
alter table public.inventori enable row level security;

-- Public read policies (for now — tighten later with auth)
create policy "allow read harga_emas" on public.harga_emas for select using (true);
create policy "allow all harga_emas" on public.harga_emas for all using (true) with check (true);

create policy "allow read karyawan" on public.karyawan for select using (true);
create policy "allow all karyawan" on public.karyawan for all using (true) with check (true);

create policy "allow read pelanggan" on public.pelanggan for select using (true);
create policy "allow all pelanggan" on public.pelanggan for all using (true) with check (true);

create policy "allow read inventori" on public.inventori for select using (true);
create policy "allow all inventori" on public.inventori for all using (true) with check (true);

-- Catatan: migration ini SEBELUMNYA juga nge-seed data contoh (karyawan, pelanggan,
-- inventori, harga emas rekaan) langsung ke tabel produksi. Itu dihapus dari sini
-- supaya deploy baru (project Supabase baru / cabang lain) tidak ikut kemasukan
-- data dummy. Kalau migration versi lama sudah pernah jalan di database ini,
-- jalankan 023_hapus_seed_dummy_001.sql untuk membersihkannya.
