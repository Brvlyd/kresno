"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import ImportCsvModal from "@/components/ImportCsvModal";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { prefixForKategori, buildPrefixCounters, nextId } from "@/lib/csv";
import JsBarcode from "jsbarcode";

/* ─── Types ─── */
interface BarangRow {
  id: string;
  id_item: string;
  jenis_barang: string;
  nama_produk: string;
  kadar: string;
  berat_gram: number;
  jumlah: number;
  status_inventori: string;
  status_laporan: string;
  tanggal_masuk: string;
  kategori: string;
  harga_beli?: number;
  harga_jual?: number;
  supplier?: string;
  keterangan?: string;
  gambar_url?: string;
}

interface FormData {
  id_item: string;
  jenis_barang: string;
  nama_produk: string;
  kadar: string;
  berat_gram: string;
  jumlah: string;
  status_inventori: string;
  status_laporan: string;
  kategori: string;
  harga_beli: string;
  harga_jual: string;
  supplier: string;
  keterangan: string;
  gambar_url: string;
}

const emptyForm: FormData = {
  id_item: "", jenis_barang: "Gelang", nama_produk: "",
  kadar: "", berat_gram: "", jumlah: "1",
  status_inventori: "Tersedia",
  status_laporan: "Draft", kategori: "Gelang",
  harga_beli: "", harga_jual: "", supplier: "",
  keterangan: "", gambar_url: "",
};

const JENIS = ["Gelang", "Kalung", "Cincin", "Anting", "Liontin", "Gelang Kaki", "Tusuk Konde", "Lainnya"];
const STATUS_INVENTORI = ["Tersedia", "Terjual", "Dalam Servis", "Retur", "Tidak Laku", "Mati Laku", "Habis Dijual", "Hilang"];
const STATUS_LAPORAN = ["Draft", "Approval Checker", "Approval Signer", "Approved", "Rejected"];

const STATUS_BADGE: Record<string, string> = {
  "Tersedia":         "bg-green-100 text-green-700",
  "Terjual":          "bg-blue-100 text-blue-700",
  "Dalam Servis":     "bg-purple-100 text-purple-700",
  "Retur":            "bg-pink-100 text-pink-700",
  "Tidak Laku":       "bg-yellow-100 text-yellow-700",
  "Mati Laku":        "bg-orange-100 text-orange-700",
  "Habis Dijual":     "bg-gray-100 text-gray-600",
  "Hilang":           "bg-red-100 text-red-700",
};

