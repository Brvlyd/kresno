/* ═══════════════════════════════════════════════════════
   RIWAYAT TRANSAKSI POS — types & helpers dipakai bersama
   oleh halaman Kasir (app/pos/page.tsx) dan halaman
   Riwayat Transaksi (app/pos/riwayat/page.tsx).
═══════════════════════════════════════════════════════ */

export interface RiwayatItemDetail {
  idItem: string;
  namaProduk: string;
  kadar: string;
  beratGram: number;
  qty: number;
  hargaSatuan: number;
  ongkos: number;
  gambarUrl?: string;
}

export interface RiwayatTransaksi {
  noInvoice: string;
  pelangganNama: string;
  pelangganHp: string;
  paymentMethod: string;
  createdAt: string;
  catatan: string;
  items: RiwayatItemDetail[];
  totalQty: number;
  subtotal: number;
  diskon: number;
  ppnPercent: number;
  ppnAmount: number;
  total: number;
}

/** Baris mentah inventori_keluar (satu baris = satu item dalam satu invoice)
 * dikelompokkan jadi satu RiwayatTransaksi per no. invoice. */
export type RiwayatRow = {
  id_item: string;
  nama_produk: string;
  kadar: string | null;
  berat_gram: number | null;
  jumlah_keluar: number | null;
  harga_satuan: number | null;
  ongkos: number | null;
  diskon: number | null;
  ppn_persen: number | null;
  ppn_amount: number | null;
  total_transaksi: number | null;
  no_invoice: string | null;
  pelanggan_nama: string | null;
  pelanggan_hp: string | null;
  payment_method: string | null;
  catatan: string | null;
  created_at: string;
  inventori: { gambar_url: string | null } | { gambar_url: string | null }[] | null;
};

export const RIWAYAT_SELECT =
  "id_item, nama_produk, kadar, berat_gram, jumlah_keluar, harga_satuan, ongkos, diskon, ppn_persen, ppn_amount, total_transaksi, no_invoice, pelanggan_nama, pelanggan_hp, payment_method, catatan, created_at, inventori:inventori_id(gambar_url)";

export const fmtRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
export const fmtGram = (n: number) => (n || 0).toFixed(2) + " gr";

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

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

export function fmtTanggalInv(d: Date) {
  return (
    String(d.getDate()).padStart(2, "0") + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    d.getFullYear()
  );
}

export function fmtWaktuRiwayat(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) +
    ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function fmtWaktuLengkap(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) +
    ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function groupRiwayatRows(rows: RiwayatRow[]): RiwayatTransaksi[] {
  const grouped: RiwayatTransaksi[] = [];
  const seen = new Map<string, RiwayatTransaksi>();
  for (const row of rows) {
    const noInvoice = row.no_invoice;
    if (!noInvoice) continue;
    let entry = seen.get(noInvoice);
    if (!entry) {
      entry = {
        noInvoice,
        pelangganNama: row.pelanggan_nama || "Umum",
        pelangganHp: row.pelanggan_hp || "",
        paymentMethod: row.payment_method || "",
        createdAt: row.created_at,
        catatan: row.catatan || "",
        items: [],
        totalQty: 0,
        subtotal: 0,
        diskon: row.diskon || 0,
        ppnPercent: row.ppn_persen || 0,
        ppnAmount: row.ppn_amount || 0,
        total: row.total_transaksi || 0,
      };
      seen.set(noInvoice, entry);
      grouped.push(entry);
    }
    const qty = row.jumlah_keluar || 0;
    const hargaSatuan = row.harga_satuan || 0;
    const ongkos = row.ongkos || 0;
    const inventoriRel = Array.isArray(row.inventori) ? row.inventori[0] : row.inventori;
    entry.items.push({
      idItem: row.id_item,
      namaProduk: row.nama_produk,
      kadar: row.kadar || "",
      beratGram: row.berat_gram || 0,
      qty,
      hargaSatuan,
      ongkos,
      gambarUrl: inventoriRel?.gambar_url || undefined,
    });
    entry.totalQty += qty;
    entry.subtotal += hargaSatuan * qty + ongkos;
  }
  return grouped;
}

/** Baris barang utk dicetak di nota — dipakai baik dari keranjang transaksi
 * baru maupun dari riwayat transaksi lama (foto diambil via join ke inventori). */
export interface InvoiceLineItem {
  namaProduk: string;
  kadar: string;
  beratGram: number;
  gambarUrl?: string;
  hargaJual: number;
  ongkos: number;
  qty: number;
}

export interface InvoiceProps {
  mode: "print" | "preview";
  noInvoice: string;
  tanggal: string;
  pelangganNama: string;
  pelangganHP: string;
  cart: InvoiceLineItem[];
  diskon: number;
  subtotal: number;
  total: number;
  totalBerat: number;
  paymentMethod: string;
  ppnEnabled: boolean;
  ppnPercent: number;
  ppnAmount: number;
}

/** Susun ulang data riwayat transaksi (sudah tersimpan di database) jadi props
 * InvoiceCetak, supaya nota lama bisa dilihat & dicetak ulang kapan saja. */
export function riwayatToInvoiceProps(r: RiwayatTransaksi): Omit<InvoiceProps, "mode"> {
  const cart: InvoiceLineItem[] = r.items.map((it) => ({
    namaProduk: it.namaProduk,
    kadar: it.kadar,
    beratGram: it.beratGram,
    gambarUrl: it.gambarUrl,
    hargaJual: it.hargaSatuan,
    ongkos: it.ongkos,
    qty: it.qty,
  }));
  const totalBerat = r.items.reduce((s, it) => s + it.beratGram * it.qty, 0);
  return {
    noInvoice: r.noInvoice,
    tanggal: fmtTanggalInv(new Date(r.createdAt)),
    pelangganNama: r.pelangganNama,
    pelangganHP: r.pelangganHp,
    cart,
    diskon: r.diskon,
    subtotal: r.subtotal,
    total: r.total,
    totalBerat,
    paymentMethod: r.paymentMethod,
    ppnEnabled: r.ppnAmount > 0,
    ppnPercent: r.ppnPercent,
    ppnAmount: r.ppnAmount,
  };
}
