/* ─── Helpers untuk kode barang & status inventori ─── */

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

const ID_ITEM_RE = /^(\d+(?:\.\d+)?K)-([A-Z0-9]+)-(\d+)$/i;

/** Hitung nomor urut terakhir per-(kadar, kode) dari daftar id_item yang sudah ada */
export function buildSeqCounters(existing: { id_item: string }[]): Map<string, number> {
  const counters = new Map<string, number>();
  for (const item of existing) {
    const match = item.id_item.match(ID_ITEM_RE);
    if (!match) continue;
    const [, kadar, kode, digits] = match;
    const key = `${kadar.toUpperCase()}-${kode.toUpperCase()}`;
    const num = parseInt(digits, 10);
    const current = counters.get(key) ?? 0;
    if (num > current) counters.set(key, num);
  }
  return counters;
}

/** Buat id_item berikutnya untuk sebuah (kadar, kode), dan perbarui counter-nya */
export function nextIdItem(kadar: string, kode: string, counters: Map<string, number>): string {
  const kadarUpper = kadar.trim().toUpperCase();
  const kodeUpper = kode.trim().toUpperCase();
  const key = `${kadarUpper}-${kodeUpper}`;
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return `${kadarUpper}-${kodeUpper}-${String(next).padStart(3, "0")}`;
}

export function normalizeStatus(value: string): string {
  const trimmed = value.trim();
  const found = STATUS_OPTIONS.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  return found ?? "Tersedia";
}
