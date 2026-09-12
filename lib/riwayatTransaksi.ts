/* ═══════════════════════════════════════════════════════
   RIWAYAT TRANSAKSI POS — types & helpers dipakai bersama
   oleh halaman Kasir (app/pos/page.tsx) dan halaman
   Riwayat Transaksi (app/pos/riwayat/page.tsx).
═══════════════════════════════════════════════════════ */

export interface RiwayatItemDetail {
  /** PK baris `inventori_keluar` ini — dipakai utk edit/hapus baris spesifik. */
  id: string;
  /** FK ke `inventori.id` (bisa null kalau barangnya sudah dihapus dari inventori) —
   * dipakai utk rekonsiliasi stok saat invoice diedit/dihapus. */
  inventoriId: string | null;
  idItem: string;
  namaProduk: string;
  kadar: string;
  beratGram: number;
  qty: number;
  hargaSatuan: number;
  /** Modal (HPP) per satuan yang dibekukan saat transaksi — null utk baris lama
   * yang belum sempat di-snapshot (lihat migration 032). */
  hargaModal: number | null;
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
  id: string;
  inventori_id: string | null;
  id_item: string;
  nama_produk: string;
  kadar: string | null;
  berat_gram: number | null;
  jumlah_keluar: number | null;
  harga_satuan: number | null;
  harga_modal: number | null;
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
  "id, inventori_id, id_item, nama_produk, kadar, berat_gram, jumlah_keluar, harga_satuan, harga_modal, ongkos, diskon, ppn_persen, ppn_amount, total_transaksi, no_invoice, pelanggan_nama, pelanggan_hp, payment_method, catatan, created_at, inventori:inventori_id(gambar_url)";

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
      id: row.id,
      inventoriId: row.inventori_id,
      idItem: row.id_item,
      namaProduk: row.nama_produk,
      kadar: row.kadar || "",
      beratGram: row.berat_gram || 0,
      qty,
      hargaSatuan,
      hargaModal: row.harga_modal ?? null,
      ongkos,
      gambarUrl: inventoriRel?.gambar_url || undefined,
    });
    entry.totalQty += qty;
    entry.subtotal += hargaSatuan * qty + ongkos;
  }
  // total_transaksi tersimpan sesekali tidak sinkron dengan diskon (mis. data lama
  // dari sebelum diskon diperbaiki, atau entri yang diedit manual) — hitung ulang
  // dari subtotal & diskon yang sudah diagregasi di atas, supaya baris riwayat, modal
  // detail, dan nota cetak-ulang selalu menampilkan total setelah diskon yang benar,
  // bukan angka mentah dari kolom total_transaksi.
  for (const entry of grouped) {
    entry.total = Math.max(0, entry.subtotal - entry.diskon) + entry.ppnAmount;
  }
  return grouped;
}

/** Satu baris keranjang siap-insert ke `inventori_keluar` — dipakai baik oleh alur
 * simpan transaksi baru (app/pos/page.tsx) maupun simpan-edit invoice lama
 * (components/pos/DetailRiwayatModal.tsx), supaya bentuk baris yang ditulis ke DB
 * selalu berasal dari satu sumber. */
export interface InventoriKeluarInsertRow {
  /** Null kalau baris ini merujuk barang inventori yang sudah dihapus — tetap
   * dipertahankan (bukan di-drop) saat invoice lama disimpan ulang setelah diedit,
   * hanya saja tidak ada stok yang direkonsiliasi utknya. */
  inventoriId: string | null;
  idItem: string;
  namaProduk: string;
  kadar: string;
  beratGram: number;
  hargaJual: number;
  /** Modal (HPP) per satuan pada harga emas hari transaksi — dibekukan bersama
   * `hargaJual` supaya laba kotor di laporan Keuangan sepatokan & tidak berubah
   * lagi setelah transaksi tersimpan. Null kalau harga emas 24K tidak tersedia
   * (laporan jatuh ke `inventori.harga_beli` seperti perilaku lama). */
  hargaModal: number | null;
  ongkos: number;
  qty: number;
}

/** Bangun baris-baris `inventori_keluar` (satu per baris keranjang) siap di-insert.
 * `jumlahSisaByItemId` = stok akhir tiap `inventori_id` SETELAH transaksi ini diterapkan
 * (dihitung oleh caller, karena caller yang tahu stok live & apakah ini transaksi baru
 * atau revisi dari transaksi lama). `createdAt`, kalau diisi, menimpa default `now()` DB —
 * wajib diisi saat menyimpan ulang invoice lama supaya tanggal transaksinya tidak berubah
 * jadi hari ini. */
