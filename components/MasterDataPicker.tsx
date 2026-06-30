"use client";

import { useState } from "react";
import { AutocompleteField } from "@/components/AutocompleteField";
import { AddJenisModal } from "@/components/AddJenisModal";

/** Field cari-atau-pilih untuk master data relasional (Jenis Perhiasan, Jenis
 * Kerusakan, Jenis Tindakan, Kadar, dst.) — textbox dengan dropdown pencarian
 * dari daftar yang sudah ada, plus tombol "+ Tambah Baru" untuk menyimpan
 * nilai baru ke tabel master-nya. */
export function MasterDataPicker({
  value, onChange, options, onAddNew,
  placeholder, addButtonLabel = "+ Tambah Baru",
  modalTitle, modalDescription, modalLabel, modalPlaceholder, modalSubmitLabel,
  validate,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onAddNew: (nama: string) => Promise<string | null>;
  placeholder?: string;
  addButtonLabel?: string;
  modalTitle?: string;
  modalDescription?: string;
  modalLabel?: string;
  modalPlaceholder?: string;
  modalSubmitLabel?: string;
  /** Validasi tambahan sebelum nilai baru disimpan ke tabel master — kembalikan
   * pesan error kalau tidak valid, atau null kalau lolos. */
  validate?: (v: string) => string | null;
  inputClassName?: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [addFailedError, setAddFailedError] = useState<string | undefined>(undefined);

  const q = value.trim().toLowerCase();
  const suggestions = (q ? options.filter((o) => o.toLowerCase().includes(q)) : options).slice(0, 8);

  return (
    <div>
      <AutocompleteField
        value={value}
        onChange={onChange}
        onSelect={(s) => onChange(s)}
        suggestions={suggestions}
        renderLabel={(s) => s}
        placeholder={placeholder}
        inputClassName={inputClassName}
        noResultsText="Tidak ditemukan — pakai tombol + Tambah Baru di bawah."
      />
      <button
        type="button"
        onClick={() => setShowAdd(true)}
        className="mt-1.5 text-xs font-semibold text-[#C99A36] hover:underline"
      >
        {addButtonLabel}
      </button>

      <AddJenisModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={async (nama) => {
          if (validate) {
            const err = validate(nama);
            if (err) { setAddFailedError(err); return null; }
          }
          setAddFailedError(undefined);
          const result = await onAddNew(nama);
          if (result) onChange(result);
          return result;
        }}
        title={modalTitle}
        description={modalDescription}
        label={modalLabel}
        placeholder={modalPlaceholder}
        submitLabel={modalSubmitLabel}
        failedError={addFailedError}
      />
    </div>
  );
}
