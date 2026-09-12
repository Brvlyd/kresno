-- ════════════════════════════════════════════════════════════════════════════
-- SNAPSHOT MODAL (HPP) SAAT TRANSAKSI — memperbaiki laba kotor yang membengkak
-- ════════════════════════════════════════════════════════════════════════════
-- Run in Supabase Dashboard > SQL Editor
--
-- MASALAH
-- Harga jual di Kasir SELALU dihitung ulang memakai harga emas 24K hari
-- transaksi (lihat `hargaJualLive` di app/pos/page.tsx), tapi modalnya tidak:
-- laporan Keuangan membaca `inventori.harga_beli` lewat join live, dan kolom itu
-- cuma pernah dihitung sekali saat barang DIINPUT ke inventori. Akibatnya:
--
--   1. Setiap kenaikan harga emas selama barang mengendap di etalase ikut
--      tercatat sebagai "laba kotor". Contoh nyata (INV-20260906-2374):
--        jual  = 5,05 gr × 51% × 2.450.000 (harga hari jual)  = 6.309.975
--        modal = 5,05 gr × 44% × 1.056.000 (harga hari input) = 2.346.432
--        laba kotor tercatat 3.863.543, padahal margin sebenarnya cuma 766.075.
--   2. Laba kotor transaksi LAMA ikut berubah kalau barangnya diedit di
--      Inventori hari ini — laporan keuangan jadi tidak reproducible.
--
-- SOLUSI
-- Snapshot modal per satuan ke baris transaksinya sendiri, persis seperti
-- `harga_satuan` yang sudah disnapshot sejak migration 022. Modal dihitung
-- dengan patokan harga emas 24K pada TANGGAL TRANSAKSI, supaya sepatokan
-- dengan harga jualnya dan laba kotor = murni selisih persen jual vs persen
-- modal.

-- ── 1. Kolom snapshot ──────────────────────────────────────────────────────
alter table public.inventori_keluar
  add column if not exists harga_modal bigint;

comment on column public.inventori_keluar.harga_modal is
  'Modal (HPP) per satuan saat transaksi = berat × persen_modal × harga emas 24K '
  'pada tanggal transaksi. Dibekukan di sini supaya laba kotor tidak berubah '
  'kalau harga emas bergerak atau barangnya diedit di Inventori. NULL = data '
  'lama yang tidak bisa direkonstruksi; laporan jatuh ke inventori.harga_beli.';

-- ── 2. PRATINJAU (opsional) ────────────────────────────────────────────────
-- Jalankan blok ini DULU kalau mau melihat perubahan angkanya sebelum menulis.
-- Tidak mengubah data apa pun.
--
-- select
--   k.no_invoice,
--   k.nama_produk,
--   k.jumlah_keluar                                    as qty,
--   i.harga_beli                                       as modal_lama_per_unit,
--   round(coalesce(nullif(k.berat_gram, 0), i.berat_gram, 0)
--         * (coalesce(i.persen_modal, 0) / 100.0) * he.harga_24k)::bigint
--                                                      as modal_baru_per_unit,
--   k.harga_satuan,
--   he.harga_24k                                       as patokan_24k_hari_transaksi
-- from public.inventori_keluar k
-- join public.inventori i on i.id = k.inventori_id
-- cross join lateral (
--   select coalesce(nullif(h.harga_beli, 0), h.harga_jual) as harga_24k
--   from public.harga_emas h
--   where h.karat = 24 and coalesce(h.label, '') = ''
--     and h.tanggal <= (k.created_at at time zone 'UTC')::date
--   order by h.tanggal desc
--   limit 1
-- ) he
-- where k.no_invoice is not null and k.status_baru = 'Terjual'
-- order by k.created_at desc;

-- ── 3. BACKFILL — hitung ulang modal semua transaksi penjualan yang sudah ada ──
-- Patokan harga emas: baris 24K label kosong pada tanggal transaksi; kalau
-- tanggal itu tidak ada isiannya (hari libur / lupa diisi) dipakai tanggal
-- terisi TERAKHIR sebelumnya — bukan harga hari ini, supaya tetap historis.
--
-- Catatan keterbatasan: `persen_modal` diambil dari baris inventori SAAT INI.
-- Kalau persentase sebuah barang pernah diubah setelah terjual, hasil backfill
-- memakai persentase yang terbaru. Tidak ada sumber lain untuk nilai lamanya.
--
-- `harga_modal is null` membuat blok ini aman dijalankan berkali-kali: baris
-- yang sudah punya snapshot tidak akan ditimpa.
with calc as (
  select
    k.id,
    round(
      coalesce(nullif(k.berat_gram, 0), i.berat_gram, 0)
      * (coalesce(i.persen_modal, 0) / 100.0)
      * he.harga_24k
    )::bigint as harga_modal
  from public.inventori_keluar k
  join public.inventori i on i.id = k.inventori_id
  cross join lateral (
    select coalesce(nullif(h.harga_beli, 0), h.harga_jual) as harga_24k
    from public.harga_emas h
    where h.karat = 24
      and coalesce(h.label, '') = ''
      and h.tanggal <= (k.created_at at time zone 'UTC')::date
    order by h.tanggal desc
    limit 1
  ) he
  where k.no_invoice is not null
    and k.status_baru = 'Terjual'
    and k.harga_modal is null
    and coalesce(i.persen_modal, 0) > 0
    and coalesce(he.harga_24k, 0) > 0
)
update public.inventori_keluar k
set harga_modal = calc.harga_modal
from calc
where k.id = calc.id;

-- ── 4. SISA YANG TIDAK BISA DIREKONSTRUKSI ────────────────────────────────
-- Baris penjualan yang barangnya sudah dihapus dari inventori, persen_modal-nya
-- 0/kosong, atau transaksinya lebih tua dari isian harga emas paling awal.
-- Sengaja DIBIARKAN null — laporan Keuangan akan jatuh ke perilaku lama
-- (inventori.harga_beli) untuk baris-baris ini. Cek sisanya dengan:
--
-- select k.no_invoice, k.id_item, k.nama_produk, k.created_at
-- from public.inventori_keluar k
-- where k.no_invoice is not null and k.status_baru = 'Terjual'
--   and k.harga_modal is null
-- order by k.created_at desc;
