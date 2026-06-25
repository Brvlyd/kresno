"use client";

import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { prefixForKategori, buildPrefixCounters, nextId } from "@/lib/csv";
import { hitungHasil } from "@/lib/hutangPiutang";
import { generateNoBuyback } from "@/lib/buyback";
import type { InvoiceBuybackData } from "@/lib/buyback";
import { InvoiceBuyback } from "@/components/InvoiceBuyback";
import { printClean } from "@/lib/print";
import { fmtRupiah, fmtGram, tglIndo } from "@/lib/gadai";

interface BuybackRow {
  id: string;
  id_item: string;
  no_buyback: string | null;
  nama_produk: string;
  kadar: string;
  berat_gram: number;
  jumlah: number;
  harga_beli: number;
  supplier: string;
  tanggal_masuk: string;
}

interface HargaEmasKarat {
  harga_beli: number;
  harga_jual: number;
}

interface FormData {
  nama_produk: string;
  kadar: string;
  berat_gram: string;
  jumlah: string;
  persen_modal: string;
  persen_jual: string;
  supplier: string;
  keterangan: string;
}

const emptyForm: FormData = {
  nama_produk: "", kadar: "", berat_gram: "", jumlah: "1",
  persen_modal: "", persen_jual: "", supplier: "", keterangan: "",
};

function hitungHargaDariPersentase(beratGram: number, persentase: number, hargaPerGramKaratBarang: number): number {
  return Math.round(hitungHasil(beratGram, persentase) * hargaPerGramKaratBarang);
}

