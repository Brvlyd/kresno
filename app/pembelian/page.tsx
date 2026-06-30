"use client";

import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { kodeForJenis, nextIdItemAtomic, KODE_JENIS_SEED } from "@/lib/csv";
import { generateNoBuyback } from "@/lib/buyback";
import type { InvoiceBuybackData } from "@/lib/buyback";
import { InvoiceBuyback } from "@/components/InvoiceBuyback";
import { InvoicePagePreview } from "@/components/InvoicePagePreview";
import { printClean } from "@/lib/print";
import { fmtRupiah, fmtGram, tglIndo, KADAR_OPTIONS } from "@/lib/gadai";
import { useCustomList } from "@/lib/useCustomList";
import { useNamaBarangList } from "@/lib/masterData";
import { MasterDataPicker } from "@/components/MasterDataPicker";
import { AutocompleteField } from "@/components/AutocompleteField";

const KADAR_FORMAT_RE = /^\d+(\.\d+)?K$/;
const validateKadarFormat = (v: string): string | null =>
  KADAR_FORMAT_RE.test(v.trim().toUpperCase()) ? null : "Format kadar harus angka diikuti K, contoh: 24K atau 18K.";

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
  taksiran_harga_beli: string;
  harga_emas_hari_ini: string;
  supplier: string;
  keterangan: string;
}

const emptyForm: FormData = {
  nama_produk: "", kadar: "", berat_gram: "", jumlah: "1",
  taksiran_harga_beli: "", harga_emas_hari_ini: "", supplier: "", keterangan: "",
};

/** Format angka jadi "1.234.567" (titik tiap ribuan) buat input Rupiah */
function formatRibuan(v: string): string {
  const digits = v.replace(/\D/g, "");
  return digits ? parseInt(digits, 10).toLocaleString("id-ID") : "";
}

