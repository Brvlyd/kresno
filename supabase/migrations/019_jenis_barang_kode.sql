-- Kode 3-huruf unik per jenis_barang, dipakai untuk menyusun id_item format baru:
-- {kadar}-{kode 3 huruf}-{urutan 3 digit}, mis. "6K-CIN-001".
-- Disimpan permanen (bukan digenerate ulang tiap saat) supaya kode per jenis_barang stabil.
-- Run in Supabase Dashboard > SQL Editor

create table if not exists public.jenis_barang_kode (
  nama text primary key,
  kode text not null unique,
  created_at timestamptz default now()
);

alter table public.jenis_barang_kode enable row level security;

drop policy if exists "allow read jenis_barang_kode" on public.jenis_barang_kode;
create policy "allow read jenis_barang_kode" on public.jenis_barang_kode for select using (true);

drop policy if exists "allow all jenis_barang_kode" on public.jenis_barang_kode;
create policy "allow all jenis_barang_kode" on public.jenis_barang_kode for all using (true) with check (true);

insert into public.jenis_barang_kode (nama, kode) values
  ('Cincin', 'CIN'),
  ('Anting', 'ANT'),
  ('Gelang', 'GEL'),
  ('Liontin', 'LIO'),
  ('Kalung', 'KAL'),
  ('Tindik Mata', 'TDM'),
  ('Tusuk Konde', 'TUS'),
  ('Lainnya', 'LAI'),
  ('Emas Rosok', 'EMA')
on conflict (nama) do nothing;
