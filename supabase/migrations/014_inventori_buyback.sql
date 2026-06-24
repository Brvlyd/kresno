-- Simpan nomor nota buyback emas rosok di baris inventori terkait
-- Run in Supabase Dashboard > SQL Editor

alter table public.inventori
  add column if not exists no_buyback text;
