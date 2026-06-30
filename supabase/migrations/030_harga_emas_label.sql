-- Tambah kolom `label` ke harga_emas supaya 1 karat bisa punya lebih dari satu
-- harga sekaligus per hari (client: "1 karat bisa sampai 3 harga" -- mis. beda
-- kualitas/bentuk barang dgn karat yang sama). Contoh: 6K Harga A vs 6K Harga B.
--
-- Constraint unique lama (tanggal, karat) diganti (tanggal, karat, label) supaya
-- baris per-label tidak saling timpa/upsert. Baris LAMA otomatis dapat label ''
-- (kosong) = tingkat harga utama/default.
--
-- PENTING: patokan harga 24K yang dipakai utk hitung harga jual/beli barang
-- (lihat app/pos/page.tsx, app/pembelian/page.tsx, app/inventori/page.tsx --
-- semua query `.eq("karat", 24)`) SELALU diambil dari baris label='' supaya
-- penambahan tingkat harga lain (mis. 24K "Harga B") tidak pernah mengganggu
-- patokan. Itu sudah disesuaikan di kode, tidak perlu diutak-atik manual.
-- Run in Supabase Dashboard > SQL Editor

alter table public.harga_emas add column if not exists label text not null default '';

-- Drop constraint unique lama (tanggal, karat) apapun namanya, baru tambah yang baru.
do $$
declare
  cname text;
begin
  select tc.constraint_name into cname
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
  where tc.table_schema = 'public' and tc.table_name = 'harga_emas' and tc.constraint_type = 'UNIQUE'
  group by tc.constraint_name
  having array_agg(kcu.column_name::text order by kcu.column_name::text) = array['karat', 'tanggal'];

  if cname is not null then
    execute format('alter table public.harga_emas drop constraint %I', cname);
  end if;
end $$;

alter table public.harga_emas
  add constraint harga_emas_tanggal_karat_label_key unique (tanggal, karat, label);
