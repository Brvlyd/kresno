export const fmtRupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n || 0);

export const fmtTanggal = (tgl: string) =>
  new Date(tgl).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

export const STATUS_OPTIONS = ["Lunas", "Belum Lunas"] as const;
export type StatusHutangPiutang = (typeof STATUS_OPTIONS)[number];

/** Cara pelunasan hutang ke supplier/sales — bisa dibayarkan emas, uang, atau emas rosok. */
export const PEMBAYARAN_PELUNASAN_OPTIONS = ["Emas", "Uang", "Emas Rosok"] as const;
export type PembayaranPelunasan = (typeof PEMBAYARAN_PELUNASAN_OPTIONS)[number];

export const JENIS_HUTANG_OPTIONS = [
  { value: "supplier", label: "Supplier & Sales" },
  { value: "operasional", label: "Operasional & Pihak ke-3" },
] as const;
export type JenisHutangValue = (typeof JENIS_HUTANG_OPTIONS)[number]["value"];

export function jenisHutangLabel(value: string): string {
  return JENIS_HUTANG_OPTIONS.find((j) => j.value === value)?.label ?? value;
}

/** Sumber piutang — sesuai flowchart, piutang berasal dari servis atau gadai (atau lainnya). */
export const SUMBER_PIUTANG_OPTIONS = ["Servis", "Gadai", "Lainnya"] as const;
export type SumberPiutang = (typeof SUMBER_PIUTANG_OPTIONS)[number];

/** Kadar/karat patokan untuk konversi nilai hutang emas — dulu fix 24K, sekarang bisa disesuaikan. */
export const KADAR_PATOKAN_OPTIONS = [24, 22, 20, 18, 16, 14, 9, 8, 6] as const;

function randomDigits(n: number): string {
  return String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
}

/** Buat nomor hutang unik: HTG-XXXX */
export function generateNoHutang(): string {
  return `HTG-${randomDigits(4)}`;
}

/** Buat nomor piutang unik: PTG-XXXX */
export function generateNoPiutang(): string {
  return `PTG-${randomDigits(4)}`;
}

/* ═══════════════════════════════════════════════════════
   RUMUS PENGAMBILAN BARANG PADA SUPPLIER / SALES
   Berat emas × Persentase harga (%) = Hasil
   Hasil × Karat (patokan, dari 24K) = Hasil Akhir
   → Hasil Akhir inilah yang bisa dibayarkan emas / uang / emas rosok
═══════════════════════════════════════════════════════ */

/** Hasil = Berat emas (gram) × Persentase harga (%) */
export function hitungHasil(beratEmasGram: number, persentaseHarga: number): number {
  return beratEmasGram * (persentaseHarga / 100);
}

/** Hasil Akhir = Hasil × (Karat dipilih / 24, patokan emas murni) */
export function hitungHasilAkhir(hasil: number, kadarKarat: number): number {
  return hasil * (kadarKarat / 24);
}

/* ═══════════════════════════════════════════════════════
   RUMUS NOTA (nilai Rupiah yang tercetak di nota/invoice)
   Hasil Akhir (gram) × Harga (per gram) = Harga Total
═══════════════════════════════════════════════════════ */

/** Harga Total = Hasil Akhir (gram) × Harga per gram (Rp) */
export function hitungHargaTotalNota(hasilAkhirGram: number, hargaPerGram: number): number {
  return Math.round(hasilAkhirGram * hargaPerGram);
}
