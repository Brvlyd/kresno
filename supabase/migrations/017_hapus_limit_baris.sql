-- Hapus batasan jumlah baris (sebelumnya 5, lihat 015_limit_5_baris_per_table.sql).
-- Sistem sudah dipakai produksi sungguhan, bukan demo lagi, jadi pembatasan ini
-- tidak lagi relevan dan justru menggagalkan penyimpanan data baru
-- (contoh: error "Tabel inventori sudah mencapai batas maksimum 5 baris" saat
-- menyimpan Pembelian Rosok / Tambah Barang di halaman Inventori).
-- Run in Supabase Dashboard > SQL Editor

drop trigger if exists trg_limit_5_rows on public.harga_emas;
drop trigger if exists trg_limit_5_rows on public.karyawan;
drop trigger if exists trg_limit_5_rows on public.pelanggan;
drop trigger if exists trg_limit_5_rows on public.inventori;
drop trigger if exists trg_limit_5_rows on public.jenis_barang_custom;
drop trigger if exists trg_limit_5_rows on public.gadai;
drop trigger if exists trg_limit_5_rows on public.servis;
drop trigger if exists trg_limit_5_rows on public.hutang;
drop trigger if exists trg_limit_5_rows on public.piutang;

drop function if exists public.enforce_max_5_rows();
