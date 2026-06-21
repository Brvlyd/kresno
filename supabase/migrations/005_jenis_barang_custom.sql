-- Daftar "Jenis Barang" tambahan yang dibuat sendiri oleh pengguna toko
-- (selain jenis bawaan: Gelang, Kalung, Cincin, Anting, Liontin, Tindik Mata, Tusuk Konde, Lainnya)
-- Run in Supabase Dashboard > SQL Editor

create table if not exists public.jenis_barang_custom (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);

alter table public.jenis_barang_custom enable row level security;

drop policy if exists "allow read jenis_barang_custom" on public.jenis_barang_custom;
create policy "allow read jenis_barang_custom" on public.jenis_barang_custom for select using (true);

drop policy if exists "allow all jenis_barang_custom" on public.jenis_barang_custom;
create policy "allow all jenis_barang_custom" on public.jenis_barang_custom for all using (true) with check (true);
