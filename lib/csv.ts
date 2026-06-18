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

/** Prefix kode untuk auto-generate ID Barang berdasarkan kategori */
export const KATEGORI_PREFIX: Record<string, string> = {
  "Gelang": "GL",
  "Kalung": "KL",
  "Cincin": "CN",
  "Anting": "AT",
  "Liontin": "LT",
  "Gelang Kaki": "GK",
  "Tusuk Konde": "TK",
  "Lainnya": "LN",
};

export function prefixForKategori(kategori: string): string {
  const trimmed = kategori.trim();
  if (KATEGORI_PREFIX[trimmed]) return KATEGORI_PREFIX[trimmed];
  // Buat prefix dari huruf awal tiap kata, fallback 2 huruf pertama
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (trimmed.length >= 2) return trimmed.slice(0, 2).toUpperCase();
  return "BR";
}

/** Hitung nomor urut terakhir per-prefix dari daftar id_item yang sudah ada */
export function buildPrefixCounters(existing: { id_item: string }[]): Map<string, number> {
  const counters = new Map<string, number>();
  for (const item of existing) {
    const match = item.id_item.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;
    const [, prefix, digits] = match;
    const num = parseInt(digits, 10);
    const current = counters.get(prefix) ?? 0;
    if (num > current) counters.set(prefix, num);
  }
  return counters;
}

/** Buat id_item berikutnya untuk sebuah prefix, dan perbarui counter-nya */
export function nextId(prefix: string, counters: Map<string, number>): string {
  const current = counters.get(prefix) ?? 0;
  const next = current + 1;
  counters.set(prefix, next);
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function normalizeStatus(value: string): string {
  const trimmed = value.trim();
  const found = STATUS_OPTIONS.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  return found ?? "Tersedia";
}
