"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import {
  JENIS_PERHIASAN_OPTIONS, KADAR_OPTIONS, JANGKA_WAKTU_OPTIONS, STATUS_AWAL_OPTIONS,
  generateNoGadai, hitungJatuhTempo, buildCicilanSchedule, summarizeBarang,
} from "@/lib/gadai";
import type { InvoiceGadaiData } from "@/lib/gadai";
import { InvoiceGadai } from "@/components/InvoiceGadai";
import { printClean } from "@/lib/print";
import { AddJenisModal } from "@/components/AddJenisModal";
import { useJenisBarang } from "@/lib/useJenisBarang";

interface BarangItemForm {
  jenis_perhiasan: string;
  nama_barang: string;
  berat_gram: string;
  kadar: string;
  kondisi_barang: string;
  deskripsi: string;
  foto_barang_url: string;
}

interface FormData {
  pelanggan_nama: string;
  pelanggan_hp: string;
  pelanggan_alamat: string;
  foto_ktp_url: string;
  items: BarangItemForm[];
  nilai_taksiran: string;
  nilai_pinjaman: string;
  bunga_persen: string;
  jangka_waktu_bulan: number;
  tanggal_gadai: string;
  tanggal_jatuh_tempo: string;
  opsi_pembayaran: "Tunai" | "Cicilan";
  status: string;
  catatan: string;
}

const today = () => new Date().toISOString().split("T")[0];

const emptyBarangItem = (): BarangItemForm => ({
  jenis_perhiasan: JENIS_PERHIASAN_OPTIONS[0], nama_barang: "", berat_gram: "",
  kadar: "", kondisi_barang: "", deskripsi: "", foto_barang_url: "",
});

const emptyForm: FormData = {
  pelanggan_nama: "", pelanggan_hp: "", pelanggan_alamat: "", foto_ktp_url: "",
  items: [emptyBarangItem()],
  nilai_taksiran: "", nilai_pinjaman: "", bunga_persen: "2.5",
  jangka_waktu_bulan: JANGKA_WAKTU_OPTIONS[0],
  tanggal_gadai: today(), tanggal_jatuh_tempo: hitungJatuhTempo(today(), JANGKA_WAKTU_OPTIONS[0]),
  opsi_pembayaran: "Tunai", status: STATUS_AWAL_OPTIONS[0], catatan: "",
};

