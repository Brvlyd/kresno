/* ─── CSV helpers untuk import inventori massal ─── */

export const CSV_HEADERS = [
  "No",
  "Gambar",
  "Nama Barang",
  "Kategori",
  "Kadar",
  "Berat Gram",
  "Jumlah",
  "Harga Modal",
  "Harga Jual",
  "Status",
  "Supplier",
  "Tanggal Masuk",
  "Keterangan",
] as const;

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

/**
 * Parse teks CSV menjadi array baris (array of cell strings).
 * Mendukung field berisi koma, baris baru, dan tanda kutip ganda yang di-escape ("").
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Normalisasi CRLF -> LF agar lebih mudah diproses
  let normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Buang BOM (jika file disimpan ulang oleh Excel dengan UTF-8 BOM)
  if (normalized.charCodeAt(0) === 0xfeff) normalized = normalized.slice(1);
  // Buang baris "sep=," yang ditambahkan agar Excel membuka kolom dengan benar
  normalized = normalized.replace(/^sep=.\n/i, "");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Push field/row terakhir jika ada sisa
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Buang baris yang seluruhnya kosong
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(escapeCsvField).join(",")).join("\r\n");
}

/** Konten CSV template kosong dengan header + beberapa baris contoh */
export function csvTemplate(): string {
  const contoh1 = [
    "1",
    "https://contoh.com/gambar/cincin.jpg",
    "Cincin Berlian Solitaire",
    "Cincin",
    "24K",
    "3.50",
    "10",
    "1050000",
    "1100000",
    "Tersedia",
    "Toko Emas Sumber Jaya",
    "2026-06-14",
    "Stok baru dari supplier",
  ];
  const contoh2 = [
    "2",
    "",
    "Kalung Rantai Mawar",
    "Kalung",
    "22K",
    "5.20",
    "4",
    "2500000",
    "2650000",
    "Tersedia",
    "Toko Emas Sumber Jaya",
    "2026-06-14",
    "",
  ];
  // Baris "sep=," di awal membuat Microsoft Excel membuka file ini dengan
  // pemisah kolom koma, walaupun pengaturan region komputer memakai koma
  // sebagai pemisah desimal (umum di Indonesia) — agar setiap informasi
  // tetap berada di kolom (sel) masing-masing, bukan tergabung jadi satu sel.
  return "sep=,\r\n" + toCsv([[...CSV_HEADERS], contoh1, contoh2]);
}

/** Parse angka dari teks, mendukung pemisah ribuan titik/koma */
export function parseNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return 0;
  // Hilangkan pemisah ribuan, anggap koma/titik terakhir sebagai desimal jika diikuti <=2 digit
  const normalized = cleaned.replace(/[.,](?=\d{3}(?:\D|$))/g, "");
  const num = parseFloat(normalized.replace(",", "."));
  return Number.isFinite(num) ? num : 0;
}

/** Parse tanggal dari format umum (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) -> "YYYY-MM-DD" */
export function parseDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString().split("T")[0];

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY atau DD-MM-YYYY
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return new Date().toISOString().split("T")[0];
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
