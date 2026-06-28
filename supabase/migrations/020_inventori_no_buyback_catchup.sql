-- Catch-up: migration 014_inventori_buyback.sql was written but never run
-- against production, so app/pembelian/page.tsx has been failing every read
-- and write with "column inventori.no_buyback does not exist".
-- Run in Supabase Dashboard > SQL Editor

alter table public.inventori
  add column if not exists no_buyback text;