export default function PembelianPage() {
  const supabase = createClient();

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [hargaEmasByKarat, setHargaEmasByKarat] = useState<Record<number, HargaEmasKarat>>({});
  const [jenisKodeMap, setJenisKodeMap] = useState<Record<string, string>>(KODE_JENIS_SEED);
  const [riwayat, setRiwayat] = useState<BuybackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buybackReady, setBuybackReady] = useState<InvoiceBuybackData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { all: kadarOptions, addCustom: addCustomKadar } = useCustomList("kadar_master", KADAR_OPTIONS);
  const { all: namaBarangOptions, record: recordNamaBarang } = useNamaBarangList();

  const set = (key: keyof FormData, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const load = useCallback(async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const [hargaRes, riwayatRes, kodeRes] = await Promise.all([
      supabase.from("harga_emas").select("karat,harga_beli,harga_jual").eq("tanggal", todayStr).eq("label", ""),
      supabase
        .from("inventori")
        .select("id,id_item,no_buyback,nama_produk,kadar,berat_gram,jumlah,harga_beli,supplier,tanggal_masuk")
        .eq("sub_jenis_aset", "Emas Rosok")
        .order("tanggal_masuk", { ascending: false }),
      supabase.from("jenis_barang_kode").select("nama,kode"),
    ]);
    const hargaMap: Record<number, HargaEmasKarat> = {};
    for (const r of hargaRes.data ?? []) {
      hargaMap[r.karat] = { harga_beli: r.harga_beli, harga_jual: r.harga_jual };
    }
    setHargaEmasByKarat(hargaMap);
    setRiwayat((riwayatRes.data ?? []) as BuybackRow[]);
    const kodeMap: Record<string, string> = { ...KODE_JENIS_SEED };
    for (const r of kodeRes.data ?? []) {
      kodeMap[r.nama] = r.kode;
    }
    setJenisKodeMap(kodeMap);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Isi awal "Harga Emas Hari Ini" dari patokan 24K (Dashboard) begitu kepanggil/berubah,
  // TAPI cuma kalau field-nya masih kosong — supaya tidak menimpa harga yang sedang diketik
  // staff (harganya boleh beda tiap transaksi, makanya tetap bisa diedit manual).
  useEffect(() => {
    const beli24 = hargaEmasByKarat[24]?.harga_beli;
    if (beli24 != null && beli24 > 0 && !form.harga_emas_hari_ini) {
      setForm((f) => ({ ...f, harga_emas_hari_ini: String(beli24) }));
    }
  }, [hargaEmasByKarat]); // eslint-disable-line react-hooks/exhaustive-deps

  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!form.nama_produk.trim()) missing.push("Nama / Deskripsi Barang");
    const kadarTrimmed = form.kadar.trim();
    if (!kadarTrimmed || !/^\d+(\.\d+)?K$/.test(kadarTrimmed)) {
      missing.push("Karat (contoh: 24K atau 18K — angka diikuti huruf K)");
    }
    if (!form.berat_gram.trim() || (parseFloat(form.berat_gram) || 0) <= 0) missing.push("Berat (gram)");
    if (!form.jumlah.trim() || (parseInt(form.jumlah) || 0) < 1) missing.push("Jumlah");
    if (!form.taksiran_harga_beli.trim() || (parseInt(form.taksiran_harga_beli.replace(/\D/g, "")) || 0) <= 0) missing.push("Taksiran Harga Beli");
    if (!form.harga_emas_hari_ini.trim() || (parseInt(form.harga_emas_hari_ini.replace(/\D/g, "")) || 0) <= 0) missing.push("Harga Emas Hari Ini");
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
    setSaving(true); setMsg("");

    const hargaBeliRp = parseInt(form.taksiran_harga_beli.replace(/\D/g, ""), 10) || 0;
    const hargaEmasHariIniNum = parseInt(form.harga_emas_hari_ini.replace(/\D/g, ""), 10) || 0;
    const jumlahNum = parseInt(form.jumlah) || 1;
    const tanggalMasuk = new Date().toISOString().split("T")[0];

    // Update patokan 24K hari ini (dipakai jg oleh halaman lain — POS, Inventori, Dashboard)
    // supaya selaras dgn harga yang baru saja diketik staff di sini. harga_jual baris ini
    // SENGAJA dipertahankan apa adanya (bukan ikut diisi 0), supaya kalkulasi % penjualan
    // di halaman lain yang masih memakainya tidak ikut berubah gara-gara transaksi buyback.
    const { error: hargaError } = await supabase.from("harga_emas").upsert(
      {
        tanggal: tanggalMasuk, karat: 24, label: "",
        harga_beli: hargaEmasHariIniNum,
        harga_jual: hargaEmasByKarat[24]?.harga_jual ?? 0,
      },
      { onConflict: "tanggal,karat,label" }
    );
    if (hargaError) { setSaving(false); setMsg("Gagal menyimpan harga emas: " + hargaError.message); return; }

    const { kode, isNew } = kodeForJenis("Emas Rosok", jenisKodeMap);
    if (isNew) {
      await supabase.from("jenis_barang_kode").insert({ nama: "Emas Rosok", kode }).select();
      setJenisKodeMap((prev) => ({ ...prev, "Emas Rosok": kode }));
    }
    const noBuyback = generateNoBuyback();

    const payload = {
      id_item: "",
      jenis_barang: "Emas Rosok",
      nama_produk: form.nama_produk.trim(),
      kadar: form.kadar.trim(),
      berat_gram: beratGramNum,
      jumlah: jumlahNum,
      status_inventori: "Tersedia",
      status_laporan: "Draf",
      kategori: "Emas Rosok",
      // Barang rosok belum dijual lagi apa adanya (biasanya dilebur/diproses ulang dulu),
      // jadi harga_jual sengaja dikosongkan (0) -- diisi manual lewat Inventori kalau nanti
      // memang mau langsung dijual.
      harga_beli: hargaBeliRp,
      harga_jual: 0,
      supplier: form.supplier.trim(),
      keterangan: form.keterangan.trim(),
      gambar_url: null,
      tanggal_masuk: tanggalMasuk,
      updated_at: new Date().toISOString(),
      jenis_inventori: "Aset",
      sub_jenis_aset: "Emas Rosok",
      no_buyback: noBuyback,
    };

    // id_item dirakit lewat fungsi atomik di DB (bukan dihitung dari snapshot existingIds di
    // browser), supaya aman dipakai banyak user input bersamaan — lalu insert-nya dicoba ulang
    // kalau (jarang sekali) tetap kena bentrok unique constraint.
    let error: { message: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      payload.id_item = await nextIdItemAtomic(supabase, form.kadar.trim(), kode, beratGramNum);
      ({ error } = await supabase.from("inventori").insert(payload));
      if (!error || error.code !== "23505") break;
    }
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
    recordNamaBarang(payload.nama_produk);
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
                  <AutocompleteField
                    value={form.nama_produk}
                    onChange={(v) => set("nama_produk", v)}
                    onSelect={(v) => set("nama_produk", v)}
                    suggestions={namaBarangOptions.filter((n) => n.toLowerCase().includes(form.nama_produk.trim().toLowerCase())).slice(0, 8)}
                    renderLabel={(n) => n}
                    placeholder="Contoh: Cincin Rosok Patah"
                    inputClassName="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                </div>

                <div>
                  <div className="grid grid-cols-3 gap-2 mb-1.5">
                    {["Karat", "Berat (gram)", "Jumlah"].map((h) => (
                      <label key={h} className="text-sm font-semibold text-gray-600">{h}</label>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <MasterDataPicker
                      value={form.kadar}
                      onChange={(v) => set("kadar", v.toUpperCase())}
                      options={kadarOptions}
                      onAddNew={addCustomKadar}
                      validate={validateKadarFormat}
                      placeholder="24K"
                      modalTitle="Tambah Kadar Baru"
                      modalLabel="Kadar Emas"
                      modalPlaceholder="Contoh: 24K"
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
                    {["Taksiran Harga Beli", "Harga Emas Hari Ini"].map((h) => (
                      <label key={h} className="text-sm font-semibold text-gray-600">{h}</label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["taksiran_harga_beli", "harga_emas_hari_ini"] as const).map((key) => (
                      <div key={key} className="flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:border-[#C99A36] focus-within:ring-1 focus-within:ring-[#C99A36]/20">
                        <span className="px-3 py-3 text-base font-semibold text-gray-500 bg-gray-50 border-r border-gray-200 select-none shrink-0">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={form[key]}
                          onChange={(e) => set(key, formatRibuan(e.target.value))}
                          placeholder="0"
                          className="flex-1 px-3 py-3 text-base focus:outline-none bg-white min-w-0"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Taksiran Harga Beli: total harga utk berat di atas (1 barang, sebelum dikali Jumlah).
                    Harga Emas Hari Ini: patokan 24K — otomatis kepakai jg di Dashboard/POS/Inventori, boleh diubah tiap transaksi.
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
              <InvoicePagePreview>
                <InvoiceBuyback mode="preview" data={buybackReady} />
              </InvoicePagePreview>
            </div>
            <div className="px-6 pb-6 sticky bottom-0 bg-white pt-3 border-t border-gray-100 rounded-b-2xl space-y-2">
              <p className="text-[11px] text-gray-400 text-center">
                Pertama kali print di komputer ini? Di kotak dialog print, klik “Lainnya” / “More settings” lalu matikan “Header dan footer” supaya alamat web tidak ikut tercetak.
              </p>
              <div className="flex gap-3">
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
        </div>
      )}
    </>
  );
}
