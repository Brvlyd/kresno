-- Barcode CODE128 yang meng-encode id_item penuh (mis. "24K-CIN-0149-0001", 17 karakter)
-- kepadetannya kebanyakan buat label fisik 30x20mm — modulnya jadi lebih tipis dari resolusi
-- printer thermal-nya sendiri, jadi scanner gagal baca walau sudah dirapikan tampilannya
-- (lihat juga percobaan sebelumnya: buang tanda "-" saat encode, masih belum cukup renggang).
--
-- Solusinya: barcode encode NOMOR PENDEK ini (bukan id_item), id_item lengkap tetap dicetak
-- sebagai teks biasa di label (manusia tetap baca id_item). 6 digit angka jauh lebih renggang
-- saat di-encode CODE128 (~79 modul vs ~156-211 modul punya id_item penuh).
-- Run in Supabase Dashboard > SQL Editor

-- "unique" otomatis bikin index, jadi lookup saat scan (cari berdasarkan barcode_no) sudah cepat.
alter table public.inventori add column if not exists barcode_no serial unique;
