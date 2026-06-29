-- Riwayat transaksi POS selama ini cuma disimpan sebagai teks gabungan di
-- kolom catatan ("INV-xxx | Nama | Metode | Catatan"), tanpa harga per item
-- maupun ringkasan invoice (subtotal/diskon/PPN/total) — jadi detail transaksi
-- tidak bisa ditampilkan utuh. Tambah kolom terstruktur supaya riwayat di
-- halaman POS bisa dibuka per item & per invoice tanpa data rekaan.
-- Run in Supabase Dashboard > SQL Editor

alter table public.inventori_keluar
  add column if not exists no_invoice text,
  add column if not exists pelanggan_nama text,
  add column if not exists pelanggan_hp text,
  add column if not exists payment_method text,
  add column if not exists kadar text,
  add column if not exists berat_gram numeric(8,2),
  add column if not exists harga_satuan bigint,
  add column if not exists ongkos bigint,
  add column if not exists diskon bigint,
  add column if not exists ppn_persen numeric(5,2),
  add column if not exists ppn_amount bigint,
  add column if not exists total_transaksi bigint;

create index if not exists inventori_keluar_no_invoice_idx on public.inventori_keluar (no_invoice);

-- ── Backfill data transaksi POS lama dari kolom catatan (format lama) ──
-- Format lama: "INV-xxx | NamaPelanggan | MetodePembayaran | CatatanBebas"
update public.inventori_keluar
set
  no_invoice = split_part(catatan, ' | ', 1),
  pelanggan_nama = nullif(split_part(catatan, ' | ', 2), ''),
  payment_method = nullif(split_part(catatan, ' | ', 3), ''),
  catatan = nullif(split_part(catatan, ' | ', 4), '')
where catatan like 'INV-%' and no_invoice is null;

-- ── Backfill kadar & berat dari data inventori terkait (kalau belum disnapshot) ──
-- Catatan: ini nilai inventori SAAT INI, bukan snapshot historis — sama seperti
-- yang sudah dipakai di halaman Keuangan untuk baris stok keluar lama.
update public.inventori_keluar k
set kadar = i.kadar, berat_gram = i.berat_gram
from public.inventori i
where k.inventori_id = i.id and k.kadar is null and k.no_invoice is not null;
