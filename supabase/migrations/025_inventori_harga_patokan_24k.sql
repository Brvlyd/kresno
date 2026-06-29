-- Perubahan rumus harga: Harga Modal & Harga Jual inventori sekarang SELALU
-- dihitung dari persentase x harga emas 24K hari barang itu masuk — bukan lagi
-- dari harga emas sesuai KARAT barang itu sendiri (mis. barang 18K dulu pakai
-- harga_emas baris karat=18, sekarang SELALU pakai baris karat=24).
--
-- Rumus baru (lihat app/inventori/page.tsx, app/pembelian/page.tsx, app/pos/page.tsx):
--   Harga (Rp) = Berat Emas (gram) x Persentase Harga (%) x Harga Emas 24K
--                pada tanggal_masuk barang itu
--                (harga_beli pakai kolom harga_beli 24K, harga_jual pakai harga_jual 24K)
--
-- Migration ini merekalkulasi ULANG harga_beli & harga_jual barang yang SUDAH ADA
-- di inventori, supaya konsisten dengan rumus baru. persen_modal & persen_jual
-- (yang diinput user) TIDAK diubah — hanya hasil Rupiah-nya yang dihitung ulang.
--
-- PENTING — jalankan SELECT preview dulu. Barang yang tanggal_masuk-nya TIDAK punya
-- baris harga_emas karat=24 (mis. tanggal itu belum pernah diisi di Dashboard) akan
-- TIDAK ikut ter-update (no-op untuk baris itu) — supaya tidak menulis harga 0 secara
-- tidak sengaja. Cek daftar itu di preview #2 dan isi harga_emas tanggal tersebut dulu
-- kalau perlu, baru jalankan migration ini lagi.
-- Run in Supabase Dashboard > SQL Editor

-- ── 1. PREVIEW — harga lama vs harga baru untuk barang yang BISA direkalkulasi ──
select
  inv.id, inv.id_item, inv.nama_produk, inv.kadar, inv.tanggal_masuk,
  inv.harga_beli as harga_beli_lama,
  round(inv.berat_gram * (inv.persen_modal / 100) * he.harga_beli) as harga_beli_baru,
  inv.harga_jual as harga_jual_lama,
  round(inv.berat_gram * (inv.persen_jual / 100) * he.harga_jual) as harga_jual_baru
from public.inventori inv
join public.harga_emas he
  on he.tanggal = inv.tanggal_masuk and he.karat = 24
order by inv.tanggal_masuk desc;

-- ── 2. PREVIEW — barang yang TIDAK bisa direkalkulasi (belum ada harga_emas 24K
--    di tanggal_masuk-nya) — isi dulu harga emas tanggal itu di Dashboard kalau perlu ──
select inv.id, inv.id_item, inv.nama_produk, inv.kadar, inv.tanggal_masuk
from public.inventori inv
where not exists (
  select 1 from public.harga_emas he
  where he.tanggal = inv.tanggal_masuk and he.karat = 24
)
order by inv.tanggal_masuk desc;

-- ── 3. UPDATE — rekalkulasi harga_beli & harga_jual, aman dijalankan berkali-kali ──
update public.inventori inv
set
  harga_beli = round(inv.berat_gram * (inv.persen_modal / 100) * he.harga_beli),
  harga_jual = round(inv.berat_gram * (inv.persen_jual / 100) * he.harga_jual),
  updated_at = now()
from public.harga_emas he
where he.tanggal = inv.tanggal_masuk and he.karat = 24;
