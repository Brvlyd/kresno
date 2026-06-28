import { JENIS_BARANG_BASE } from "@/lib/csv";

/** Pilihan jenis perhiasan — sama dengan kategori barang di Inventori */
export const JENIS_PERHIASAN_OPTIONS = JENIS_BARANG_BASE;

/** Pilihan kadar emas standar */
export const KADAR_OPTIONS = [
  "24K (99.99%)",
  "22K (91.6%)",
  "18K (75%)",
  "16K (66.6%)",
  "14K (58.5%)",
  "9K (37.5%)",
];

/** Pilihan jangka waktu gadai (bulan) */
export const JANGKA_WAKTU_OPTIONS = [1, 3, 6, 12];

/** Pilihan status awal pengajuan gadai */
export const STATUS_AWAL_OPTIONS = ["Menunggu", "Diproses", "Aktif"];

export const fmtRupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
export const fmtGram = (n: number) => (n || 0).toFixed(2) + " gr";

export const tglIndo = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

/** Buat nomor gadai unik: G-YYYYMMDD-XXX */
export function generateNoGadai(): string {
  const today = new Date();
  const ymd = today.toISOString().split("T")[0].replace(/-/g, "");
  const suffix = Math.floor(100 + Math.random() * 900);
  return `G-${ymd}-${suffix}`;
}

/** Hitung tanggal jatuh tempo = tanggal gadai + jangka waktu (bulan) */
export function hitungJatuhTempo(tanggalGadai: string, jangkaWaktuBulan: number): string {
  const d = new Date(tanggalGadai);
  d.setMonth(d.getMonth() + jangkaWaktuBulan);
  return d.toISOString().split("T")[0];
}

export interface CicilanItem {
  no_cicilan: number;
  jumlah_bayar: number;
  tanggal_jatuh_tempo: string;
  status: "Belum Bayar" | "Lunas";
}

/** Total bunga gadai: bunga_persen adalah tarif PER BULAN, jadi harus dikali jangka waktu. */
export function hitungTotalBunga(
  nilaiPinjaman: number,
  bungaPersen: number,
  jangkaWaktuBulan: number
): number {
  return nilaiPinjaman * (bungaPersen / 100) * jangkaWaktuBulan;
}

/** Buat jadwal cicilan bulanan berdasarkan nilai pinjaman + bunga flat per bulan */
export function buildCicilanSchedule(
  nilaiPinjaman: number,
  bungaPersen: number,
  jangkaWaktuBulan: number,
  tanggalGadai: string
): CicilanItem[] {
  const totalBunga = hitungTotalBunga(nilaiPinjaman, bungaPersen, jangkaWaktuBulan);
  const total = nilaiPinjaman + totalBunga;
  const perCicilan = Math.ceil(total / jangkaWaktuBulan);

  const schedule: CicilanItem[] = [];
  for (let i = 1; i <= jangkaWaktuBulan; i++) {
    const d = new Date(tanggalGadai);
    d.setMonth(d.getMonth() + i);
    schedule.push({
      no_cicilan: i,
      jumlah_bayar: perCicilan,
      tanggal_jatuh_tempo: d.toISOString().split("T")[0],
      status: "Belum Bayar",
    });
  }
  return schedule;
}

export interface GadaiBarangItem {
  jenis_perhiasan: string;
  nama_barang: string;
  berat_gram: number;
  kadar: string;
  kondisi_barang?: string | null;
  deskripsi?: string | null;
  foto_barang_url?: string | null;
}

/**
 * Ringkasan dipakai untuk kolom agregat di tabel `gadai` (listing/pencarian).
 * Kadar tidak digabung jadi rata-rata — kalau campuran kadar beda, ditandai
 * "Campuran" karena nilai per gram tiap kadar berbeda.
 */
export function summarizeBarang(items: GadaiBarangItem[]) {
  const totalBerat = items.reduce((s, it) => s + (it.berat_gram || 0), 0);
  const kadarUnik = new Set(items.map((it) => it.kadar));
  return {
    jenis_perhiasan: items.length > 1 ? `${items[0].jenis_perhiasan} +${items.length - 1} lainnya` : items[0]?.jenis_perhiasan ?? "",
    nama_barang: items.length > 1 ? `${items[0].nama_barang} +${items.length - 1} lainnya` : items[0]?.nama_barang ?? "",
    berat_gram: totalBerat,
    kadar: kadarUnik.size === 1 ? items[0].kadar : "Campuran",
  };
}

export interface InvoiceGadaiData {
  no_gadai: string;
  items: GadaiBarangItem[];
  nilai_pinjaman: number;
  bunga_persen: number;
  tanggal_gadai: string;
  tanggal_jatuh_tempo: string;
  catatan?: string;
}

/** Terbilang sederhana (Bahasa Indonesia) — dipakai untuk baris "Rp (...)" di nota gadai. */
export function terbilang(angka: number): string {
  const satuan = [
    "", "satu", "dua", "tiga", "empat", "lima",
    "enam", "tujuh", "delapan", "sembilan", "sepuluh",
    "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas",
    "enam belas", "tujuh belas", "delapan belas", "sembilan belas",
  ];
  if (angka === 0) return "nol";
  if (angka < 0) return "minus " + terbilang(-angka);
  let r = "";
  if (angka >= 1_000_000_000) { r += terbilang(Math.floor(angka / 1_000_000_000)) + " miliar "; angka %= 1_000_000_000; }
  if (angka >= 1_000_000)     { r += terbilang(Math.floor(angka / 1_000_000))     + " juta ";   angka %= 1_000_000; }
  if (angka >= 1_000) {
    const rb = Math.floor(angka / 1_000);
    r += (rb === 1 ? "se" : terbilang(rb) + " ") + "ribu ";
    angka %= 1_000;
  }
  if (angka >= 100) {
    const rt = Math.floor(angka / 100);
    r += (rt === 1 ? "se" : terbilang(rt) + " ") + "ratus ";
    angka %= 100;
  }
  if (angka > 0) {
    if (angka < 20) r += satuan[angka];
    else {
      r += satuan[Math.floor(angka / 10)] + " puluh";
      if (angka % 10 > 0) r += " " + satuan[angka % 10];
    }
  }
  return r.trim();
}
