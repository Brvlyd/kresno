-- Ubah format id_item (kode/barcode barang) dari 3 bagian {kadar}-{kode}-{urutan}
-- (mis. "24K-CIN-001") menjadi 4 bagian {karat 2 digit}K-{kode 3 huruf}-{berat gram x100,
-- 4 digit}-{urutan, 4 digit} (mis. "24K-CIN-0149-0001" untuk barang 1.49 gram).
--
-- "Urutan" (barang ke berapa) TETAP memakai urutan lama per (karat, kode) — tidak diacak ulang,
-- supaya nomor urut barang tidak berubah maknanya, hanya ditambah digit & disisipi berat.
--
-- Baris yang id_item-nya TIDAK mengikuti format lama {kadar}-{kode}-{urutan} (mis. sisa data lama
-- yang formatnya tidak standar) TIDAK disentuh oleh UPDATE ini, supaya tidak salah ubah — cek manual
-- pakai query preview #1.
--
-- Riwayat transaksi (inventori_keluar.id_item) adalah snapshot kode pada saat barang itu terjual,
-- jadi SENGAJA tidak diubah di sini — biar struk/riwayat lama tetap menampilkan kode yang dulu
-- benar-benar tercetak di barangnya.
--
-- Aman dijalankan berkali-kali: begitu id_item sudah berformat baru (4 bagian), ia tidak lagi
-- cocok dengan pattern format lama (3 bagian) jadi UPDATE jadi no-op untuk baris itu.
-- Run in Supabase Dashboard > SQL Editor

-- ── 1. PREVIEW — baris yang TIDAK cocok format lama maupun format baru, perlu dicek manual ──
select id, id_item, jenis_barang, kadar, berat_gram
from public.inventori
where id_item !~ '^\d+(\.\d+)?K-[A-Za-z0-9]+-\d+$'
  and id_item !~ '^\d{1,2}K-[A-Za-z0-9]+-\d+-\d+$';

-- ── 2. PREVIEW — pratinjau id_item lama -> baru sebelum benar-benar diubah, periksa dulu ──
with parsed as (
  select
    id,
    id_item as id_item_lama,
    (regexp_match(id_item, '^(\d+(?:\.\d+)?)K-([A-Za-z0-9]+)-(\d+)$'))[1]::numeric as karat_num,
    upper((regexp_match(id_item, '^(\d+(?:\.\d+)?)K-([A-Za-z0-9]+)-(\d+)$'))[2]) as kode,
    (regexp_match(id_item, '^(\d+(?:\.\d+)?)K-([A-Za-z0-9]+)-(\d+)$'))[3]::int as urutan_lama,
    berat_gram
  from public.inventori
  where id_item ~ '^\d+(\.\d+)?K-[A-Za-z0-9]+-\d+$'
),
seq as (
  select *,
    row_number() over (
      partition by round(karat_num)::int, kode
      order by urutan_lama, id
    ) as urutan_baru
  from parsed
)
select
  id, id_item_lama,
  lpad(round(karat_num)::int::text, 2, '0') || 'K-' || kode || '-' ||
  lpad(round(berat_gram * 100)::int::text, 4, '0') || '-' ||
  lpad(urutan_baru::text, 4, '0') as id_item_baru
from seq
order by id_item_lama;

-- ── 3. UPDATE — jalankan setelah preview #2 di atas terlihat benar ──
with parsed as (
  select
    id,
    (regexp_match(id_item, '^(\d+(?:\.\d+)?)K-([A-Za-z0-9]+)-(\d+)$'))[1]::numeric as karat_num,
    upper((regexp_match(id_item, '^(\d+(?:\.\d+)?)K-([A-Za-z0-9]+)-(\d+)$'))[2]) as kode,
    (regexp_match(id_item, '^(\d+(?:\.\d+)?)K-([A-Za-z0-9]+)-(\d+)$'))[3]::int as urutan_lama,
    berat_gram
  from public.inventori
  where id_item ~ '^\d+(\.\d+)?K-[A-Za-z0-9]+-\d+$'
),
seq as (
  select *,
    row_number() over (
      partition by round(karat_num)::int, kode
      order by urutan_lama, id
    ) as urutan_baru
  from parsed
)
update public.inventori inv
set id_item = lpad(round(seq.karat_num)::int::text, 2, '0') || 'K-' || seq.kode || '-' ||
              lpad(round(seq.berat_gram * 100)::int::text, 4, '0') || '-' ||
              lpad(seq.urutan_baru::text, 4, '0')
from seq
where inv.id = seq.id;
