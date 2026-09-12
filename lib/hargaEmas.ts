/* ═══════════════════════════════════════════════════════
   HARGA EMAS — patokan harga & konversi persentase → Rupiah

   Satu sumber kebenaran untuk rumus "berat × persentase × harga emas 24K",
   dipakai bersama oleh Inventori (menyimpan harga katalog), Kasir (menghitung
   harga jual & modal saat transaksi), dan Keuangan (fallback laba kotor).
═══════════════════════════════════════════════════════ */

import { hitungHasil } from "./hutangPiutang";

/** Harga emas per gram untuk satu karat tertentu pada satu tanggal. */
export interface HargaEmasKarat {
  harga_beli: number;
  harga_jual: number;
}

/**
 * Harga (Rp) = Berat × Persentase × Harga emas 24K — SELALU patokan 24K,
 * berapa pun karat barangnya (bukan harga per karat barang itu sendiri).
 */
export function hitungHargaDariPersentase(
  beratGram: number,
  persentase: number,
  hargaEmas24K: number,
): number {
  return Math.round(hitungHasil(beratGram, persentase) * hargaEmas24K);
}

/**
 * Patokan 24K untuk menghitung MODAL barang. Normalnya kolom `harga_beli`
 * (harga emas yang toko pakai saat mengambil barang), tapi kalau kolom itu
 * kosong/0 dipakai `harga_jual` sebagai cadangan.
 *
 * Tanpa cadangan ini, `harga_beli` yang lupa diisi di Dashboard membuat modal
 * barang jadi Rp 0 — dan laba kotor di laporan Keuangan jadi 100% dari harga
 * jual, seolah-olah barangnya gratis.
 */
export function patokanModal24K(harga: HargaEmasKarat | null | undefined): number | null {
  if (!harga) return null;
  const patokan = harga.harga_beli || harga.harga_jual || 0;
  return patokan > 0 ? patokan : null;
}

/**
 * Modal (Rp) per satuan barang pada harga emas yang diberikan.
 *
 * PENTING — harus SEPATOKAN dengan harga jualnya: kalau harga jual dihitung
 * ulang memakai harga emas hari transaksi (lihat `hargaJualLive` di Kasir),
 * modalnya wajib memakai harga emas hari yang sama juga. Dulu harga jual
 * dihitung live sementara modal diambil dari kolom `inventori.harga_beli`
 * yang terakhir dihitung saat barang DIINPUT — jadi setiap kenaikan harga
 * emas selama barang mengendap di etalase ikut tercatat sebagai laba kotor.
 */
export function hitungModalPerUnit(
  beratGram: number,
  persenModal: number,
  harga24KModal: number | null,
  fallbackHargaBeli: number,
): number {
  if (harga24KModal == null || !persenModal) return fallbackHargaBeli;
  return hitungHargaDariPersentase(beratGram, persenModal, harga24KModal);
}
