"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import PinGate from "@/components/PinGate";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { kodeForJenis, buildSeqCounters, nextIdItem, nextIdItemAtomic, KODE_JENIS_SEED, matchesBarcodeScan } from "@/lib/csv";
import { generateNoHutang, hitungHasil, hitungHasilAkhir } from "@/lib/hutangPiutang";
import { KADAR_OPTIONS } from "@/lib/gadai";
import { AddJenisModal } from "@/components/AddJenisModal";
import StorageImage from "@/components/StorageImage";
import { useJenisBarang } from "@/lib/useJenisBarang";
import { useCustomList } from "@/lib/useCustomList";
import { useNamaBarangList } from "@/lib/masterData";
import { MasterDataPicker } from "@/components/MasterDataPicker";
import { AutocompleteField } from "@/components/AutocompleteField";
import JsBarcode from "jsbarcode";

const KADAR_FORMAT_RE = /^\d+(\.\d+)?K$/;
const validateKadarFormat = (v: string): string | null =>
  KADAR_FORMAT_RE.test(v.trim().toUpperCase()) ? null : "Format kadar harus angka diikuti K, contoh: 24K atau 18K.";

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
  persen_modal?: number;
  persen_jual?: number;
  supplier?: string;
  keterangan?: string;
  gambar_url?: string;
  jenis_inventori: string;
  sub_jenis_aset?: string | null;
  no_buyback?: string | null;
  barcode_no?: number | null;
  id_item_lama?: string | null;
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
  persen_modal: string;
  persen_jual: string;
  supplier: string;
  keterangan: string;
  gambar_url: string;
  jenis_inventori: string;
  sub_jenis_aset: string;
}

const emptyForm: FormData = {
  id_item: "", jenis_barang: "Gelang", nama_produk: "",
  kadar: "", berat_gram: "", jumlah: "1",
  status_inventori: "Tersedia",
  status_laporan: "Draf", kategori: "Gelang",
  persen_modal: "", persen_jual: "", supplier: "",
  keterangan: "", gambar_url: "",
  jenis_inventori: "Stock Dalam", sub_jenis_aset: "",
};

const JENIS = ["Gelang", "Kalung", "Cincin", "Anting", "Liontin", "Tindik Mata", "Tusuk Konde", "Lainnya"];
const STATUS_INVENTORI = ["Tersedia", "Terjual", "Dalam Servis", "Retur", "Tidak Laku", "Mati Laku", "Habis Dijual", "Hilang"];
const STATUS_LAPORAN = ["Draf", "Persetujuan Pemeriksa", "Persetujuan Penandatangan", "Disetujui", "Ditolak"];
const JENIS_INVENTORI = ["Stock Dalam", "Stock Display", "Aset"] as const;
const SUB_JENIS_ASET = ["Cukim"] as const;

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

/** Harga emas per gram untuk satu karat tertentu, hari ini, dari halaman Dashboard. */
interface HargaEmasKarat {
  harga_beli: number;
  harga_jual: number;
}

/**
 * Harga (Rp) = Berat x Persentase x Harga emas 24K hari itu — SELALU patokan 24K,
 * berapa pun karat barangnya (bukan harga per karat barang itu sendiri).
 */
function hitungHargaDariPersentase(beratGram: number, persentase: number, hargaEmas24K: number): number {
  return Math.round(hitungHasil(beratGram, persentase) * hargaEmas24K);
}

