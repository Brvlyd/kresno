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

const tglIndo = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export interface InvoiceServisData {
  no_servis: string;
  tanggal_masuk: string;
  jenis_servis: "Cuci" | "Perbaikan";
  pelanggan_nama: string;
  pelanggan_alamat: string;
  pelanggan_hp: string;
  jenis_perhiasan: string;
  nama_barang: string;
  berat_gram: number;
  kadar: string;
  kondisi_awal: string;
  jenis_kerusakan?: string;
  jenis_tindakan?: string;
  prioritas?: string;
  estimasi_biaya: number;
  uang_muka: number;
  estimasi_selesai: string;
}

/** Cetak invoice servis (A5) */
export function cetakInvoiceServis(data: InvoiceServisData) {
  const w = window.open("", "_blank", "width=600,height=800");
  if (!w) return;

  const sisaPembayaran = data.estimasi_biaya - data.uang_muka;

  const detailPerbaikanRows = data.jenis_servis === "Perbaikan"
    ? `
      <tr><td>Jenis Kerusakan</td><td>${data.jenis_kerusakan || "-"}</td></tr>
      <tr><td>Jenis Tindakan</td><td>${data.jenis_tindakan || "-"}</td></tr>
      <tr><td>Prioritas</td><td>${data.prioritas || "-"}</td></tr>
    `
    : "";

  w.document.write(`
    <html><head><title>Invoice ${data.no_servis}</title>
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
        <div class="judul">INVOICE SERVIS</div>
        <div class="nomor">No. ${data.no_servis} • ${tglIndo(data.tanggal_masuk)}</div>
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
        <tr><td>Kondisi Awal</td><td>${data.kondisi_awal || "-"}</td></tr>
      </table>

      <h3>Detail Servis</h3>
      <table>
        <tr><td>Jenis Servis</td><td>${data.jenis_servis}</td></tr>
        ${detailPerbaikanRows}
      </table>

      <h3>Biaya</h3>
      <table>
        <tr><td>Estimasi Biaya</td><td>${fmtRupiah(data.estimasi_biaya)}</td></tr>
        <tr><td>Uang Muka</td><td>${fmtRupiah(data.uang_muka)}</td></tr>
        <tr><td>Sisa Pembayaran</td><td>${fmtRupiah(sisaPembayaran)}</td></tr>
        <tr><td>Estimasi Selesai</td><td>${tglIndo(data.estimasi_selesai)}</td></tr>
      </table>

      <h3>Ketentuan</h3>
      <ul class="ketentuan">
        <!-- Placeholder — ketentuan resmi menyusul dari pihak toko -->
        <li>Ketentuan servis akan diinformasikan menyusul oleh pihak toko.</li>
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
