"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import {
  JENIS_PERHIASAN_OPTIONS, KADAR_OPTIONS, JANGKA_WAKTU_OPTIONS, STATUS_AWAL_OPTIONS,
  generateNoGadai, hitungJatuhTempo, buildCicilanSchedule, cetakInvoiceGadai,
} from "@/lib/gadai";

interface FormData {
  pelanggan_nama: string;
  pelanggan_hp: string;
  pelanggan_alamat: string;
  foto_ktp_url: string;
  jenis_perhiasan: string;
  nama_barang: string;
  berat_gram: string;
  kadar: string;
  kondisi_barang: string;
  deskripsi: string;
  foto_barang_url: string;
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

const emptyForm: FormData = {
  pelanggan_nama: "", pelanggan_hp: "", pelanggan_alamat: "", foto_ktp_url: "",
  jenis_perhiasan: JENIS_PERHIASAN_OPTIONS[0], nama_barang: "", berat_gram: "",
  kadar: "", kondisi_barang: "", deskripsi: "", foto_barang_url: "",
  nilai_taksiran: "", nilai_pinjaman: "", bunga_persen: "",
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
  const [uploadingBarang, setUploadingBarang] = useState(false);
  const [msg, setMsg] = useState("");
  const [savedNoGadai, setSavedNoGadai] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const jatuhTempoTouchedRef = useRef(false);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  // Tanggal jatuh tempo otomatis = tanggal gadai + jangka waktu, kecuali sudah diubah manual
  useEffect(() => {
    if (jatuhTempoTouchedRef.current) return;
    setForm((f) => ({ ...f, tanggal_jatuh_tempo: hitungJatuhTempo(f.tanggal_gadai, f.jangka_waktu_bulan) }));
  }, [form.tanggal_gadai, form.jangka_waktu_bulan]);

  const uploadFoto = async (file: File, target: "foto_ktp_url" | "foto_barang_url") => {
    const setUploading = target === "foto_ktp_url" ? setUploadingKtp : setUploadingBarang;
    setUploading(true);
    setMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${target === "foto_ktp_url" ? "ktp" : "barang"}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("pegadaian-images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setMsg("Gagal upload foto: " + error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("pegadaian-images").getPublicUrl(path);
    set(target, data.publicUrl);
    setUploading(false);
  };

  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!form.pelanggan_nama.trim()) missing.push("Nama Pelanggan");
    if (!form.pelanggan_hp.trim()) missing.push("No. HP");
    if (!form.pelanggan_alamat.trim()) missing.push("Alamat");
    if (!form.nama_barang.trim()) missing.push("Nama Barang");
    if (!form.berat_gram.trim() || (parseFloat(form.berat_gram) || 0) <= 0) missing.push("Berat (gram)");
    if (!form.kadar.trim()) missing.push("Kadar Emas");
    if (!form.nilai_taksiran.trim() || (parseFloat(form.nilai_taksiran) || 0) <= 0) missing.push("Nilai Taksiran");
    if (!form.nilai_pinjaman.trim() || (parseFloat(form.nilai_pinjaman) || 0) <= 0) missing.push("Nilai Pinjaman");
    if (!form.bunga_persen.trim()) missing.push("Bunga (%)");
    return missing;
  };

  const buildPayload = (noGadai: string) => ({
    no_gadai: noGadai,
    pelanggan_nama: form.pelanggan_nama.trim(),
    pelanggan_hp: form.pelanggan_hp.trim(),
    pelanggan_alamat: form.pelanggan_alamat.trim(),
    foto_ktp_url: form.foto_ktp_url.trim() || null,
    jenis_perhiasan: form.jenis_perhiasan,
    nama_barang: form.nama_barang.trim(),
    berat_gram: parseFloat(form.berat_gram) || 0,
    kadar: form.kadar,
    kondisi_barang: form.kondisi_barang.trim() || null,
    deskripsi: form.deskripsi.trim() || null,
    foto_barang_url: form.foto_barang_url.trim() || null,
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
  });

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