/* ─── Input persentase harga (%) ─── */
function PercentInput({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:border-[#C99A36] focus-within:ring-1 focus-within:ring-[#C99A36]/20 ${className}`}>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="flex-1 px-3 py-3 text-base focus:outline-none bg-white min-w-0"
      />
      <span className="px-3 py-3 text-base font-semibold text-gray-500 bg-gray-50 border-l border-gray-200 select-none shrink-0">%</span>
    </div>
  );
}

/* ─── Preview & Pilih Barcode sebelum Print ─── */
function BarcodePreviewModal({
  open, onClose, idItem, barcodeNo, namaProduk, kadar, beratGram, jumlah,
}: {
  open: boolean;
  onClose: () => void;
  idItem: string;
  barcodeNo?: number | null;
  namaProduk: string;
  kadar: string;
  beratGram: string;
  jumlah: number;
}) {
  const [checked, setChecked] = useState<boolean[]>([]);
  const [columns, setColumns] = useState<1 | 2 | 3>(3);
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("barcodePrintColumns");
    if (saved === "1" || saved === "2" || saved === "3") setColumns(Number(saved) as 1 | 2 | 3);
  }, []);

  const changeColumns = (n: 1 | 2 | 3) => {
    setColumns(n);
    localStorage.setItem("barcodePrintColumns", String(n));
  };

  useEffect(() => {
    if (!open) return;
    setChecked(Array(jumlah).fill(true));
  }, [open, jumlah]);

  // Setiap unit dalam 1 batch (jumlah sama) dicetak dengan barcode IDENTIK — persis id_item,
  // tanpa akhiran nomor unit, supaya hasil scan label manapun pasti cocok dengan id_item di database.
  useEffect(() => {
    if (!open || !idItem) return;
    const timer = setTimeout(() => {
      // id_item penuh (mis. "24K-CIN-0149-0001", 17 char) masih kepadetan buat label
      // 30x20mm walau "-"-nya dibuang (~156 modul CODE128 — masih lebih tipis dari
      // resolusi printer thermal). Begitu barang sudah tersimpan & punya barcode_no
      // (nomor pendek dari DB, lihat migration 028), barcode encode nomor itu saja
      // (~79 modul, jauh lebih renggang/gampang discan). id_item lengkap tetap
      // dicetak sebagai teks biasa di bawah barcode untuk dibaca manusia. Barang yang
      // belum tersimpan (belum punya barcode_no) pakai fallback id_item tanpa "-".
      // Lihat idItemScanCandidates() di lib/csv.ts untuk pencocokan saat scan.
      const payload = barcodeNo != null ? String(barcodeNo).padStart(6, "0") : idItem.replace(/-/g, "");
      svgRefs.current.forEach((el) => {
        if (!el) return;
        try {
          JsBarcode(el, payload, {
            format: "CODE128",
            displayValue: false,
            height: 100,
            margin: 0,
            width: 2,
            lineColor: "#000000",
            background: "#ffffff",
          });
          // Tanpa ini, browser memaksa proporsi (preserveAspectRatio bawaan) supaya pas
          // dengan lebar label -> tinggi batang barcode jadi cuma terisi sebagian kecil
          // dari tinggi yang dialokasikan ("letterbox"), batangnya jadi pendek & susah
          // discan. "none" supaya tinggi batang dipakai penuh sesuai ukuran cetak.
          el.setAttribute("preserveAspectRatio", "none");
        } catch { /* ignore */ }
      });
    }, 40);
    return () => clearTimeout(timer);
  }, [open, idItem, barcodeNo, jumlah]);

  const selectedCount = checked.filter(Boolean).length;

  const doPrint = () => {
    const selected: { code: string; svg: string }[] = [];
    checked.forEach((on, i) => {
      if (!on) return;
      const el = svgRefs.current[i];
      if (!el) return;
      selected.push({ code: idItem, svg: el.outerHTML });
    });
    if (!selected.length) return;

    const LABEL_W = 33; // mm — fisik 1 label di kertas roll (label thermal 33x15mm, 3 line)
    const LABEL_H = 15; // mm
    const GAP = 1; // mm — jarak antar label di kertas roll
    // Kertas rollnya fisik SELALU 3 kolom lebar (3x33mm + 2x1mm jarak) — lihat foto kertas label.
    // Halaman cetak (@page) HARUS selalu dibuat selebar itu juga, walau cuma sebagian
    // kolom yang diisi barcode. Kalau halaman dibuat lebih sempit (mis. 33mm utk "1
    // Kolom"), printer/driver bakal men-scale isinya supaya pas dgn lebar kertas fisik
    // -- hasilnya 1 barcode malah jadi besar & buram, bukan tetap 1 label kecil.
    // Makanya kolom yang TIDAK dipakai diisi <div> kosong (bukan dihilangkan dari grid).
    const PAPER_COLS = 3;
    const pageWidth = PAPER_COLS * LABEL_W + (PAPER_COLS - 1) * GAP;

    const rowsHtml: string[] = [];
    for (let r = 0; r < selected.length; r += columns) {
      const rowItems = selected.slice(r, r + columns);
      const labelsHtml = rowItems
        .map(
          ({ code, svg }) => `
        <div class="label">
          <div class="toko">Toko Mas Kresno</div>
          ${svg}
          <div class="kode">${code}</div>
          <div class="nama">${namaProduk}</div>
        </div>`
        )
        .join("");
      const blankHtml = `<div class="label label-empty"></div>`.repeat(PAPER_COLS - rowItems.length);
      rowsHtml.push(`<div class="row">${labelsHtml}${blankHtml}</div>`);
    }

    const w = window.open("", "_blank", "width=400,height=300");
    if (!w) return;
    w.document.write(`<html><head><title>Barcode ${idItem}</title>
      <style>
        @page { size: ${pageWidth}mm ${LABEL_H}mm; margin: 0; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .row {
          display: grid;
          grid-template-columns: repeat(${PAPER_COLS}, ${LABEL_W}mm);
          column-gap: ${GAP}mm;
          width: ${pageWidth}mm;
          height: ${LABEL_H}mm;
          page-break-after: always;
          break-after: page;
        }
        .row:last-child { page-break-after: auto; break-after: auto; }
        .label {
          width: ${LABEL_W}mm; height: ${LABEL_H}mm; overflow: hidden;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 0.4mm 1mm;
        }
        .label-empty { visibility: hidden; }
        .label .toko { font-size: 4pt; font-weight: bold; line-height: 1.1; }
        .label svg {
          width: 29mm; height: 6.2mm; margin: 0.2mm 0;
          shape-rendering: crispEdges;
        }
        .label .kode { font-size: 4.5pt; font-weight: bold; letter-spacing: 0.5px; line-height: 1.1; }
        .label .nama { font-size: 3.5pt; max-width: ${LABEL_W - 2}mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.05; }
      </style></head>
      <body>${rowsHtml.join("")}
      <script>
        window.onload = function () { window.print(); };
        window.onafterprint = function () { window.close(); };
      <\/script>
      </body></html>`);
    w.document.close();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Preview Barcode
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{idItem} &bull; {jumlah} unit</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors font-bold text-xl"
          >
            ×
          </button>
        </div>
        {barcodeNo == null && (
          <p className="px-6 pt-3 text-xs text-amber-700 bg-amber-50">
            Barang ini belum disimpan, jadi barcode-nya masih pakai format lama (lebih padat).
            Simpan dulu lalu buka lagi untuk barcode yang paling gampang discan.
          </p>
        )}

        {/* Select all toggle */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-600 font-medium">
            {selectedCount} dari {jumlah} dipilih
          </p>
          <button
            onClick={() => setChecked(Array(jumlah).fill(!checked.every(Boolean)))}
            className="text-sm font-semibold hover:underline"
            style={{ color: "#C99A36" }}
          >
            {checked.every(Boolean) ? "Batalkan Semua" : "Pilih Semua"}
          </button>
        </div>

        {/* Layout cetak: jumlah kolom per baris kertas thermal */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-600 font-medium">Tata letak kertas</p>
          <div className="flex gap-1.5">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                onClick={() => changeColumns(n)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  columns === n
                    ? "border-[#C99A36] bg-amber-50 text-[#C99A36]"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {n} Kolom
              </button>
            ))}
          </div>
        </div>

        {/* Grid barcode preview */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: jumlah }, (_, i) => (
              <div
                key={i}
                onClick={() => setChecked((prev) => prev.map((v, j) => j === i ? !v : v))}
                className={`cursor-pointer rounded-xl border-2 p-2 flex flex-col items-center gap-1 transition-all select-none ${
                  checked[i] ? "border-[#C99A36] bg-amber-50" : "border-gray-200 bg-white opacity-50"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-0.5">
                  <span className="text-[10px] text-gray-400 font-medium">#{i + 1}</span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    checked[i] ? "bg-[#C99A36] border-[#C99A36]" : "border-gray-300"
                  }`}>
                    {checked[i] && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M1.5 5l2.5 2.5 4.5-4.5" />
                      </svg>
                    )}
                  </div>
                </div>
                <svg
                  ref={(el) => { svgRefs.current[i] = el; }}
                  className="w-full"
                  style={{ height: 30 }}
                />
                <p className="text-[10px] font-bold text-gray-800 tracking-wide">{idItem}</p>
                <p className="text-[9px] text-gray-400 truncate w-full text-center">{namaProduk}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={doPrint}
            disabled={selectedCount === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#C99A36" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print {selectedCount > 0 ? `(${selectedCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Popup Detail Barang ─── */
function DetailBarangPopup({
  open, onClose, editData, onSaved, jenisOptions, customJenis, existingIds, onAddJenis, onDeleteJenis, defaultJenisInventori, hargaEmasByKarat, ensureKode,
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
  defaultJenisInventori?: string;
  hargaEmasByKarat: Record<number, HargaEmasKarat>;
  ensureKode: (jenis: string) => Promise<string>;
}) {
  const supabase = createClient();
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showBarcodePreview, setShowBarcodePreview] = useState(false);
  const [barcodeNo, setBarcodeNo] = useState<number | null>(null);
  const [catatHutang, setCatatHutang] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const jenisTouchedRef = useRef(false);

  const { all: kadarOptions, addCustom: addCustomKadar } = useCustomList("kadar_master", KADAR_OPTIONS);
  const { all: namaBarangOptions, record: recordNamaBarang } = useNamaBarangList();

  useEffect(() => {
    if (!open) return;
    jenisTouchedRef.current = false;
    setCatatHutang(false);
    if (editData) {
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
        persen_modal:      editData.persen_modal != null ? String(editData.persen_modal) : "",
        persen_jual:       editData.persen_jual != null ? String(editData.persen_jual) : "",
        supplier:          editData.supplier ?? "",
        keterangan:        editData.keterangan ?? "",
        gambar_url:        editData.gambar_url ?? "",
        jenis_inventori:   editData.jenis_inventori ?? "Stock Dalam",
        sub_jenis_aset:    editData.sub_jenis_aset ?? "",
      });
    } else {
      setForm({ ...emptyForm, jenis_inventori: defaultJenisInventori ?? "Stock Dalam", sub_jenis_aset: "" });
    }
    setBarcodeNo(editData?.barcode_no ?? null);
    setMsg("");
    setShowBarcodePreview(false);
  }, [open, editData, defaultJenisInventori]);

  // Kode otomatis: selalu untuk barang baru; untuk edit hanya jika user ganti jenis
  // Butuh kadar yang valid (mis. "24K") karena format kode-nya {karat}-{kode jenis}-{berat}-{urutan}
  useEffect(() => {
    if (!open) return;
    if (editData && !jenisTouchedRef.current) return;
    const kadarTrimmed = form.kadar.trim();
    if (!/^\d+(\.\d+)?K$/.test(kadarTrimmed)) return;
    const beratGramNum = parseFloat(form.berat_gram) || 0;
    let cancelled = false;
    (async () => {
      const kode = await ensureKode(form.jenis_barang);
      if (cancelled) return;
      const counters = buildSeqCounters(existingIds.map((id_item) => ({ id_item })));
      setForm((f) => ({ ...f, id_item: nextIdItem(kadarTrimmed, kode, beratGramNum, counters) }));
    })();
    return () => { cancelled = true; };
  }, [open, editData, form.jenis_barang, form.kadar, form.berat_gram, existingIds, ensureKode]);

  const set = (key: keyof FormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

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

  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!form.id_item.trim()) missing.push("Kode Barang");
    if (!form.nama_produk.trim()) missing.push("Item / Nama Barang");
    const kadarTrimmed = form.kadar.trim();
    if (!kadarTrimmed || !/^\d+(\.\d+)?K$/.test(kadarTrimmed)) {
      missing.push("Karat (contoh: 24K atau 18K — angka diikuti huruf K)");
    }
    if (!form.berat_gram.trim() || (parseFloat(form.berat_gram) || 0) <= 0) missing.push("Berat (gram)");
    if (!form.jumlah.trim() || (parseInt(form.jumlah) || 0) < 1) missing.push("Jumlah");
    if (!form.persen_modal.trim() || (parseFloat(form.persen_modal) || 0) <= 0) missing.push("Persentase Modal");
    if (!form.persen_jual.trim() || (parseFloat(form.persen_jual) || 0) <= 0) missing.push("Persentase Jual");
    if (!hargaEmasByKarat[24]) missing.push("Harga Emas 24K hari ini (isi dulu di halaman Dashboard)");
    if (!form.supplier.trim()) missing.push("Supplier");
    if (form.jenis_inventori === "Aset" && !form.sub_jenis_aset) missing.push("Jenis Aset (Cukim / Emas Rosok)");
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
    const hargaEmas24K = hargaEmasByKarat[24];
    if (!hargaEmas24K) return;
    setSaving(true); setMsg("");

    const persenModalNum = parseFloat(form.persen_modal) || 0;
    const persenJualNum = parseFloat(form.persen_jual) || 0;
    const hargaBeliRp = hitungHargaDariPersentase(beratGramNum, persenModalNum, hargaEmas24K.harga_beli);
    const hargaJualRp = hitungHargaDariPersentase(beratGramNum, persenJualNum, hargaEmas24K.harga_jual);

    const payload = {
      id_item:           form.id_item.trim().toUpperCase(),
      jenis_barang:      form.jenis_barang,
      nama_produk:       form.nama_produk.trim(),
      kadar:             form.kadar.trim(),
      berat_gram:        beratGramNum,
      jumlah:            parseInt(form.jumlah) || 1,
      status_inventori:  form.status_inventori,
      status_laporan:    form.status_laporan,
      kategori:          form.jenis_barang,
      persen_modal:      persenModalNum,
      persen_jual:       persenJualNum,
      harga_beli:        hargaBeliRp,
      harga_jual:        hargaJualRp,
      supplier:          form.supplier.trim(),
      keterangan:        form.keterangan.trim(),
      gambar_url:        form.gambar_url.trim() || null,
      tanggal_masuk:     new Date().toISOString().split("T")[0],
      updated_at:        new Date().toISOString(),
      jenis_inventori:   form.jenis_inventori,
      sub_jenis_aset:    form.jenis_inventori === "Aset" ? (form.sub_jenis_aset || null) : null,
    };

    let error: { message: string; code?: string } | null = null;
    if (editData) {
      ({ error } = await supabase.from("inventori").update(payload).eq("id", editData.id));
    } else {
      // id_item dirakit ulang di sini (bukan pakai pratinjau form.id_item) lewat fungsi atomik
      // di DB, supaya aman dipakai banyak user input bersamaan — lalu insert-nya dicoba ulang
      // kalau (jarang sekali) tetap kena bentrok unique constraint.
      const kode = await ensureKode(form.jenis_barang);
      let inserted: { barcode_no: number | null } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        payload.id_item = await nextIdItemAtomic(supabase, form.kadar.trim(), kode, beratGramNum);
        const res = await supabase.from("inventori").insert(payload).select("barcode_no").single();
        error = res.error;
        inserted = res.data;
        if (!error || error.code !== "23505") break;
      }
      if (!error) {
        setForm((f) => ({ ...f, id_item: payload.id_item }));
        // Supaya tombol "Cetak Barcode" langsung pakai barcode_no (lebih renggang/gampang
        // discan) tanpa perlu tutup-buka popup lagi setelah barang baru disimpan.
        setBarcodeNo(inserted?.barcode_no ?? null);
      }
    }

    if (error) { setSaving(false); setMsg("Gagal menyimpan: " + error.message); return; }

    recordNamaBarang(payload.nama_produk);

    if (!editData && catatHutang && payload.supplier) {
      const jatuhTempo = new Date();
      jatuhTempo.setDate(jatuhTempo.getDate() + 30);
      const totalBeratNum = beratGramNum * payload.jumlah;
      const hasilHutang = hitungHasil(totalBeratNum, persenModalNum);
      const hasilAkhirHutang = hitungHasilAkhir(hasilHutang, karatNum);
      const { error: hutangError } = await supabase.from("hutang").insert({
        no_hutang: generateNoHutang(),
        jenis_hutang: "supplier",
        nama: payload.supplier,
        kategori: "Supplier",
        berat_emas_gram: totalBeratNum,
        persentase_harga: persenModalNum,
        kadar_karat: karatNum,
        hasil: hasilHutang,
        hasil_akhir: hasilAkhirHutang,
        harga_per_gram: hargaEmasByKarat[24]?.harga_beli ?? 0,
        harga_total: Math.round(payload.harga_beli * payload.jumlah),
        pembayaran_pelunasan: null,
        status: "Belum Lunas",
        tanggal_jatuh_tempo: jatuhTempo.toISOString().split("T")[0],
        tanggal_pelunasan: null,
      });
      setSaving(false);
      if (hutangError) {
        setMsg("Barang tersimpan, tapi gagal mencatat hutang: " + hutangError.message);
        return;
      }
      setMsg("✓ Berhasil disimpan! Hutang ke supplier juga tercatat.");
      onSaved();
      setTimeout(() => { onClose(); }, 900);
      return;
    }

    setSaving(false);
    setMsg("✓ Berhasil disimpan!");
    onSaved();
    setTimeout(() => { onClose(); }, 700);
  };

  const openBarcodePreview = () => {
    const missing = missingFields();
    if (missing.length > 0) {
      setMsg(`Lengkapi dulu: ${missing.join(", ")}.`);
      return;
    }
    setShowBarcodePreview(true);
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
          {/* Kode Barang — tampil saja, tidak bisa diubah */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Kode Barang</label>
            <p className="text-sm text-gray-400 mb-1.5">
              Kode ini dibuat otomatis sesuai Jenis Barang yang dipilih dan tidak dapat diubah.
            </p>
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-base font-mono font-bold text-gray-900 tracking-widest">
                {form.id_item || "—"}
              </span>
            </div>
          </div>

          {/* Jenis Barang */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Jenis Barang</label>
            <p className="text-sm text-gray-400 mb-1.5">Cari atau pilih jenis barang ini. Tidak ada di daftar? Tambahkan jenis baru.</p>
            <MasterDataPicker
              value={form.jenis_barang}
              onChange={(v) => { jenisTouchedRef.current = true; set("jenis_barang", v); }}
              options={jenisOptions}
              onAddNew={onAddJenis}
              placeholder="Cari atau pilih jenis barang..."
              modalTitle="Tambah Jenis Barang Baru"
              modalLabel="Nama Jenis Barang"
            />
            {customJenis.includes(form.jenis_barang) && (
              <button
                type="button"
                onClick={() => { onDeleteJenis(form.jenis_barang); set("jenis_barang", JENIS[0]); }}
                className="mt-1.5 text-xs font-semibold text-red-500 hover:underline"
              >
                Hapus jenis &ldquo;{form.jenis_barang}&rdquo; dari daftar
              </button>
            )}
          </div>

          {/* Jenis Inventori */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
            <label className="block text-base font-semibold text-gray-700 mb-2">Jenis Inventori</label>
            <div className="flex gap-2 flex-wrap">
              {JENIS_INVENTORI.map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => { set("jenis_inventori", j); if (j !== "Aset") set("sub_jenis_aset", ""); }}
                  className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                    form.jenis_inventori === j
                      ? "bg-[#C99A36] border-[#C99A36] text-white"
                      : "border-gray-300 text-gray-600 bg-white hover:border-[#C99A36]"
                  }`}
                >
                  {j}
                </button>
              ))}
            </div>

            {/* Sub Jenis Aset */}
            {form.jenis_inventori === "Aset" && (
              <div className="mt-3">
                <label className="block text-sm font-semibold text-gray-600 mb-2">Jenis Aset</label>
                <div className="flex gap-2 flex-wrap">
                  {SUB_JENIS_ASET.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set("sub_jenis_aset", s)}
                      className={`px-4 py-2.5 rounded-full text-base font-semibold border-2 transition-colors ${
                        form.sub_jenis_aset === s
                          ? "bg-stone-700 border-stone-700 text-white"
                          : "border-gray-300 text-gray-600 bg-white hover:border-stone-500"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Nama Barang / Item */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">
              {form.jenis_inventori === "Aset" ? "Item / Deskripsi Aset" : "Nama Barang"}
            </label>
            <AutocompleteField
              value={form.nama_produk}
              onChange={(v) => set("nama_produk", v)}
              onSelect={(v) => set("nama_produk", v)}
              suggestions={namaBarangOptions.filter((n) => n.toLowerCase().includes(form.nama_produk.trim().toLowerCase())).slice(0, 8)}
              renderLabel={(n) => n}
              placeholder="Contoh: Gelang Rantai Singapur"
              inputClassName="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20"
            />
          </div>

          {/* Gambar Barang */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1.5">Foto Barang <span className="text-gray-400 font-normal">(opsional)</span></label>
            {form.gambar_url ? (
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <StorageImage src={form.gambar_url} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <p className="text-sm text-gray-500">Foto sudah diunggah.</p>
                  <button
                    type="button"
                    onClick={() => set("gambar_url", "")}
                    className="self-start text-sm font-semibold text-red-500 hover:underline"
                  >
                    Ganti / Hapus Foto
                  </button>
                </div>
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) uploadGambar(f);
                }}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
                  dragActive ? "border-[#C99A36] bg-amber-50" : "border-gray-300 bg-gray-50 hover:border-[#C99A36]"
                }`}
              >
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <p className="text-sm text-gray-500">
                  {uploading ? (
                    "Mengunggah foto..."
                  ) : (
                    <>Seret &amp; lepas foto di sini, atau <span className="font-semibold" style={{ color: "#C99A36" }}>klik untuk pilih file</span></>
                  )}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadGambar(f); e.target.value = ""; }}
                />
              </label>
            )}
          </div>

          {/* Karat / Berat / Jumlah */}
          <div>
            <div className="grid grid-cols-3 gap-2 mb-1.5">
              {["Karat", "Berat (gram)", "Jumlah"].map((h) => (
                <label key={h} className="text-sm font-semibold text-gray-600">{h}</label>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
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
                <span className="text-xs text-gray-400">Angka + K (contoh: 24K)</span>
              </div>
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

          {/* Persentase Modal / Persentase Jual — harga asli baru muncul saat barang dijual */}
          <div>
            <div className="grid grid-cols-2 gap-2 mb-1.5">
              {["Persentase Modal (%)", "Persentase Jual (%)"].map((h) => (
                <label key={h} className="text-sm font-semibold text-gray-600">{h}</label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PercentInput value={form.persen_modal} onChange={(v) => set("persen_modal", v)} />
              <PercentInput value={form.persen_jual} onChange={(v) => set("persen_jual", v)} />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              % dari harga emas 24K hari ini (Dashboard) — bukan harga sesuai karat barang ini. Harga Rupiah sebenarnya baru muncul saat barang ini dijual.
            </p>
            {(() => {
              const beratPreview = parseFloat(form.berat_gram) || 0;
              const karatTrimmedPreview = form.kadar.trim();
              const persenModalPreview = parseFloat(form.persen_modal) || 0;
              const persenJualPreview = parseFloat(form.persen_jual) || 0;
              const hargaEmas24KPreview = hargaEmasByKarat[24];
              if (!karatTrimmedPreview || !/^\d+(\.\d+)?K$/.test(karatTrimmedPreview)) return null;
              if (!hargaEmas24KPreview) {
                return (
                  <p className="text-xs font-semibold text-red-500 mt-1.5">
                    Harga Emas 24K hari ini belum diisi di Dashboard — isi dulu sebelum menyimpan barang.
                  </p>
                );
              }
              if (!beratPreview || (!persenModalPreview && !persenJualPreview)) return null;
              const modalRp = hitungHargaDariPersentase(beratPreview, persenModalPreview, hargaEmas24KPreview.harga_beli);
              const jualRp = hitungHargaDariPersentase(beratPreview, persenJualPreview, hargaEmas24KPreview.harga_jual);
              return (
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <p className="text-gray-400">≈ Rp {modalRp.toLocaleString("id-ID")}</p>
                  <p className="text-gray-400">≈ Rp {jualRp.toLocaleString("id-ID")}</p>
                </div>
              );
            })()}
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
            {!editData && (
              <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={catatHutang}
                  onChange={(e) => setCatatHutang(e.target.checked)}
                  className="accent-[#C99A36]"
                />
                Catat sebagai Hutang ke Supplier (belum dibayar)
              </label>
            )}
          </div>

          {/* Keterangan — opsional */}
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
            <p className="text-sm text-gray-400 mb-1.5">Tahap persetujuan laporan barang ini (boleh dibiarkan &quot;Draf&quot; jika belum tahu).</p>
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
            onClick={openBarcodePreview}
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

      {/* Barcode preview modal (muncul di atas popup ini) */}
      <BarcodePreviewModal
        open={showBarcodePreview}
        onClose={() => setShowBarcodePreview(false)}
        idItem={form.id_item}
        barcodeNo={barcodeNo}
        namaProduk={form.nama_produk}
        kadar={form.kadar}
        beratGram={form.berat_gram}
        jumlah={Math.max(1, parseInt(form.jumlah) || 1)}
      />
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

/* ─── Hasil Scan Barcode (konfirmasi ditemukan / tidak ditemukan) ─── */
type ScanResult =
  | { type: "found"; item: BarangRow }
  | { type: "notfound"; code: string };

function ScanResultPopup({
  result, onClose, onEdit,
}: {
  result: ScanResult | null;
  onClose: () => void;
  onEdit: (item: BarangRow) => void;
}) {
  if (!result) return null;

  if (result.type === "notfound") {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Barang Tidak Ditemukan</h3>
          <p className="text-gray-500 text-base mb-1">
            Kode barcode <strong className="font-mono">{result.code}</strong> tidak cocok dengan barang manapun di inventori.
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Pastikan barcode sudah benar, atau barang ini belum didaftarkan ke inventori.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-base transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  const item = result.item;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-green-50 border-b border-green-100 px-6 py-5 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900">Barang Berhasil Dipindai</h3>
          <p className="text-gray-500 text-sm mt-1">Detail barang hasil scan barcode:</p>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            {item.gambar_url ? (
              <StorageImage src={item.gambar_url} alt={item.nama_produk} className="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-lg font-bold text-gray-900 truncate">{item.nama_produk}</p>
              <p className="text-sm text-gray-400 font-mono">{item.id_item}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-amber-600 font-semibold uppercase">Karat</p>
              <p className="text-base font-bold text-gray-900">{item.kadar || "—"}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-amber-600 font-semibold uppercase">Berat</p>
              <p className="text-base font-bold text-gray-900">{item.berat_gram}g</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-amber-600 font-semibold uppercase">Stok</p>
              <p className="text-base font-bold text-gray-900">{item.jumlah} pcs</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[item.status_inventori] ?? "bg-gray-100 text-gray-600"}`}>
              {item.status_inventori}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              {item.jenis_inventori ?? "Stock Dalam"}
            </span>
          </div>

          {item.jumlah <= 5 && (
            <p className="text-red-600 text-sm font-semibold mt-3">⚠ Stok menipis, tersisa {item.jumlah} pcs.</p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-base hover:bg-gray-50 transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={() => { onEdit(item); onClose(); }}
            className="flex-1 py-3.5 rounded-xl text-white font-bold text-base transition-all hover:opacity-90"
            style={{ backgroundColor: "#C99A36" }}
          >
            Ubah Barang
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Main Inventori Page ═══ */
function InventoriContent({ onLock, onOpenChangePin }: {
  onLock: () => void;
  onOpenChangePin: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const processedScanRef = useRef<string | null>(null);

  const [items, setItems] = useState<BarangRow[]>([]);
  const [filtered, setFiltered] = useState<BarangRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BarangRow | null>(null);
  const [activeTab, setActiveTab] = useState<typeof JENIS_INVENTORI[number]>("Stock Dalam");
  const [filterSubJenis, setFilterSubJenis] = useState("Semua");
  const [filterJenis, setFilterJenis] = useState("Pilih Jenis Inventori");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [sortBy, setSortBy] = useState<"terbaru" | "terlama" | "nama_az" | "stok_banyak" | "stok_sedikit">("terbaru");
  const [showPopup, setShowPopup] = useState(false);
  const [editItem, setEditItem] = useState<BarangRow | null>(null);
  const [hapusItem, setHapusItem] = useState<BarangRow | null>(null);
  const [search, setSearch] = useState("");
  const [searchAllTabs, setSearchAllTabs] = useState(false);
  const [showAddJenisFilter, setShowAddJenisFilter] = useState(false);
  const [hargaEmasByKarat, setHargaEmasByKarat] = useState<Record<number, HargaEmasKarat>>({});
  const [jenisKodeMap, setJenisKodeMap] = useState<Record<string, string>>(KODE_JENIS_SEED);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const { allJenis, customJenis, addCustomJenis, deleteCustomJenis: deleteCustomJenisRaw } = useJenisBarang(JENIS);

  // Pilih barang & pastikan tab/filter yang aktif tidak menyembunyikannya dari daftar
  // (mis. barang hasil scan ada di tab "Aset" padahal tab yang sedang dibuka "Stock Dalam").
  const focusItem = useCallback((item: BarangRow) => {
    setSelected(item);
    setActiveTab((item.jenis_inventori as typeof JENIS_INVENTORI[number]) ?? "Stock Dalam");
    setFilterSubJenis("Semua");
    setFilterJenis("Pilih Jenis Inventori");
    setFilterStatus("Semua");
    setSearch("");
    setSearchAllTabs(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const [invRes, hargaRes, kodeRes] = await Promise.all([
      supabase
        .from("inventori")
        .select("*")
        .order("tanggal_masuk", { ascending: false }),
      supabase
        .from("harga_emas")
        .select("karat,harga_beli,harga_jual")
        .eq("tanggal", todayStr)
        .eq("label", ""),
      supabase.from("jenis_barang_kode").select("nama,kode"),
    ]);
    const rows = (invRes.data ?? []) as BarangRow[];
    setItems(rows);
    setFiltered(rows);
    const hargaMap: Record<number, HargaEmasKarat> = {};
    for (const r of hargaRes.data ?? []) {
      hargaMap[r.karat] = { harga_beli: r.harga_beli, harga_jual: r.harga_jual };
    }
    setHargaEmasByKarat(hargaMap);
    const kodeMap: Record<string, string> = { ...KODE_JENIS_SEED };
    for (const r of kodeRes.data ?? []) {
      kodeMap[r.nama] = r.kode;
    }
    setJenisKodeMap(kodeMap);

    // Auto-select from URL param (link dari Dashboard / Konfirmasi Keluar)
    const idParam = searchParams.get("id");
    if (idParam) {
      const found = rows.find((r) => r.id === idParam);
      if (found) focusItem(found);
    }
    setLoading(false);
  }, [searchParams, focusItem]);

  // Ambil kode 3-huruf untuk jenis_barang; kalau belum ada, generate & simpan permanen
  const ensureKode = useCallback(async (jenis: string): Promise<string> => {
    const trimmed = jenis.trim();
    const { kode, isNew } = kodeForJenis(trimmed, jenisKodeMap);
    if (!isNew) return kode;
    const { error } = await supabase.from("jenis_barang_kode").insert({ nama: trimmed, kode });
    if (!error) {
      setJenisKodeMap((prev) => ({ ...prev, [trimmed]: kode }));
      return kode;
    }
    // User lain bisa saja barusan menambah jenis yang sama (atau kode yang sama) duluan —
    // ambil ulang peta kode terbaru dari DB alih-alih langsung gagal.
    const { data } = await supabase.from("jenis_barang_kode").select("nama,kode");
    const fresh: Record<string, string> = { ...KODE_JENIS_SEED };
    for (const r of data ?? []) fresh[r.nama] = r.kode;
    setJenisKodeMap(fresh);
    if (fresh[trimmed]) return fresh[trimmed];
    throw error;
  }, [jenisKodeMap]);

  const deleteCustomJenis = useCallback(async (nama: string) => {
    if (!window.confirm(`Hapus jenis barang "${nama}" dari daftar pilihan?\n\nBarang yang sudah memakai jenis ini tidak akan terhapus, hanya pilihannya saja yang dihilangkan.`)) {
      return;
    }
    const ok = await deleteCustomJenisRaw(nama);
    if (!ok) { window.alert("Gagal menghapus jenis barang."); return; }
    if (filterJenis === nama) setFilterJenis("Pilih Jenis Inventori");
  }, [filterJenis, deleteCustomJenisRaw]);

  useEffect(() => { load(); }, [load]);

  // Hasil scan barcode (dari BarcodeScannerListener, lewat ?scan=KODE) -> tampilkan
  // popup konfirmasi "ditemukan" dengan detail barang, atau popup "tidak ditemukan".
  useEffect(() => {
    const scanCode = searchParams.get("scan");
    if (!scanCode || items.length === 0) return;
    // Kunci dedup pakai kode + nonce "t" (bukan kode saja) supaya scan barang yang
    // sama dua kali berturut-turut tetap memicu popup baru, bukan diabaikan.
    const scanKey = `${scanCode}:${searchParams.get("t") ?? ""}`;
    if (processedScanRef.current === scanKey) return;
    processedScanRef.current = scanKey;

    const idItem = scanCode.trim().toUpperCase();
    const found = items.find((i) => matchesBarcodeScan(i.id_item, i.barcode_no, i.id_item_lama, idItem));
    if (found) {
      focusItem(found);
      setScanResult({ type: "found", item: found });
    } else {
      setScanResult({ type: "notfound", code: idItem });
    }
    router.replace("/inventori");
  }, [items, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters + sort, and keep selected in sync with latest DB data
  useEffect(() => {
    let result = items;
    if (!searchAllTabs) {
      result = result.filter((r) => (r.jenis_inventori ?? "Stock Dalam") === activeTab);
      if (activeTab === "Aset" && filterSubJenis !== "Semua") {
        result = result.filter((r) => r.sub_jenis_aset === filterSubJenis);
      }
    }
    if (filterJenis !== "Pilih Jenis Inventori") {
      const f = filterJenis.toLowerCase();
      result = result.filter((r) => r.jenis_barang.toLowerCase() === f || r.kategori.toLowerCase() === f);
    }
    if (filterStatus !== "Semua") {
      result = result.filter((r) => r.status_inventori === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.id_item.toLowerCase().includes(q) ||
        (r.id_item_lama ?? "").toLowerCase().includes(q) ||
        r.nama_produk.toLowerCase().includes(q) ||
        r.kadar.toLowerCase().includes(q)
      );
    }
    if (searchParams.get("filter") === "menipis") {
      result = result.filter((r) => r.jumlah <= 5);
    }
    // Sort
    if (sortBy === "terlama") {
      result = [...result].sort((a, b) => new Date(a.tanggal_masuk).getTime() - new Date(b.tanggal_masuk).getTime());
    } else if (sortBy === "nama_az") {
      result = [...result].sort((a, b) => a.nama_produk.localeCompare(b.nama_produk, "id"));
    } else if (sortBy === "stok_banyak") {
      result = [...result].sort((a, b) => b.jumlah - a.jumlah);
    } else if (sortBy === "stok_sedikit") {
      result = [...result].sort((a, b) => a.jumlah - b.jumlah);
    }
    // default "terbaru": sudah urut dari DB (tanggal_masuk desc)
    setFiltered(result);

    // Refresh selected so the detail panel shows up-to-date data after edit/save
    if (selected) {
      const updated = result.find((r) => r.id === selected.id);
      if (!updated) setSelected(result[0] ?? null);
      else if (updated !== selected) setSelected(updated);
    }
  }, [items, activeTab, filterSubJenis, filterJenis, filterStatus, sortBy, search, searchParams, searchAllTabs]);

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
      <div id="inventori-screen" className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-4 sm:px-6 pt-6 pb-8 flex flex-col gap-5">
          {/* Title */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
                Daftar Barang (Inventori)
              </h1>
              <p className="text-base text-gray-500 mt-1">
                Lihat, tambah, dan kelola semua barang emas yang ada di toko.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onOpenChangePin}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors hover:bg-amber-50"
                style={{ borderColor: "#C99A36", color: "#C99A36" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Ganti PIN
              </button>
              <button
                onClick={onLock}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Kunci Halaman
              </button>
            </div>
          </div>

          {/* 3 Tab Jenis Inventori */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-2xl">
            {JENIS_INVENTORI.map((tab) => {
              const count = items.filter((r) => (r.jenis_inventori ?? "Stock Dalam") === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setFilterSubJenis("Semua"); setFilterStatus("Semua"); setSortBy("terbaru"); setSelected(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-base transition-all ${
                    activeTab === tab
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "Aset" ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  ) : tab === "Stock Display" ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                  )}
                  <span>{tab}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    activeTab === tab ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-500"
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Help banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4" style={{ color: "#C99A36" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <p className="text-base font-bold text-gray-800">Panduan Cepat</p>
            </div>
            <ol className="text-sm text-gray-700 space-y-1.5 list-none pl-0">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Pilih tab kategori di atas (<strong>Stock Dalam</strong>, <strong>Stock Display</strong>, atau <strong>Aset</strong>) sesuai jenis barang.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Klik tombol <strong>Tambah Barang</strong> di bawah untuk memasukkan barang baru.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Klik nama barang di daftar kiri untuk melihat detailnya. Gunakan tombol <strong>Ubah</strong> atau <strong>Hapus</strong> di panel kanan.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                <span>Gunakan kolom <strong>Cari Barang</strong> di kiri untuk menemukan barang. Centang &ldquo;Cari di semua kategori&rdquo; agar pencarian tidak terbatas satu tab.</span>
              </li>
            </ol>
          </div>

          {/* Tambah Barang action button */}
          <div className="flex justify-center">
            <button
              onClick={openTambah}
              className="w-full sm:w-auto flex items-center justify-center gap-4 px-[50px] py-5 rounded-2xl text-white font-bold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
              style={{ backgroundColor: "#C99A36" }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
                </svg>
              </div>
              <div className="text-center max-w-[280px]">
                <p className="text-xl font-bold leading-tight">
                  {activeTab === "Aset" ? "Tambah Aset" : `Tambah ${activeTab}`}
                </p>
                <p className="text-sm font-normal opacity-90 mt-0.5">
                  Masukkan satu barang baru ke daftar
                </p>
              </div>
            </button>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-5">
            {/* LEFT: filter + list */}
            <div className="w-full lg:w-64 xl:w-72 lg:shrink-0 flex flex-col gap-3">
              {/* Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Cari Barang</label>
                <div className="relative">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ketik kode, nama, atau karat..."
                    className="w-full border border-gray-300 rounded-xl pl-4 pr-10 py-3 text-base focus:outline-none focus:border-[#C99A36]"
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                  </svg>
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={searchAllTabs}
                    onChange={(e) => setSearchAllTabs(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#C99A36]"
                  />
                  <span className="text-sm text-gray-600">Cari di semua kategori inventori</span>
                </label>
                {searchAllTabs && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-1.5 font-medium">
                    Menampilkan hasil dari Stock Dalam, Stock Display & Aset.
                  </p>
                )}
              </div>

              {/* Sub-filter Aset (Cukim / Emas Rosok) */}
              {activeTab === "Aset" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">Jenis Aset</label>
                  <div className="flex flex-wrap gap-2">
                    {["Semua", ...SUB_JENIS_ASET].map((s) => (
                      <button
                        key={s}
                        onClick={() => { setFilterSubJenis(s); setSelected(null); }}
                        className={`px-3.5 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${
                          filterSubJenis === s
                            ? "bg-stone-700 border-stone-700 text-white"
                            : "border-gray-200 text-gray-600 hover:border-stone-500"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Jenis filter */}
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

              {/* Status Barang filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Status Barang</label>
                <div className="flex flex-wrap gap-2">
                  {["Semua", "Tersedia", "Terjual", "Dalam Servis", "Lainnya"].map((s) => {
                    const isActive = s === "Lainnya"
                      ? !["Semua","Tersedia","Terjual","Dalam Servis"].includes(filterStatus) && filterStatus !== "Semua"
                      : filterStatus === s;
                    return (
                      <div key={s} className="relative">
                        {s === "Lainnya" ? (
                          <select
                            value={["Semua","Tersedia","Terjual","Dalam Servis"].includes(filterStatus) ? "" : filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value || "Semua")}
                            className={`px-3.5 py-2 rounded-full text-sm font-semibold border-2 transition-colors appearance-none pr-7 cursor-pointer ${
                              isActive
                                ? "bg-[#C99A36] border-[#C99A36] text-white"
                                : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                            }`}
                          >
                            <option value="">Lainnya ▾</option>
                            {["Retur","Tidak Laku","Mati Laku","Habis Dijual","Hilang"].map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setFilterStatus(s)}
                            className={`px-3.5 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${
                              isActive
                                ? "bg-[#C99A36] border-[#C99A36] text-white"
                                : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                            }`}
                          >
                            {s}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Urutkan</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-[#C99A36] bg-white"
                >
                  <option value="terbaru">Terbaru (baru masuk dulu)</option>
                  <option value="terlama">Terlama (lama masuk dulu)</option>
                  <option value="nama_az">Nama A → Z</option>
                  <option value="stok_banyak">Stok Terbanyak</option>
                  <option value="stok_sedikit">Stok Paling Sedikit</option>
                </select>
              </div>

              {/* Result count */}
              {!loading && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    <span className="font-bold text-gray-800">{filtered.length}</span> barang ditemukan
                    {!searchAllTabs && items.filter((r) => (r.jenis_inventori ?? "Stock Dalam") === activeTab).length !== filtered.length && (
                      <span className="text-gray-400"> dari {items.filter((r) => (r.jenis_inventori ?? "Stock Dalam") === activeTab).length}</span>
                    )}
                    {searchAllTabs && items.length !== filtered.length && (
                      <span className="text-gray-400"> dari {items.length} total</span>
                    )}
                  </p>
                  {(filterStatus !== "Semua" || filterJenis !== "Pilih Jenis Inventori" || search.trim() || searchAllTabs) && (
                    <button
                      onClick={() => { setFilterStatus("Semua"); setFilterJenis("Pilih Jenis Inventori"); setSearch(""); setSearchAllTabs(false); }}
                      className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                    >
                      Reset filter
                    </button>
                  )}
                </div>
              )}

              {/* List of items */}
              <div className="flex-1 min-h-64 lg:min-h-0 border border-gray-200 rounded-xl overflow-hidden">
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
                  <div className="divide-y divide-gray-100 max-h-80 lg:max-h-[520px] overflow-y-auto">
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
                          <StorageImage src={item.gambar_url} alt={item.nama_produk} className="w-11 h-11 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-gray-800 leading-tight truncate">{item.nama_produk}</p>
                          <p className="text-xs text-gray-400 mt-0.5 font-mono">{item.id_item}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.kadar && <span>{item.kadar}</span>}
                            {item.kadar && item.berat_gram ? " · " : ""}
                            {item.berat_gram ? <span>{item.berat_gram}g</span> : ""}
                            {(item.kadar || item.berat_gram) && item.jumlah > 1 ? " · " : ""}
                            {item.jumlah > 1 && <span>{item.jumlah} pcs</span>}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[item.status_inventori] ?? "bg-gray-100 text-gray-600"}`}>
                              {item.status_inventori}
                            </span>
                            {searchAllTabs && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                                {item.jenis_inventori ?? "Stock Dalam"}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: detail panel or empty state */}
            <div className="flex-1 min-h-64 lg:min-h-0 border border-gray-200 rounded-xl overflow-hidden">
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
                        <StorageImage
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

                  {/* Jenis Inventori + Sub Jenis badge */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-amber-100 text-amber-800">
                      {selected.jenis_inventori ?? "Stock Dalam"}
                    </span>
                    {selected.sub_jenis_aset && (
                      <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-stone-100 text-stone-700">
                        {selected.sub_jenis_aset}
                      </span>
                    )}
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Karat</p>
                      <p className="text-xl font-bold text-gray-900">{selected.kadar || "—"}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Berat</p>
                      <p className="text-xl font-bold text-gray-900">{selected.berat_gram} <span className="text-sm font-normal">gram</span></p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Stok</p>
                      <p className="text-xl font-bold text-gray-900">{selected.jumlah} <span className="text-sm font-normal">pcs</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "Tanggal Masuk",  value: new Date(selected.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }), icon: "📅" },
                      { label: "Persentase Modal", value: selected.persen_modal ? `${selected.persen_modal}% dari emas 24K` : "—", icon: "💰" },
                      { label: "Persentase Jual",  value: selected.persen_jual ? `${selected.persen_jual}% dari emas 24K` : "—", icon: "🏷️" },
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
                        selected.status_laporan === "Disetujui"                  ? "bg-green-100 text-green-700" :
                        selected.status_laporan === "Ditolak"                    ? "bg-red-100 text-red-700" :
                        selected.status_laporan === "Persetujuan Penandatangan"   ? "bg-stone-700 text-white" :
                        selected.status_laporan === "Persetujuan Pemeriksa"       ? "bg-blue-100 text-blue-700" :
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
        onSaved={() => load()}
        jenisOptions={allJenis}
        customJenis={customJenis}
        existingIds={items.map((i) => i.id_item)}
        onAddJenis={addCustomJenis}
        onDeleteJenis={deleteCustomJenis}
        defaultJenisInventori={activeTab}
        hargaEmasByKarat={hargaEmasByKarat}
        ensureKode={ensureKode}
      />
      <HapusPopup
        open={!!hapusItem}
        item={hapusItem}
        onClose={() => setHapusItem(null)}
        onConfirm={hapus}
      />
      <ScanResultPopup
        result={scanResult}
        onClose={() => setScanResult(null)}
        onEdit={(item) => { setEditItem(item); setShowPopup(true); }}
      />
    </AppLayout>
  );
}

export default function InventoriPage() {
  return (
    <PinGate pageTitle="Halaman Inventori">
      {({ lock, openChangePin }) => (
        <Suspense fallback={<AppLayout><div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Memuat...</p></div></AppLayout>}>
          <InventoriContent onLock={lock} onOpenChangePin={openChangePin} />
        </Suspense>
      )}
    </PinGate>
  );
}
