/* ─── Helpers untuk kode barang & status inventori ─── */

import type { SupabaseClient } from "@supabase/supabase-js";

export const STATUS_OPTIONS = [
  "Tersedia",
  "Terjual",
  "Dalam Servis",
  "Retur",
  "Tidak Laku",
  "Mati Laku",
  "Habis Dijual",
  "Hilang",
] as const;

/** Jenis barang bawaan (di luar yang ditambah sendiri lewat tabel jenis_barang_custom) */
export const JENIS_BARANG_BASE = [
  "Gelang",
  "Kalung",
  "Cincin",
  "Anting",
  "Liontin",
  "Tindik Mata",
  "Tusuk Konde",
  "Lainnya",
];

/** Kode 3-huruf bawaan per jenis_barang — harus sinkron dengan seed di supabase/migrations/019_jenis_barang_kode.sql */
export const KODE_JENIS_SEED: Record<string, string> = {
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

function lettersOnly(word: string): string {
  return word.replace(/[^A-Za-z]/g, "").toUpperCase();
}

/** Kandidat kode 3-huruf untuk sebuah jenis_barang, diurutkan dari yang paling enak dibaca */
function generateKodeCandidates(jenis: string): string[] {
  const words = jenis.trim().split(/\s+/).filter(Boolean).map(lettersOnly).filter(Boolean);
  if (words.length === 0) return ["XXX"];

  const [w1, w2, w3] = words;
  const candidates: string[] = [];

  if (w1.length >= 3) candidates.push(w1.slice(0, 3));
  if (w2) {
    if (w1.length >= 2 && w2.length >= 1) candidates.push((w1.slice(0, 2) + w2.slice(0, 1)).slice(0, 3));
    if (w1.length >= 1 && w2.length >= 2) candidates.push((w1.slice(0, 1) + w2.slice(0, 2)).slice(0, 3));
  }
  if (w3 && w1.length >= 1 && w2.length >= 1 && w3.length >= 1) {
    candidates.push(w1[0] + w2[0] + w3[0]);
  }
  // Geser jendela 3-huruf di sepanjang kata pertama, lalu kata kedua
  for (let i = 1; i + 3 <= w1.length; i++) candidates.push(w1.slice(i, i + 3));
  if (w2) {
    for (let i = 0; i + 3 <= w2.length; i++) candidates.push(w2.slice(i, i + 3));
  }
  if (w1.length < 3) candidates.push(w1.padEnd(3, "X"));

  return candidates;
}

/**
 * Ambil kode 3-huruf untuk sebuah jenis_barang dari peta yang sudah ada,
 * atau generate kandidat baru yang belum bentrok dengan kode lain.
 * Pemanggil bertanggung jawab menyimpan hasil baru (isNew: true) ke tabel jenis_barang_kode.
 */
export function kodeForJenis(
  jenis: string,
  kodeMap: Record<string, string>
): { kode: string; isNew: boolean } {
  const trimmed = jenis.trim();
  if (kodeMap[trimmed]) return { kode: kodeMap[trimmed], isNew: false };

  const used = new Set(Object.values(kodeMap).map((k) => k.toUpperCase()));
  for (const candidate of generateKodeCandidates(trimmed)) {
    if (candidate.length === 3 && !used.has(candidate)) {
      return { kode: candidate, isNew: true };
    }
  }
  // Fallback terakhir (praktis tidak akan tercapai): 1 huruf + 2 digit
  const base = lettersOnly(trimmed.split(/\s+/)[0] ?? "")[0] ?? "X";
  for (let n = 1; n < 100; n++) {
    const candidate = `${base}${String(n).padStart(2, "0")}`;
    if (!used.has(candidate)) return { kode: candidate, isNew: true };
  }
  throw new Error(`Tidak bisa membuat kode unik untuk jenis "${jenis}"`);
}

/** Format id_item LAMA (barang yang ditambahkan sebelum dipendekkan):
 *  {karat 2 digit}K-{kode 3 huruf}-{berat gram x100, 4 digit}-{urutan, 4 digit} */
const ID_ITEM_RE_LAMA = /^(\d{1,2})K-([A-Z0-9]+)-(\d+)-(\d+)$/i;

/** Format id_item TERBARU (ringkas, idealnya <=10 karakter — barcode yang discan sudah
 *  pakai barcode_no terpisah, jadi id_item bebas dipendekkan demi keterbacaan teksnya):
 *  {karat 2 digit}{kode 3 huruf}{berat gram dibulatkan, 2 digit}{urutan, >=3 digit}.
 *  Urutan bisa melebar lebih dari 3 digit kalau 1 kombinasi karat+jenis sudah dipakai
 *  >999 kali — jarang terjadi, dibiarkan melebar drpd tabrakan/kehilangan data. */
const ID_ITEM_RE_BARU = /^(\d{2})([A-Z0-9]{3})(\d{2})(\d{3,})$/i;

/** "24K", "6K", "18.5K" -> "24K", "06K", "19K" (karat dibulatkan, selalu 2 digit) */
function formatKaratKode(kadar: string): string {
  const num = Math.round(parseFloat(kadar.trim()) || 0);
  return `${String(Math.max(0, num)).padStart(2, "0")}K`;
}

/** 1.49 (gram) -> "01" — cuma tag cepat dikenali di id_item, DIBULATKAN ke gram bulat
 *  (bukan acuan harga; kolom berat_gram di database tetap presisi penuh, tidak kepengaruh). */
function formatBeratKodeRingkas(beratGram: number): string {
  const gram = Math.min(99, Math.max(0, Math.round(beratGram)));
  return String(gram).padStart(2, "0");
}

/** Hitung nomor urut terakhir per-(karat, kode) dari daftar id_item yang sudah ada
 *  (format lama maupun baru, supaya pratinjau nomor urut tetap nyambung). */
export function buildSeqCounters(existing: { id_item: string }[]): Map<string, number> {
  const counters = new Map<string, number>();
  for (const item of existing) {
    const lama = item.id_item.match(ID_ITEM_RE_LAMA);
    const match = lama ?? item.id_item.match(ID_ITEM_RE_BARU);
    if (!match) continue;
    const [, karatDigits, kode, , urutan] = match;
    const key = `${karatDigits.padStart(2, "0")}K-${kode.toUpperCase()}`;
    const num = parseInt(urutan, 10);
    const current = counters.get(key) ?? 0;
    if (num > current) counters.set(key, num);
  }
  return counters;
}

/** Key counter per (karat, kode) — dipakai baik oleh counter lokal maupun fungsi atomik di DB (next_id_item_seq) */
function idItemSeqKey(kadar: string, kode: string): string {
  return `${formatKaratKode(kadar)}-${kode.trim().toUpperCase()}`;
}

/** Rakit id_item final dari nomor urut yang sudah didapat — format ringkas tanpa "-" */
function formatIdItem(kadar: string, kode: string, beratGram: number, seq: number): string {
  const karatDigits = formatKaratKode(kadar).replace("K", "");
  const kodeUpper = kode.trim().toUpperCase();
  return `${karatDigits}${kodeUpper}${formatBeratKodeRingkas(beratGram)}${String(seq).padStart(3, "0")}`;
}

/**
 * Barcode yang dicetak meng-encode id_item TANPA tanda "-" (CODE128-nya jadi lebih
 * renggang/gampang discan — dashes hanya pemanis tampilan, bukan data). Tapi label
 * lama yang sudah dicetak sebelum perubahan ini masih meng-encode id_item APA ADANYA
 * (dengan "-"). Dipakai untuk mencocokkan hasil scan ke id_item di database terlepas
 * dari label mana yang dipakai (lama atau baru).
 */
export function idItemScanCandidates(rawCode: string): string[] {
  const code = rawCode.trim().toUpperCase();
  const candidates = new Set([code]);
  // Format id_item 4-bagian: {2 digit karat}K-{3 kode}-{4 berat}-{4 urutan} = 17 char
  // dengan "-", 14 char tanpa "-". Sisipkan kembali "-" di posisi yang sama supaya
  // cocok dengan id_item asli di database.
  if (!code.includes("-") && code.length === 14) {
    candidates.add(`${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6, 10)}-${code.slice(10, 14)}`);
  }
  return Array.from(candidates);
}

/**
 * Cocokkan hasil scan ke 1 barang, terlepas dari format barcode mana yang dipakai saat
 * label itu dicetak: id_item lengkap dengan "-" (label paling lama), id_item tanpa "-"
 * (percobaan sebelumnya), id_item_lama — id_item versi sebelum diringkas (lihat migration
 * 029, dipakai barang yang sudah ada sebelum format ringkas berlaku), atau barcode_no —
 * nomor pendek dari DB (lihat migration 028, format terbaru, paling renggang/gampang discan).
 */
export function matchesBarcodeScan(
  idItem: string,
  barcodeNo: number | null | undefined,
  idItemLama: string | null | undefined,
  scanCode: string
): boolean {
  const scanned = scanCode.trim().toUpperCase();
  const normalized = scanned.replace(/-/g, "");
  if (idItem.toUpperCase().replace(/-/g, "") === normalized) return true;
  if (idItemLama && idItemLama.toUpperCase().replace(/-/g, "") === normalized) return true;
  if (barcodeNo != null && /^\d+$/.test(scanned) && Number(scanned) === barcodeNo) return true;
  return false;
}

/**
 * Buat id_item berikutnya untuk sebuah (kadar, kode, berat), dan perbarui counter-nya.
 * HANYA dipakai untuk pratinjau lokal (live preview) di form — bisa beda dari yang akhirnya
 * tersimpan kalau ada user lain yang nambah barang di waktu yang sama. Untuk id_item yang
 * benar-benar disimpan ke DB, pakai nextIdItemAtomic supaya tidak race.
 */
export function nextIdItem(kadar: string, kode: string, beratGram: number, counters: Map<string, number>): string {
  const key = idItemSeqKey(kadar, kode);
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return formatIdItem(kadar, kode, beratGram, next);
}

/**
 * Versi aman-konkurensi dari nextIdItem: nomor urut diambil lewat fungsi Postgres
 * next_id_item_seq, yang meng-increment counter per (karat, kode) di dalam satu UPSERT —
 * Postgres mengunci baris counter-nya sehingga dua submit yang terjadi bersamaan dari
 * device berbeda TIDAK PERNAH bisa mendapat nomor urut (dan karenanya id_item) yang sama.
 * Panggil ini tepat sebelum insert ke tabel inventori, bukan saat preview reaktif di form.
 */
export async function nextIdItemAtomic(
  supabase: SupabaseClient,
  kadar: string,
  kode: string,
  beratGram: number
): Promise<string> {
  const { data, error } = await supabase.rpc("next_id_item_seq", {
    p_seq_key: idItemSeqKey(kadar, kode),
  });
  if (error) throw error;
  return formatIdItem(kadar, kode, beratGram, data as number);
}

export function normalizeStatus(value: string): string {
  const trimmed = value.trim();
  const found = STATUS_OPTIONS.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  return found ?? "Tersedia";
}
