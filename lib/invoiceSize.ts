"use client";

import { useCallback, useEffect, useState } from "react";

/** Jenis transaksi yang punya invoice sendiri — ukuran kertas diatur per jenis. */
export type InvoiceKind = "pos" | "servis" | "pegadaian" | "pembelian";

export interface InvoiceSize {
  widthMm: number;
  heightMm: number;
  marginMm: number;
}

export const DEFAULT_INVOICE_SIZE: InvoiceSize = {
  widthMm: 210,
  heightMm: 148,
  marginMm: 5,
};

/** Ukuran konten acuan desain invoice — diukur langsung dari scrollWidth/scrollHeight
 * konten React invoice yang sebenarnya (bukan tebakan dari ukuran kertas A5 lama), supaya
 * scale di InvoicePrintFrame akurat dan tidak ke-crop di atas. Diukur dari InvoiceServis
 * (paling tinggi, 165.1 × 139.4mm) + buffer aman utk varian invoice lain (gadai/buyback). */
export const DESIGN_CONTENT_WIDTH_MM = 170;
export const DESIGN_CONTENT_HEIGHT_MM = 145;

const STORAGE_PREFIX = "invoice-size:";

function isValidSize(v: unknown): v is InvoiceSize {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.widthMm === "number" && s.widthMm > 0 &&
    typeof s.heightMm === "number" && s.heightMm > 0 &&
    typeof s.marginMm === "number" && s.marginMm >= 0
  );
}

export function loadInvoiceSize(kind: InvoiceKind): InvoiceSize {
  if (typeof window === "undefined") return DEFAULT_INVOICE_SIZE;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + kind);
    if (!raw) return DEFAULT_INVOICE_SIZE;
    const parsed = JSON.parse(raw);
    if (isValidSize(parsed)) return parsed;
  } catch {
    // localStorage korup/tidak tersedia — pakai default saja
  }
  return DEFAULT_INVOICE_SIZE;
}

export function saveInvoiceSize(kind: InvoiceKind, size: InvoiceSize) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + kind, JSON.stringify(size));
}

/** Baca & simpan ukuran kertas invoice untuk satu jenis transaksi (persisten di localStorage browser). */
export function useInvoiceSize(kind: InvoiceKind) {
  const [size, setSizeState] = useState<InvoiceSize>(DEFAULT_INVOICE_SIZE);

  useEffect(() => {
    setSizeState(loadInvoiceSize(kind));
  }, [kind]);

  const setSize = useCallback((next: InvoiceSize) => {
    setSizeState(next);
    saveInvoiceSize(kind, next);
  }, [kind]);

  return [size, setSize] as const;
}
