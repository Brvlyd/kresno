#!/usr/bin/env node
/**
 * One-off migration: regenerate semua `inventori.id_item` dari format lama
 * ({PREFIX 2 huruf}{4 digit}, mis. "CN0040") ke format baru
 * ({kadar}-{kode jenis 3 huruf}-{urutan 3 digit}, mis. "6K-CIN-001").
 *
 * Logic kode-3-huruf di sini SENGAJA diduplikasi dari lib/csv.ts (bukan di-import)
 * supaya script ini berdiri sendiri tanpa perlu toolchain TS/path-alias Next.js.
 * Kalau algoritma kodeForJenis di lib/csv.ts diubah, sinkronkan juga di sini.
 *
 * Default: DRY RUN — hanya print mapping id_item lama -> baru, tidak menulis apa pun.
 * Tambah --apply untuk benar-benar menulis ke database.
 *
 * Usage:
 *   node scripts/migrate-id-item.mjs            # dry run
 *   node scripts/migrate-id-item.mjs --apply     # benar-benar update
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

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
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY tidak ditemukan di .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─── Duplikasi dari lib/csv.ts — harus tetap sinkron ─── */
const KODE_JENIS_SEED = {
  "Cincin": "CIN",
  "Anting": "ANT",
  "Gelang": "GEL",
  "Liontin": "LIO",
  "Kalung": "KAL",
  "Tindik Mata": "TDM",
  "Tusuk Konde": "TUS",
  "Lainnya": "LAI",
  "Emas Rosok": "EMA",
};

function lettersOnly(word) {
  return word.replace(/[^A-Za-z]/g, "").toUpperCase();
}

function generateKodeCandidates(jenis) {
  const words = jenis.trim().split(/\s+/).filter(Boolean).map(lettersOnly).filter(Boolean);
  if (words.length === 0) return ["XXX"];
  const [w1, w2, w3] = words;
  const candidates = [];
  if (w1.length >= 3) candidates.push(w1.slice(0, 3));
  if (w2) {
    if (w1.length >= 2 && w2.length >= 1) candidates.push((w1.slice(0, 2) + w2.slice(0, 1)).slice(0, 3));
    if (w1.length >= 1 && w2.length >= 2) candidates.push((w1.slice(0, 1) + w2.slice(0, 2)).slice(0, 3));
  }
  if (w3 && w1.length >= 1 && w2.length >= 1 && w3.length >= 1) {
    candidates.push(w1[0] + w2[0] + w3[0]);
  }
  for (let i = 1; i + 3 <= w1.length; i++) candidates.push(w1.slice(i, i + 3));
  if (w2) {
    for (let i = 0; i + 3 <= w2.length; i++) candidates.push(w2.slice(i, i + 3));
  }
  if (w1.length < 3) candidates.push(w1.padEnd(3, "X"));
  return candidates;
}

function kodeForJenis(jenis, kodeMap) {
  const trimmed = jenis.trim();
  if (kodeMap[trimmed]) return { kode: kodeMap[trimmed], isNew: false };
  const used = new Set(Object.values(kodeMap).map((k) => k.toUpperCase()));
  for (const candidate of generateKodeCandidates(trimmed)) {
    if (candidate.length === 3 && !used.has(candidate)) return { kode: candidate, isNew: true };
  }
  const base = lettersOnly(trimmed.split(/\s+/)[0] ?? "")[0] ?? "X";
  for (let n = 1; n < 100; n++) {
    const candidate = `${base}${String(n).padStart(2, "0")}`;
    if (!used.has(candidate)) return { kode: candidate, isNew: true };
  }
  throw new Error(`Tidak bisa membuat kode unik untuk jenis "${jenis}"`);
}
/* ─── End duplikasi ─── */

const KADAR_RE = /^\d+(\.\d+)?K$/i;

