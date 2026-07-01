"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import DateField from "@/components/DateField";

const KADAR_FORMAT_RE = /^\d+(\.\d+)?K$/;
const validateKadarFormat = (v: string): string | null =>
  KADAR_FORMAT_RE.test(v.trim().toUpperCase()) ? null : "Format kadar harus angka diikuti K, contoh: 24K atau 18K.";

const PAGE_SIZE = 20;

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

interface EditForm {
  nama_produk: string;
  kadar: string;
  berat_gram: string;
  jumlah: string;
  harga_beli: string;
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

function rowToInvoiceData(r: BuybackRow): InvoiceBuybackData {
  return {
    no_buyback: r.no_buyback ?? "—",
    tanggal: r.tanggal_masuk,
    nama_barang: r.nama_produk,
    kadar: r.kadar,
    berat_gram: r.berat_gram,
    jumlah: r.jumlah,
    harga_per_gram: r.berat_gram > 0 ? Math.round(r.harga_beli / r.berat_gram) : 0,
    total: Math.round(r.harga_beli * r.jumlah),
  };
}

export default function PembelianPage() {
  const supabase = createClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [hargaEmasByKarat, setHargaEmasByKarat] = useState<Record<number, HargaEmasKarat>>({});
  const [jenisKodeMap, setJenisKodeMap] = useState<Record<string, string>>(KODE_JENIS_SEED);
  const [riwayat, setRiwayat] = useState<BuybackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buybackReady, setBuybackReady] = useState<InvoiceBuybackData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Filter & pagination state
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  // Detail & invoice dari riwayat
  const [selectedRow, setSelectedRow] = useState<BuybackRow | null>(null);
  const [previewRow, setPreviewRow] = useState<BuybackRow | null>(null);

  // Edit mode dalam modal detail
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");

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

  useEffect(() => {
    const beli24 = hargaEmasByKarat[24]?.harga_beli;
    if (beli24 != null && beli24 > 0 && !form.harga_emas_hari_ini) {
      setForm((f) => ({ ...f, harga_emas_hari_ini: String(beli24) }));
    }
  }, [hargaEmasByKarat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search reset page
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPage(0), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, dateFrom, dateTo]);

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