/* ─── Popup Tambah Jenis Barang Baru ─── */
function AddJenisModal({
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
    // Jika nama mirip dengan jenis yang sudah ada (typo/beda huruf besar-kecil),
    // otomatis dikelompokkan ke jenis yang sudah ada — tidak membuat jenis baru.
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
          Jenis ini akan langsung bisa dipakai untuk semua barang selanjutnya.
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

/* ─── Popup Detail Barang ─── */
function DetailBarangPopup({
  open, onClose, editData, onSaved, jenisOptions, customJenis, existingIds, onAddJenis, onDeleteJenis,
}: {
  open: boolean;
  onClose: () => void;
  editData: BarangRow | null;
  onSaved: () => void;
  jenisOptions: string[];
  customJenis: string[];
  existingIds: string[];
  onAddJenis: (nama: string) => Promise<string | null>;
  onDeleteJenis: (nama: string) => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAddJenis, setShowAddJenis] = useState(false);
  const idTouchedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      idTouchedRef.current = true;
      setForm({
        id_item:           editData.id_item,
        jenis_barang:      editData.jenis_barang,
        nama_produk:       editData.nama_produk,
        kadar:             editData.kadar,
        berat_gram:        String(editData.berat_gram),
        jumlah:            String(editData.jumlah),
        status_inventori:  editData.status_inventori,
        status_laporan:    editData.status_laporan,
        kategori:          editData.kategori,
        harga_beli:        editData.harga_beli != null ? String(editData.harga_beli) : "",
        harga_jual:        editData.harga_jual != null ? String(editData.harga_jual) : "",
        supplier:          editData.supplier ?? "",
        keterangan:        editData.keterangan ?? "",
        gambar_url:        editData.gambar_url ?? "",
      });
    } else {
      idTouchedRef.current = false;
      setForm(emptyForm);
    }
    setMsg("");
  }, [open, editData]);

  // Buat Kode Barang otomatis untuk barang baru, ikut menyesuaikan saat Jenis Barang dipilih
  useEffect(() => {
    if (!open || editData || idTouchedRef.current) return;
    const prefix = prefixForKategori(form.jenis_barang);
    const counters = buildPrefixCounters(existingIds.map((id_item) => ({ id_item })));
    const id = nextId(prefix, counters);
    setForm((f) => ({ ...f, id_item: id }));
  }, [open, editData, form.jenis_barang, existingIds]);

  const set = (key: keyof FormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const generateNewId = () => {
    idTouchedRef.current = false;
    const prefix = prefixForKategori(form.jenis_barang);
    const counters = buildPrefixCounters(existingIds.map((id_item) => ({ id_item })));
    set("id_item", nextId(prefix, counters));
  };

  const uploadGambar = async (file: File) => {
    setUploading(true);
    setMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${(form.id_item || "item").trim().toUpperCase()}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("inventori-images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setMsg("Gagal upload gambar: " + error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("inventori-images").getPublicUrl(path);
    set("gambar_url", data.publicUrl);
    setUploading(false);
  };

  // Cek semua keterangan wajib sudah diisi. Mengembalikan daftar nama field yang masih kosong.
  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!form.id_item.trim()) missing.push("Kode Barang");
    if (!form.nama_produk.trim()) missing.push("Nama Barang");
    if (!form.kadar.trim()) missing.push("Kadar");
    if (!form.berat_gram.trim() || (parseFloat(form.berat_gram) || 0) <= 0) missing.push("Berat (gram)");
    if (!form.jumlah.trim() || (parseInt(form.jumlah) || 0) < 1) missing.push("Jumlah");
    if (!form.harga_beli.trim() || (parseFloat(form.harga_beli) || 0) <= 0) missing.push("Harga Modal");
    if (!form.harga_jual.trim() || (parseFloat(form.harga_jual) || 0) <= 0) missing.push("Harga Jual");
    if (!form.supplier.trim()) missing.push("Supplier");
    if (!form.keterangan.trim()) missing.push("Keterangan");
    return missing;
  };

  const save = async () => {
    const missing = missingFields();
    if (missing.length > 0) {
      setMsg(`Lengkapi dulu: ${missing.join(", ")}.`);
      return;
    }
    setSaving(true); setMsg("");

    const payload = {
      id_item:           form.id_item.trim().toUpperCase(),
      jenis_barang:      form.jenis_barang,
      nama_produk:       form.nama_produk.trim(),
      kadar:             form.kadar.trim(),
      berat_gram:        parseFloat(form.berat_gram) || 0,
      jumlah:            parseInt(form.jumlah) || 1,
      status_inventori:  form.status_inventori,
      status_laporan:    form.status_laporan,
      kategori:          form.jenis_barang,
      harga_beli:        parseFloat(form.harga_beli) || 0,
      harga_jual:        parseFloat(form.harga_jual) || 0,
      supplier:          form.supplier.trim(),
      keterangan:        form.keterangan.trim(),
      gambar_url:        form.gambar_url.trim() || null,
      tanggal_masuk:     new Date().toISOString().split("T")[0],
      updated_at:        new Date().toISOString(),
    };

    const { error } = editData
      ? await supabase.from("inventori").update(payload).eq("id", editData.id)
      : await supabase.from("inventori").insert(payload);

    setSaving(false);
    if (error) { setMsg("Gagal menyimpan: " + error.message); return; }
    setMsg("✓ Berhasil disimpan!");
    setTimeout(() => { onSaved(); onClose(); }, 700);
  };

  const cetakBarcode = () => {
    const missing = missingFields();
    if (missing.length > 0) {
      setMsg(`Lengkapi dulu: ${missing.join(", ")}.`);
      return;
    }

    // Buat barcode Code128 sebagai SVG untuk label cetak
    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svgEl, form.id_item, {
      format: "CODE128",
      displayValue: false,
      height: 35,
      margin: 0,
    });
    const barcodeSvg = svgEl.outerHTML;

    const jumlahLabel = Math.max(1, parseInt(form.jumlah) || 1);
    const labelHtml = `
      <div class="label">
        <div class="toko">Toko Mas Kresno</div>
        ${barcodeSvg}
        <div class="kode">${form.id_item}</div>
        <div class="nama">${form.nama_produk}</div>
        <div class="info">${form.kadar} • ${form.berat_gram} gr</div>
      </div>`;

    const w = window.open("", "_blank", "width=500,height=400");
    if (!w) return;
    w.document.write(`
      <html><head><title>Barcode ${form.id_item}</title>
      <style>
        @page { size: auto; margin: 4mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .sheet {
          display: grid;
          grid-template-columns: repeat(3, 30mm);
          gap: 1.5mm;
        }
        .label {
          width: 30mm;
          height: 20mm;
          overflow: hidden;
          border: 1px dashed #bbb;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 1mm;
        }
        .label .toko { font-size: 6px; font-weight: bold; }
        .label svg { width: 26mm; height: 8mm; }
        .label .kode { font-size: 7px; font-weight: bold; letter-spacing: 1px; }
        .label .nama {
          font-size: 5.5px; max-width: 28mm;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .label .info { font-size: 5.5px; color: #555; }
        @media print {
          .label { border: none; }
        }
      </style></head>
      <body>
        <div class="sheet">${labelHtml.repeat(jumlahLabel)}</div>
        <script>window.onload = function () { window.print(); };</script>
      </body></html>
    `);
    w.document.close();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
            {editData ? "Ubah Barang" : "Tambah Barang Baru"}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors font-bold text-xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* ID Barang */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Kode Barang (dibuat otomatis)</label>
            <p className="text-sm text-gray-400 mb-1.5">
              Kode ini dibuat otomatis sesuai Jenis Barang yang dipilih. Tidak perlu diubah,
              kecuali toko sudah punya sistem kode sendiri.
            </p>
            <div className="flex gap-2">
              <input
                value={form.id_item}
                onChange={(e) => { idTouchedRef.current = true; set("id_item", e.target.value); }}
                placeholder="Contoh: GL0001"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20 uppercase"
              />
              {!editData && (
                <button
                  type="button"
                  onClick={generateNewId}
                  title="Buat kode otomatis ulang"
                  className="px-4 rounded-xl border-2 font-semibold text-sm transition-colors hover:bg-amber-50"
                  style={{ borderColor: "#C99A36", color: "#C99A36" }}
                >
                  Buat Otomatis
                </button>
              )}
            </div>
          </div>

          {/* Jenis Barang */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Jenis Barang</label>
            <p className="text-sm text-gray-400 mb-1.5">Pilih jenis barang ini. Tidak ada di daftar? Tambahkan jenis baru.</p>
            <div className="flex flex-wrap gap-2">
              {jenisOptions.map((j) => (
                <div key={j} className="relative">
                  <button
                    type="button"
                    onClick={() => set("jenis_barang", j)}
                    className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                      form.jenis_barang === j
                        ? "bg-[#C99A36] border-[#C99A36] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                    }`}
                  >
                    {j}
                  </button>
                  {customJenis.includes(j) && (
                    <button
                      type="button"
                      onClick={() => onDeleteJenis(j)}
                      title={`Hapus jenis "${j}" dari daftar`}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShowAddJenis(true)}
                className="px-4 py-2.5 rounded-full text-base font-semibold border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#C99A36] hover:text-[#C99A36] transition-colors"
              >
                + Jenis Baru
              </button>
            </div>
          </div>

          <AddJenisModal
            open={showAddJenis}
            onClose={() => setShowAddJenis(false)}
            onAdd={async (nama) => {
              const result = await onAddJenis(nama);
              if (result) set("jenis_barang", result);
              return result;
            }}
          />

          {/* Nama Barang */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Nama Barang</label>
            <input
              value={form.nama_produk}
              onChange={(e) => set("nama_produk", e.target.value)}
              placeholder="Contoh: Gelang Rantai Singapur"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20"
            />
          </div>

          {/* Gambar Barang */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Foto Barang <span className="text-gray-400 font-normal">(opsional)</span></label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.gambar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.gambar_url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-semibold border-2 cursor-pointer transition-colors hover:bg-amber-50 w-full justify-center"
                  style={{ borderColor: "#C99A36", color: "#C99A36" }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  {uploading ? "Mengunggah foto..." : "Ambil / Pilih Foto"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadGambar(f); }}
                  />
                </label>
                <p className="text-sm text-gray-400">Atau tempel link gambar di bawah ini.</p>
                <input
                  value={form.gambar_url}
                  onChange={(e) => set("gambar_url", e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                />
              </div>
            </div>
          </div>

          {/* Kadar / Berat / Jumlah */}
          <div>
            <div className="grid grid-cols-3 gap-2 mb-1.5">
              {["Kadar", "Berat (gram)", "Jumlah"].map((h) => (
                <label key={h} className="text-sm font-semibold text-gray-600">{h}</label>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={form.kadar}
                onChange={(e) => set("kadar", e.target.value)}
                placeholder="24K"
                className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
              />
              <input
                type="number"
                value={form.berat_gram}
                onChange={(e) => set("berat_gram", e.target.value)}
                placeholder="3.50"
                min="0"
                step="0.01"
                className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
              />
              <input
                type="number"
                value={form.jumlah}
                onChange={(e) => set("jumlah", e.target.value)}
                placeholder="1"
                min="1"
                className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
              />
            </div>
          </div>

          {/* Harga Modal / Harga Jual */}
          <div>
            <div className="grid grid-cols-2 gap-2 mb-1.5">
              {["Harga Modal (beli)", "Harga Jual"].map((h) => (
                <label key={h} className="text-sm font-semibold text-gray-600">{h}</label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={form.harga_beli}
                onChange={(e) => set("harga_beli", e.target.value)}
                placeholder="0"
                min="0"
                className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
              />
              <input
                type="number"
                value={form.harga_jual}
                onChange={(e) => set("harga_jual", e.target.value)}
                placeholder="0"
                min="0"
                className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
              />
            </div>
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Supplier</label>
            <input
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
              placeholder="Nama supplier"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
            />
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Keterangan</label>
            <textarea
              value={form.keterangan}
              onChange={(e) => set("keterangan", e.target.value)}
              placeholder="Catatan tambahan..."
              rows={2}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
            />
          </div>

          {/* Status Inventori */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Status Barang</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_INVENTORI.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status_inventori", s)}
                  className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                    form.status_inventori === s
                      ? "border-[#C99A36] " + (STATUS_BADGE[s] ?? "bg-gray-100 text-gray-600")
                      : "border-gray-200 text-gray-500 hover:border-[#C99A36]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Status Laporan */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Status Laporan</label>
            <p className="text-sm text-gray-400 mb-1.5">Tahap persetujuan laporan barang ini (boleh dibiarkan &quot;Draft&quot; jika belum tahu).</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_LAPORAN.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status_laporan", s)}
                  className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                    form.status_laporan === s
                      ? "bg-[#C99A36] border-[#C99A36] text-white"
                      : "border-gray-200 text-gray-500 hover:border-[#C99A36]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback */}
          {msg && (
            <p className={`text-sm font-semibold py-2.5 px-4 rounded-xl ${
              msg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}>
              {msg}
            </p>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-6 flex gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "#C99A36" }}
          >
            {saving ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
              </svg>
            )}
            {saving ? "Menyimpan..." : "Simpan Barang Ini"}
          </button>
          <button
            onClick={cetakBarcode}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-base border-2 transition-all hover:opacity-80 active:scale-[0.98]"
            style={{ borderColor: "#C99A36", color: "#C99A36" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Cetak Barcode
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Konfirmasi Hapus ─── */
function HapusPopup({
  open, item, onClose, onConfirm,
}: {
  open: boolean;
  item: BarangRow | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Hapus Barang Ini?</h3>
        <p className="text-gray-500 text-base mb-6">
          <strong>{item.nama_produk}</strong> ({item.id_item}) akan dihapus secara permanen dan tidak bisa dikembalikan.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-base hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button onClick={onConfirm} className="flex-1 py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-base transition-colors">
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Main Inventori Page ═══ */
function InventoriContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<BarangRow[]>([]);
  const [filtered, setFiltered] = useState<BarangRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BarangRow | null>(null);
  const [filterJenis, setFilterJenis] = useState("Pilih Jenis Inventori");
  const [showPopup, setShowPopup] = useState(false);
  const [showImportPopup, setShowImportPopup] = useState(false);
  const [editItem, setEditItem] = useState<BarangRow | null>(null);
  const [hapusItem, setHapusItem] = useState<BarangRow | null>(null);
  const [search, setSearch] = useState("");
  const [customJenis, setCustomJenis] = useState<string[]>([]);
  const [showAddJenisFilter, setShowAddJenisFilter] = useState(false);

  const allJenis = [...JENIS, ...customJenis];

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventori")
      .select("*")
      .order("tanggal_masuk", { ascending: false });
    const rows = (data ?? []) as BarangRow[];
    setItems(rows);
    setFiltered(rows);

    // Auto-select from URL param
    const idParam = searchParams.get("id");
    if (idParam) {
      const found = rows.find((r) => r.id === idParam);
      if (found) setSelected(found);
    }
    setLoading(false);
  }, [searchParams]);

  const loadCustomJenis = useCallback(async () => {
    const { data } = await supabase.from("jenis_barang_custom").select("nama").order("nama");
    setCustomJenis((data ?? []).map((d) => d.nama as string));
  }, []);

  const addCustomJenis = useCallback(async (nama: string): Promise<string | null> => {
    const trimmed = nama.trim();
    if (!trimmed) return null;
    // Jika sudah ada jenis dengan nama yang sama (tidak peduli besar/kecil huruf atau spasi),
    // gunakan nama yang sudah ada agar tidak terbentuk jenis ganda akibat typo (mis. "Gelang" vs "gelang")
    const existingMatch = allJenis.find((j) => j.toLowerCase() === trimmed.toLowerCase());
    if (existingMatch) return existingMatch;
    const { error } = await supabase.from("jenis_barang_custom").insert({ nama: trimmed });
    if (error) return null;
    setCustomJenis((prev) => [...prev, trimmed]);
    return trimmed;
  }, [allJenis]);

  const deleteCustomJenis = useCallback(async (nama: string) => {
    if (!window.confirm(`Hapus jenis barang "${nama}" dari daftar pilihan?\n\nBarang yang sudah memakai jenis ini tidak akan terhapus, hanya pilihannya saja yang dihilangkan.`)) {
      return;
    }
    const { error } = await supabase.from("jenis_barang_custom").delete().eq("nama", nama);
    if (error) { window.alert("Gagal menghapus jenis barang: " + error.message); return; }
    setCustomJenis((prev) => prev.filter((j) => j !== nama));
    if (filterJenis === nama) setFilterJenis("Pilih Jenis Inventori");
  }, [filterJenis]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCustomJenis(); }, [loadCustomJenis]);

  // Apply filters
  useEffect(() => {
    let result = items;
    if (filterJenis !== "Pilih Jenis Inventori") {
      const f = filterJenis.toLowerCase();
      result = result.filter((r) => r.jenis_barang.toLowerCase() === f || r.kategori.toLowerCase() === f);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.id_item.toLowerCase().includes(q) ||
        r.nama_produk.toLowerCase().includes(q) ||
        r.kadar.toLowerCase().includes(q)
      );
    }
    // Filter menipis from URL
    if (searchParams.get("filter") === "menipis") {
      result = result.filter((r) => r.jumlah <= 5);
    }
    setFiltered(result);
    // Reset selected if no longer in filtered
    if (selected && !result.find((r) => r.id === selected.id)) {
      setSelected(result[0] ?? null);
    }
  }, [items, filterJenis, search, searchParams]);

  const hapus = async () => {
    if (!hapusItem) return;
    await supabase.from("inventori").delete().eq("id", hapusItem.id);
    if (selected?.id === hapusItem.id) setSelected(null);
    setHapusItem(null);
    load();
  };

  const openTambah = () => { setEditItem(null); setShowPopup(true); };
  const openEdit = (item: BarangRow) => { setEditItem(item); setShowPopup(true); };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-6 pt-6 pb-8 flex flex-col gap-5">
          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Daftar Barang (Inventori)
            </h1>
            <p className="text-base text-gray-500 mt-1">
              Lihat, tambah, dan kelola semua barang emas yang ada di toko.
            </p>
          </div>

          {/* Help banner */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" style={{ color: "#C99A36" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="text-base text-gray-700 leading-relaxed">
              <strong>Cara pakai:</strong> Pilih salah satu barang di daftar kiri untuk melihat detailnya.
              Gunakan tombol besar <strong>Tambah 1 Barang</strong> untuk menambah barang satu-satu,
              atau <strong>Tambah Banyak Barang (CSV)</strong> jika ingin memasukkan banyak barang sekaligus dari file Excel.
            </p>
          </div>

          {/* Big action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={openTambah}
              className="flex items-center gap-4 px-6 py-5 rounded-2xl text-white font-bold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm text-left"
              style={{ backgroundColor: "#C99A36" }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">Tambah 1 Barang</p>
                <p className="text-sm font-normal opacity-90 mt-0.5">Masukkan satu barang baru ke daftar</p>
              </div>
            </button>
            <button
              onClick={() => setShowImportPopup(true)}
              className="flex items-center gap-4 px-6 py-5 rounded-2xl font-bold border-2 transition-all hover:bg-amber-50 active:scale-[0.98] text-left"
              style={{ borderColor: "#C99A36", color: "#C99A36" }}
            >
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 11v9m0-9l-3 3m3-3l3 3"/>
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">Tambah Banyak Barang (CSV)</p>
                <p className="text-sm font-normal opacity-80 mt-0.5">Masukkan banyak barang sekaligus dari file Excel/CSV</p>
              </div>
            </button>
          </div>

          {/* Two-column layout */}
          <div className="flex gap-5 min-h-[520px]">
            {/* LEFT: filter + list */}
            <div className="w-64 xl:w-72 flex-shrink-0 flex flex-col gap-3">
              {/* Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Cari Barang</label>
                <div className="relative">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ketik ID atau nama barang..."
                    className="w-full border border-gray-300 rounded-xl pl-4 pr-10 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                  </svg>
                </div>
              </div>

              {/* Jenis filter — tombol besar yang selalu terlihat */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Jenis Barang</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterJenis("Pilih Jenis Inventori")}
                    className={`px-3.5 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${
                      filterJenis === "Pilih Jenis Inventori"
                        ? "bg-[#C99A36] border-[#C99A36] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                    }`}
                  >
                    Semua
                  </button>
                  {allJenis.map((j) => (
                    <div key={j} className="relative">
                      <button
                        onClick={() => setFilterJenis(j)}
                        className={`px-3.5 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${
                          filterJenis === j
                            ? "bg-[#C99A36] border-[#C99A36] text-white"
                            : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                        }`}
                      >
                        {j}
                      </button>
                      {customJenis.includes(j) && (
                        <button
                          type="button"
                          onClick={() => deleteCustomJenis(j)}
                          title={`Hapus jenis "${j}" dari daftar`}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setShowAddJenisFilter(true)}
                    className="px-3.5 py-2 rounded-full text-sm font-semibold border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#C99A36] hover:text-[#C99A36] transition-colors"
                  >
                    + Jenis Baru
                  </button>
                </div>
              </div>

              <AddJenisModal
                open={showAddJenisFilter}
                onClose={() => setShowAddJenisFilter(false)}
                onAdd={async (nama) => {
                  const result = await addCustomJenis(nama);
                  if (result) setFilterJenis(result);
                  return result;
                }}
              />

              {/* List of items */}
              <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg"/>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                    <p className="text-gray-500 text-base font-medium">Barang tidak ditemukan</p>
                    <p className="text-gray-400 text-sm mt-1">Coba ganti kata pencarian atau pilih jenis &ldquo;Semua&rdquo;</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
                    {filtered.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelected(item)}
                        className={`w-full text-left px-4 py-3.5 transition-colors flex items-center gap-3 ${
                          selected?.id === item.id
                            ? "bg-amber-50 border-l-4 border-[#C99A36]"
                            : "hover:bg-gray-50 border-l-4 border-transparent"
                        }`}
                      >
                        {item.gambar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.gambar_url} alt={item.nama_produk} className="w-11 h-11 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-gray-800 leading-tight truncate">{item.nama_produk}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{item.id_item}</p>
                          <p className="mt-1">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[item.status_inventori] ?? "bg-gray-100 text-gray-600"}`}>
                              {item.status_inventori}
                            </span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: detail panel or empty state */}
            <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden">
              {!selected ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center px-8">
                  <svg className="w-20 h-20 mb-5" viewBox="0 0 80 80" fill="none">
                    <rect x="10" y="30" width="60" height="40" rx="4" fill="#F5E6C8" stroke="#C99A36" strokeWidth="2"/>
                    <path d="M10 40h60" stroke="#C99A36" strokeWidth="1.5"/>
                    <path d="M25 30V22a15 15 0 0130 0v8" stroke="#C99A36" strokeWidth="2" fill="none"/>
                    <rect x="28" y="42" width="24" height="16" rx="2" fill="#C99A36" opacity="0.3"/>
                    <path d="M36 46v8M44 46v8" stroke="#C99A36" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p className="text-gray-700 font-bold text-xl">Belum Ada Barang Dipilih</p>
                  <p className="text-gray-400 text-base mt-2 max-w-xs">
                    Klik salah satu barang di daftar sebelah kiri untuk melihat detailnya, atau tambah barang baru.
                  </p>
                  <button
                    onClick={openTambah}
                    className="mt-5 flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-bold text-base transition-all hover:opacity-90"
                    style={{ backgroundColor: "#C99A36" }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
                    </svg>
                    Tambah Barang Baru
                  </button>
                </div>
              ) : (
                <div className="p-6 h-full overflow-y-auto">
                  {/* Detail header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-start gap-4">
                      {selected.gambar_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selected.gambar_url}
                          alt={selected.nama_produk}
                          className="w-16 h-16 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                        />
                      )}
                      <div>
                        <p className="text-sm text-gray-400 font-medium uppercase tracking-wide mb-1">Detail Barang</p>
                        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
                          {selected.nama_produk}
                        </h2>
                        <p className="text-base text-gray-500 mt-0.5">{selected.id_item} • {selected.jenis_barang}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-3">
                      <button
                        onClick={() => openEdit(selected)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-semibold border-2 transition-colors hover:bg-amber-50"
                        style={{ borderColor: "#C99A36", color: "#C99A36" }}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        Ubah
                      </button>
                      <button
                        onClick={() => setHapusItem(selected)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-semibold border-2 border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Hapus
                      </button>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "Kadar",         value: selected.kadar || "—", icon: "💎" },
                      { label: "Berat",          value: `${selected.berat_gram} gram`, icon: "⚖️" },
                      { label: "Jumlah Stok",    value: `${selected.jumlah} pcs`, icon: "📦" },
                      { label: "Tanggal Masuk",  value: new Date(selected.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }), icon: "📅" },
                      { label: "Harga Modal",    value: selected.harga_beli ? `Rp ${selected.harga_beli.toLocaleString("id-ID")}` : "—", icon: "💰" },
                      { label: "Harga Jual",     value: selected.harga_jual ? `Rp ${selected.harga_jual.toLocaleString("id-ID")}` : "—", icon: "🏷️" },
                      { label: "Supplier",       value: selected.supplier || "—", icon: "🚚" },
                    ].map(({ label, value, icon }) => (
                      <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-sm text-gray-400 font-medium mb-1">{icon} {label}</p>
                        <p className="text-lg font-bold text-gray-800">{value}</p>
                      </div>
                    ))}
                  </div>

                  {selected.keterangan && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
                      <p className="text-sm text-gray-400 font-medium mb-1">📝 Keterangan</p>
                      <p className="text-base text-gray-700">{selected.keterangan}</p>
                    </div>
                  )}

                  {/* Status badges */}
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex flex-col gap-1.5">
                      <p className="text-sm text-gray-400 font-medium">Status Barang</p>
                      <span className={`px-4 py-2 rounded-full text-base font-bold w-fit ${STATUS_BADGE[selected.status_inventori] ?? "bg-gray-100 text-gray-600"}`}>
                        {selected.status_inventori}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-sm text-gray-400 font-medium">Status Laporan</p>
                      <span className={`px-4 py-2 rounded-full text-base font-bold w-fit ${
                        selected.status_laporan === "Approved"         ? "bg-green-100 text-green-700" :
                        selected.status_laporan === "Rejected"         ? "bg-red-100 text-red-700" :
                        selected.status_laporan === "Approval Signer"  ? "bg-stone-700 text-white" :
                        selected.status_laporan === "Approval Checker" ? "bg-blue-100 text-blue-700" :
                        "bg-orange-100 text-orange-600"
                      }`}>
                        {selected.status_laporan}
                      </span>
                    </div>
                  </div>

                  {/* Low stock warning */}
                  {selected.jumlah <= 5 && (
                    <div className="mt-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                      </svg>
                      <p className="text-red-600 text-base font-semibold">Stok menipis! Tersisa {selected.jumlah} pcs. Segera lakukan restok.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Popups */}
      <DetailBarangPopup
        open={showPopup}
        onClose={() => setShowPopup(false)}
        editData={editItem}
        onSaved={() => { load(); setShowPopup(false); }}
        jenisOptions={allJenis}
        customJenis={customJenis}
        existingIds={items.map((i) => i.id_item)}
        onAddJenis={addCustomJenis}
        onDeleteJenis={deleteCustomJenis}
      />
      <HapusPopup
        open={!!hapusItem}
        item={hapusItem}
        onClose={() => setHapusItem(null)}
        onConfirm={hapus}
      />
      <ImportCsvModal
        open={showImportPopup}
        onClose={() => setShowImportPopup(false)}
        onImported={load}
      />
    </AppLayout>
  );
}

export default function InventoriPage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Memuat...</p></div></AppLayout>}>
      <InventoriContent />
    </Suspense>
  );
}
