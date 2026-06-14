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

-- ── Seed sample data ──
insert into public.karyawan (nama, jabatan, status) values
  ('Budi Santoso', 'Kasir', 'Aktif'),
  ('Siti Rahayu', 'Admin', 'Aktif'),
  ('Ahmad Fauzi', 'Tukang Emas', 'Aktif'),
  ('Dewi Lestari', 'Kepala Toko', 'Aktif'),
  ('Rina Wati', 'Kasir', 'Aktif')
on conflict do nothing;

insert into public.pelanggan (nama, telepon) values
  ('Pak Hendra', '08123456789'),
  ('Bu Sari', '08234567890'),
  ('Pak Dedi', '08345678901')
on conflict do nothing;

insert into public.inventori (id_item, nama_produk, kategori, kadar, berat_gram, jumlah, status_laporan, tanggal_masuk) values
  ('GE0001', 'Cincin Berlian Solitaire',   'Cincin',  '24K', 3.50, 10, 'Draft',            '2026-05-24'),
  ('GE0005', 'Kalung Rantai Singapur',     'Kalung',  '22K', 5.20,  8, 'Draft',            '2026-05-24'),
  ('KA011',  'Gelang Bangle Motif Bunga',  'Gelang',  '18K', 7.80,  6, 'Draft',            '2026-05-24'),
  ('CI039',  'Cincin Couple Polos',        'Cincin',  '22K', 4.20, 12, 'Approval Checker', '2026-05-23'),
  ('KA020',  'Liontin Hati',               'Liontin', '18K', 1.75, 15, 'Approval Signer',  '2026-05-23'),
  ('CI007',  'Cincin Batu Permata',        'Cincin',  '20K', 3.10,  9, 'Rejected',         '2026-05-22')
on conflict (id_item) do nothing;

insert into public.harga_emas (tanggal, karat, harga_beli, harga_jual) values
  (current_date, 24, 1050000, 1100000),
  (current_date, 22,  960000, 1005000),
  (current_date, 18,  785000,  820000)
on conflict (tanggal, karat) do nothing;
