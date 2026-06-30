"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Popup tambah nilai master data baru — dipakai di Inventori, Gadai, dan Servis
 * untuk Jenis Barang, dan bisa dipakai ulang untuk daftar master data lain
 * (Jenis Kerusakan, Jenis Tindakan, Kadar, dst.) lewat prop copy di bawah. */
export function AddJenisModal({
  open, onClose, onAdd,
  title = "Tambah Jenis Barang Baru",
  description = (
    <>
      Ketik nama jenis barang baru, misalnya &ldquo;Jam Tangan&rdquo; atau &ldquo;Pin Emas&rdquo;.
      Jenis ini akan langsung bisa dipakai untuk semua barang selanjutnya, di Inventori, Gadai, maupun Servis.
    </>
  ),
  label = "Nama Jenis Barang",
  placeholder = "Contoh: Jam Tangan",
  requiredError = "Nama jenis barang wajib diisi.",
  failedError = "Gagal menyimpan jenis barang baru. Coba lagi.",
  submitLabel = "Simpan Jenis Baru",
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (nama: string) => Promise<string | null>;
  title?: string;
  description?: ReactNode;
  label?: string;
  placeholder?: string;
  requiredError?: string;
  failedError?: string;
  submitLabel?: string;
}) {
  const [nama, setNama] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setNama(""); setError(""); }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const trimmed = nama.trim();
    if (!trimmed) { setError(requiredError); return; }
    setSaving(true);
    setError("");
    const result = await onAdd(trimmed);
    setSaving(false);
    if (!result) { setError(failedError); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "var(--font-playfair)" }}>
          {title}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {description}
        </p>
        <label className="block text-base font-semibold text-gray-700 mb-1.5">{label}</label>
        <input
          autoFocus
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20"
        />
        {error && <p className="text-sm font-semibold text-red-600 mt-2">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-white font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "#C99A36" }}
          >
            {saving ? "Menyimpan..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
