-- Batasi tabel data utama (yang diisi manual lewat UI) maksimum 2 baris,
-- supaya client demo tidak bisa mengisi database dengan banyak data.
-- TIDAK diterapkan ke: gadai_cicilan & inventori_keluar (auto-generated oleh
-- aplikasi, bisa rusak kalau dibatasi), maupun keuangan_pin & login_password
-- (sudah dikunci 1 baris lewat constraint sendiri).
-- Run in Supabase Dashboard > SQL Editor

-- 1. Buang kelebihan data lama, sisakan 2 baris tertua per tabel
delete from public.harga_emas
where id not in (select id from public.harga_emas order by created_at asc, id asc limit 2);

delete from public.karyawan
where id not in (select id from public.karyawan order by created_at asc, id asc limit 2);

delete from public.pelanggan
where id not in (select id from public.pelanggan order by created_at asc, id asc limit 2);

delete from public.inventori
where id not in (select id from public.inventori order by created_at asc, id asc limit 2);

delete from public.jenis_barang_custom
where id not in (select id from public.jenis_barang_custom order by created_at asc, id asc limit 2);

delete from public.gadai
where id not in (select id from public.gadai order by created_at asc, id asc limit 2);

delete from public.servis
where id not in (select id from public.servis order by created_at asc, id asc limit 2);

delete from public.hutang
where id not in (select id from public.hutang order by created_at asc, id asc limit 2);

delete from public.piutang
where id not in (select id from public.piutang order by created_at asc, id asc limit 2);

-- 2. Fungsi trigger generik: tolak INSERT kalau tabel sudah punya >= 2 baris
create or replace function public.enforce_max_2_rows()
returns trigger as $$
declare
  row_count integer;
begin
  execute format('select count(*) from %I.%I', tg_table_schema, tg_table_name) into row_count;
  if row_count >= 2 then
    raise exception 'Tabel % sudah mencapai batas maksimum 2 baris', tg_table_name;
  end if;
  return new;
end;
$$ language plpgsql;

-- 3. Pasang trigger ke setiap tabel data utama
drop trigger if exists trg_limit_2_rows on public.harga_emas;
create trigger trg_limit_2_rows before insert on public.harga_emas
  for each row execute function public.enforce_max_2_rows();

drop trigger if exists trg_limit_2_rows on public.karyawan;
create trigger trg_limit_2_rows before insert on public.karyawan
  for each row execute function public.enforce_max_2_rows();

drop trigger if exists trg_limit_2_rows on public.pelanggan;
create trigger trg_limit_2_rows before insert on public.pelanggan
  for each row execute function public.enforce_max_2_rows();

drop trigger if exists trg_limit_2_rows on public.inventori;
create trigger trg_limit_2_rows before insert on public.inventori
  for each row execute function public.enforce_max_2_rows();

drop trigger if exists trg_limit_2_rows on public.jenis_barang_custom;
create trigger trg_limit_2_rows before insert on public.jenis_barang_custom
  for each row execute function public.enforce_max_2_rows();

drop trigger if exists trg_limit_2_rows on public.gadai;
create trigger trg_limit_2_rows before insert on public.gadai
  for each row execute function public.enforce_max_2_rows();

drop trigger if exists trg_limit_2_rows on public.servis;
create trigger trg_limit_2_rows before insert on public.servis
  for each row execute function public.enforce_max_2_rows();

drop trigger if exists trg_limit_2_rows on public.hutang;
create trigger trg_limit_2_rows before insert on public.hutang
  for each row execute function public.enforce_max_2_rows();

drop trigger if exists trg_limit_2_rows on public.piutang;
create trigger trg_limit_2_rows before insert on public.piutang
  for each row execute function public.enforce_max_2_rows();