async function main() {
  const [{ data: kodeRows, error: kodeErr }, { data: customRows }, { data: invRows, error: invErr }] =
    await Promise.all([
      supabase.from("jenis_barang_kode").select("nama,kode"),
      supabase.from("jenis_barang_custom").select("nama"),
      supabase.from("inventori").select("id,id_item,jenis_barang,kadar,created_at").order("created_at", { ascending: true }),
    ]);

  if (kodeErr) throw kodeErr;
  if (invErr) throw invErr;

  const kodeMap = { ...KODE_JENIS_SEED };
  for (const r of kodeRows ?? []) kodeMap[r.nama] = r.kode;

  // Pastikan semua jenis_barang yang dipakai (di inventori + custom) punya kode
  const namaPerlu = new Set([
    ...(invRows ?? []).map((r) => (r.jenis_barang ?? "").trim()).filter(Boolean),
    ...(customRows ?? []).map((r) => r.nama),
  ]);
  const kodeBaru = []; // { nama, kode } yang perlu di-insert ke jenis_barang_kode
  for (const nama of [...namaPerlu].sort((a, b) => a.localeCompare(b))) {
    const { kode, isNew } = kodeForJenis(nama, kodeMap);
    if (isNew) {
      kodeMap[nama] = kode;
      kodeBaru.push({ nama, kode });
    }
  }

  // Susun id_item baru per (kadar, kode), urut created_at supaya urutan masuk tetap terjaga
  const counters = new Map();
  const mapping = []; // { id, old, new, jenis, kadar }
  const skipped = []; // { id, old, jenis, kadar, alasan }

  for (const row of invRows ?? []) {
    const jenis = (row.jenis_barang ?? "").trim();
    const kadarTrimmed = (row.kadar ?? "").trim().toUpperCase();
    if (!jenis) { skipped.push({ ...row, alasan: "jenis_barang kosong" }); continue; }
    if (!KADAR_RE.test(kadarTrimmed)) { skipped.push({ ...row, alasan: `kadar tidak valid: "${row.kadar}"` }); continue; }
    const kode = kodeMap[jenis];
    if (!kode) { skipped.push({ ...row, alasan: `tidak ada kode untuk jenis "${jenis}"` }); continue; }

    const key = `${kadarTrimmed}-${kode}`;
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    const newIdItem = `${kadarTrimmed}-${kode}-${String(next).padStart(3, "0")}`;
    mapping.push({ id: row.id, old: row.id_item, new: newIdItem, jenis, kadar: kadarTrimmed });
  }

  console.log(`\n=== ${APPLY ? "APPLY" : "DRY RUN"} — migrate-id-item ===\n`);

  if (kodeBaru.length) {
    console.log(`Kode jenis baru yang akan ditambahkan (${kodeBaru.length}):`);
    for (const k of kodeBaru) console.log(`  ${k.nama.padEnd(20)} -> ${k.kode}`);
    console.log();
  }

  console.log(`Akan diregenerasi: ${mapping.length} baris`);
  for (const m of mapping) {
    const changed = m.old !== m.new ? "" : "  (sama)";
    console.log(`  ${m.old.padEnd(14)} -> ${m.new.padEnd(14)}  [${m.jenis} / ${m.kadar}]${changed}`);
  }

  if (skipped.length) {
    console.log(`\nDilewati / TIDAK diubah (${skipped.length}):`);
    for (const s of skipped) console.log(`  ${s.id_item ?? "(tanpa id_item)"}  — ${s.alasan}`);
  }

  if (!APPLY) {
    console.log("\nIni masih dry run. Jalankan dengan --apply untuk benar-benar menulis ke database.");
    return;
  }

  console.log("\nMenerapkan perubahan...");

  if (kodeBaru.length) {
    const { error } = await supabase.from("jenis_barang_kode").insert(kodeBaru);
    if (error) console.warn("  Peringatan saat insert jenis_barang_kode:", error.message);
  }

  // Tahap 1: pindahkan dulu ke placeholder unik supaya tidak bentrok unique constraint
  for (const m of mapping) {
    if (m.old === m.new) continue;
    const { error } = await supabase.from("inventori").update({ id_item: `TMP-${m.id}` }).eq("id", m.id);
    if (error) console.warn(`  Gagal set placeholder untuk ${m.old}:`, error.message);
  }

  // Tahap 2: set ke nilai final
  let updated = 0;
  for (const m of mapping) {
    if (m.old === m.new) continue;
    const { error } = await supabase.from("inventori").update({ id_item: m.new }).eq("id", m.id);
    if (error) console.warn(`  Gagal update ${m.old} -> ${m.new}:`, error.message);
    else updated++;
  }

  console.log(`\nSelesai. ${updated} id_item berhasil diregenerasi, ${skipped.length} dilewati.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
