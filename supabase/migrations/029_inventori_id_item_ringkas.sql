-- Terapkan format id_item ringkas (lihat lib/csv.ts formatIdItem, sebelumnya cuma berlaku
-- utk barang BARU) ke SEMUA barang yang sudah ada di inventori.
--
-- id_item LAMA disimpan di kolom id_item_lama (BUKAN dibuang) supaya label fisik yang
-- sudah dicetak/ditempel di barang -- format apapun yang dipakai saat itu (dengan "-",
-- tanpa "-", atau barcode_no) -- TETAP bisa discan & ditemukan walau id_item-nya sekarang
-- berubah. Toko TIDAK perlu cetak ulang semua label sekaligus; tinggal cetak ulang
-- pelan-pelan kalau mau label barunya yang lebih ringkas.
--
-- Karat, kode jenis, & nomor urut dipakai APA ADANYA dari id_item lama (cuma direformat
-- tanpa "-" & berat dibulatkan) -- BUKAN diacak ulang -- supaya counter di tabel
-- id_item_seq (dipakai utk barang BARU berikutnya, lihat 027_id_item_seq.sql) tetap
-- nyambung & tidak collision dengan barang yang baru direname di sini.
--
-- Baris yang id_item-nya TIDAK mengikuti format standar 4-bagian (sisa data lama yang
-- tidak standar, lihat juga 024_id_item_format_berat.sql) TIDAK disentuh.
-- Run in Supabase Dashboard > SQL Editor

alter table public.inventori add column if not exists id_item_lama text;
create index if not exists inventori_id_item_lama_idx on public.inventori (id_item_lama);

-- ── PREVIEW — cek hasil reformat dulu sebelum benar-benar dijalankan ──
with parsed as (
  select
    id, id_item as id_item_lama, berat_gram,
    (regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[1] as karat_digits,
    upper((regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[2]) as kode,
    (regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[4]::int as urutan
  from public.inventori
  where id_item ~ '^\d{1,2}K-[A-Za-z0-9]+-\d+-\d+$'
)
select
  id, id_item_lama,
  lpad(karat_digits, 2, '0') || kode ||
  lpad(least(99, round(berat_gram)::int)::text, 2, '0') ||
  lpad(urutan::text, 3, '0') as id_item_baru
from parsed
order by id_item_lama;

-- ── UPDATE — jalankan setelah preview di atas terlihat benar ──
with parsed as (
  select
    id, id_item as id_item_lama, berat_gram,
    (regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[1] as karat_digits,
    upper((regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[2]) as kode,
    (regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[4]::int as urutan
  from public.inventori
  where id_item ~ '^\d{1,2}K-[A-Za-z0-9]+-\d+-\d+$'
)
update public.inventori inv
set id_item_lama = parsed.id_item_lama,
    id_item = lpad(parsed.karat_digits, 2, '0') || parsed.kode ||
              lpad(least(99, round(parsed.berat_gram)::int)::text, 2, '0') ||
              lpad(parsed.urutan::text, 3, '0')
from parsed
where inv.id = parsed.id;