export default function PembelianPage() {
  const supabase = createClient();

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [hargaEmasByKarat, setHargaEmasByKarat] = useState<Record<number, HargaEmasKarat>>({});
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [riwayat, setRiwayat] = useState<BuybackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buybackReady, setBuybackReady] = useState<InvoiceBuybackData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const set = (key: keyof FormData, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const load = useCallback(async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const [invRes, hargaRes, riwayatRes] = await Promise.all([
      supabase.from("inventori").select("id_item"),
      supabase.from("harga_emas").select("karat,harga_beli,harga_jual").eq("tanggal", todayStr),
      supabase
        .from("inventori")
        .select("id,id_item,no_buyback,nama_produk,kadar,berat_gram,jumlah,harga_beli,supplier,tanggal_masuk")
        .eq("sub_jenis_aset", "Emas Rosok")
        .order("tanggal_masuk", { ascending: false }),
    ]);
    setExistingIds((invRes.data ?? []).map((r: { id_item: string }) => r.id_item));
    const hargaMap: Record<number, HargaEmasKarat> = {};
    for (const r of hargaRes.data ?? []) {
      hargaMap[r.karat] = { harga_beli: r.harga_beli, harga_jual: r.harga_jual };
    }
    setHargaEmasByKarat(hargaMap);
    setRiwayat((riwayatRes.data ?? []) as BuybackRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!form.nama_produk.trim()) missing.push("Nama / Deskripsi Barang");
    const kadarTrimmed = form.kadar.trim();
    if (!kadarTrimmed || !/^\d+(\.\d+)?K$/.test(kadarTrimmed)) {
      missing.push("Karat (contoh: 24K atau 18K — angka diikuti huruf K)");
    }
    if (!form.berat_gram.trim() || (parseFloat(form.berat_gram) || 0) <= 0) missing.push("Berat (gram)");
    if (!form.jumlah.trim() || (parseInt(form.jumlah) || 0) < 1) missing.push("Jumlah");
    if (!form.persen_modal.trim() || (parseFloat(form.persen_modal) || 0) <= 0) missing.push("Persentase Modal");
    if (!form.persen_jual.trim() || (parseFloat(form.persen_jual) || 0) <= 0) missing.push("Persentase Jual");
    if (kadarTrimmed && /^\d+(\.\d+)?K$/.test(kadarTrimmed) && !hargaEmasByKarat[parseFloat(kadarTrimmed)]) {
      missing.push(`Harga Emas ${kadarTrimmed} hari ini (isi dulu di halaman Dashboard)`);
    }
    if (!form.supplier.trim()) missing.push("Nama Penjual");
    return missing;
  };

  const save = async () => {
    const missing = missingFields();
    if (missing.length > 0) {
      setMsg(`Lengkapi dulu: ${missing.join(", ")}.`);
      return;
    }
    const beratGramNum = parseFloat(form.berat_gram) || 0;
    const karatNum = parseFloat(form.kadar.trim()) || 24;
    const hargaKarat = hargaEmasByKarat[karatNum];
    if (!hargaKarat) return;
    setSaving(true); setMsg("");

    const persenModalNum = parseFloat(form.persen_modal) || 0;
    const persenJualNum = parseFloat(form.persen_jual) || 0;
    const hargaBeliRp = hitungHargaDariPersentase(beratGramNum, persenModalNum, hargaKarat.harga_beli);
    const hargaJualRp = hitungHargaDariPersentase(beratGramNum, persenJualNum, hargaKarat.harga_jual);
    const jumlahNum = parseInt(form.jumlah) || 1;

    const prefix = prefixForKategori("Emas Rosok");
    const counters = buildPrefixCounters(existingIds.map((id_item) => ({ id_item })));
    const idItem = nextId(prefix, counters);
    const noBuyback = generateNoBuyback();
    const tanggalMasuk = new Date().toISOString().split("T")[0];

    const payload = {
      id_item: idItem,
      jenis_barang: "Emas Rosok",
      nama_produk: form.nama_produk.trim(),
      kadar: form.kadar.trim(),
      berat_gram: beratGramNum,
      jumlah: jumlahNum,
      status_inventori: "Tersedia",
      status_laporan: "Draft",
      kategori: "Emas Rosok",
      persen_modal: persenModalNum,
      persen_jual: persenJualNum,
      harga_beli: hargaBeliRp,
      harga_jual: hargaJualRp,
      supplier: form.supplier.trim(),
      keterangan: form.keterangan.trim(),
      gambar_url: null,
      tanggal_masuk: tanggalMasuk,
      updated_at: new Date().toISOString(),
      jenis_inventori: "Aset",
      sub_jenis_aset: "Emas Rosok",
      no_buyback: noBuyback,
    };

    const { error } = await supabase.from("inventori").insert(payload);
    setSaving(false);
    if (error) { setMsg("Gagal menyimpan: " + error.message); return; }

    setBuybackReady({
      no_buyback: noBuyback,
      tanggal: tanggalMasuk,
      nama_barang: payload.nama_produk,
      kadar: payload.kadar,
      berat_gram: payload.berat_gram,
      jumlah: payload.jumlah,
      harga_per_gram: beratGramNum > 0 ? Math.round(hargaBeliRp / beratGramNum) : 0,
      total: Math.round(hargaBeliRp * jumlahNum),
    });
    setForm(emptyForm);
    setMsg("");
    load();
  };

  return (
    <>
      <style>{`
        @media print {
          aside, nav, #pembelian-screen, #buyback-preview-overlay { display: none !important; }
          #invoice-print { display: block !important; }
          html, body { background: white !important; margin: 0; }
          @page { size: A5 landscape; margin: 10mm; }
        }
      `}</style>

      {buybackReady && <InvoiceBuyback mode="print" data={buybackReady} />}

      <AppLayout>
        <div id="pembelian-screen" className="flex-1 flex flex-col bg-white min-h-screen">
          <div className="px-4 sm:px-6 pt-6 pb-8 flex flex-col gap-5">
            <div>
              <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
                Pembelian Emas Rosok (Buyback)
              </h1>
              <p className="text-base text-gray-500 mt-1">
                Catat pembelian emas rosok dari pelanggan dan cetak nota buyback-nya di sini.
              </p>
            </div>

            {/* Notifikasi: Buyback berhasil disimpan */}
            {buybackReady && (
              <div className="flex items-center justify-between gap-4 bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex-wrap">
                <div>
                  <p className="font-bold text-green-800">✅ Buyback emas berhasil disimpan!</p>
                  <p className="text-sm text-green-700">No. Nota: <span className="font-mono font-semibold">{buybackReady.no_buyback}</span></p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPreview(true)}
                    className="px-4 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all"
                    style={{ backgroundColor: "#C99A36" }}
                  >
                    🖨️ Lihat / Cetak Invoice
                  </button>
                  <button
                    onClick={() => setBuybackReady(null)}
                    className="px-4 py-2.5 rounded-xl border border-green-300 text-green-700 font-semibold text-sm hover:bg-green-100 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-5">
              {/* Form */}
              <div className="w-full lg:w-[420px] lg:shrink-0 bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                <h2 className="font-bold text-gray-800 text-lg">Tambah Pembelian Rosok</h2>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1.5">Nama / Deskripsi Barang</label>
                  <input
                    value={form.nama_produk}
                    onChange={(e) => set("nama_produk", e.target.value)}
                    placeholder="Contoh: Cincin Rosok Patah"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>

                <div>
                  <div className="grid grid-cols-3 gap-2 mb-1.5">
                    {["Karat", "Berat (gram)", "Jumlah"].map((h) => (
                      <label key={h} className="text-sm font-semibold text-gray-600">{h}</label>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={form.kadar}
                      onChange={(e) => set("kadar", e.target.value.toUpperCase())}
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

                <div>
                  <div className="grid grid-cols-2 gap-2 mb-1.5">
                    {["Persentase Modal (%)", "Persentase Jual (%)"].map((h) => (
                      <label key={h} className="text-sm font-semibold text-gray-600">{h}</label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["persen_modal", "persen_jual"] as const).map((key) => (
                      <div key={key} className="flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:border-[#C99A36] focus-within:ring-1 focus-within:ring-[#C99A36]/20">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                          placeholder="0"
                          className="flex-1 px-3 py-3 text-base focus:outline-none bg-white min-w-0"
                        />
                        <span className="px-3 py-3 text-base font-semibold text-gray-500 bg-gray-50 border-l border-gray-200 select-none shrink-0">%</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    % dari harga emas sesuai karat hari ini (Dashboard).
                  </p>
                </div>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1.5">Nama Penjual</label>
                  <input
                    value={form.supplier}
                    onChange={(e) => set("supplier", e.target.value)}
                    placeholder="Nama pelanggan yang menjual"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1.5">
                    Keterangan <span className="text-gray-400 font-normal">(opsional)</span>
                  </label>
                  <textarea
                    value={form.keterangan}
                    onChange={(e) => set("keterangan", e.target.value)}
                    placeholder="Catatan tambahan..."
                    rows={2}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] resize-none"
                  />
                </div>

                {msg && (
                  <p className="text-sm font-semibold py-2.5 px-4 rounded-xl bg-red-50 text-red-600">
                    {msg}
                  </p>
                )}

                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: "#C99A36" }}
                >
                  {saving ? "Menyimpan..." : "Simpan Pembelian"}
                </button>
              </div>

              {/* Riwayat */}
              <div className="flex-1 border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-amber-50">
                  <h3 className="font-extrabold text-gray-900">Riwayat Pembelian Rosok</h3>
                  <p className="text-sm text-gray-600">{riwayat.length} transaksi tercatat</p>
                </div>
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : riwayat.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <p className="text-gray-500 text-base font-medium">Belum ada pembelian rosok tercatat.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {["No. Nota", "Tanggal", "Nama Barang", "Kadar", "Berat", "Jml", "Harga Beli", "Penjual"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {riwayat.map((r) => (
                          <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{r.no_buyback ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{tglIndo(r.tanggal_masuk)}</td>
                            <td className="px-4 py-3 font-semibold text-gray-800">{r.nama_produk}</td>
                            <td className="px-4 py-3">{r.kadar}</td>
                            <td className="px-4 py-3">{fmtGram(r.berat_gram * r.jumlah)}</td>
                            <td className="px-4 py-3 text-center">{r.jumlah}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{fmtRupiah(r.harga_beli * r.jumlah)}</td>
                            <td className="px-4 py-3 text-gray-600">{r.supplier}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>

      {/* Modal preview/cetak invoice buyback */}
      {showPreview && buybackReady && (
        <div id="buyback-preview-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Preview Invoice Buyback</h2>
                <p className="text-xs text-gray-400">Periksa kembali sebelum dicetak.</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="bg-white rounded-xl shadow-md p-5 mx-auto" style={{ maxWidth: 620 }}>
                <InvoiceBuyback mode="preview" data={buybackReady} />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100 rounded-b-2xl">
              <button
                onClick={() => setShowPreview(false)}
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