export default function TambahPengajuanGadaiPage() {
  const supabase = createClient();
  const router = useRouter();

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingKtp, setUploadingKtp] = useState(false);
  const [uploadingBarangIdx, setUploadingBarangIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [savedNoGadai, setSavedNoGadai] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAddJenis, setShowAddJenis] = useState(false);
  const [addJenisForIdx, setAddJenisForIdx] = useState<number | null>(null);
  const jatuhTempoTouchedRef = useRef(false);

  const { allJenis: jenisOptions, addCustomJenis } = useJenisBarang(JENIS_PERHIASAN_OPTIONS);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const setItem = <K extends keyof BarangItemForm>(idx: number, key: K, val: BarangItemForm[K]) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [key]: val } : it)) }));

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyBarangItem()] }));

  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  // Tanggal jatuh tempo otomatis = tanggal gadai + jangka waktu, kecuali sudah diubah manual
  useEffect(() => {
    if (jatuhTempoTouchedRef.current) return;
    setForm((f) => ({ ...f, tanggal_jatuh_tempo: hitungJatuhTempo(f.tanggal_gadai, f.jangka_waktu_bulan) }));
  }, [form.tanggal_gadai, form.jangka_waktu_bulan]);

  const uploadFotoKtp = async (file: File) => {
    setUploadingKtp(true);
    setMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `ktp-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("pegadaian-images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setMsg("Gagal upload foto: " + error.message);
      setUploadingKtp(false);
      return;
    }
    const { data } = supabase.storage.from("pegadaian-images").getPublicUrl(path);
    set("foto_ktp_url", data.publicUrl);
    setUploadingKtp(false);
  };

  const uploadFotoBarang = async (file: File, idx: number) => {
    setUploadingBarangIdx(idx);
    setMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `barang-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("pegadaian-images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setMsg("Gagal upload foto: " + error.message);
      setUploadingBarangIdx(null);
      return;
    }
    const { data } = supabase.storage.from("pegadaian-images").getPublicUrl(path);
    setItem(idx, "foto_barang_url", data.publicUrl);
    setUploadingBarangIdx(null);
  };

  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!form.pelanggan_nama.trim()) missing.push("Nama Pelanggan");
    if (!form.pelanggan_hp.trim()) missing.push("No. HP");
    if (!form.pelanggan_alamat.trim()) missing.push("Alamat");
    form.items.forEach((it, i) => {
      const n = form.items.length > 1 ? ` #${i + 1}` : "";
      if (!it.nama_barang.trim()) missing.push(`Nama Barang${n}`);
      if (!it.berat_gram.trim() || (parseFloat(it.berat_gram) || 0) <= 0) missing.push(`Berat (gram)${n}`);
      if (!it.kadar.trim()) missing.push(`Kadar Emas${n}`);
    });
    if (!form.nilai_taksiran.trim() || (parseFloat(form.nilai_taksiran) || 0) <= 0) missing.push("Nilai Taksiran");
    if (!form.nilai_pinjaman.trim() || (parseFloat(form.nilai_pinjaman) || 0) <= 0) missing.push("Nilai Pinjaman");
    if (!form.bunga_persen.trim()) missing.push("Bunga (%)");
    return missing;
  };

  const itemsNumeric = () => form.items.map((it) => ({
    jenis_perhiasan: it.jenis_perhiasan,
    nama_barang: it.nama_barang.trim(),
    berat_gram: parseFloat(it.berat_gram) || 0,
    kadar: it.kadar,
    kondisi_barang: it.kondisi_barang.trim() || null,
    deskripsi: it.deskripsi.trim() || null,
    foto_barang_url: it.foto_barang_url.trim() || null,
  }));

  const buildPayload = (noGadai: string) => {
    const summary = summarizeBarang(itemsNumeric());
    return {
      no_gadai: noGadai,
      pelanggan_nama: form.pelanggan_nama.trim(),
      pelanggan_hp: form.pelanggan_hp.trim(),
      pelanggan_alamat: form.pelanggan_alamat.trim(),
      foto_ktp_url: form.foto_ktp_url.trim() || null,
      ...summary,
      nilai_taksiran: Math.round(parseFloat(form.nilai_taksiran) || 0),
      nilai_pinjaman: Math.round(parseFloat(form.nilai_pinjaman) || 0),
      bunga_persen: parseFloat(form.bunga_persen) || 0,
      jangka_waktu_bulan: form.jangka_waktu_bulan,
      tanggal_gadai: form.tanggal_gadai,
      tanggal_jatuh_tempo: form.tanggal_jatuh_tempo,
      opsi_pembayaran: form.opsi_pembayaran,
      status: form.status,
      catatan: form.catatan.trim() || null,
      updated_at: new Date().toISOString(),
    };
  };

  const simpan = async (): Promise<{ id: string; no_gadai: string } | null> => {
    const missing = missingFields();
    if (missing.length > 0) {
      setMsg(`Lengkapi dulu: ${missing.join(", ")}.`);
      return null;
    }
    setSaving(true);
    setMsg("");

    const noGadai = savedNoGadai ?? generateNoGadai();
    const payload = buildPayload(noGadai);

    const { data, error } = savedId
      ? await supabase.from("gadai").update(payload).eq("id", savedId).select("id, no_gadai").single()
      : await supabase.from("gadai").insert(payload).select("id, no_gadai").single();

    if (error) {
      setSaving(false);
      setMsg("Gagal menyimpan: " + error.message);
      return null;
    }

    if (savedId) {
      await supabase.from("gadai_barang").delete().eq("gadai_id", savedId);
    }
    const { error: barangError } = await supabase.from("gadai_barang").insert(
      itemsNumeric().map((it, i) => ({ ...it, gadai_id: data.id, urutan: i + 1 }))
    );
    if (barangError) {
      setSaving(false);
      setMsg("Pengajuan tersimpan, tapi gagal menyimpan data barang: " + barangError.message);
      return null;
    }

    if (!savedId && form.opsi_pembayaran === "Cicilan") {
      const schedule = buildCicilanSchedule(
        parseFloat(form.nilai_pinjaman) || 0,
        parseFloat(form.bunga_persen) || 0,
        form.jangka_waktu_bulan,
        form.tanggal_gadai
      );
      const { error: cicilanError } = await supabase.from("gadai_cicilan").insert(
        schedule.map((c) => ({ ...c, gadai_id: data.id }))
      );
      if (cicilanError) {
        setSaving(false);
        setMsg("Pengajuan tersimpan, tapi gagal membuat jadwal cicilan: " + cicilanError.message);
        return null;
      }
    }

    setSaving(false);
    setSavedId(data.id);
    setSavedNoGadai(data.no_gadai);
    return { id: data.id, no_gadai: data.no_gadai };
  };

  const simpanPengajuan = async () => {
    const result = await simpan();
    if (result) setMsg("✓ Pengajuan gadai berhasil disimpan!");
  };

  const invoiceData: InvoiceGadaiData = {
    no_gadai: savedNoGadai ?? "",
    items: itemsNumeric(),
    nilai_pinjaman: Math.round(parseFloat(form.nilai_pinjaman) || 0),
    bunga_persen: parseFloat(form.bunga_persen) || 0,
    tanggal_gadai: form.tanggal_gadai,
    tanggal_jatuh_tempo: form.tanggal_jatuh_tempo,
    catatan: form.catatan.trim() || undefined,
  };

  const mulaiPengajuanBaru = () => {
    setForm(emptyForm);
    setSavedId(null);
    setSavedNoGadai(null);
    setShowPreviewModal(false);
    setMsg("");
    jatuhTempoTouchedRef.current = false;
  };

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          aside, nav, #gadai-form-screen, #gadai-preview-overlay { display: none !important; }
          #invoice-print { display: block !important; }
          html, body { background: white !important; margin: 0; }
          @page { size: A5 landscape; margin: 10mm; }
        }
      `}</style>

      {/* Invoice — hidden on screen, visible on print */}
      {savedNoGadai && <InvoiceGadai mode="print" data={invoiceData} />}

      <AppLayout>
      <div id="gadai-form-screen" className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-4 sm:px-6 pt-6 pb-10 max-w-5xl mx-auto w-full flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Tambah Pengajuan Gadai
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Isi data pelanggan, barang, dan ketentuan pinjaman untuk pengajuan gadai baru.
            </p>
          </div>

          {savedNoGadai ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-3">
              <p className="text-4xl">✅</p>
              <p className="text-lg font-bold text-gray-800">Pengajuan gadai berhasil disimpan!</p>
              <p className="text-sm text-gray-500">
                No. Gadai: <span className="font-mono font-semibold">{savedNoGadai}</span>
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
                  onClick={mulaiPengajuanBaru}
                  className="px-6 py-3 rounded-xl border-2 font-bold hover:bg-amber-50 transition-all"
                  style={{ borderColor: "#C99A36", color: "#C99A36" }}
                >
                  + Pengajuan Baru
                </button>
              </div>
              <div className="pt-1">
                <button
                  onClick={() => router.push("/pegadaian")}
                  className="text-sm font-semibold text-[#C99A36] hover:underline"
                >
                  Kembali ke Daftar Pengajuan Gadai
                </button>
              </div>
            </div>
          ) : (<>

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

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Foto KTP <span className="text-gray-400 font-normal">(opsional)</span></label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {form.foto_ktp_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.foto_ktp_url} alt="Foto KTP" className="w-full h-full object-cover" />
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
                    {uploadingKtp ? "Mengunggah foto..." : "Ambil / Pilih Foto KTP"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploadingKtp}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFotoKtp(f); }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Data Barang Gadai ── */}
          {form.items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>
                  Data Barang Gadai {form.items.length > 1 ? `#${idx + 1}` : ""}
                </h2>
                {form.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-sm font-semibold text-red-500 hover:underline"
                  >
                    Hapus
                  </button>
                )}
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Jenis Perhiasan</label>
                <div className="flex flex-wrap gap-2">
                  {jenisOptions.map((j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setItem(idx, "jenis_perhiasan", j)}
                      className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                        item.jenis_perhiasan === j
                          ? "bg-[#C99A36] border-[#C99A36] text-white"
                          : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                      }`}
                    >
                      {j}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setAddJenisForIdx(idx); setShowAddJenis(true); }}
                    className="px-4 py-2.5 rounded-full text-base font-semibold border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#C99A36] hover:text-[#C99A36] transition-colors"
                  >
                    + Jenis Baru
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Nama Barang</label>
                <input
                  value={item.nama_barang}
                  onChange={(e) => setItem(idx, "nama_barang", e.target.value)}
                  placeholder="Contoh: Gelang Rantai Singapur"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Berat (gram)</label>
                  <input
                    type="number"
                    value={item.berat_gram}
                    onChange={(e) => setItem(idx, "berat_gram", e.target.value)}
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
                    list="kadar-gadai-options"
                    value={item.kadar}
                    onChange={(e) => setItem(idx, "kadar", e.target.value)}
                    placeholder="Contoh: 24K, 18K"
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36] bg-white"
                  />
                  <datalist id="kadar-gadai-options">
                    {KADAR_OPTIONS.map((k) => <option key={k} value={k} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Kondisi Barang <span className="text-gray-400 font-normal">(opsional)</span></label>
                <input
                  value={item.kondisi_barang}
                  onChange={(e) => setItem(idx, "kondisi_barang", e.target.value)}
                  placeholder="Contoh: Baik, sedikit baret"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Deskripsi Singkat <span className="text-gray-400 font-normal">(opsional)</span></label>
                <textarea
                  value={item.deskripsi}
                  onChange={(e) => setItem(idx, "deskripsi", e.target.value)}
                  placeholder="Catatan tambahan tentang barang..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Foto Barang <span className="text-gray-400 font-normal">(opsional)</span></label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.foto_barang_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.foto_barang_url} alt="Foto Barang" className="w-full h-full object-cover" />
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
                      {uploadingBarangIdx === idx ? "Mengunggah foto..." : "Ambil / Pilih Foto Barang"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingBarangIdx === idx}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFotoBarang(f, idx); }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <AddJenisModal
            open={showAddJenis}
            onClose={() => setShowAddJenis(false)}
            onAdd={async (nama) => {
              const result = await addCustomJenis(nama);
              if (result && addJenisForIdx !== null) setItem(addJenisForIdx, "jenis_perhiasan", result);
              return result;
            }}
          />

          <button
            type="button"
            onClick={addItem}
            className="w-full py-3 rounded-xl border-2 border-dashed font-semibold text-base transition-colors hover:bg-amber-50"
            style={{ borderColor: "#C99A36", color: "#C99A36" }}
          >
            + Tambah Barang Lain
          </button>

          {/* ── Data Pinjaman ── */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Data Pinjaman</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nilai Taksiran (Rp)</label>
                <input
                  type="number"
                  value={form.nilai_taksiran}
                  onChange={(e) => set("nilai_taksiran", e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nilai Pinjaman (Rp)</label>
                <input
                  type="number"
                  value={form.nilai_pinjaman}
                  onChange={(e) => set("nilai_pinjaman", e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Bunga (% per bulan)</label>
              <input
                type="number"
                value={form.bunga_persen}
                onChange={(e) => set("bunga_persen", e.target.value)}
                placeholder="0"
                min="0"
                step="0.1"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Jangka Waktu</label>
              <div className="flex flex-wrap gap-2">
                {JANGKA_WAKTU_OPTIONS.map((bulan) => (
                  <button
                    key={bulan}
                    type="button"
                    onClick={() => set("jangka_waktu_bulan", bulan)}
                    className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                      form.jangka_waktu_bulan === bulan
                        ? "bg-[#C99A36] border-[#C99A36] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                    }`}
                  >
                    {bulan} Bulan
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Tanggal Gadai</label>
                  <input
                    type="date"
                    value={form.tanggal_gadai}
                    onChange={(e) => set("tanggal_gadai", e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Tanggal Jatuh Tempo</label>
                  <input
                    type="date"
                    value={form.tanggal_jatuh_tempo}
                    onChange={(e) => { jatuhTempoTouchedRef.current = true; set("tanggal_jatuh_tempo", e.target.value); }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Jatuh tempo dihitung otomatis dari tanggal gadai + jangka waktu, dan bisa diubah manual.</p>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Opsi Pembayaran</label>
              <div className="flex flex-wrap gap-2">
                {(["Tunai", "Cicilan"] as const).map((opsi) => (
                  <button
                    key={opsi}
                    type="button"
                    onClick={() => set("opsi_pembayaran", opsi)}
                    className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                      form.opsi_pembayaran === opsi
                        ? "bg-[#C99A36] border-[#C99A36] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                    }`}
                  >
                    {opsi}
                  </button>
                ))}
              </div>
              {form.opsi_pembayaran === "Cicilan" && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Jadwal cicilan akan dibuat otomatis sebanyak {form.jangka_waktu_bulan} bulan saat pengajuan disimpan.
                </p>
              )}
            </div>
          </div>

          {/* ── Status & Catatan ── */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Status Awal & Catatan</h2>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Status Awal</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_AWAL_OPTIONS.map((s) => (
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
                value={form.catatan}
                onChange={(e) => set("catatan", e.target.value)}
                placeholder="Catatan internal mengenai pengajuan ini..."
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
              />
            </div>
          </div>

          {msg && (
            <p className={`text-sm font-semibold py-2.5 px-4 rounded-xl ${msg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {msg}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={() => router.push("/pegadaian")}
              className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={simpanPengajuan}
              disabled={saving}
              className="flex-1 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#C99A36" }}
            >
              {saving ? "Menyimpan..." : "Simpan Pengajuan"}
            </button>
          </div>

          </>)}
        </div>
      </div>
      </AppLayout>

      {/* ── MODAL: PREVIEW / CETAK INVOICE ── */}
      {showPreviewModal && savedNoGadai && (
        <div id="gadai-preview-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Preview Invoice Gadai</h2>
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
                <InvoiceGadai mode="preview" data={invoiceData} />
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
