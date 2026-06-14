-- Add missing columns to inventori table
-- Run in Supabase Dashboard > SQL Editor

alter table public.inventori
  add column if not exists jenis_barang text not null default 'Gelang',
  add column if not exists buatan text,
  add column if not exists kadar2 text,
  add column if not exists status_inventori text not null default 'Tersedia'
    check (status_inventori in ('Tersedia','Tidak Laku','Mati Laku','Habis Dijual','Hilang')),
  add column if not exists updated_at timestamptz default now();

-- Update existing rows to have a default jenis_barang matching kategori
update public.inventori set jenis_barang = kategori where jenis_barang = 'Gelang' and kategori != 'Gelang';

-- Update status_inventori from status_laporan mapping where needed
update public.inventori set status_inventori = 'Tersedia' where status_inventori is null;
