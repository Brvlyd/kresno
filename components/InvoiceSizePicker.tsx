"use client";

import { INVOICE_SIZE_PRESETS, type InvoiceSize, type InvoiceSizePresetId } from "@/lib/invoiceSize";

/** Dropdown ukuran kertas invoice (preset umum + custom lebar x tinggi mm). */
export function InvoiceSizePicker({
  value,
  onChange,
}: {
  value: InvoiceSize;
  onChange: (size: InvoiceSize) => void;
}) {
  function handlePresetChange(preset: InvoiceSizePresetId) {
    if (preset === "custom") {
      onChange({ preset: "custom", widthMm: value.widthMm, heightMm: value.heightMm, marginMm: value.marginMm });
      return;
    }
    onChange({ preset, ...INVOICE_SIZE_PRESETS[preset] });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-gray-500 whitespace-nowrap">📄 Ukuran Kertas:</span>
      <select
        value={value.preset}
        onChange={(e) => handlePresetChange(e.target.value as InvoiceSizePresetId)}
        className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
      >
        {Object.entries(INVOICE_SIZE_PRESETS).map(([id, p]) => (
          <option key={id} value={id}>{p.label}</option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      {value.preset === "custom" && (
        <>
          <input
            type="number"
            min={20}
            max={1000}
            value={value.widthMm}
            onChange={(e) => onChange({ ...value, preset: "custom", widthMm: Number(e.target.value) || value.widthMm })}
            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5"
            aria-label="Lebar (mm)"
          />
          <span className="text-gray-400">×</span>
          <input
            type="number"
            min={20}
            max={1000}
            value={value.heightMm}
            onChange={(e) => onChange({ ...value, preset: "custom", heightMm: Number(e.target.value) || value.heightMm })}
            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5"
            aria-label="Tinggi (mm)"
          />
          <span className="text-gray-400">mm</span>
        </>
      )}
    </div>
  );
}
