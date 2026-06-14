-- Support bulk CSV import for inventori: extra fields + merged status set + image storage
-- Run in Supabase Dashboard > SQL Editor

-- 1. New columns for CSV import (Supplier, Keterangan, Gambar)
alter table public.inventori
  add column if not exists supplier text,
  add column if not exists keterangan text,
  add column if not exists gambar_url text;

-- 2. Merge status_inventori options: keep existing values + add new CSV statuses
alter table public.inventori
  drop constraint if exists inventori_status_inventori_check;

alter table public.inventori
  add constraint inventori_status_inventori_check
  check (status_inventori in (
    'Tersedia','Terjual','Dalam Servis','Retur',
    'Tidak Laku','Mati Laku','Habis Dijual','Hilang'
  ));

-- 3. Storage bucket for item photos (used by single-item image upload)
insert into storage.buckets (id, name, public)
values ('inventori-images', 'inventori-images', true)
on conflict (id) do nothing;

-- Public read + write policies for the bucket
drop policy if exists "inventori-images public read" on storage.objects;
create policy "inventori-images public read"
  on storage.objects for select
  using (bucket_id = 'inventori-images');

drop policy if exists "inventori-images public write" on storage.objects;
create policy "inventori-images public write"
  on storage.objects for insert
  with check (bucket_id = 'inventori-images');

drop policy if exists "inventori-images public update" on storage.objects;
create policy "inventori-images public update"
  on storage.objects for update
  using (bucket_id = 'inventori-images');

drop policy if exists "inventori-images public delete" on storage.objects;
create policy "inventori-images public delete"
  on storage.objects for delete
  using (bucket_id = 'inventori-images');
