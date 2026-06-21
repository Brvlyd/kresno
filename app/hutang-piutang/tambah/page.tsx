"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import {
  JENIS_HUTANG_OPTIONS, PEMBAYARAN_PELUNASAN_OPTIONS, STATUS_OPTIONS, KADAR_PATOKAN_OPTIONS,
  generateNoHutang, hitungHasil, hitungHasilAkhir, hitungHargaTotalNota, fmtRupiah,
  type JenisHutangValue,
} from "@/lib/hutangPiutang";

interface FormData {
  nama: string;
  kategori: string;
  berat_emas_gram: string;
  persentase_harga: string;
  kadar_karat: string;
  harga_per_gram: string;
  harga_total_manual: string;
  pembayaran_pelunasan: string;
  status: string;
  tanggal_jatuh_tempo: string;
  tanggal_pelunasan: string;
}

const today = () => new Date().toISOString().split("T")[0];

const emptyForm: FormData = {
  nama: "", kategori: "",
  berat_emas_gram: "", persentase_harga: "", kadar_karat: String(KADAR_PATOKAN_OPTIONS[0]),
  harga_per_gram: "", harga_total_manual: "",
  pembayaran_pelunasan: PEMBAYARAN_PELUNASAN_OPTIONS[0],
  status: STATUS_OPTIONS[1],
  tanggal_jatuh_tempo: today(),
  tanggal_pelunasan: "",
};

function isJenisHutangValue(v: string | null): v is JenisHutangValue {
  return JENIS_HUTANG_OPTIONS.some((j) => j.value === v);
}

function TambahHutangContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const jenisParam = searchParams.get("jenis");

  const [jenis, setJenis] = useState<JenisHutangValue>(isJenisHutangValue(jenisParam) ? jenisParam : "supplier");
  const [form, setForm] = useState<FormData>(emptyForm);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedNoHutang, setSavedNoHutang] = useState<string | null>(null);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const setStatus = (s: string) =>
    setForm((f) => ({ ...f, status: s, tanggal_pelunasan: s === "Lunas" && !f.tanggal_pelunasan ? today() : f.tanggal_pelunasan }));

  useEffect(() => {
    if (!editId) return;
    supabase.from("hutang").select("*").eq("id", editId).maybeSingle().then(({ data }) => {
      if (data) {
        setSavedId(data.id as string);
        setSavedNoHutang(data.no_hutang as string);
        if (isJenisHutangValue(data.jenis_hutang as string)) setJenis(data.jenis_hutang as JenisHutangValue);
        setForm({
          nama: (data.nama as string) ?? "",
          kategori: (data.kategori as string) ?? "",
          berat_emas_gram: data.berat_emas_gram != null ? String(data.berat_emas_gram) : "",
          persentase_harga: data.persentase_harga != null ? String(data.persentase_harga) : "",
          kadar_karat: data.kadar_karat != null ? String(data.kadar_karat) : String(KADAR_PATOKAN_OPTIONS[0]),
          harga_per_gram: data.harga_per_gram != null ? String(data.harga_per_gram) : "",
          harga_total_manual: data.harga_total != null ? String(data.harga_total) : "",
          pembayaran_pelunasan: (data.pembayaran_pelunasan as string) ?? PEMBAYARAN_PELUNASAN_OPTIONS[0],
          status: (data.status as string) ?? STATUS_OPTIONS[1],
          tanggal_jatuh_tempo: (data.tanggal_jatuh_tempo as string) ?? today(),
          tanggal_pelunasan: (data.tanggal_pelunasan as string) ?? "",
        });
      }
      setLoadingEdit(false);
    });
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSupplier = jenis === "supplier";

  /* ── Live formula: Berat emas × Persentase harga = Hasil; Hasil × Karat/24 = Hasil Akhir ── */
  const beratNum = parseFloat(form.berat_emas_gram) || 0;
  const persentaseNum = parseFloat(form.persentase_harga) || 0;
  const kadarNum = parseInt(form.kadar_karat) || KADAR_PATOKAN_OPTIONS[0];
  const hargaPerGramNum = parseFloat(form.harga_per_gram) || 0;
  const hasil = hitungHasil(beratNum, persentaseNum);
  const hasilAkhir = hitungHasilAkhir(hasil, kadarNum);
  const hargaTotalNota = hitungHargaTotalNota(hasilAkhir, hargaPerGramNum);
  const hargaTotal = isSupplier ? hargaTotalNota : Math.round(parseFloat(form.harga_total_manual) || 0);

  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!form.nama.trim()) missing.push(isSupplier ? "Kreditur" : "Nama Biaya");
    if (!form.kategori.trim()) missing.push("Kategori");
    if (!form.tanggal_jatuh_tempo.trim()) missing.push("Tanggal Jatuh Tempo");
    if (isSupplier) {
      if (beratNum <= 0) missing.push("Berat Emas");
      if (hargaPerGramNum <= 0) missing.push("Harga per Gram");
    } else {
      if (hargaTotal <= 0) missing.push("Harga Total");
    }
    return missing;
  };

  const buildPayload = (noHutang: string) => ({
    no_hutang: noHutang,
    jenis_hutang: jenis,
    nama: form.nama.trim(),
    kategori: form.kategori.trim(),
    berat_emas_gram: isSupplier ? beratNum : null,
    persentase_harga: isSupplier ? persentaseNum : null,
    kadar_karat: isSupplier ? kadarNum : null,
    hasil: isSupplier ? hasil : null,
    hasil_akhir: isSupplier ? hasilAkhir : null,
    harga_per_gram: isSupplier ? hargaPerGramNum : null,
    harga_total: hargaTotal,
    pembayaran_pelunasan: isSupplier ? form.pembayaran_pelunasan : null,
    status: form.status,
    tanggal_jatuh_tempo: form.tanggal_jatuh_tempo,
    tanggal_pelunasan: form.status === "Lunas" ? (form.tanggal_pelunasan || today()) : null,
    updated_at: new Date().toISOString(),
  });

  const simpan = async () => {
    const missing = missingFields();
    if (missing.length > 0) {
      setMsg(`Lengkapi dulu: ${missing.join(", ")}.`);
      return;
    }
    setSaving(true);
    setMsg("");

    const noHutang = savedNoHutang ?? generateNoHutang();
    const payload = buildPayload(noHutang);

    const { data, error } = savedId
      ? await supabase.from("hutang").update(payload).eq("id", savedId).select("id, no_hutang").single()
      : await supabase.from("hutang").insert(payload).select("id, no_hutang").single();

    setSaving(false);
    if (error) {
      setMsg("Gagal menyimpan: " + error.message);
      return;
    }
    setSavedId(data.id);
    setSavedNoHutang(data.no_hutang);
    setMsg("✓ Hutang berhasil disimpan!");
  };

  if (loadingEdit) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <p className="text-gray-400">Memuat data...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-4 sm:px-6 pt-6 pb-10 max-w-5xl mx-auto w-full flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
                {savedId ? "Edit Hutang" : "Tambah Hutang"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">Catat hutang/pinjaman yang dilakukan toko.</p>
            </div>
            <button
              onClick={() => router.push("/hutang-piutang")}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "#6F5333" }}
            >
              ← Kembali
            </button>
          </div>

          {/* Jenis Hutang */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Jenis Hutang</label>
            <div className="flex flex-wrap gap-2">
              {JENIS_HUTANG_OPTIONS.map((j) => (
                <button
                  key={j.value}
                  type="button"
                  onClick={() => setJenis(j.value)}
                  className={`px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                    jenis === j.value
                      ? "bg-[#6F5333] border-[#6F5333] text-white"
                      : "border-gray-200 text-gray-600 hover:border-[#6F5333]"
                  }`}
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>

          {isSupplier ? (
            <div className="border border-gray-200 rounded-xl p-5 space-y-4">
              <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Data Supplier &amp; Sales</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1.5">Kreditur</label>
                  <input
                    value={form.nama}
                    onChange={(e) => set("nama", e.target.value)}
                    placeholder="Nama supplier / sales"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1.5">Kategori</label>
                  <input
                    value={form.kategori}
                    onChange={(e) => set("kategori", e.target.value)}
                    placeholder="Contoh: Supplier, Sales"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-dashed border-gray-200">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Rumus Pengambilan Barang</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Berat Emas (gr)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.berat_emas_gram}
                      onChange={(e) => set("berat_emas_gram", e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Persentase Harga (%)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.persentase_harga}
                      onChange={(e) => set("persentase_harga", e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Karat Patokan</label>
                    <select
                      value={form.kadar_karat}
                      onChange={(e) => set("kadar_karat", e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36] bg-white"
                    >
                      {KADAR_PATOKAN_OPTIONS.map((k) => <option key={k} value={k}>{k}K</option>)}
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FDF6E3" }}>
                    <p className="text-xs text-gray-500">Hasil</p>
                    <p className="font-bold" style={{ color: "#6F5333" }}>{hasil.toFixed(2)} gr</p>
                  </div>
                  <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FDF6E3" }}>
                    <p className="text-xs text-gray-500">Hasil Akhir ({kadarNum}K)</p>
                    <p className="font-bold" style={{ color: "#6F5333" }}>{hasilAkhir.toFixed(2)} gr</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Hasil = Berat Emas × Persentase Harga. Hasil Akhir = Hasil × (Karat dipilih ÷ 24) — inilah nilai yang bisa dibayarkan emas, uang, atau emas rosok.
                </p>
              </div>

              <div className="pt-2 border-t border-dashed border-gray-200">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Rumus Nota</p>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Harga per Gram (Rp)</label>
                  <input
                    type="number" min="0"
                    value={form.harga_per_gram}
                    onChange={(e) => set("harga_per_gram", e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
                <div className="mt-3 rounded-xl px-4 py-3" style={{ backgroundColor: "#FDF6E3" }}>
                  <p className="text-xs text-gray-500">Harga Total (Hasil Akhir × Harga per Gram)</p>
                  <p className="font-bold text-lg" style={{ color: "#6F5333" }}>{fmtRupiah(hargaTotalNota)}</p>
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Pembayaran Pelunasan</label>
                <div className="flex flex-wrap gap-2">
                  {PEMBAYARAN_PELUNASAN_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => set("pembayaran_pelunasan", opt)}
                      className={`px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                        form.pembayaran_pelunasan === opt
                          ? "bg-[#6F5333] border-[#6F5333] text-white"
                          : "border-gray-200 text-gray-600 hover:border-[#6F5333]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl p-5 space-y-4">
              <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Data Operasional &amp; Pihak ke-3</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1.5">Nama Biaya</label>
                  <input
                    value={form.nama}
                    onChange={(e) => set("nama", e.target.value)}
                    placeholder="Contoh: Biaya Listrik Toko"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1.5">Kategori</label>
                  <input
                    value={form.kategori}
                    onChange={(e) => set("kategori", e.target.value)}
                    placeholder="Contoh: Operasional"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
              </div>

              <div className="sm:w-1/2">
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Harga Total (Rp)</label>
                <input
                  type="number" min="0"
                  value={form.harga_total_manual}
                  onChange={(e) => set("harga_total_manual", e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>
            </div>
          )}

          {/* Status & Tanggal */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Status &amp; Pelunasan</h2>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                      form.status === s
                        ? "bg-[#6F5333] border-[#6F5333] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#6F5333]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Tanggal Jatuh Tempo</label>
                <input
                  type="date"
                  value={form.tanggal_jatuh_tempo}
                  onChange={(e) => set("tanggal_jatuh_tempo", e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Tanggal Pelunasan</label>
                <input
                  type="date"
                  value={form.tanggal_pelunasan}
                  disabled={form.status !== "Lunas"}
                  onChange={(e) => set("tanggal_pelunasan", e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-[#C99A36] disabled:bg-gray-50"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Tanggal Jatuh Tempo = batas waktu pembayaran (payment request). Tanggal Pelunasan terisi otomatis saat status diubah ke Lunas, dan bisa diubah manual.
            </p>
          </div>

          {msg && (
            <p className={`text-sm font-semibold py-2.5 px-4 rounded-xl ${msg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {msg}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={() => router.push("/hutang-piutang")}
              className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={simpan}
              disabled={saving}
              className="flex-1 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#6F5333" }}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function TambahHutangPage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex-1 flex items-center justify-center min-h-screen"><p className="text-gray-400">Memuat...</p></div></AppLayout>}>
      <TambahHutangContent />
    </Suspense>
  );
}
