-- ============================================================
-- Modul Servis: servis cuci & perbaikan perhiasan
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.servis (
  id uuid primary key default gen_random_uuid(),
  no_servis text unique not null,
  jenis_servis text not null
    check (jenis_servis in ('Cuci','Perbaikan')),

  -- Data pelanggan
  pelanggan_nama text not null,
  pelanggan_hp text,
  pelanggan_alamat text,

  -- Data perhiasan
  jenis_perhiasan text not null,
  nama_barang text not null,
  berat_gram numeric(8,2) not null default 0,
  kadar text not null,
  kondisi_awal text,
  deskripsi text,
  foto_barang_url text,

  -- Detail perbaikan (hanya untuk jenis_servis = 'Perbaikan')
  jenis_kerusakan text,
  jenis_tindakan text,
  prioritas text,
  catatan_kerusakan text,

  -- Biaya & status
  estimasi_biaya bigint not null default 0,
  uang_muka bigint not null default 0,
  status text not null default 'Menunggu'
    check (status in ('Menunggu','Diproses','Selesai','Diambil')),
  tanggal_masuk date not null default current_date,
  estimasi_selesai date,
  tanggal_selesai date,
  catatan_tambahan text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── RLS ──
alter table public.servis enable row level security;

drop policy if exists "allow read servis" on public.servis;
create policy "allow read servis" on public.servis for select using (true);
drop policy if exists "allow all servis" on public.servis;
create policy "allow all servis" on public.servis for all using (true) with check (true);

-- Storage bucket for foto barang servis
insert into storage.buckets (id, name, public)
values ('servis-images', 'servis-images', true)
on conflict (id) do nothing;

drop policy if exists "servis-images public read" on storage.objects;
create policy "servis-images public read"
  on storage.objects for select
  using (bucket_id = 'servis-images');

drop policy if exists "servis-images public write" on storage.objects;
create policy "servis-images public write"
  on storage.objects for insert
  with check (bucket_id = 'servis-images');

drop policy if exists "servis-images public update" on storage.objects;
create policy "servis-images public update"
  on storage.objects for update
  using (bucket_id = 'servis-images');

drop policy if exists "servis-images public delete" on storage.objects;
create policy "servis-images public delete"
  on storage.objects for delete
  using (bucket_id = 'servis-images');
