/** Buat nomor buyback unik: BB-YYYYMMDD-XXX */
export function generateNoBuyback(): string {
  const today = new Date();
  const ymd = today.toISOString().split("T")[0].replace(/-/g, "");
  const suffix = Math.floor(100 + Math.random() * 900);
  return `BB-${ymd}-${suffix}`;
}

export interface InvoiceBuybackData {
  no_buyback: string;
  tanggal: string;
  nama_barang: string;
  kadar: string;
  berat_gram: number;
  jumlah: number;
  harga_per_gram: number;
  total: number;
}
