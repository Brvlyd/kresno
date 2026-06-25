"use client";

import { useEffect, useState } from "react";

/** Popup tambah jenis barang baru — dipakai di Inventori, Gadai, dan Servis. */
export function AddJenisModal({
  open, onClose, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (nama: string) => Promise<string | null>;
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
    if (!trimmed) { setError("Nama jenis barang wajib diisi."); return; }
    setSaving(true);
    setError("");
    const result = await onAdd(trimmed);
    setSaving(false);
    if (!result) { setError("Gagal menyimpan jenis barang baru. Coba lagi."); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "var(--font-playfair)" }}>
          Tambah Jenis Barang Baru
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Ketik nama jenis barang baru, misalnya &ldquo;Jam Tangan&rdquo; atau &ldquo;Pin Emas&rdquo;.
          Jenis ini akan langsung bisa dipakai untuk semua barang selanjutnya, di Inventori, Gadai, maupun Servis.
        </p>
        <label className="block text-base font-semibold text-gray-700 mb-1.5">Nama Jenis Barang</label>
        <input
          autoFocus
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Contoh: Jam Tangan"
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
            {saving ? "Menyimpan..." : "Simpan Jenis Baru"}
          </button>
        </div>
      </div>
    </div>
  );
}