export function buildInventoriKeluarInserts(
  rows: InventoriKeluarInsertRow[],
  meta: {
    noInvoice: string;
    createdAt?: string;
    pelangganNama: string;
    pelangganHp: string | null;
    paymentMethod: string;
    catatan: string | null;
    diskon: number;
    ppnEnabled: boolean;
    ppnPercent: number;
    ppnAmount: number;
    total: number;
    jumlahSisaByItemId: Map<string, number>;
  }
) {
  return rows.map((r) => ({
    inventori_id: r.inventoriId,
    id_item: r.idItem,
    nama_produk: r.namaProduk,
    jumlah_keluar: r.qty,
    jumlah_sisa: r.inventoriId ? meta.jumlahSisaByItemId.get(r.inventoriId) ?? 0 : 0,
    status_baru: "Terjual",
    catatan: meta.catatan,
    no_invoice: meta.noInvoice,
    pelanggan_nama: meta.pelangganNama,
    pelanggan_hp: meta.pelangganHp,
    payment_method: meta.paymentMethod,
    kadar: r.kadar,
    berat_gram: r.beratGram,
    harga_satuan: r.hargaJual,
    harga_modal: r.hargaModal,
    ongkos: r.ongkos,
    diskon: meta.diskon,
    ppn_persen: meta.ppnEnabled ? meta.ppnPercent : 0,
    ppn_amount: meta.ppnAmount,
    total_transaksi: meta.total,
    ...(meta.createdAt ? { created_at: meta.createdAt } : {}),
  }));
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
  /** Dipakai saat nota dipecah jadi beberapa halaman (lihat paginateInvoiceCart) —
   * menampilkan label "Halaman X dari Y" & melanjutkan nomor urut baris. */
  pageIndex?: number;
  pageCount?: number;
  rowStartIndex?: number;
}

/** Gabungkan baris keranjang yang barangnya identik (nama, kadar, berat, & harga
 * jual per satuan sama) jadi satu baris dengan qty & ongkos dijumlahkan — supaya
 * barang yang sama yang ditambahkan berkali-kali ke keranjang tidak tercetak
 * sebagai baris-baris terpisah di nota. */
export function groupInvoiceCart(cart: InvoiceLineItem[]): InvoiceLineItem[] {
  const grouped: InvoiceLineItem[] = [];
  const byKey = new Map<string, InvoiceLineItem>();
  for (const ci of cart) {
    const key = [ci.namaProduk, ci.kadar, ci.beratGram, ci.hargaJual].join(" ");
    const existing = byKey.get(key);
    if (existing) {
      existing.qty += ci.qty;
      existing.ongkos += ci.ongkos;
      if (!existing.gambarUrl && ci.gambarUrl) existing.gambarUrl = ci.gambarUrl;
    } else {
      const copy = { ...ci };
      byKey.set(key, copy);
      grouped.push(copy);
    }
  }
  return grouped;
}

/** Maks. baris barang per halaman nota — kalau lebih dari ini, tabel tidak
 * dilebarkan (yang akan merusak tata letak A5 & format baku nota), melainkan
 * dipecah ke halaman/nota berikutnya. */
export const MAX_INVOICE_ROWS = 12;

export interface InvoicePageTotals {
  cart: InvoiceLineItem[];
  subtotal: number;
  diskon: number;
  ppnAmount: number;
  total: number;
  totalBerat: number;
}

/** Kelompokkan barang identik (groupInvoiceCart), lalu — kalau baris hasilnya
 * masih lebih banyak dari maxRows — pecah jadi beberapa halaman nota yang
 * masing-masing berdiri sendiri (subtotal, terbilang, dst dihitung dari
 * barangnya sendiri) supaya formatnya tetap sama seperti nota satu halaman.
 * Diskon dialokasikan proporsional per halaman berdasarkan subtotal halaman
 * itu (sisa pembulatan ditaruh di halaman terakhir), dan PPN dihitung ulang
 * dari subtotal-setelah-diskon halaman itu — sehingga total semua halaman
 * kalau dijumlahkan persis sama dengan total transaksi aslinya. */
export function paginateInvoiceCart(
  cart: InvoiceLineItem[],
  diskon: number,
  ppnEnabled: boolean,
  ppnPercent: number,
  maxRows: number = MAX_INVOICE_ROWS,
): InvoicePageTotals[] {
  const grouped = groupInvoiceCart(cart);
  const chunks: InvoiceLineItem[][] = [];
  for (let i = 0; i < grouped.length; i += maxRows) chunks.push(grouped.slice(i, i + maxRows));
  if (chunks.length === 0) chunks.push([]);

  const pageSubtotals = chunks.map((pc) => pc.reduce((s, ci) => s + ci.hargaJual * ci.qty + ci.ongkos, 0));
  const totalSubtotal = pageSubtotals.reduce((s, n) => s + n, 0);

  let diskonSisa = diskon;
  return chunks.map((pageCart, idx) => {
    const isLast = idx === chunks.length - 1;
    const pageSubtotal = pageSubtotals[idx];
    const pageDiskon = isLast
      ? diskonSisa
      : Math.round(totalSubtotal > 0 ? (diskon * pageSubtotal) / totalSubtotal : 0);
    diskonSisa -= pageDiskon;
    const afterDiskon = Math.max(0, pageSubtotal - pageDiskon);
    const ppnAmount = ppnEnabled ? Math.round((afterDiskon * ppnPercent) / 100) : 0;
    return {
      cart: pageCart,
      subtotal: pageSubtotal,
      diskon: pageDiskon,
      ppnAmount,
      total: afterDiskon + ppnAmount,
      totalBerat: pageCart.reduce((s, ci) => s + ci.beratGram * ci.qty, 0),
    };
  });
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
