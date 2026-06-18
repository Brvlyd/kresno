"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { STATUS_OPTIONS, SUMBER_PIUTANG_OPTIONS, generateNoPiutang, type SumberPiutang } from "@/lib/hutangPiutang";

interface FormData {
  nama_debitur: string;
  kategori: string;
  jumlah_piutang: string;
  referensi: string;
  catatan_penagihan: string;
  status: string;
  tanggal_jatuh_tempo: string;
  tanggal_pelunasan: string;
}

const today = () => new Date().toISOString().split("T")[0];

const emptyForm: FormData = {
  nama_debitur: "", kategori: "", jumlah_piutang: "", referensi: "", catatan_penagihan: "",
  status: STATUS_OPTIONS[1],
  tanggal_jatuh_tempo: today(),
  tanggal_pelunasan: "",
};

function isSumberPiutang(v: string | null): v is SumberPiutang {
  return SUMBER_PIUTANG_OPTIONS.includes((v ?? "") as SumberPiutang);
}

function TambahPiutangContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const sumberParam = searchParams.get("sumber");

  const [sumber, setSumber] = useState<SumberPiutang>(isSumberPiutang(sumberParam) ? sumberParam : SUMBER_PIUTANG_OPTIONS[0]);
  const [form, setForm] = useState<FormData>(() => editId ? emptyForm : {
    ...emptyForm,
    nama_debitur: searchParams.get("nama") ?? "",
    kategori: searchParams.get("kategori") ?? "",
    jumlah_piutang: searchParams.get("jumlah") ?? "",
    referensi: searchParams.get("referensi") ?? "",
  });
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedNoPiutang, setSavedNoPiutang] = useState<string | null>(null);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const setStatus = (s: string) =>
    setForm((f) => ({ ...f, status: s, tanggal_pelunasan: s === "Lunas" && !f.tanggal_pelunasan ? today() : f.tanggal_pelunasan }));

  useEffect(() => {
    if (!editId) return;
    supabase.from("piutang").select("*").eq("id", editId).maybeSingle().then(({ data }) => {
      if (data) {
        setSavedId(data.id as string);
        setSavedNoPiutang(data.no_piutang as string);
        if (isSumberPiutang(data.sumber as string)) setSumber(data.sumber as SumberPiutang);
        setForm({
          nama_debitur: (data.nama_debitur as string) ?? "",
          kategori: (data.kategori as string) ?? "",
          jumlah_piutang: data.jumlah_piutang != null ? String(data.jumlah_piutang) : "",
          referensi: (data.referensi as string) ?? "",
          catatan_penagihan: (data.catatan_penagihan as string) ?? "",
          status: (data.status as string) ?? STATUS_OPTIONS[1],
          tanggal_jatuh_tempo: (data.tanggal_jatuh_tempo as string) ?? today(),
          tanggal_pelunasan: (data.tanggal_pelunasan as string) ?? "",
        });
      }
      setLoadingEdit(false);
    });
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!form.nama_debitur.trim()) missing.push("Nama / Debitur");
    if (!form.kategori.trim()) missing.push("Kategori");
    if (!form.jumlah_piutang.trim() || (parseFloat(form.jumlah_piutang) || 0) <= 0) missing.push("Jumlah Piutang");
    if (!form.tanggal_jatuh_tempo.trim()) missing.push("Tanggal Jatuh Tempo");
    return missing;
  };

  const buildPayload = (noPiutang: string) => ({
    no_piutang: noPiutang,
    sumber,
    nama_debitur: form.nama_debitur.trim(),
    kategori: form.kategori.trim(),
    jumlah_piutang: Math.round(parseFloat(form.jumlah_piutang) || 0),
    referensi: form.referensi.trim() || null,
    catatan_penagihan: form.catatan_penagihan.trim() || null,
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

    const noPiutang = savedNoPiutang ?? generateNoPiutang();
    const payload = buildPayload(noPiutang);

    const { data, error } = savedId
      ? await supabase.from("piutang").update(payload).eq("id", savedId).select("id, no_piutang").single()
      : await supabase.from("piutang").insert(payload).select("id, no_piutang").single();

    setSaving(false);
    if (error) {
      setMsg("Gagal menyimpan: " + error.message);
      return;
    }
    setSavedId(data.id);
    setSavedNoPiutang(data.no_piutang);
    setMsg("✓ Piutang berhasil disimpan!");
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
                {savedId ? "Edit Piutang" : "Tambah Piutang"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">Catat pinjaman yang diberikan toko kepada pihak lain.</p>
            </div>
            <button
              onClick={() => router.push("/hutang-piutang")}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "#6F5333" }}
            >
              ← Kembali
            </button>
          </div>

          {/* Sumber Piutang */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Sumber Piutang</label>
            <div className="flex flex-wrap gap-2">
              {SUMBER_PIUTANG_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSumber(s)}
                  className={`px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                    sumber === s
                      ? "bg-[#6F5333] border-[#6F5333] text-white"
                      : "border-gray-200 text-gray-600 hover:border-[#6F5333]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Sesuai alur bisnis, piutang biasanya berasal dari Servis atau Gadai pelanggan yang belum lunas.
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>Data Piutang</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Nama / Debitur</label>
                <input
                  value={form.nama_debitur}
                  onChange={(e) => set("nama_debitur", e.target.value)}
                  placeholder="Nama orang/pihak yang meminjam"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Kategori</label>
                <input
                  value={form.kategori}
                  onChange={(e) => set("kategori", e.target.value)}
                  placeholder="Contoh: Customer, Karyawan, Lainnya"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">
                  Referensi <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <input
                  value={form.referensi}
                  onChange={(e) => set("referensi", e.target.value)}
                  placeholder="No. Servis / No. Gadai"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">Jumlah Piutang (Rp)</label>
                <input
                  type="number" min="0"
                  value={form.jumlah_piutang}
                  onChange={(e) => set("jumlah_piutang", e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1.5">Catatan Penagihan <span className="text-gray-400 font-normal">(opsional)</span></label>
              <textarea
                value={form.catatan_penagihan}
                onChange={(e) => set("catatan_penagihan", e.target.value)}
                placeholder="Catatan follow-up penagihan ke debitur..."
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
              />
            </div>
          </div>

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
              Tanggal Jatuh Tempo dipakai untuk menagih (penagihan) sebelum lewat waktu. Tanggal Pelunasan terisi otomatis saat status diubah ke Lunas (pembayaran masuk).
            </p>
          </div>

          {msg && (
            <p className={`text-sm font-semibold py-2.5 px-4 rounded-xl ${msg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {msg}
            </p>
          )}

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

export default function TambahPiutangPage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex-1 flex items-center justify-center min-h-screen"><p className="text-gray-400">Memuat...</p></div></AppLayout>}>
      <TambahPiutangContent />
    </Suspense>
  );
}
