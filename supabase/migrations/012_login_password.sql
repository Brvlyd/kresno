-- Password masuk halaman awal (sebelum dashboard). Disimpan di Supabase (terpusat),
-- supaya "Reset Password" lewat email bisa benar-benar mengubah password yang berlaku
-- untuk semua device. Single-row table (id selalu 1).
-- Run in Supabase Dashboard > SQL Editor

create table if not exists public.login_password (
  id smallint primary key default 1,
  password text not null default '1111',
  updated_at timestamptz default now(),
  constraint login_password_single_row check (id = 1)
);

insert into public.login_password (id, password) values (1, '1111')
on conflict (id) do nothing;

alter table public.login_password enable row level security;

create policy "allow read login_password" on public.login_password for select using (true);
create policy "allow all login_password" on public.login_password for all using (true) with check (true);
