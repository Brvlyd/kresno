-- Migration 001_dashboard.sql menyertakan "seed sample data" yang ikut nge-insert
-- data REKAAN langsung ke tabel produksi: karyawan, pelanggan, inventori, & harga
-- emas (lihat 001_dashboard.sql baris 73-101). Kalau migration itu sudah pernah
-- dijalankan di database ini, data dummy berikut MASIH ADA dan tampil di app:
--   - karyawan : Budi Santoso, Siti Rahayu, Ahmad Fauzi, Dewi Lestari, Rina Wati
--   - pelanggan: Pak Hendra, Bu Sari, Pak Dedi
--   - inventori: GE0001, GE0005, KA011, CI039, KA020, CI007
--   - harga_emas: baris dengan harga_beli/harga_jual 1050000/1100000 (24K),
--                 960000/1005000 (22K), 785000/820000 (18K)
--
-- PENTING — jalankan SELECT preview di bawah dulu sebelum DELETE, supaya Anda
-- bisa pastikan baris yang kena hapus benar-benar baris seed (bukan data asli
-- toko yang kebetulan namanya sama). Cocokkan KOMBINASI beberapa kolom (bukan
-- cuma satu) supaya tidak salah hapus data asli.
-- Run in Supabase Dashboard > SQL Editor

-- ── 1. PREVIEW dulu — jalankan select ini, periksa hasilnya ──
-- select * from public.karyawan
--   where (nama, jabatan) in (
--     ('Budi Santoso','Kasir'), ('Siti Rahayu','Admin'), ('Ahmad Fauzi','Tukang Emas'),
--     ('Dewi Lestari','Kepala Toko'), ('Rina Wati','Kasir')
--   );
-- select * from public.pelanggan
--   where (nama, telepon) in (
--     ('Pak Hendra','08123456789'), ('Bu Sari','08234567890'), ('Pak Dedi','08345678901')
--   );
-- select * from public.inventori
--   where (id_item, nama_produk) in (
--     ('GE0001','Cincin Berlian Solitaire'), ('GE0005','Kalung Rantai Singapur'),
--     ('KA011','Gelang Bangle Motif Bunga'), ('CI039','Cincin Couple Polos'),
--     ('KA020','Liontin Hati'), ('CI007','Cincin Batu Permata')
--   );
-- select * from public.harga_emas
--   where (karat, harga_beli, harga_jual) in ((24,1050000,1100000),(22,960000,1005000),(18,785000,820000));

-- ── 2. Hapus baris seed — aman dijalankan berkali-kali, no-op kalau sudah bersih ──
delete from public.karyawan
where (nama, jabatan) in (
  ('Budi Santoso','Kasir'), ('Siti Rahayu','Admin'), ('Ahmad Fauzi','Tukang Emas'),
  ('Dewi Lestari','Kepala Toko'), ('Rina Wati','Kasir')
);

delete from public.pelanggan
where (nama, telepon) in (
  ('Pak Hendra','08123456789'), ('Bu Sari','08234567890'), ('Pak Dedi','08345678901')
);

-- inventori_keluar.inventori_id sudah "on delete set null", jadi aman dihapus —
-- riwayat transaksi (kalau ada yang kebetulan menjual barang seed ini saat testing)
-- tidak akan ikut terhapus, hanya tautannya ke barang yang null.
delete from public.inventori
where (id_item, nama_produk) in (
  ('GE0001','Cincin Berlian Solitaire'), ('GE0005','Kalung Rantai Singapur'),
  ('KA011','Gelang Bangle Motif Bunga'), ('CI039','Cincin Couple Polos'),
  ('KA020','Liontin Hati'), ('CI007','Cincin Batu Permata')
);

delete from public.harga_emas
where (karat, harga_beli, harga_jual) in ((24,1050000,1100000),(22,960000,1005000),(18,785000,820000));
