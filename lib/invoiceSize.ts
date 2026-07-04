"use client";

import { useCallback, useEffect, useState } from "react";

/** Jenis transaksi yang punya invoice sendiri — ukuran kertas diatur per jenis. */
export type InvoiceKind = "pos" | "servis" | "pegadaian" | "pembelian";

export type InvoiceSizePresetId = "a5-landscape" | "a4-portrait" | "thermal-58" | "thermal-80" | "custom";

export interface InvoiceSize {
  preset: InvoiceSizePresetId;
  widthMm: number;
  heightMm: number;
  marginMm: number;
}

export const INVOICE_SIZE_PRESETS: Record<
  Exclude<InvoiceSizePresetId, "custom">,
  { label: string; widthMm: number; heightMm: number; marginMm: number }
> = {
  "a5-landscape": { label: "A5 Landscape (210 × 148 mm)", widthMm: 210, heightMm: 148, marginMm: 10 },
  "a4-portrait": { label: "A4 Potrait (210 × 297 mm)", widthMm: 210, heightMm: 297, marginMm: 15 },
  "thermal-58": { label: "Thermal 58mm", widthMm: 58, heightMm: 200, marginMm: 3 },
  "thermal-80": { label: "Thermal 80mm", widthMm: 80, heightMm: 250, marginMm: 4 },
};

export const DEFAULT_INVOICE_SIZE: InvoiceSize = {
  preset: "a5-landscape",
  ...INVOICE_SIZE_PRESETS["a5-landscape"],
};

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
