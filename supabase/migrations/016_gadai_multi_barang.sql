-- ============================================================
-- Gadai: dukung banyak barang per pengajuan, masing-masing
-- dengan berat & kadar sendiri (kadar emas menentukan nilai per
-- gram, jadi tidak bisa digabung jadi satu "total berat" saja).
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.gadai_barang (
  id uuid primary key default gen_random_uuid(),
  gadai_id uuid not null references public.gadai(id) on delete cascade,
  urutan integer not null default 1,
  jenis_perhiasan text not null,
  nama_barang text not null,
  berat_gram numeric(8,2) not null default 0,
  kadar text not null,
  kondisi_barang text,
  deskripsi text,
  foto_barang_url text,
  created_at timestamptz default now()
);

alter table public.gadai_barang enable row level security;

drop policy if exists "allow read gadai_barang" on public.gadai_barang;
create policy "allow read gadai_barang" on public.gadai_barang for select using (true);
drop policy if exists "allow all gadai_barang" on public.gadai_barang;
create policy "allow all gadai_barang" on public.gadai_barang for all using (true) with check (true);

-- Backfill: setiap baris gadai lama jadi 1 baris gadai_barang,
-- supaya data lama tetap tampil di invoice/detail yang baru.
insert into public.gadai_barang
  (gadai_id, urutan, jenis_perhiasan, nama_barang, berat_gram, kadar, kondisi_barang, deskripsi, foto_barang_url)
select g.id, 1, g.jenis_perhiasan, g.nama_barang, g.berat_gram, g.kadar, g.kondisi_barang, g.deskripsi, g.foto_barang_url
from public.gadai g
where not exists (select 1 from public.gadai_barang gb where gb.gadai_id = g.id);
