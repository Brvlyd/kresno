"use client";

import { useState } from "react";

/** Jenis transaksi yang punya invoice sendiri. `kind` tidak lagi mempengaruhi ukuran
 * (semua nota berperilaku sama) — dipertahankan hanya supaya call-site lama
 * (`useInvoiceSize("pos")` dst) tetap jalan. */
export type InvoiceKind = "pos" | "servis" | "pegadaian" | "pembelian";

export interface InvoiceSize {
  /** Lebar NOTA/INVOICE yang tercetak (mm) — bukan lebar kertas. */
  widthMm: number;
  /** Tinggi NOTA/INVOICE yang tercetak (mm) — bukan tinggi kertas. */
  heightMm: number;
  /** Ruang kosong (mm) di tiap sisi antara invoice dan tepi kertas. Kertas = invoice + 2×margin. */
  marginMm: number;
}

/** Default = invoice A5 landscape (210 × 148 mm), margin 5 mm.
 *
 * PENTING: widthMm/heightMm = ukuran NOTA/INVOICE-nya sendiri (area yang tercetak),
 * BUKAN ukuran kertas. Kertas fisik (@page) = invoice + 2×margin di tiap sisi.
 *
 * Ukuran ini sengaja TIDAK dipersist ke localStorage: tiap kali halaman/komponen
 * invoice dibuka lagi, ukuran selalu di-reset balik ke default A5 ini. User boleh
 * mengubahnya untuk sesi tampilan saat itu, tapi tidak "menempel" ke pembukaan berikutnya. */
export const DEFAULT_INVOICE_SIZE: InvoiceSize = {
  widthMm: 210,
  heightMm: 148,
  marginMm: 5,
};

/** Ukuran konten acuan desain invoice — diukur langsung dari scrollWidth/scrollHeight
 * konten React invoice yang sebenarnya, supaya scale di InvoicePrintFrame akurat dan
 * tidak ke-crop di atas. Diukur dari InvoiceServis (paling tinggi, 165.1 × 139.4mm) +
 * buffer aman utk varian invoice lain (gadai/buyback). */
export const DESIGN_CONTENT_WIDTH_MM = 170;
export const DESIGN_CONTENT_HEIGHT_MM = 145;

/** State ukuran invoice untuk satu sesi tampilan. Sengaja TIDAK persisten (tanpa
 * localStorage): begitu komponen di-mount ulang (halaman dibuka lagi / modal ditutup
 * lalu dibuka), ukuran otomatis balik ke DEFAULT_INVOICE_SIZE (A5 landscape, margin 5).
 * `kind` diabaikan — semua jenis nota berperilaku sama. */
export function useInvoiceSize(_kind?: InvoiceKind) {
  return useState<InvoiceSize>(DEFAULT_INVOICE_SIZE);
}
