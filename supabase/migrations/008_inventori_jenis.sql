-- ============================================================
-- Inventori: 3 jenis inventori (Stock Dalam, Stock Display, Aset)
-- Aset mencakup Cukim dan Emas Rosok; pembelian emas rosok = Buyback Emas
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.inventori
  add column if not exists jenis_inventori text not null default 'Stock Dalam'
    check (jenis_inventori in ('Stock Dalam', 'Stock Display', 'Aset')),
  add column if not exists sub_jenis_aset text
    check (sub_jenis_aset is null or sub_jenis_aset in ('Cukim', 'Emas Rosok'));

-- Semua data lama dimasukkan ke 'Stock Dalam' secara default
update public.inventori
  set jenis_inventori = 'Stock Dalam'
  where jenis_inventori is null or jenis_inventori = '';