  // Filtered + paginated riwayat
  const filteredRiwayat = riwayat.filter((r) => {
    if (dateFrom && r.tanggal_masuk < dateFrom) return false;
    if (dateTo && r.tanggal_masuk > dateTo) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !r.nama_produk.toLowerCase().includes(q) &&
        !r.supplier.toLowerCase().includes(q) &&
        !(r.no_buyback ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredRiwayat.length / PAGE_SIZE);
  const pagedRiwayat = filteredRiwayat.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const isFiltering = search.trim() !== "" || dateFrom !== "" || dateTo !== "";

  function resetFilter() {
    setSearch(""); setDateFrom(""); setDateTo(""); setPage(0);
  }

  function closeDetailModal() {
    setSelectedRow(null);
    setEditMode(false);
    setEditForm(null);
    setEditMsg("");
  }

  function openEdit(r: BuybackRow) {
    setEditForm({
      nama_produk: r.nama_produk,
      kadar: r.kadar,
      berat_gram: String(r.berat_gram),
      jumlah: String(r.jumlah),
      harga_beli: r.harga_beli.toLocaleString("id-ID"),
      supplier: r.supplier,
      tanggal_masuk: r.tanggal_masuk,
    });
    setEditMsg("");
    setEditMode(true);
  }

  async function saveEdit() {
    if (!selectedRow || !editForm) return;
    const nama = editForm.nama_produk.trim();
    const kadar = editForm.kadar.trim().toUpperCase();
    const berat = parseFloat(editForm.berat_gram);
    const jumlah = parseInt(editForm.jumlah);
    const hargaBeli = parseInt(editForm.harga_beli.replace(/\D/g, ""), 10);
    const supplier = editForm.supplier.trim();

    if (!nama) { setEditMsg("Nama barang tidak boleh kosong."); return; }
    if (!KADAR_FORMAT_RE.test(kadar)) { setEditMsg("Format kadar harus angka diikuti K, contoh: 24K."); return; }
    if (!berat || berat <= 0) { setEditMsg("Berat harus lebih dari 0."); return; }
    if (!jumlah || jumlah < 1) { setEditMsg("Jumlah harus minimal 1."); return; }
    if (!hargaBeli || hargaBeli <= 0) { setEditMsg("Harga beli harus lebih dari 0."); return; }
    if (!supplier) { setEditMsg("Nama penjual tidak boleh kosong."); return; }

    setEditSaving(true); setEditMsg("");
    const { error } = await supabase
      .from("inventori")
      .update({
        nama_produk: nama,
        kadar,
        berat_gram: berat,
        jumlah,
        harga_beli: hargaBeli,
        supplier,
        tanggal_masuk: editForm.tanggal_masuk,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedRow.id);
    setEditSaving(false);
    if (error) { setEditMsg("Gagal menyimpan: " + error.message); return; }

    const updated: BuybackRow = {
      ...selectedRow,
      nama_produk: nama, kadar, berat_gram: berat, jumlah,
      harga_beli: hargaBeli, supplier, tanggal_masuk: editForm.tanggal_masuk,
    };
    setRiwayat((prev) => prev.map((r) => r.id === selectedRow.id ? updated : r));
    setSelectedRow(updated);
    setEditMode(false);
    setEditForm(null);
  }

  return (
    <>
      <style>{`
        @media print {
          aside, nav, #pembelian-screen, #buyback-preview-overlay, #riwayat-preview-overlay { display: none !important; }
          #invoice-print { display: block !important; }
          html, body { background: white !important; margin: 0; }
          @page { size: A5 landscape; margin: 10mm 5mm; }
        }
      `}</style>

      {buybackReady && <InvoiceBuyback mode="print" data={buybackReady} />}
      {previewRow && <InvoiceBuyback mode="print" data={rowToInvoiceData(previewRow)} />}

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
              <div className="flex-1 border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-gray-100 bg-amber-50">
                  <h3 className="font-extrabold text-gray-900">Riwayat Pembelian Rosok</h3>
                  <p className="text-sm text-gray-600">
                    {isFiltering
                      ? `${filteredRiwayat.length} dari ${riwayat.length} transaksi`
                      : `${riwayat.length} transaksi tercatat`}
                  </p>
                </div>

                {/* Filter bar */}
                <div className="px-5 py-4 border-b border-gray-100 bg-white space-y-3">
                  <div className="relative">
                    <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                    </svg>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nama barang, penjual, atau no. nota..."
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Dari Tanggal</label>
                      <DateField value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(0); }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Sampai Tanggal</label>
                      <DateField value={dateTo} onChange={(v) => { setDateTo(v); setPage(0); }} />
                    </div>
                  </div>
                  {isFiltering && (
                    <button
                      onClick={resetFilter}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: "#6F5333" }}
                    >
                      ✕ Hapus Filter
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : filteredRiwayat.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center flex-1">
                    <p className="text-gray-500 text-base font-medium">
                      {isFiltering ? "Tidak ada riwayat yang cocok dengan filter ini." : "Belum ada pembelian rosok tercatat."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {["No. Nota", "Tanggal", "Nama Barang", "Kadar", "Berat", "Jml", "Harga Beli", "Penjual", ""].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {pagedRiwayat.map((r) => (
                            <tr
                              key={r.id}
                              className="hover:bg-amber-50/50 transition-colors cursor-pointer"
                              onClick={() => setSelectedRow(r)}
                            >
                              <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{r.no_buyback ?? "—"}</td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{tglIndo(r.tanggal_masuk)}</td>
                              <td className="px-4 py-3 font-semibold text-gray-800">{r.nama_produk}</td>
                              <td className="px-4 py-3">{r.kadar}</td>
                              <td className="px-4 py-3">{fmtGram(r.berat_gram * r.jumlah)}</td>
                              <td className="px-4 py-3 text-center">{r.jumlah}</td>
                              <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{fmtRupiah(r.harga_beli * r.jumlah)}</td>
                              <td className="px-4 py-3 text-gray-600">{r.supplier}</td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-[#C99A36] font-semibold whitespace-nowrap">Lihat →</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-dashed border-gray-200 bg-white">
                        <p className="text-xs text-gray-400">
                          {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRiwayat.length)} dari {filteredRiwayat.length} transaksi
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setPage(0)}
                            disabled={page === 0}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-bold text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                          >«</button>
                          <button
                            onClick={() => setPage((p) => p - 1)}
                            disabled={page === 0}
                            className="px-3 h-8 flex items-center rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                          >‹ Prev</button>
                          <span
                            className="px-3 h-8 flex items-center rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: "#C99A36" }}
                          >
                            {page + 1} / {totalPages}
                          </span>
                          <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page >= totalPages - 1}
                            className="px-3 h-8 flex items-center rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                          >Next ›</button>
                          <button
                            onClick={() => setPage(totalPages - 1)}
                            disabled={page >= totalPages - 1}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-bold text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                          >»</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>

      {/* Modal preview/cetak invoice buyback BARU */}
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
                Pertama kali print di komputer ini? Di kotak dialog print, klik "Lainnya" / "More settings" lalu matikan "Header dan footer" supaya alamat web tidak ikut tercetak.
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

      {/* Modal DETAIL / EDIT RIWAYAT */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editMode ? "Edit Riwayat Buyback" : "Detail Riwayat Buyback"}
                </h2>
                <p className="text-xs text-gray-400 font-mono">{selectedRow.no_buyback ?? "—"}</p>
              </div>
              <button
                onClick={closeDetailModal}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 font-bold"
              >
                ×
              </button>
            </div>

            {/* VIEW MODE */}
            {!editMode && (
              <>
                <div className="px-6 py-5 space-y-3">
                  {[
                    { label: "No. Nota", value: selectedRow.no_buyback ?? "—", mono: true },
                    { label: "Tanggal", value: tglIndo(selectedRow.tanggal_masuk) },
                    { label: "Nama Barang", value: selectedRow.nama_produk },
                    { label: "Kadar", value: selectedRow.kadar },
                    { label: "Berat Total", value: fmtGram(selectedRow.berat_gram * selectedRow.jumlah) },
                    { label: "Jumlah", value: String(selectedRow.jumlah) },
                    { label: "Harga per Gram", value: selectedRow.berat_gram > 0 ? fmtRupiah(Math.round(selectedRow.harga_beli / selectedRow.berat_gram)) : "—" },
                    { label: "Total Harga Beli", value: fmtRupiah(selectedRow.harga_beli * selectedRow.jumlah), bold: true },
                    { label: "Penjual", value: selectedRow.supplier },
                  ].map(({ label, value, mono, bold }) => (
                    <div key={label} className="flex justify-between items-start gap-4">
                      <span className="text-sm text-gray-500 shrink-0">{label}</span>
                      <span className={`text-sm text-right ${bold ? "font-bold text-gray-900" : "text-gray-800"} ${mono ? "font-mono" : ""}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-5 grid grid-cols-3 gap-2">
                  <button
                    onClick={closeDetailModal}
                    className="py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => openEdit(selectedRow)}
                    className="py-2.5 rounded-xl border-2 font-semibold text-sm transition-colors"
                    style={{ borderColor: "#C99A36", color: "#C99A36" }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => { setPreviewRow(selectedRow); closeDetailModal(); }}
                    className="py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all"
                    style={{ backgroundColor: "#C99A36" }}
                  >
                    🖨️ Invoice
                  </button>
                </div>
              </>
            )}

            {/* EDIT MODE */}
            {editMode && editForm && (
              <>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nama / Deskripsi Barang</label>
                    <input
                      value={editForm.nama_produk}
                      onChange={(e) => setEditForm((f) => f ? { ...f, nama_produk: e.target.value } : f)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Kadar</label>
                      <input
                        value={editForm.kadar}
                        onChange={(e) => setEditForm((f) => f ? { ...f, kadar: e.target.value.toUpperCase() } : f)}
                        placeholder="24K"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Berat (gram)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.berat_gram}
                        onChange={(e) => setEditForm((f) => f ? { ...f, berat_gram: e.target.value } : f)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Jumlah</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.jumlah}
                        onChange={(e) => setEditForm((f) => f ? { ...f, jumlah: e.target.value } : f)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Harga Beli (per item)</label>
                    <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:border-[#C99A36]">
                      <span className="px-3 py-2.5 text-sm font-semibold text-gray-500 bg-gray-50 border-r border-gray-200 shrink-0">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editForm.harga_beli}
                        onChange={(e) => setEditForm((f) => f ? { ...f, harga_beli: formatRibuan(e.target.value) } : f)}
                        className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Penjual</label>
                    <input
                      value={editForm.supplier}
                      onChange={(e) => setEditForm((f) => f ? { ...f, supplier: e.target.value } : f)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Masuk</label>
                    <DateField
                      value={editForm.tanggal_masuk}
                      onChange={(v) => setEditForm((f) => f ? { ...f, tanggal_masuk: v } : f)}
                    />
                  </div>
                  {editMsg && (
                    <p className="text-sm font-semibold py-2 px-3 rounded-xl bg-red-50 text-red-600">{editMsg}</p>
                  )}
                </div>
                <div className="px-6 pb-5 flex gap-3">
                  <button
                    onClick={() => { setEditMode(false); setEditForm(null); setEditMsg(""); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                    style={{ backgroundColor: "#C99A36" }}
                  >
                    {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal PREVIEW INVOICE dari RIWAYAT */}
      {previewRow && (
        <div id="riwayat-preview-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Invoice Buyback</h2>
                <p className="text-xs text-gray-400 font-mono">{previewRow.no_buyback ?? "—"}</p>
              </div>
              <button
                onClick={() => setPreviewRow(null)}
                className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <InvoicePagePreview>
                <InvoiceBuyback mode="preview" data={rowToInvoiceData(previewRow)} />
              </InvoicePagePreview>
            </div>
            <div className="px-6 pb-6 sticky bottom-0 bg-white pt-3 border-t border-gray-100 rounded-b-2xl space-y-2">
              <p className="text-[11px] text-gray-400 text-center">
                Pertama kali print di komputer ini? Di kotak dialog print, klik "Lainnya" / "More settings" lalu matikan "Header dan footer" supaya alamat web tidak ikut tercetak.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewRow(null)}
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
