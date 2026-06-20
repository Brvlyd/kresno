-- Harga Modal & Harga Jual inventori sekarang diinput sebagai persentase, bukan Rupiah langsung.
-- Rumus (sama dengan Rumus Pengambilan Barang pada Supplier/Sales di lib/hutangPiutang.ts):
--   Hasil       = Berat Emas (gram) x Persentase Harga (%)
--   Hasil Akhir = Hasil x (Karat barang / 24)
--   Harga (Rp)  = Hasil Akhir x Harga Emas 24K hari itu (kolom harga_beli untuk modal, harga_jual untuk jual)
-- Kolom harga_beli/harga_jual tetap disimpan (hasil hitungan di atas) supaya laporan Keuangan,
-- Hutang, dan POS yang sudah ada tidak perlu diubah skemanya.
-- Run in Supabase Dashboard > SQL Editor

alter table public.inventori
  add column if not exists persen_modal numeric(6,2) default 0,
  add column if not exists persen_jual numeric(6,2) default 0;
