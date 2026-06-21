-- PIN halaman /keuangan dipindah dari localStorage (per-browser) ke Supabase (terpusat),
-- supaya "Lupa PIN" lewat email bisa benar-benar mengubah PIN yang berlaku untuk semua device.
-- Single-row table (id selalu 1).
-- Run in Supabase Dashboard > SQL Editor

create table if not exists public.keuangan_pin (
  id smallint primary key default 1,
  pin text not null default '1234',
  updated_at timestamptz default now(),
  constraint keuangan_pin_single_row check (id = 1)
);

insert into public.keuangan_pin (id, pin) values (1, '1234')
on conflict (id) do nothing;

alter table public.keuangan_pin enable row level security;

create policy "allow read keuangan_pin" on public.keuangan_pin for select using (true);
create policy "allow all keuangan_pin" on public.keuangan_pin for all using (true) with check (true);
