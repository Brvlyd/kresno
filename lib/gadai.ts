import { KATEGORI_PREFIX } from "@/lib/csv";

/** Pilihan jenis perhiasan — sama dengan kategori barang di Inventori */
export const JENIS_PERHIASAN_OPTIONS = Object.keys(KATEGORI_PREFIX);

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

/** Buat jadwal cicilan bulanan berdasarkan nilai pinjaman + bunga flat per bulan */
export function buildCicilanSchedule(
  nilaiPinjaman: number,
  bungaPersen: number,
  jangkaWaktuBulan: number,
  tanggalGadai: string
): CicilanItem[] {
  const totalBunga = nilaiPinjaman * (bungaPersen / 100) * jangkaWaktuBulan;
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

const tglIndo = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export interface InvoiceGadaiData {
  no_gadai: string;
  tanggal_gadai: string;
  pelanggan_nama: string;
  pelanggan_alamat: string;
  pelanggan_hp: string;
  jenis_perhiasan: string;
  nama_barang: string;
  berat_gram: number;
  kadar: string;
  nilai_taksiran: number;
  nilai_pinjaman: number;
  bunga_persen: number;
  jangka_waktu_bulan: number;
  tanggal_jatuh_tempo: string;
  opsi_pembayaran: "Tunai" | "Cicilan";
  cicilanPerBulan?: number;
}

/** Cetak invoice gadai (A5) — pola sama dengan cetakBarcode di app/inventori/page.tsx */
export function cetakInvoiceGadai(data: InvoiceGadaiData) {
  const w = window.open("", "_blank", "width=600,height=800");
  if (!w) return;

  const cicilanRow = data.opsi_pembayaran === "Cicilan" && data.cicilanPerBulan
    ? `<tr><td>Cicilan per Bulan</td><td>${data.jangka_waktu_bulan}x ${fmtRupiah(data.cicilanPerBulan)}</td></tr>`
    : "";

  w.document.write(`
    <html><head><title>Invoice ${data.no_gadai}</title>
    <style>
      @page { size: A5; margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #222; }
      .header { text-align: center; margin-bottom: 10px; }
      .header .toko { font-size: 16px; font-weight: bold; }
      .header .judul { font-size: 13px; font-weight: bold; margin-top: 4px; letter-spacing: 1px; }
      .header .nomor { font-size: 11px; color: #555; margin-top: 2px; }
      hr { border: none; border-top: 1px solid #999; margin: 8px 0; }
      h3 { font-size: 12px; margin: 10px 0 4px; text-transform: uppercase; letter-spacing: 0.5px; }
      table { width: 100%; border-collapse: collapse; }
      table td { padding: 2px 0; vertical-align: top; }
      table td:first-child { width: 45%; color: #555; }
      .ketentuan { font-size: 10px; color: #444; margin-top: 4px; padding-left: 16px; }
      .ketentuan li { margin-bottom: 3px; }
      .ttd { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; font-size: 11px; }
      .ttd div { width: 45%; }
      .ttd .line { margin-top: 40px; border-top: 1px solid #333; padding-top: 4px; }
    </style></head>
    <body>
      <div class="header">
        <div class="toko">Toko Mas Kresno</div>
        <div class="judul">INVOICE GADAI</div>
        <div class="nomor">No. ${data.no_gadai} • ${tglIndo(data.tanggal_gadai)}</div>
      </div>
      <hr/>

      <h3>Data Pelanggan</h3>
      <table>
        <tr><td>Nama</td><td>${data.pelanggan_nama}</td></tr>
        <tr><td>Alamat</td><td>${data.pelanggan_alamat || "-"}</td></tr>
        <tr><td>No. HP</td><td>${data.pelanggan_hp || "-"}</td></tr>
      </table>

      <h3>Data Barang</h3>
      <table>
        <tr><td>Jenis Barang</td><td>${data.jenis_perhiasan} — ${data.nama_barang}</td></tr>
        <tr><td>Berat</td><td>${data.berat_gram} gram</td></tr>
        <tr><td>Kadar</td><td>${data.kadar}</td></tr>
      </table>

      <h3>Data Pinjaman</h3>
      <table>
        <tr><td>Nilai Taksiran</td><td>${fmtRupiah(data.nilai_taksiran)}</td></tr>
        <tr><td>Nilai Pinjaman</td><td>${fmtRupiah(data.nilai_pinjaman)}</td></tr>
        <tr><td>Bunga</td><td>${data.bunga_persen}% / bulan</td></tr>
        <tr><td>Jangka Waktu</td><td>${data.jangka_waktu_bulan} bulan</td></tr>
        <tr><td>Tanggal Jatuh Tempo</td><td>${tglIndo(data.tanggal_jatuh_tempo)}</td></tr>
        <tr><td>Opsi Pembayaran</td><td>${data.opsi_pembayaran}</td></tr>
        ${cicilanRow}
      </table>

      <h3>Ketentuan</h3>
      <ul class="ketentuan">
        <!-- Placeholder — ketentuan resmi menyusul dari pihak toko -->
        <li>Ketentuan gadai akan diinformasikan menyusul oleh pihak toko.</li>
      </ul>

      <div class="ttd">
        <div><div class="line">Pelanggan</div></div>
        <div><div class="line">Petugas</div></div>
      </div>

      <script>window.onload = function () { window.print(); };</script>
    </body></html>
  `);
  w.document.close();
}
