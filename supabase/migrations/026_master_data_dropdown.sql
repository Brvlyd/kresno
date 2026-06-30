-- Tabel master data tambahan supaya field "item" yang selama ini cuma daftar
-- statis di kode (Jenis Kerusakan, Jenis Tindakan, Kadar) atau input bebas
-- (Nama Barang/Nama Produk) bisa dicari & dipilih ulang lewat dropdown,
-- konsisten dengan pola jenis_barang_custom yang sudah ada — bukan cuma
-- tersimpan di state halaman masing-masing.
-- Run in Supabase Dashboard > SQL Editor

create table if not exists public.jenis_kerusakan_custom (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);
alter table public.jenis_kerusakan_custom enable row level security;
drop policy if exists "authenticated read jenis_kerusakan_custom" on public.jenis_kerusakan_custom;
create policy "authenticated read jenis_kerusakan_custom" on public.jenis_kerusakan_custom for select using (auth.role() = 'authenticated');
drop policy if exists "authenticated all jenis_kerusakan_custom" on public.jenis_kerusakan_custom;
create policy "authenticated all jenis_kerusakan_custom" on public.jenis_kerusakan_custom for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists public.jenis_tindakan_custom (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);
alter table public.jenis_tindakan_custom enable row level security;
drop policy if exists "authenticated read jenis_tindakan_custom" on public.jenis_tindakan_custom;
create policy "authenticated read jenis_tindakan_custom" on public.jenis_tindakan_custom for select using (auth.role() = 'authenticated');
drop policy if exists "authenticated all jenis_tindakan_custom" on public.jenis_tindakan_custom;
create policy "authenticated all jenis_tindakan_custom" on public.jenis_tindakan_custom for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Kadar bawaan (24K..6K) sudah jadi baseSeed di lib/gadai.ts (KADAR_OPTIONS) —
-- tabel ini menampung kadar TAMBAHAN yang diketik user, sama seperti pola
-- jenis_barang_custom yang tidak menyimpan jenis bawaan (Gelang, Kalung, dst.).
create table if not exists public.kadar_master (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);
alter table public.kadar_master enable row level security;
drop policy if exists "authenticated read kadar_master" on public.kadar_master;
create policy "authenticated read kadar_master" on public.kadar_master for select using (auth.role() = 'authenticated');
drop policy if exists "authenticated all kadar_master" on public.kadar_master;
create policy "authenticated all kadar_master" on public.kadar_master for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Riwayat nama barang/produk yang pernah diketik di Servis, Pegadaian, Pembelian,
-- atau Inventori — dipakai murni sebagai sumber saran pencarian (bukan stok asli,
-- karena barang servis/gadai milik pelanggan dan barang pembelian rosok bukan
-- stok toko).
create table if not exists public.nama_barang_riwayat (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);
alter table public.nama_barang_riwayat enable row level security;
drop policy if exists "authenticated read nama_barang_riwayat" on public.nama_barang_riwayat;
create policy "authenticated read nama_barang_riwayat" on public.nama_barang_riwayat for select using (auth.role() = 'authenticated');
drop policy if exists "authenticated all nama_barang_riwayat" on public.nama_barang_riwayat;
create policy "authenticated all nama_barang_riwayat" on public.nama_barang_riwayat for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
