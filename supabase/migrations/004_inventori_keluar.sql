-- Riwayat barang keluar (hasil konfirmasi scan Scanner 2 / barang terjual/servis/retur/hilang)
-- Barang TIDAK dihapus dari inventori — hanya status & jumlah yang diperbarui,
-- riwayat transaksi keluar disimpan di tabel ini untuk audit/laporan.
-- Run in Supabase Dashboard > SQL Editor

create table if not exists public.inventori_keluar (
  id uuid primary key default gen_random_uuid(),
  inventori_id uuid references public.inventori(id) on delete set null,
  id_item text not null,
  nama_produk text not null,
  jumlah_keluar integer not null default 1,
  jumlah_sisa integer not null default 0,
  status_baru text not null,
  catatan text,
  created_at timestamptz default now()
);

alter table public.inventori_keluar enable row level security;

create policy "allow read inventori_keluar" on public.inventori_keluar for select using (true);
create policy "allow all inventori_keluar" on public.inventori_keluar for all using (true) with check (true);
