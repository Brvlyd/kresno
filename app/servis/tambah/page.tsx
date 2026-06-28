"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import {
  JENIS_PERHIASAN_OPTIONS, KADAR_OPTIONS, JENIS_KERUSAKAN_OPTIONS, JENIS_TINDAKAN_OPTIONS,
  PRIORITAS_OPTIONS, ESTIMASI_WAKTU_OPTIONS, fmtRupiah,
  generateNoServis, hitungEstimasiSelesai,
} from "@/lib/servis";
import type { InvoiceServisData } from "@/lib/servis";
import { InvoiceServis } from "@/components/InvoiceServis";
import { printClean } from "@/lib/print";
import { AddJenisModal } from "@/components/AddJenisModal";
import { useJenisBarang } from "@/lib/useJenisBarang";
import StorageImage from "@/components/StorageImage";

interface FormData {
  pelanggan_nama: string;
  pelanggan_hp: string;
  pelanggan_alamat: string;
  jenis_perhiasan: string;
  nama_barang: string;
  berat_gram: string;
  kadar: string;
  kondisi_awal: string;
  deskripsi: string;
  foto_barang_url: string;
  jenis_kerusakan: string;
  jenis_tindakan: string;
  prioritas: string;
  catatan_kerusakan: string;
  estimasi_biaya: string;
  uang_muka: string;
  estimasi_waktu_hari: number;
  tanggal_masuk: string;
  estimasi_selesai: string;
  status: string;
  catatan_tambahan: string;
}

const today = () => new Date().toISOString().split("T")[0];

const emptyForm: FormData = {
  pelanggan_nama: "", pelanggan_hp: "", pelanggan_alamat: "",
  jenis_perhiasan: JENIS_PERHIASAN_OPTIONS[0], nama_barang: "", berat_gram: "",
  kadar: "", kondisi_awal: "", deskripsi: "", foto_barang_url: "",
  jenis_kerusakan: "", jenis_tindakan: "", prioritas: PRIORITAS_OPTIONS[0], catatan_kerusakan: "",
  estimasi_biaya: "", uang_muka: "",
  estimasi_waktu_hari: ESTIMASI_WAKTU_OPTIONS[0],
  tanggal_masuk: today(), estimasi_selesai: hitungEstimasiSelesai(today(), ESTIMASI_WAKTU_OPTIONS[0]),
  status: "Menunggu", catatan_tambahan: "",
};

function TambahServisContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Bisa dipilih lewat URL (?jenis=Cuci) atau langsung di form
  const initialJenis = searchParams.get("jenis") === "Cuci" ? "Cuci"
    : searchParams.get("jenis") === "Perbaikan" ? "Perbaikan"
    : null;
  const [jenisServis, setJenisServis] = useState<"Cuci" | "Perbaikan" | null>(initialJenis);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [msg, setMsg] = useState("");
  const [savedNoServis, setSavedNoServis] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAddJenis, setShowAddJenis] = useState(false);
  const estimasiTouchedRef = useRef(false);

  const { allJenis: jenisOptions, addCustomJenis } = useJenisBarang(JENIS_PERHIASAN_OPTIONS);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  // Estimasi selesai otomatis = tanggal masuk + estimasi waktu, kecuali sudah diubah manual
  useEffect(() => {
    if (estimasiTouchedRef.current) return;
    setForm((f) => ({ ...f, estimasi_selesai: hitungEstimasiSelesai(f.tanggal_masuk, f.estimasi_waktu_hari) }));
  }, [form.tanggal_masuk, form.estimasi_waktu_hari]);

  const uploadFoto = async (file: File) => {
    setUploadingFoto(true);
    setMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `barang-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("servis-images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setMsg("Gagal upload foto: " + error.message);
      setUploadingFoto(false);
      return;
    }
    const { data } = supabase.storage.from("servis-images").getPublicUrl(path);
    set("foto_barang_url", data.publicUrl);
    setUploadingFoto(false);
  };

  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!jenisServis) missing.push("Jenis Servis (Cuci / Perbaikan)");
    if (!form.pelanggan_nama.trim()) missing.push("Nama Pelanggan");
    if (!form.pelanggan_hp.trim()) missing.push("No. HP");
    if (!form.pelanggan_alamat.trim()) missing.push("Alamat");
    if (!form.nama_barang.trim()) missing.push("Nama Barang");
    if (!form.berat_gram.trim() || (parseFloat(form.berat_gram) || 0) <= 0) missing.push("Berat (gram)");
    if (!form.kadar.trim()) missing.push("Kadar Emas");
    if (!form.estimasi_biaya.trim() || (parseFloat(form.estimasi_biaya) || 0) <= 0) missing.push("Estimasi Biaya");
    if (jenisServis === "Perbaikan") {
      if (!form.jenis_kerusakan.trim()) missing.push("Jenis Kerusakan");
      if (!form.jenis_tindakan.trim()) missing.push("Jenis Tindakan");
    }
    return missing;
  };

  const buildPayload = (noServis: string) => ({
    no_servis: noServis,
    jenis_servis: jenisServis as "Cuci" | "Perbaikan",
    pelanggan_nama: form.pelanggan_nama.trim(),
    pelanggan_hp: form.pelanggan_hp.trim(),
    pelanggan_alamat: form.pelanggan_alamat.trim(),
    jenis_perhiasan: form.jenis_perhiasan,
    nama_barang: form.nama_barang.trim(),
    berat_gram: parseFloat(form.berat_gram) || 0,
    kadar: form.kadar,
    kondisi_awal: form.kondisi_awal.trim() || null,
    deskripsi: form.deskripsi.trim() || null,
    foto_barang_url: form.foto_barang_url.trim() || null,
    jenis_kerusakan: jenisServis === "Perbaikan" ? form.jenis_kerusakan : null,
    jenis_tindakan: jenisServis === "Perbaikan" ? form.jenis_tindakan : null,
    prioritas: jenisServis === "Perbaikan" ? form.prioritas : null,
    catatan_kerusakan: jenisServis === "Perbaikan" ? (form.catatan_kerusakan.trim() || null) : null,
    estimasi_biaya: Math.round(parseFloat(form.estimasi_biaya) || 0),
    uang_muka: Math.round(parseFloat(form.uang_muka) || 0),
    status: form.status,
    tanggal_masuk: form.tanggal_masuk,
    estimasi_selesai: form.estimasi_selesai,
    catatan_tambahan: form.catatan_tambahan.trim() || null,
    updated_at: new Date().toISOString(),
  });

  const simpan = async (): Promise<{ id: string; no_servis: string } | null> => {
    const missing = missingFields();
    if (missing.length > 0) {
      setMsg(`Lengkapi dulu: ${missing.join(", ")}.`);
      return null;
    }
    setSaving(true);
    setMsg("");

    const noServis = savedNoServis ?? generateNoServis();
    const payload = buildPayload(noServis);

    const { data, error } = savedId
      ? await supabase.from("servis").update(payload).eq("id", savedId).select("id, no_servis").single()
      : await supabase.from("servis").insert(payload).select("id, no_servis").single();

    setSaving(false);
    if (error) {
      setMsg("Gagal menyimpan: " + error.message);
      return null;
    }

    setSavedId(data.id);
    setSavedNoServis(data.no_servis);
    return { id: data.id, no_servis: data.no_servis };
  };

  const simpanServis = async () => {
    const result = await simpan();
    if (result) setMsg("✓ Servis berhasil disimpan!");
  };

  const invoiceData: InvoiceServisData = {
    no_servis: savedNoServis ?? "",
    tanggal_masuk: form.tanggal_masuk,
    jenis_servis: (jenisServis ?? "Cuci") as "Cuci" | "Perbaikan",
    nama_barang: form.nama_barang.trim(),
    berat_gram: parseFloat(form.berat_gram) || 0,
    kadar: form.kadar,
    estimasi_selesai: form.estimasi_selesai,
    estimasi_biaya: Math.round(parseFloat(form.estimasi_biaya) || 0),
    uang_muka: Math.round(parseFloat(form.uang_muka) || 0),
  };

  const mulaiServisBaru = () => {
    setForm(emptyForm);
    setJenisServis(null);
    setSavedId(null);
    setSavedNoServis(null);
    setShowPreviewModal(false);
    setMsg("");
    estimasiTouchedRef.current = false;
  };

  const sisaPembayaran = (Math.round(parseFloat(form.estimasi_biaya) || 0)) - (Math.round(parseFloat(form.uang_muka) || 0));

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          aside, nav, #servis-form-screen, #servis-preview-overlay { display: none !important; }
          #invoice-print { display: block !important; }
          html, body { background: white !important; margin: 0; }
          @page { size: A5 landscape; margin: 10mm; }
        }
      `}</style>

      {/* Invoice — hidden on screen, visible on print */}
      {savedNoServis && <InvoiceServis mode="print" data={invoiceData} />}

      <AppLayout>
      <div id="servis-form-screen" className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-4 sm:px-6 pt-6 pb-10 max-w-5xl mx-auto w-full flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Tambah Servis Layanan
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Pilih jenis layanan, lalu isi data servis di bawah ini.
            </p>
          </div>

          {savedNoServis ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-3">
              <p className="text-4xl">✅</p>
              <p className="text-lg font-bold text-gray-800">Servis berhasil disimpan!</p>
              <p className="text-sm text-gray-500">
                No. Servis: <span className="font-mono font-semibold">{savedNoServis}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="px-6 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-all"
                  style={{ backgroundColor: "#C99A36" }}
                >
                  🖨️ Lihat / Cetak Invoice
                </button>
                <button
                  onClick={mulaiServisBaru}
                  className="px-6 py-3 rounded-xl border-2 font-bold hover:bg-amber-50 transition-all"
                  style={{ borderColor: "#C99A36", color: "#C99A36" }}
                >
                  + Servis Baru
                </button>
              </div>
              <div className="pt-1">
                <button
                  onClick={() => router.push("/servis")}
                  className="text-sm font-semibold text-[#C99A36] hover:underline"
                >
                  Kembali ke Daftar Servis
                </button>
              </div>
            </div>
          ) : (<>

          {/* Pilih jenis servis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setJenisServis("Cuci")}
              className={`flex items-center gap-4 px-5 py-5 rounded-2xl border-2 font-bold transition-all text-left ${
                jenisServis === "Cuci"
                  ? "border-[#C99A36] bg-amber-50 text-gray-900"
                  : "border-gray-200 text-gray-500 hover:border-[#C99A36] hover:bg-amber-50/40"
              }`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                jenisServis === "Cuci" ? "bg-amber-100" : "bg-gray-100"
              }`}>
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke={jenisServis === "Cuci" ? "#C99A36" : "#9CA3AF"} strokeWidth="2">
                  <path d="M7 3v4M12 3v4M17 3v4" strokeLinecap="round"/>
                  <path d="M4 9h16l-1.5 9.5A2 2 0 0116.5 20h-9A2 2 0 015.5 18.5L4 9z" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-base font-bold leading-tight">Cuci Perhiasan</p>
                <p className="text-xs font-normal text-gray-400 mt-0.5">Pembersihan &amp; pemolesan</p>
              </div>
              {jenisServis === "Cuci" && (
                <svg className="w-5 h-5 ml-auto shrink-0" style={{ color: "#C99A36" }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => setJenisServis("Perbaikan")}
              className={`flex items-center gap-4 px-5 py-5 rounded-2xl border-2 font-bold transition-all text-left ${
                jenisServis === "Perbaikan"
                  ? "border-[#C99A36] bg-amber-50 text-gray-900"
                  : "border-gray-200 text-gray-500 hover:border-[#C99A36] hover:bg-amber-50/40"
              }`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                jenisServis === "Perbaikan" ? "bg-amber-100" : "bg-gray-100"
              }`}>
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke={jenisServis === "Perbaikan" ? "#C99A36" : "#9CA3AF"} strokeWidth="2">
                  <path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2-2 2.5-2.5z" strokeLinejoin="round" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-base font-bold leading-tight">Perbaikan Perhiasan</p>
                <p className="text-xs font-normal text-gray-400 mt-0.5">Servis kerusakan &amp; restorasi</p>
              </div>
              {jenisServis === "Perbaikan" && (
                <svg className="w-5 h-5 ml-auto shrink-0" style={{ color: "#C99A36" }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              )}
            </button>
          </div>

          {/* Form fields — tampil hanya setelah jenis dipilih */}
          {!jenisServis && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-800 text-sm font-semibold">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Pilih salah satu jenis layanan di atas untuk melanjutkan pengisian formulir.
            </div>
          )}

          {jenisServis && (<>

          {/* ── Data Pelanggan ── */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Data Pelanggan</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Nama Pelanggan</label>
                <input
                  value={form.pelanggan_nama}
                  onChange={(e) => set("pelanggan_nama", e.target.value)}
                  placeholder="Nama lengkap"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">No. HP</label>
                <input
                  value={form.pelanggan_hp}
                  onChange={(e) => set("pelanggan_hp", e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Alamat</label>
              <textarea
                value={form.pelanggan_alamat}
                onChange={(e) => set("pelanggan_alamat", e.target.value)}
                placeholder="Alamat lengkap"
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
              />
            </div>
          </div>

          {/* ── Data Perhiasan ── */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Data Perhiasan</h2>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Jenis Perhiasan</label>
              <div className="flex flex-wrap gap-2">
                {jenisOptions.map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => set("jenis_perhiasan", j)}
                    className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                      form.jenis_perhiasan === j
                        ? "bg-[#C99A36] border-[#C99A36] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                    }`}
                  >
                    {j}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddJenis(true)}
                  className="px-4 py-2.5 rounded-full text-base font-semibold border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#C99A36] hover:text-[#C99A36] transition-colors"
                >
                  + Jenis Baru
                </button>
              </div>

              <AddJenisModal
                open={showAddJenis}
                onClose={() => setShowAddJenis(false)}
                onAdd={async (nama) => {
                  const result = await addCustomJenis(nama);
                  if (result) set("jenis_perhiasan", result);
                  return result;
                }}
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Nama Barang</label>
              <input
                value={form.nama_barang}
                onChange={(e) => set("nama_barang", e.target.value)}
                placeholder="Contoh: Gelang Rantai Singapur"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Berat (gram)</label>
                <input
                  type="number"
                  value={form.berat_gram}
                  onChange={(e) => set("berat_gram", e.target.value)}
                  placeholder="3.50"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Kadar Emas</label>
                <input
                  type="text"
                  list="kadar-servis-options"
                  value={form.kadar}
                  onChange={(e) => set("kadar", e.target.value)}
                  placeholder="Contoh: 24K, 18K"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36] bg-white"
                />
                <datalist id="kadar-servis-options">
                  {KADAR_OPTIONS.map((k) => <option key={k} value={k} />)}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Kondisi Awal <span className="text-gray-400 font-normal">(opsional)</span></label>
              <input
                value={form.kondisi_awal}
                onChange={(e) => set("kondisi_awal", e.target.value)}
                placeholder="Contoh: Kotor, ada baret halus"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Deskripsi Singkat <span className="text-gray-400 font-normal">(opsional)</span></label>
              <textarea
                value={form.deskripsi}
                onChange={(e) => set("deskripsi", e.target.value)}
                placeholder="Catatan tambahan tentang barang..."
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Foto Barang <span className="text-gray-400 font-normal">(opsional)</span></label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {form.foto_barang_url ? (
                    <StorageImage src={form.foto_barang_url} alt="Foto Barang" className="w-full h-full object-cover" />
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
                    {uploadingFoto ? "Mengunggah foto..." : "Ambil / Pilih Foto Barang"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploadingFoto}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(f); }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Detail Perbaikan (hanya untuk jenis Perbaikan) ── */}
          {jenisServis === "Perbaikan" && (
            <div className="border border-gray-200 rounded-xl p-5 space-y-4">
              <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Detail Perbaikan</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Jenis Kerusakan</label>
                  <select
                    value={form.jenis_kerusakan}
                    onChange={(e) => set("jenis_kerusakan", e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36] bg-white"
                  >
                    <option value="">Pilih kerusakan</option>
                    {JENIS_KERUSAKAN_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Jenis Tindakan</label>
                  <select
                    value={form.jenis_tindakan}
                    onChange={(e) => set("jenis_tindakan", e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36] bg-white"
                  >
                    <option value="">Pilih tindakan</option>
                    {JENIS_TINDAKAN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Prioritas</label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITAS_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set("prioritas", p)}
                      className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                        form.prioritas === p
                          ? "bg-[#C99A36] border-[#C99A36] text-white"
                          : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Catatan Kerusakan <span className="text-gray-400 font-normal">(opsional)</span></label>
                <textarea
                  value={form.catatan_kerusakan}
                  onChange={(e) => set("catatan_kerusakan", e.target.value)}
                  placeholder="Jelaskan kerusakan secara detail..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Biaya & Status ── */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Biaya & Status</h2>

            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Estimasi Biaya (Rp)</label>
                  <input
                    type="number"
                    value={form.estimasi_biaya}
                    onChange={(e) => set("estimasi_biaya", e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Uang Muka (Rp)</label>
                  <input
                    type="number"
                    value={form.uang_muka}
                    onChange={(e) => set("uang_muka", e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Sisa Pembayaran: <span className="font-semibold text-gray-600">{fmtRupiah(Math.max(0, sisaPembayaran))}</span>
              </p>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Estimasi Waktu Pengerjaan</label>
              <div className="flex flex-wrap gap-2">
                {ESTIMASI_WAKTU_OPTIONS.map((hari) => (
                  <button
                    key={hari}
                    type="button"
                    onClick={() => set("estimasi_waktu_hari", hari)}
                    className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                      form.estimasi_waktu_hari === hari
                        ? "bg-[#C99A36] border-[#C99A36] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                    }`}
                  >
                    {hari} Hari
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Tanggal Masuk</label>
                  <input
                    type="date"
                    value={form.tanggal_masuk}
                    onChange={(e) => set("tanggal_masuk", e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Estimasi Selesai</label>
                  <input
                    type="date"
                    value={form.estimasi_selesai}
                    onChange={(e) => { estimasiTouchedRef.current = true; set("estimasi_selesai", e.target.value); }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Estimasi selesai dihitung otomatis dari tanggal masuk + estimasi waktu, dan bisa diubah manual.</p>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Status Awal</label>
              <div className="flex flex-wrap gap-2">
                {(["Menunggu", "Diproses"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("status", s)}
                    className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                      form.status === s
                        ? "bg-[#C99A36] border-[#C99A36] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Catatan Tambahan <span className="text-gray-400 font-normal">(opsional)</span></label>
              <textarea
                value={form.catatan_tambahan}
                onChange={(e) => set("catatan_tambahan", e.target.value)}
                placeholder="Catatan internal mengenai servis ini..."
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
              />
            </div>
          </div>

          </>)} {/* end jenisServis && */}

          {msg && (
            <p className={`text-sm font-semibold py-2.5 px-4 rounded-xl ${msg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {msg}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={() => router.push("/servis")}
              className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={simpanServis}
              disabled={saving || !jenisServis}
              className="flex-1 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#C99A36" }}
            >
              {saving ? "Menyimpan..." : "Simpan Servis"}
            </button>
          </div>

          </>)}
        </div>
      </div>
      </AppLayout>

      {/* ── MODAL: PREVIEW / CETAK INVOICE ── */}
      {showPreviewModal && savedNoServis && (
        <div id="servis-preview-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Preview Invoice Servis</h2>
                <p className="text-xs text-gray-400">Periksa kembali sebelum dicetak.</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="bg-white rounded-xl shadow-md p-5 mx-auto" style={{ maxWidth: 620 }}>
                <InvoiceServis mode="preview" data={invoiceData} />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100 rounded-b-2xl">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
              >
                ✕ Tutup
              </button>
              <button
                onClick={() => printClean()}
                className="flex-1 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-all"
                style={{ backgroundColor: "#C99A36" }}
              >
                🖨️ Cetak Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function TambahServisPage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Memuat...</p></div></AppLayout>}>
      <TambahServisContent />
    </Suspense>
  );
}
