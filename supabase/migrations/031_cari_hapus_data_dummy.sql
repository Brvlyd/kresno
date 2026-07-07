-- Cari & hapus data dummy/tes di SELURUH tabel transaksi (bukan cuma inventori):
-- karyawan, pelanggan, inventori, inventori_keluar, gadai (+gadai_barang/gadai_cicilan),
-- servis, hutang, piutang, dan tabel master data custom (jenis_barang_custom, dll).
--
-- PENTING — jangan langsung jalankan bagian DELETE. Urutannya:
--   1. Jalankan SETIAP query SELECT di bawah satu-satu, periksa hasilnya.
--   2. Kalau ada baris yang KELIRU ketangkep (misal nama pelanggan asli yang
--      kebetulan mengandung kata seperti "test"/"coba"), sesuaikan dulu filter
--      ILIKE-nya atau kecualikan id-nya secara eksplisit sebelum hapus.
--   3. Baru jalankan blok DELETE yang berpasangan dengan SELECT itu.
-- Kata kunci di bawah cuma tebakan pola umum nama data tes — cek manual tetap wajib.
-- Run in Supabase Dashboard > SQL Editor

-- Pola kata kunci dummy/tes yang umum dipakai saat testing manual.
-- (didefinisikan berulang di tiap query karena SQL biasa tidak punya variabel lintas-statement)

-- ────────────────────────────────────────────────────────────
-- 1. KARYAWAN
-- ────────────────────────────────────────────────────────────
select * from public.karyawan
where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%','%asdf%','%qwerty%'])
   or jabatan ilike any (array['%test%','%dummy%','%contoh%','%sample%']);

-- delete from public.karyawan
-- where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%','%asdf%','%qwerty%'])
--    or jabatan ilike any (array['%test%','%dummy%','%contoh%','%sample%']);

-- ────────────────────────────────────────────────────────────
-- 2. PELANGGAN
-- ────────────────────────────────────────────────────────────
select * from public.pelanggan
where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%','%asdf%','%qwerty%'])
   or telepon in ('08123456789','08234567890','08345678901','123456789','000000000');

-- delete from public.pelanggan
-- where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%','%asdf%','%qwerty%'])
--    or telepon in ('08123456789','08234567890','08345678901','123456789','000000000');

-- ────────────────────────────────────────────────────────────
-- 3. INVENTORI (barang stok toko)
-- ────────────────────────────────────────────────────────────
-- 3a. Seed dummy lama dari migration 001 (lihat 023_hapus_seed_dummy_001.sql) —
--     ulang di sini untuk jaga-jaga kalau 023 belum pernah dijalankan.
select * from public.inventori
where (id_item, nama_produk) in (
  ('GE0001','Cincin Berlian Solitaire'), ('GE0005','Kalung Rantai Singapur'),
  ('KA011','Gelang Bangle Motif Bunga'), ('CI039','Cincin Couple Polos'),
  ('KA020','Liontin Hati'), ('CI007','Cincin Batu Permata')
);

-- 3b. Pola nama tes umum
select * from public.inventori
where nama_produk ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%','%asdf%','%qwerty%'])
   or id_item ilike any (array['%test%','%dummy%','%xxx%']);

-- delete from public.inventori
-- where (id_item, nama_produk) in (
--   ('GE0001','Cincin Berlian Solitaire'), ('GE0005','Kalung Rantai Singapur'),
--   ('KA011','Gelang Bangle Motif Bunga'), ('CI039','Cincin Couple Polos'),
--   ('KA020','Liontin Hati'), ('CI007','Cincin Batu Permata')
-- );
-- delete from public.inventori
-- where nama_produk ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%','%asdf%','%qwerty%'])
--    or id_item ilike any (array['%test%','%dummy%','%xxx%']);

-- ────────────────────────────────────────────────────────────
-- 4. INVENTORI_KELUAR (riwayat barang keluar/terjual)
-- ────────────────────────────────────────────────────────────
-- Baris ini biasanya ikut kehapus otomatis kalau inventori induknya dihapus
-- (relasi dibuat "on delete set null" — lihat 004_inventori_keluar.sql), tapi
-- cek juga langsung siapa tahu ada riwayat tes yang barangnya sudah tidak ada.
select * from public.inventori_keluar
where nama_produk ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
   or catatan ilike any (array['%test%','%dummy%','%coba%']);

