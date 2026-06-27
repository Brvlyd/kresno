-- Terjemahkan nilai status_laporan yang masih berbahasa Inggris ke Bahasa
-- Indonesia, supaya konsisten dengan label baru di halaman Inventori & Dashboard.
-- Kolom ini dibatasi oleh check constraint dari 001_dashboard.sql yang hanya
-- mengizinkan nilai lama (Draft/Approval Checker/Approval Signer/Approved/
-- Rejected) — harus diganti dulu sebelum data lama bisa diupdate.
-- Run in Supabase Dashboard > SQL Editor

-- 1. Lepas check constraint & default lama
alter table public.inventori drop constraint if exists inventori_status_laporan_check;
alter table public.inventori alter column status_laporan drop default;

-- 2. Terjemahkan data lama ke Bahasa Indonesia
update public.inventori set status_laporan = 'Draf' where status_laporan = 'Draft';
update public.inventori set status_laporan = 'Persetujuan Pemeriksa' where status_laporan = 'Approval Checker';
update public.inventori set status_laporan = 'Persetujuan Penandatangan' where status_laporan = 'Approval Signer';
update public.inventori set status_laporan = 'Disetujui' where status_laporan = 'Approved';
update public.inventori set status_laporan = 'Ditolak' where status_laporan = 'Rejected';

-- 3. Pasang check constraint & default baru (Bahasa Indonesia)
alter table public.inventori alter column status_laporan set default 'Draf';
alter table public.inventori add constraint inventori_status_laporan_check
  check (status_laporan in ('Draf','Persetujuan Pemeriksa','Persetujuan Penandatangan','Disetujui','Ditolak'));
