-- Harga Modal & Harga Jual inventori sekarang diinput sebagai persentase, bukan Rupiah langsung.
-- Rumus saat ini (lihat 025_inventori_harga_patokan_24k.sql untuk versi terbaru):
--   Harga (Rp) = Berat Emas (gram) x Persentase Harga (%) x Harga Emas 24K hari itu
--                (kolom harga_beli untuk modal, harga_jual untuk jual — SELALU patokan 24K,
--                 bukan harga sesuai karat barang itu sendiri)
-- Kolom harga_beli/harga_jual tetap disimpan (hasil hitungan di atas) supaya laporan Keuangan,
-- Hutang, dan POS yang sudah ada tidak perlu diubah skemanya.
-- Run in Supabase Dashboard > SQL Editor

alter table public.inventori
  add column if not exists persen_modal numeric(6,2) default 0,
  add column if not exists persen_jual numeric(6,2) default 0;