-- delete from public.inventori_keluar
-- where nama_produk ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
--    or catatan ilike any (array['%test%','%dummy%','%coba%']);

-- ────────────────────────────────────────────────────────────
-- 5. GADAI (+ gadai_barang, gadai_cicilan ikut lewat on delete cascade)
-- ────────────────────────────────────────────────────────────
select * from public.gadai
where pelanggan_nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
   or nama_barang ilike any (array['%test%','%dummy%','%contoh%','%sample%'])
   or catatan ilike any (array['%test%','%dummy%']);

-- delete from public.gadai
-- where pelanggan_nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
--    or nama_barang ilike any (array['%test%','%dummy%','%contoh%','%sample%'])
--    or catatan ilike any (array['%test%','%dummy%']);

-- ────────────────────────────────────────────────────────────
-- 6. SERVIS
-- ────────────────────────────────────────────────────────────
select * from public.servis
where pelanggan_nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
   or nama_barang ilike any (array['%test%','%dummy%','%contoh%','%sample%'])
   or catatan_kerusakan ilike any (array['%test%','%dummy%'])
   or catatan_tambahan ilike any (array['%test%','%dummy%']);

-- delete from public.servis
-- where pelanggan_nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
--    or nama_barang ilike any (array['%test%','%dummy%','%contoh%','%sample%'])
--    or catatan_kerusakan ilike any (array['%test%','%dummy%'])
--    or catatan_tambahan ilike any (array['%test%','%dummy%']);

-- ────────────────────────────────────────────────────────────
-- 7. HUTANG
-- ────────────────────────────────────────────────────────────
select * from public.hutang
where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
   or kategori ilike any (array['%test%','%dummy%']);

-- delete from public.hutang
-- where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
--    or kategori ilike any (array['%test%','%dummy%']);

-- ────────────────────────────────────────────────────────────
-- 8. PIUTANG
-- ────────────────────────────────────────────────────────────
select * from public.piutang
where nama_debitur ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
   or kategori ilike any (array['%test%','%dummy%'])
   or catatan_penagihan ilike any (array['%test%','%dummy%']);

-- delete from public.piutang
-- where nama_debitur ilike any (array['%test%','%dummy%','%contoh%','%sample%','%percobaan%','%uji coba%'])
--    or kategori ilike any (array['%test%','%dummy%'])
--    or catatan_penagihan ilike any (array['%test%','%dummy%']);

-- ────────────────────────────────────────────────────────────
-- 9. HARGA_EMAS — seed dummy lama dari migration 001 (lihat 023)
-- ────────────────────────────────────────────────────────────
select * from public.harga_emas
where (karat, harga_beli, harga_jual) in ((24,1050000,1100000),(22,960000,1005000),(18,785000,820000));

-- delete from public.harga_emas
-- where (karat, harga_beli, harga_jual) in ((24,1050000,1100000),(22,960000,1005000),(18,785000,820000));

-- ────────────────────────────────────────────────────────────
-- 10. MASTER DATA CUSTOM (dropdown tambahan buatan user)
--     jenis_barang_kode TIDAK dicek di sini — isinya kategori baku
--     (Cincin/Kalung/dll dari migration 019), bukan data dummy.
-- ────────────────────────────────────────────────────────────
select * from public.jenis_barang_custom where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);
select * from public.jenis_kerusakan_custom where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);
select * from public.jenis_tindakan_custom where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);
select * from public.kadar_master where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);
select * from public.nama_barang_riwayat where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);

-- delete from public.jenis_barang_custom where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);
-- delete from public.jenis_kerusakan_custom where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);
-- delete from public.jenis_tindakan_custom where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);
-- delete from public.kadar_master where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);
-- delete from public.nama_barang_riwayat where nama ilike any (array['%test%','%dummy%','%contoh%','%sample%','%asdf%']);
