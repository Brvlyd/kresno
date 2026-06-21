-- ============================================================
-- Modul Hutang & Piutang
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Hutang (toko berhutang ke supplier/sales atau pihak ke-3)
create table if not exists public.hutang (
  id uuid primary key default gen_random_uuid(),
  no_hutang text unique not null,
  jenis_hutang text not null check (jenis_hutang in ('supplier','operasional')),

  nama text not null,
  kategori text not null,

  -- Rumus pengambilan barang (hanya untuk jenis_hutang = 'supplier')
  berat_emas_gram numeric(8,2),
  persentase_harga numeric(6,2),
  kadar_karat smallint,
  hasil numeric(10,2),
  hasil_akhir numeric(10,2),

  -- Rumus nota
  harga_per_gram bigint,
  harga_total bigint not null default 0,

  pembayaran_pelunasan text check (pembayaran_pelunasan in ('Emas','Uang','Emas Rosok')),
  status text not null default 'Belum Lunas' check (status in ('Lunas','Belum Lunas')),
  tanggal_jatuh_tempo date not null default current_date,
  tanggal_pelunasan date,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Piutang (toko meminjamkan ke pihak lain — biasanya dari servis/gadai)
create table if not exists public.piutang (
  id uuid primary key default gen_random_uuid(),
  no_piutang text unique not null,
  sumber text not null check (sumber in ('Servis','Gadai','Lainnya')),

  nama_debitur text not null,
  kategori text not null,
  jumlah_piutang bigint not null default 0,
  referensi text,
  catatan_penagihan text,

  status text not null default 'Belum Lunas' check (status in ('Lunas','Belum Lunas')),
  tanggal_jatuh_tempo date not null default current_date,
  tanggal_pelunasan date,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── RLS ──
alter table public.hutang enable row level security;
alter table public.piutang enable row level security;

drop policy if exists "allow read hutang" on public.hutang;
create policy "allow read hutang" on public.hutang for select using (true);
drop policy if exists "allow all hutang" on public.hutang;
create policy "allow all hutang" on public.hutang for all using (true) with check (true);

drop policy if exists "allow read piutang" on public.piutang;
create policy "allow read piutang" on public.piutang for select using (true);
drop policy if exists "allow all piutang" on public.piutang;
create policy "allow all piutang" on public.piutang for all using (true) with check (true);
