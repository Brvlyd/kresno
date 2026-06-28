-- Tutup celah keamanan: semua policy lama "using (true)" / "with check (true)"
-- mengizinkan SIAPA PUN dengan anon key (yang memang ikut terkirim ke setiap
-- browser) membaca & menulis seluruh data toko langsung lewat REST API
-- Supabase, tanpa login sama sekali. Ganti jadi auth.role() = 'authenticated'.
--
-- PENTING — urutan penerapan:
-- Jangan jalankan migration ini sebelum app/login (Supabase Auth asli) sudah
-- berjalan & diverifikasi di production (lihat 020 dan perubahan app/login,
-- proxy.ts, app/otp). Begitu migration ini jalan, anon key TIDAK BISA lagi
-- baca/tulis apa pun — kalau login real-auth belum siap, aplikasi akan rusak
-- total untuk semua orang.
-- Run in Supabase Dashboard > SQL Editor

-- ── Tabel ──
do $$
declare
  t text;
  tables text[] := array[
    'harga_emas', 'karyawan', 'pelanggan', 'inventori',
    'inventori_keluar', 'jenis_barang_custom',
    'gadai', 'gadai_cicilan', 'gadai_barang',
    'servis', 'hutang', 'piutang',
    'keuangan_pin', 'login_password', 'jenis_barang_kode'
  ];
begin
  foreach t in array tables loop
    -- Nama policy adalah IDENTIFIER (%I), bukan string literal (%L) —
    -- pakai %L di sini menghasilkan "drop policy 'nama'..." yang gagal parse.
    execute format('drop policy if exists %I on public.%I', 'allow read ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'allow all ' || t, t);
    execute format(
      'create policy %I on public.%I for select using (auth.role() = ''authenticated'')',
      'authenticated read ' || t, t
    );
    execute format(
      'create policy %I on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      'authenticated all ' || t, t
    );
  end loop;
end $$;

-- ── Storage buckets: tidak lagi public, dan object policy butuh auth ──
update storage.buckets set public = false
where id in ('inventori-images', 'pegadaian-images', 'servis-images');

do $$
declare
  b text;
  buckets text[] := array['inventori-images', 'pegadaian-images', 'servis-images'];
begin
  foreach b in array buckets loop
    execute format('drop policy if exists %I on storage.objects', b || ' public read');
    execute format('drop policy if exists %I on storage.objects', b || ' public write');
    execute format('drop policy if exists %I on storage.objects', b || ' public update');
    execute format('drop policy if exists %I on storage.objects', b || ' public delete');

    execute format(
      'create policy %I on storage.objects for select using (bucket_id = %L and auth.role() = ''authenticated'')',
      b || ' authenticated read', b
    );
    execute format(
      'create policy %I on storage.objects for insert with check (bucket_id = %L and auth.role() = ''authenticated'')',
      b || ' authenticated write', b
    );
    execute format(
      'create policy %I on storage.objects for update using (bucket_id = %L and auth.role() = ''authenticated'')',
      b || ' authenticated update', b
    );
    execute format(
      'create policy %I on storage.objects for delete using (bucket_id = %L and auth.role() = ''authenticated'')',
      b || ' authenticated delete', b
    );
  end loop;
end $$;