  const cetak = async () => {
    let noGadai = savedNoGadai;
    if (!noGadai) {
      const result = await simpan();
      if (!result) return;
      noGadai = result.no_gadai;
    }
    const cicilanPerBulan = form.opsi_pembayaran === "Cicilan"
      ? buildCicilanSchedule(
          parseFloat(form.nilai_pinjaman) || 0,
          parseFloat(form.bunga_persen) || 0,
          form.jangka_waktu_bulan,
          form.tanggal_gadai
        )[0]?.jumlah_bayar
      : undefined;

    cetakInvoiceGadai({
      no_gadai: noGadai,
      tanggal_gadai: form.tanggal_gadai,
      pelanggan_nama: form.pelanggan_nama.trim(),
      pelanggan_alamat: form.pelanggan_alamat.trim(),
      pelanggan_hp: form.pelanggan_hp.trim(),
      jenis_perhiasan: form.jenis_perhiasan,
      nama_barang: form.nama_barang.trim(),
      berat_gram: parseFloat(form.berat_gram) || 0,
      kadar: form.kadar,
      nilai_taksiran: Math.round(parseFloat(form.nilai_taksiran) || 0),
      nilai_pinjaman: Math.round(parseFloat(form.nilai_pinjaman) || 0),
      bunga_persen: parseFloat(form.bunga_persen) || 0,
      jangka_waktu_bulan: form.jangka_waktu_bulan,
      tanggal_jatuh_tempo: form.tanggal_jatuh_tempo,
      opsi_pembayaran: form.opsi_pembayaran,
      cicilanPerBulan,
    });
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-4 sm:px-6 pt-6 pb-10 max-w-2xl mx-auto w-full flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Tambah Pengajuan Gadai
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Isi data pelanggan, barang, dan ketentuan pinjaman untuk pengajuan gadai baru.
            </p>
          </div>

          {/* ── Data Pelanggan ── */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Data Pelanggan</h2>

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
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(f, "foto_ktp_url"); }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Data Barang Gadai ── */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Data Barang Gadai</h2>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Jenis Perhiasan</label>
              <div className="flex flex-wrap gap-2">
                {JENIS_PERHIASAN_OPTIONS.map((j) => (
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
              </div>
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

            <div>
              <div className="grid grid-cols-2 gap-2 mb-1.5">
                <label className="text-sm font-semibold text-gray-600">Berat (gram)</label>
                <label className="text-sm font-semibold text-gray-600">Kadar Emas</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
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
                  type="text"
                  list="kadar-gadai-options"
                  value={form.kadar}
                  onChange={(e) => set("kadar", e.target.value)}
                  placeholder="Contoh: 24K, 18K"
                  className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36] bg-white"
                />
                <datalist id="kadar-gadai-options">
                  {KADAR_OPTIONS.map((k) => <option key={k} value={k} />)}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Kondisi Barang <span className="text-gray-400 font-normal">(opsional)</span></label>
              <input
                value={form.kondisi_barang}
                onChange={(e) => set("kondisi_barang", e.target.value)}
                placeholder="Contoh: Baik, sedikit baret"
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.foto_barang_url} alt="Foto Barang" className="w-full h-full object-cover" />
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
                    {uploadingBarang ? "Mengunggah foto..." : "Ambil / Pilih Foto Barang"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploadingBarang}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(f, "foto_barang_url"); }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Data Pinjaman ── */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Data Pinjaman</h2>

            <div>
              <div className="grid grid-cols-2 gap-2 mb-1.5">
                <label className="text-sm font-semibold text-gray-600">Nilai Taksiran (Rp)</label>
                <label className="text-sm font-semibold text-gray-600">Nilai Pinjaman (Rp)</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={form.nilai_taksiran}
                  onChange={(e) => set("nilai_taksiran", e.target.value)}
                  placeholder="0"
                  min="0"
                  className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
                <input
                  type="number"
                  value={form.nilai_pinjaman}
                  onChange={(e) => set("nilai_pinjaman", e.target.value)}
                  placeholder="0"
                  min="0"
                  className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
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
              <div className="grid grid-cols-2 gap-2 mb-1.5">
                <label className="text-sm font-semibold text-gray-600">Tanggal Gadai</label>
                <label className="text-sm font-semibold text-gray-600">Tanggal Jatuh Tempo</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={form.tanggal_gadai}
                  onChange={(e) => set("tanggal_gadai", e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
                <input
                  type="date"
                  value={form.tanggal_jatuh_tempo}
                  onChange={(e) => { jatuhTempoTouchedRef.current = true; set("tanggal_jatuh_tempo", e.target.value); }}
                  className="border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
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
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => router.push("/pegadaian")}
              className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={cetak}
              disabled={saving}
              className="flex-1 py-3.5 rounded-xl border-2 font-semibold text-base transition-colors hover:bg-amber-50 disabled:opacity-50"
              style={{ borderColor: "#C99A36", color: "#C99A36" }}
            >
              Cetak Invoice
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

          {savedNoGadai && (
            <div className="flex justify-center">
              <button
                onClick={() => router.push("/pegadaian")}
                className="text-sm font-semibold text-[#C99A36] hover:underline"
              >
                Kembali ke Daftar Pengajuan Gadai
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
