"use client";

import type { InvoiceSize } from "@/lib/invoiceSize";

/** Input ukuran kertas invoice custom: lebar x tinggi x margin (mm). */
export function InvoiceSizePicker({
  value,
  onChange,
}: {
  value: InvoiceSize;
  onChange: (size: InvoiceSize) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-gray-500 whitespace-nowrap">📄 Ukuran Kertas:</span>
      <input
        type="number"
        min={20}
        max={1000}
        value={value.widthMm}
        onChange={(e) => onChange({ ...value, widthMm: Number(e.target.value) || value.widthMm })}
        className="w-16 border border-gray-300 rounded-lg px-2 py-1.5"
        aria-label="Lebar (mm)"
      />
      <span className="text-gray-400">×</span>
      <input
        type="number"
        min={20}
        max={1000}
        value={value.heightMm}
        onChange={(e) => onChange({ ...value, heightMm: Number(e.target.value) || value.heightMm })}
        className="w-16 border border-gray-300 rounded-lg px-2 py-1.5"
        aria-label="Tinggi (mm)"
      />
      <span className="text-gray-400">mm</span>
      <span className="text-gray-400 mx-1">|</span>
      <span className="text-gray-500">Margin:</span>
      <input
        type="number"
        min={0}
        max={100}
        value={value.marginMm}
        onChange={(e) => onChange({ ...value, marginMm: Number(e.target.value) })}
        className="w-14 border border-gray-300 rounded-lg px-2 py-1.5"
        aria-label="Margin (mm)"
      />
      <span className="text-gray-400">mm</span>
    </div>
  );
}
