-- Terapkan format id_item ringkas (lihat lib/csv.ts formatIdItem, sebelumnya cuma berlaku
-- utk barang BARU) ke SEMUA barang yang sudah ada di inventori.
--
-- id_item LAMA disimpan di kolom id_item_lama (BUKAN dibuang) supaya label fisik yang
-- sudah dicetak/ditempel di barang -- format apapun yang dipakai saat itu (dengan "-",
-- tanpa "-", atau barcode_no) -- TETAP bisa discan & ditemukan walau id_item-nya sekarang
-- berubah. Toko TIDAK perlu cetak ulang semua label sekaligus; tinggal cetak ulang
-- pelan-pelan kalau mau label barunya yang lebih ringkas.
--
-- Nomor urut TIDAK dipakai apa adanya dari id_item lama -- DIRENUMBER lewat row_number()
-- per (karat, kode). Ternyata nomor urut lama TIDAK dijamin unik di situasi ini: sebelum
-- migration 027 (fix race condition), 2 barang bisa kebagian nomor urut yang SAMA untuk
-- (karat, kode) yang sama selama berat-nya beda (id_item lama tetap unik krn berat ikut
-- jadi pembeda) -- begitu berat dibulatkan & dibuang dari "pembeda", 2 barang itu jadi
-- tabrakan. row_number() menjamin nomor urut baru unik per (karat, kode) walau ada
-- duplikat/lubang di data lama.
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
    lpad((regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[1], 2, '0') as karat_digits,
    upper((regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[2]) as kode,
    (regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[4]::int as urutan_lama
  from public.inventori
  where id_item ~ '^\d{1,2}K-[A-Za-z0-9]+-\d+-\d+$'
),
seq as (
  select *,
    row_number() over (partition by karat_digits, kode order by urutan_lama, id) as urutan_baru
  from parsed
)
select
  id, id_item_lama,
  karat_digits || kode ||
  lpad(least(99, round(berat_gram)::int)::text, 2, '0') ||
  lpad(urutan_baru::text, 3, '0') as id_item_baru
from seq
order by id_item_lama;

-- ── UPDATE — jalankan setelah preview di atas terlihat benar ──
with parsed as (
  select
    id, id_item as id_item_lama, berat_gram,
    lpad((regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[1], 2, '0') as karat_digits,
    upper((regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[2]) as kode,
    (regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[4]::int as urutan_lama
  from public.inventori
  where id_item ~ '^\d{1,2}K-[A-Za-z0-9]+-\d+-\d+$'
),
seq as (
  select *,
    row_number() over (partition by karat_digits, kode order by urutan_lama, id) as urutan_baru
  from parsed
)
update public.inventori inv
set id_item_lama = seq.id_item_lama,
    id_item = seq.karat_digits || seq.kode ||
              lpad(least(99, round(seq.berat_gram)::int)::text, 2, '0') ||
              lpad(seq.urutan_baru::text, 3, '0')
from seq
where inv.id = seq.id;

-- Sinkronkan counter id_item_seq (dipakai utk barang BARU berikutnya, lihat
-- 027_id_item_seq.sql) supaya tidak pernah mengeluarkan nomor urut yang barusan
-- dipakai ulang di atas -- ambil yang LEBIH BESAR antara nilai lama & nomor urut
-- tertinggi hasil renumber barusan, per (karat, kode).
with maxbaru as (
  select
    lpad((regexp_match(id_item_lama, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[1], 2, '0') || 'K-' ||
      upper((regexp_match(id_item_lama, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$'))[2]) as seq_key,
    count(*) as total
  from public.inventori
  where id_item_lama ~ '^\d{1,2}K-[A-Za-z0-9]+-\d+-\d+$'
  group by 1
)
insert into public.id_item_seq (seq_key, last_seq)
select seq_key, total from maxbaru
on conflict (seq_key) do update set last_seq = greatest(public.id_item_seq.last_seq, excluded.last_seq);
