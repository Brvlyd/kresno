"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { STATUS_OPTIONS } from "@/lib/csv";

interface BarangRow {
  id: string;
  id_item: string;
  nama_produk: string;
  jenis_barang: string;
  kadar: string;
  berat_gram: number;
  jumlah: number;
  harga_jual?: number;
  status_inventori: string;
  gambar_url?: string;
}

const STATUS_KELUAR_OPTIONS = STATUS_OPTIONS.filter((s) => s !== "Tersedia");

function KonfirmasiKeluarContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [item, setItem] = useState<BarangRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [jumlahKeluar, setJumlahKeluar] = useState("1");
  const [statusBaru, setStatusBaru] = useState<string>("Terjual");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) { setLoading(false); setNotFound(true); return; }
      const { data, error } = await supabase.from("inventori").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setItem(data as BarangRow);
        setJumlahKeluar(String(Math.min(1, (data as BarangRow).jumlah) || 1));
      }
      setLoading(false);
    };
    load();
  }, [id, supabase]);

  const submit = async () => {
    if (!item) return;
    const jumlah = parseInt(jumlahKeluar) || 0;
    if (jumlah < 1) { setMsg("Jumlah keluar minimal 1."); return; }
    if (jumlah > item.jumlah) { setMsg(`Jumlah keluar tidak boleh melebihi stok (${item.jumlah}).`); return; }

    setSaving(true);
    setMsg("");

    const jumlahSisa = item.jumlah - jumlah;

    const { error: updateError } = await supabase
      .from("inventori")
      .update({
        jumlah: jumlahSisa,
        status_inventori: statusBaru,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) {
      setSaving(false);
      setMsg("Gagal memperbarui inventori: " + updateError.message);
      return;
    }

    const { error: logError } = await supabase.from("inventori_keluar").insert({
      inventori_id: item.id,
      id_item: item.id_item,
      nama_produk: item.nama_produk,
      jumlah_keluar: jumlah,
      jumlah_sisa: jumlahSisa,
      status_baru: statusBaru,
      catatan: catatan.trim() || null,
    });

    setSaving(false);
    if (logError) {
      setMsg("Inventori diperbarui, tapi gagal menyimpan riwayat: " + logError.message);
      return;
    }

    setDone(true);
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-6 pt-6 pb-8 max-w-2xl mx-auto w-full flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Konfirmasi Barang Keluar
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Hasil scan Scanner 2 — konfirmasi barang yang keluar dari inventori.
            </p>
          </div>

          {loading ? (
            <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
          ) : notFound || !item ? (
            <div className="border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-700 font-semibold text-lg mb-1">Barang Tidak Ditemukan</p>
              <p className="text-gray-400 text-sm mb-5">ID barang dari hasil scan tidak ada di inventori.</p>
              <button
                onClick={() => router.push("/inventori")}
                className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
                style={{ backgroundColor: "#C99A36" }}
              >
                Kembali ke Inventori
              </button>
            </div>
          ) : done ? (
            <div className="border border-green-200 bg-green-50 rounded-xl p-8 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p className="text-gray-800 font-semibold text-lg mb-1">Barang Keluar Dikonfirmasi</p>
              <p className="text-gray-500 text-sm mb-5">
                {item.nama_produk} ({item.id_item}) — status diperbarui menjadi <strong>{statusBaru}</strong>.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push(`/inventori?id=${item.id}`)}
                  className="px-5 py-2.5 rounded-xl border-2 font-semibold text-sm transition-colors hover:bg-amber-50"
                  style={{ borderColor: "#C99A36", color: "#C99A36" }}
                >
                  Lihat Detail Barang
                </button>
                <button
                  onClick={() => router.push("/inventori")}
                  className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: "#C99A36" }}
                >
                  Kembali ke Inventori
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Detail barang */}
              <div className="border border-gray-200 rounded-xl p-5 flex gap-4 items-start">
                {item.gambar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.gambar_url} alt={item.nama_produk} className="w-20 h-20 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
                    {item.nama_produk}
                  </h2>
                  <p className="text-sm text-gray-500 mb-2">{item.id_item} • {item.jenis_barang}</p>
                  <div className="flex gap-2 flex-wrap text-sm">
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">{item.kadar}</span>
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">{item.berat_gram} gr</span>
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">Stok: {item.jumlah} pcs</span>
                    {item.harga_jual ? (
                      <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                        Rp {item.harga_jual.toLocaleString("id-ID")}
                      </span>
                    ) : null}
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-[#C99A36] font-semibold">
                      Status saat ini: {item.status_inventori}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form konfirmasi */}
              <div className="border border-gray-200 rounded-xl p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jumlah Keluar</label>
                  <input
                    type="number"
                    value={jumlahKeluar}
                    onChange={(e) => setJumlahKeluar(e.target.value)}
                    min="1"
                    max={item.jumlah}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                  <p className="text-xs text-gray-400 mt-1">Maksimal {item.jumlah} pcs (sesuai stok saat ini).</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status Baru</label>
                  <select
                    value={statusBaru}
                    onChange={(e) => setStatusBaru(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] bg-white"
                  >
                    {STATUS_KELUAR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Barang tetap tercatat di inventori (riwayat), hanya status & stok yang diperbarui.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Catatan <span className="text-gray-400 font-normal">(opsional)</span></label>
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows={2}
                    placeholder="Contoh: terjual ke Bu Sari"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
                  />
                </div>

                {msg && (
                  <p className="text-sm font-semibold py-2.5 px-4 rounded-xl bg-red-50 text-red-600">{msg}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => router.push("/inventori")}
                    className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={submit}
                    disabled={saving}
                    className="flex-1 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                    style={{ backgroundColor: "#C99A36" }}
                  >
                    {saving ? "Menyimpan..." : "Konfirmasi Keluar"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function KonfirmasiKeluarPage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Memuat...</p></div></AppLayout>}>
      <KonfirmasiKeluarContent />
    </Suspense>
  );
}
