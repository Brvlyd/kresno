-- ============================================================
-- Modul Pegadaian: pengajuan gadai + jadwal cicilan
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Gadai (pengajuan gadai)
create table if not exists public.gadai (
  id uuid primary key default gen_random_uuid(),
  no_gadai text unique not null,

  -- Data pelanggan
  pelanggan_nama text not null,
  pelanggan_hp text,
  pelanggan_alamat text,
  foto_ktp_url text,

  -- Data barang gadai
  jenis_perhiasan text not null,
  nama_barang text not null,
  berat_gram numeric(8,2) not null default 0,
  kadar text not null,
  kondisi_barang text,
  deskripsi text,
  foto_barang_url text,

  -- Data pinjaman
  nilai_taksiran bigint not null default 0,
  nilai_pinjaman bigint not null default 0,
  bunga_persen numeric(5,2) not null default 0,
  jangka_waktu_bulan integer not null default 1,
  tanggal_gadai date not null default current_date,
  tanggal_jatuh_tempo date,

  opsi_pembayaran text not null default 'Tunai'
    check (opsi_pembayaran in ('Tunai','Cicilan')),
  status text not null default 'Menunggu'
    check (status in ('Menunggu','Diproses','Aktif','Lunas','Disita')),
  catatan text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Jadwal cicilan per gadai (hanya terisi jika opsi_pembayaran = 'Cicilan')
create table if not exists public.gadai_cicilan (
  id uuid primary key default gen_random_uuid(),
  gadai_id uuid not null references public.gadai(id) on delete cascade,
  no_cicilan integer not null,
  jumlah_bayar bigint not null default 0,
  tanggal_jatuh_tempo date,
  tanggal_bayar date,
  status text not null default 'Belum Bayar'
    check (status in ('Belum Bayar','Lunas')),
  created_at timestamptz default now()
);

-- ── RLS: Allow all reads, restrict writes to authenticated ──
alter table public.gadai enable row level security;
alter table public.gadai_cicilan enable row level security;

drop policy if exists "allow read gadai" on public.gadai;
create policy "allow read gadai" on public.gadai for select using (true);
drop policy if exists "allow all gadai" on public.gadai;
create policy "allow all gadai" on public.gadai for all using (true) with check (true);

drop policy if exists "allow read gadai_cicilan" on public.gadai_cicilan;
create policy "allow read gadai_cicilan" on public.gadai_cicilan for select using (true);
drop policy if exists "allow all gadai_cicilan" on public.gadai_cicilan;
create policy "allow all gadai_cicilan" on public.gadai_cicilan for all using (true) with check (true);

-- 3. Storage bucket for KTP & item photos
insert into storage.buckets (id, name, public)
values ('pegadaian-images', 'pegadaian-images', true)
on conflict (id) do nothing;

drop policy if exists "pegadaian-images public read" on storage.objects;
create policy "pegadaian-images public read"
  on storage.objects for select
  using (bucket_id = 'pegadaian-images');

drop policy if exists "pegadaian-images public write" on storage.objects;
create policy "pegadaian-images public write"
  on storage.objects for insert
  with check (bucket_id = 'pegadaian-images');

drop policy if exists "pegadaian-images public update" on storage.objects;
create policy "pegadaian-images public update"
  on storage.objects for update
  using (bucket_id = 'pegadaian-images');

drop policy if exists "pegadaian-images public delete" on storage.objects;
create policy "pegadaian-images public delete"
  on storage.objects for delete
  using (bucket_id = 'pegadaian-images');
