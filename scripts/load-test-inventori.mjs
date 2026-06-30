#!/usr/bin/env node
/**
 * Load test: simulasikan N user nge-klik "Simpan" di halaman Inventori PERSIS BERSAMAAN
 * (Promise.all, bukan satu-satu), untuk verifikasi fix race condition id_item — lihat
 * supabase/migrations/027_id_item_seq.sql.
 *
 * Semua staf di app ini login pakai SATU akun toko yang sama (lihat app/login/page.tsx),
 * jadi script ini login sekali lalu menembak N insert bersamaan dari sesi yang sama —
 * itu sudah merepresentasikan kondisi sebenarnya (N orang, device beda, akun sama).
 *
 * PIN toko TIDAK disimpan di script/repo ini — wajib di-set lewat environment variable
 * tiap kali menjalankan, supaya tidak ke-commit atau ke-log di mana pun.
 *
 * Semua baris yang dibuat ditandai supplier="LOADTEST-<timestamp>" dan otomatis DIHAPUS
 * lagi di akhir run (kecuali pakai --keep).
 *
 * Usage (PowerShell):
 *   $env:TOKO_PIN = "pin-login-toko"
 *   node scripts/load-test-inventori.mjs            # default: 5 "user" bersamaan
 *   node scripts/load-test-inventori.mjs 20          # stress test 20 sekaligus
 *   node scripts/load-test-inventori.mjs 5 --keep    # jangan hapus data test setelah selesai
 *
 * Usage (bash):
 *   TOKO_PIN=pin-login-toko node scripts/load-test-inventori.mjs
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const KEEP = process.argv.includes("--keep");
const N = parseInt(process.argv.slice(2).find((a) => !a.startsWith("--")), 10) || 5;

function loadEnvLocal() {
  const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TOKO_EMAIL = process.env.TOKO_EMAIL || "tokomaskresno5758@gmail.com";
const TOKO_PIN = process.env.TOKO_PIN;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY tidak ditemukan di .env.local");
  process.exit(1);
}
if (!TOKO_PIN) {
  console.error("Set dulu environment variable TOKO_PIN (PIN login toko) sebelum menjalankan script ini.");
  console.error('Contoh PowerShell : $env:TOKO_PIN = "pin-login-toko"');
  console.error("Contoh bash       : export TOKO_PIN=pin-login-toko");
  process.exit(1);
}

const MARKER = `LOADTEST-${Date.now()}`;
const JENIS = "Gelang";
const KODE = "GEL"; // sudah seeded permanen di jenis_barang_kode, lihat KODE_JENIS_SEED
const KADAR = "24K";
const BERAT_GRAM = 1.23;

async function addOneItem(supabase, n) {
  const t0 = Date.now();
  try {
    const { data: seq, error: seqErr } = await supabase.rpc("next_id_item_seq", {
      p_seq_key: `${KADAR}-${KODE}`,
    });
    if (seqErr) throw seqErr;
    const idItem = `${KADAR}-${KODE}-${String(Math.round(BERAT_GRAM * 100)).padStart(4, "0")}-${String(seq).padStart(4, "0")}`;

    const { error: insErr } = await supabase.from("inventori").insert({
      id_item: idItem,
      jenis_barang: JENIS,
      nama_produk: `[LOAD TEST] Gelang simulasi user #${n}`,
      kadar: KADAR,
      berat_gram: BERAT_GRAM,
      jumlah: 1,
      kategori: JENIS,
      persen_modal: 80,
      persen_jual: 100,
      harga_beli: 0,
      harga_jual: 0,
      supplier: MARKER,
      keterangan: "Dibuat otomatis oleh scripts/load-test-inventori.mjs — aman dihapus.",
      tanggal_masuk: new Date().toISOString().split("T")[0],
    });
    if (insErr) throw insErr;
    return { n, ok: true, id_item: idItem, ms: Date.now() - t0 };
  } catch (err) {
    return { n, ok: false, error: err?.message ?? String(err), ms: Date.now() - t0 };
  }
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log(`Login sebagai ${TOKO_EMAIL} ...`);
  const { error: loginErr } = await supabase.auth.signInWithPassword({ email: TOKO_EMAIL, password: TOKO_PIN });
  if (loginErr) {
    console.error("Gagal login:", loginErr.message);
    process.exit(1);
  }

  console.log(`Menembak ${N} insert "Tambah Barang" PERSIS BERSAMAAN (jenis=${JENIS}, kadar=${KADAR}) ...\n`);

  const results = await Promise.all(Array.from({ length: N }, (_, i) => addOneItem(supabase, i + 1)));

  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const uniqueIds = new Set(ok.map((r) => r.id_item));

  console.log("=== Hasil ===");
  for (const r of results) {
    console.log(
      r.ok
        ? `  #${String(r.n).padStart(2)}  OK     ${r.id_item}  (${r.ms} ms)`
        : `  #${String(r.n).padStart(2)}  GAGAL  ${r.error}  (${r.ms} ms)`
    );
  }

  console.log(`\nBerhasil     : ${ok.length}/${N}`);
  console.log(`Gagal        : ${fail.length}/${N}`);
  console.log(
    `id_item unik : ${uniqueIds.size}/${ok.length} ${uniqueIds.size === ok.length ? "(OK, tidak ada tabrakan)" : "(BENTROK! ada id_item duplikat)"}`
  );

  const verdict = fail.length === 0 && uniqueIds.size === ok.length;
  console.log(`\n${verdict ? "✓ PASS" : "✗ FAIL"} — ${verdict ? "aman dipakai banyak user bersamaan." : "masih ada masalah, cek detail di atas."}`);

  if (ok.length > 0) {
    if (!KEEP) {
      console.log(`\nMembersihkan ${ok.length} baris data test (supplier="${MARKER}") ...`);
      const { error: delErr } = await supabase.from("inventori").delete().eq("supplier", MARKER);
      if (delErr) console.warn("  Gagal hapus data test (hapus manual ya):", delErr.message);
      else console.log("  Selesai dibersihkan.");
    } else {
      console.log(`\nData test TIDAK dihapus (--keep). Cari di Inventori dengan Supplier = "${MARKER}" kalau mau cek/hapus manual.`);
    }
  }

  await supabase.auth.signOut();
  process.exit(verdict ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
