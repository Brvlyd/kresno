-- Naikkan batas baris pada tabel data utama dari 2 menjadi 5
-- (lihat 013_limit_2_baris_per_table.sql untuk konteks awal pembatasan ini).
-- Run in Supabase Dashboard > SQL Editor

-- 1. Lepas trigger lama di semua tabel yang dibatasi
drop trigger if exists trg_limit_2_rows on public.harga_emas;
drop trigger if exists trg_limit_2_rows on public.karyawan;
drop trigger if exists trg_limit_2_rows on public.pelanggan;
drop trigger if exists trg_limit_2_rows on public.inventori;
drop trigger if exists trg_limit_2_rows on public.jenis_barang_custom;
drop trigger if exists trg_limit_2_rows on public.gadai;
drop trigger if exists trg_limit_2_rows on public.servis;
drop trigger if exists trg_limit_2_rows on public.hutang;
drop trigger if exists trg_limit_2_rows on public.piutang;

drop function if exists public.enforce_max_2_rows();

-- 2. Fungsi trigger generik: tolak INSERT kalau tabel sudah punya >= 5 baris
create or replace function public.enforce_max_5_rows()
returns trigger as $$
declare
  row_count integer;
begin
  execute format('select count(*) from %I.%I', tg_table_schema, tg_table_name) into row_count;
  if row_count >= 5 then
    raise exception 'Tabel % sudah mencapai batas maksimum 5 baris', tg_table_name;
  end if;
  return new;
end;
$$ language plpgsql;

-- 3. Pasang trigger baru ke setiap tabel data utama
create trigger trg_limit_5_rows before insert on public.harga_emas
  for each row execute function public.enforce_max_5_rows();

create trigger trg_limit_5_rows before insert on public.karyawan
  for each row execute function public.enforce_max_5_rows();

create trigger trg_limit_5_rows before insert on public.pelanggan
  for each row execute function public.enforce_max_5_rows();

create trigger trg_limit_5_rows before insert on public.inventori
  for each row execute function public.enforce_max_5_rows();

create trigger trg_limit_5_rows before insert on public.jenis_barang_custom
  for each row execute function public.enforce_max_5_rows();

create trigger trg_limit_5_rows before insert on public.gadai
  for each row execute function public.enforce_max_5_rows();

create trigger trg_limit_5_rows before insert on public.servis
  for each row execute function public.enforce_max_5_rows();

create trigger trg_limit_5_rows before insert on public.hutang
  for each row execute function public.enforce_max_5_rows();

create trigger trg_limit_5_rows before insert on public.piutang
  for each row execute function public.enforce_max_5_rows();
