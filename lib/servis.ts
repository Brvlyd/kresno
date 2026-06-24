import { JENIS_PERHIASAN_OPTIONS, KADAR_OPTIONS, fmtRupiah } from "@/lib/gadai";

export { JENIS_PERHIASAN_OPTIONS, KADAR_OPTIONS, fmtRupiah };

/** Pilihan jenis kerusakan untuk servis perbaikan */
export const JENIS_KERUSAKAN_OPTIONS = [
  "Patah/Putus",
  "Aus/Menipis",
  "Batu Lepas",
  "Kunci/Pengait Rusak",
  "Ukiran Pudar",
  "Lainnya",
];

/** Pilihan jenis tindakan untuk servis perbaikan */
export const JENIS_TINDAKAN_OPTIONS = [
  "Solder/Sambung",
  "Ganti Kunci/Pengait",
  "Poles/Refinishing",
  "Pengukiran Ulang",
  "Pasang Batu",
  "Lainnya",
];

/** Pilihan prioritas servis perbaikan */
export const PRIORITAS_OPTIONS = ["Normal", "Tinggi", "Urgent"];

/** Pilihan estimasi waktu pengerjaan (hari) */
export const ESTIMASI_WAKTU_OPTIONS = [1, 2, 3, 4, 7, 14];

/** Status servis */
export const STATUS_SERVIS_OPTIONS = ["Menunggu", "Diproses", "Selesai", "Diambil"];

/** Buat nomor servis unik: SRV-YYYYMMDD-XXX */
export function generateNoServis(): string {
  const today = new Date();
  const ymd = today.toISOString().split("T")[0].replace(/-/g, "");
  const suffix = Math.floor(100 + Math.random() * 900);
  return `SRV-${ymd}-${suffix}`;
}

/** Hitung estimasi tanggal selesai = tanggal masuk + estimasi hari */
export function hitungEstimasiSelesai(tanggalMasuk: string, hariEstimasi: number): string {
  const d = new Date(tanggalMasuk);
  d.setDate(d.getDate() + hariEstimasi);
  return d.toISOString().split("T")[0];
}

export interface InvoiceServisData {
  no_servis: string;
  tanggal_masuk: string;
  jenis_servis: "Cuci" | "Perbaikan";
  nama_barang: string;
  berat_gram: number;
  kadar: string;
  estimasi_selesai: string;
  estimasi_biaya: number;
  uang_muka: number;
}
