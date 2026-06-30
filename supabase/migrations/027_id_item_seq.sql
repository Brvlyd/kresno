-- Perbaikan race condition: id_item (kode barang, mis. "24K-GEL-0150-0007") selama ini
-- dihitung di BROWSER dengan cara menghitung urutan dari daftar item yang sudah ter-load
-- (lib/csv.ts nextIdItem). Kalau beberapa user nambah barang di waktu yang berdekatan,
-- mereka bisa memakai snapshot data yang sama -> menghasilkan id_item yang identik ->
-- insert kedua/ketiga gagal kena unique constraint ("duplicate key value violates unique
-- constraint inventori_id_item_key").
--
-- Solusinya: pindahkan penomoran urut ke DATABASE lewat satu fungsi atomik. UPSERT di
-- dalamnya mengunci baris counter-nya, jadi dua transaksi yang jalan bersamaan TIDAK
-- PERNAH bisa mendapat nomor urut yang sama, walaupun di-klik Simpan persis bersamaan
-- dari device berbeda.
-- Run in Supabase Dashboard > SQL Editor

create table if not exists public.id_item_seq (
  seq_key text primary key,   -- format: "{karat 2 digit}K-{kode 3 huruf}", mis. "24K-GEL"
  last_seq integer not null default 0
);

alter table public.id_item_seq enable row level security;
drop policy if exists "authenticated read id_item_seq" on public.id_item_seq;
create policy "authenticated read id_item_seq" on public.id_item_seq for select using (auth.role() = 'authenticated');
drop policy if exists "authenticated all id_item_seq" on public.id_item_seq;
create policy "authenticated all id_item_seq" on public.id_item_seq for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Backfill dari id_item yang sudah ada (format baru 4-bagian, lihat 024_id_item_format_berat.sql)
-- supaya counter melanjutkan dari nomor urut tertinggi yang sudah dipakai, bukan mulai dari 0 lagi.
insert into public.id_item_seq (seq_key, last_seq)
select
  lpad(m[1], 2, '0') || 'K-' || upper(m[2]) as seq_key,
  max(m[4]::int) as last_seq
from (
  select regexp_match(id_item, '^(\d{1,2})K-([A-Za-z0-9]+)-(\d+)-(\d+)$') as m
  from public.inventori
) sub
where m is not null
group by 1
on conflict (seq_key) do update set last_seq = greatest(public.id_item_seq.last_seq, excluded.last_seq);

-- Fungsi atomik: increment & kembalikan nomor urut berikutnya untuk sebuah (karat, kode).
-- Dipanggil dari aplikasi lewat supabase.rpc("next_id_item_seq", { p_seq_key }).
create or replace function public.next_id_item_seq(p_seq_key text)
returns integer
language sql
security invoker
as $$
  insert into public.id_item_seq as s (seq_key, last_seq)
  values (p_seq_key, 1)
  on conflict (seq_key)
  do update set last_seq = s.last_seq + 1
  returning s.last_seq;
$$;

grant execute on function public.next_id_item_seq(text) to authenticated;
