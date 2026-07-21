"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import AppLayout from "@/components/AppLayout";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import {
  fmtRupiah, JENIS_PERHIASAN_OPTIONS, KADAR_OPTIONS, JANGKA_WAKTU_OPTIONS,
  buildCicilanSchedule, summarizeBarang,
  type CicilanItem, type GadaiBarangItem,
} from "@/lib/gadai";
import type { InvoiceGadaiData } from "@/lib/gadai";
import { InvoiceGadai } from "@/components/InvoiceGadai";
import { InvoicePagePreview } from "@/components/InvoicePagePreview";
import { InvoicePrintFrame } from "@/components/InvoicePrintFrame";
import { InvoiceSizePicker } from "@/components/InvoiceSizePicker";
import { useInvoiceSize } from "@/lib/invoiceSize";
import { printClean } from "@/lib/print";
import { useJenisBarang } from "@/lib/useJenisBarang";
import { useCustomList } from "@/lib/useCustomList";
import { useNamaBarangList } from "@/lib/masterData";
import { MasterDataPicker } from "@/components/MasterDataPicker";
import { AutocompleteField } from "@/components/AutocompleteField";
import StorageImage from "@/components/StorageImage";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface BarangItemForm {
  jenis_perhiasan: string;
  nama_barang: string;
  berat_gram: string;
  kadar: string;
  kondisi_barang: string;
  deskripsi: string;
  foto_barang_url: string;
}

const emptyBarangItem = (): BarangItemForm => ({
  jenis_perhiasan: JENIS_PERHIASAN_OPTIONS[0], nama_barang: "", berat_gram: "",
  kadar: "", kondisi_barang: "", deskripsi: "", foto_barang_url: "",
});

/* ─── Types ─── */
interface GadaiRow {
  id: string;
  no_gadai: string;
  pelanggan_nama: string;
  pelanggan_hp: string | null;
  pelanggan_alamat: string | null;
  foto_ktp_url: string | null;
  jenis_perhiasan: string;
  nama_barang: string;
  berat_gram: number;
  kadar: string;
  kondisi_barang: string | null;
  deskripsi: string | null;
  foto_barang_url: string | null;
  nilai_taksiran: number;
  nilai_pinjaman: number;
  bunga_persen: number;
  jangka_waktu_bulan: number;
  tanggal_gadai: string;
  tanggal_jatuh_tempo: string;
  opsi_pembayaran: "Tunai" | "Cicilan";
  status: "Menunggu" | "Diproses" | "Aktif" | "Lunas" | "Disita";
  catatan: string | null;
  created_at: string;
}

const PAGE_SIZE = 5;

const STATUS_STYLE: Record<string, string> = {
  "Menunggu": "bg-orange-100 text-orange-600 border border-orange-200",
  "Diproses": "bg-blue-100 text-blue-600 border border-blue-200",
  "Aktif":    "bg-green-100 text-green-700 border border-green-200",
  "Lunas":    "bg-gray-100 text-gray-600 border border-gray-200",
  "Disita":   "bg-red-100 text-red-600 border border-red-200",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

/* ═══ Popup: Detail Gadai ═══ */
function DetailGadaiPopup({
  open, onClose, item, onChanged,
}: {
  open: boolean;
  onClose: () => void;
  item: GadaiRow | null;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [cicilan, setCicilan] = useState<(CicilanItem & { id: string; tanggal_bayar: string | null })[]>([]);
  const [loadingCicilan, setLoadingCicilan] = useState(false);
  const [barangItems, setBarangItems] = useState<GadaiBarangItem[]>([]);
  const [loadingBarang, setLoadingBarang] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceSize, setInvoiceSize] = useInvoiceSize("pegadaian");

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    pelanggan_nama: "", pelanggan_hp: "", pelanggan_alamat: "", foto_ktp_url: "",
    items: [emptyBarangItem()] as BarangItemForm[],
    nilai_taksiran: "", nilai_pinjaman: "", bunga_persen: "",
    jangka_waktu_bulan: JANGKA_WAKTU_OPTIONS[0],
    tanggal_gadai: "", tanggal_jatuh_tempo: "",
    opsi_pembayaran: "Tunai" as "Tunai" | "Cicilan",
    catatan: "",
  });
  const [uploadingKtp, setUploadingKtp] = useState(false);
  const [uploadingBarangIdx, setUploadingBarangIdx] = useState<number | null>(null);
  const [editMsg, setEditMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { allJenis: jenisOptions, addCustomJenis } = useJenisBarang(JENIS_PERHIASAN_OPTIONS);
  const { all: kadarOptions, addCustom: addCustomKadar } = useCustomList("kadar_master", KADAR_OPTIONS);
  const { all: namaBarangOptions, record: recordNamaBarang } = useNamaBarangList();

  const setEdit = <K extends keyof typeof editForm>(key: K, val: (typeof editForm)[K]) =>
    setEditForm((f) => ({ ...f, [key]: val }));
  const setEditItem = <K extends keyof BarangItemForm>(idx: number, key: K, val: BarangItemForm[K]) =>
    setEditForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [key]: val } : it)) }));
  const addEditItem = () => setEditForm((f) => ({ ...f, items: [...f.items, emptyBarangItem()] }));
  const removeEditItem = (idx: number) => setEditForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  useEffect(() => {
    if (!open || !item) return;
    setMsg("");
    if (item.opsi_pembayaran === "Cicilan") {
      setLoadingCicilan(true);
      supabase
        .from("gadai_cicilan")
        .select("*")
        .eq("gadai_id", item.id)
        .order("no_cicilan", { ascending: true })
        .then(({ data }) => {
          setCicilan((data ?? []) as (CicilanItem & { id: string; tanggal_bayar: string | null })[]);
          setLoadingCicilan(false);
        });
    } else {
      setCicilan([]);
    }

    setLoadingBarang(true);
    supabase
      .from("gadai_barang")
      .select("*")
      .eq("gadai_id", item.id)
      .order("urutan", { ascending: true })
      .then(({ data }) => {
        setBarangItems(
          data && data.length > 0
            ? (data as GadaiBarangItem[])
            : [{
                jenis_perhiasan: item.jenis_perhiasan, nama_barang: item.nama_barang,
                berat_gram: item.berat_gram, kadar: item.kadar,
                kondisi_barang: item.kondisi_barang, deskripsi: item.deskripsi, foto_barang_url: item.foto_barang_url,
              }]
        );
        setLoadingBarang(false);
      });
  }, [open, item]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !item) return null;

  function openEdit() {
    if (!item) return;
    setEditForm({
      pelanggan_nama: item.pelanggan_nama,
      pelanggan_hp: item.pelanggan_hp ?? "",
      pelanggan_alamat: item.pelanggan_alamat ?? "",
      foto_ktp_url: item.foto_ktp_url ?? "",
      items: barangItems.map((b) => ({
        jenis_perhiasan: b.jenis_perhiasan,
        nama_barang: b.nama_barang,
        berat_gram: String(b.berat_gram),
        kadar: b.kadar,
        kondisi_barang: b.kondisi_barang ?? "",
        deskripsi: b.deskripsi ?? "",
        foto_barang_url: b.foto_barang_url ?? "",
      })),
      nilai_taksiran: String(item.nilai_taksiran),
      nilai_pinjaman: String(item.nilai_pinjaman),
      bunga_persen: String(item.bunga_persen),
      jangka_waktu_bulan: item.jangka_waktu_bulan,
      tanggal_gadai: item.tanggal_gadai,
      tanggal_jatuh_tempo: item.tanggal_jatuh_tempo,
      opsi_pembayaran: item.opsi_pembayaran,
      catatan: item.catatan ?? "",
    });
    setEditMsg("");
    setEditMode(true);
  }

  async function uploadFotoKtpEdit(file: File) {
    setUploadingKtp(true);
    setEditMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `ktp-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("pegadaian-images").upload(path, file, { cacheControl: "3600", upsert: true });
    if (error) { setEditMsg("Gagal upload foto: " + error.message); setUploadingKtp(false); return; }
    const { data } = supabase.storage.from("pegadaian-images").getPublicUrl(path);
    setEdit("foto_ktp_url", data.publicUrl);
    setUploadingKtp(false);
  }

  async function uploadFotoBarangEdit(file: File, idx: number) {
    setUploadingBarangIdx(idx);
    setEditMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `barang-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("pegadaian-images").upload(path, file, { cacheControl: "3600", upsert: true });
    if (error) { setEditMsg("Gagal upload foto: " + error.message); setUploadingBarangIdx(null); return; }
    const { data } = supabase.storage.from("pegadaian-images").getPublicUrl(path);
    setEditItem(idx, "foto_barang_url", data.publicUrl);
    setUploadingBarangIdx(null);
  }

  function editMissingFields(): string[] {
    const missing: string[] = [];
    if (!editForm.pelanggan_nama.trim()) missing.push("Nama Pelanggan");
    if (!editForm.pelanggan_hp.trim()) missing.push("No. HP");
    if (!editForm.pelanggan_alamat.trim()) missing.push("Alamat");
    editForm.items.forEach((it, i) => {
      const n = editForm.items.length > 1 ? ` #${i + 1}` : "";
      if (!it.nama_barang.trim()) missing.push(`Nama Barang${n}`);
      if (!it.berat_gram.trim() || (parseFloat(it.berat_gram) || 0) <= 0) missing.push(`Berat (gram)${n}`);
      if (!it.kadar.trim()) missing.push(`Kadar Emas${n}`);
    });
    if (!editForm.nilai_taksiran.trim() || (parseFloat(editForm.nilai_taksiran) || 0) <= 0) missing.push("Nilai Taksiran");
    if (!editForm.nilai_pinjaman.trim() || (parseFloat(editForm.nilai_pinjaman) || 0) <= 0) missing.push("Nilai Pinjaman");
    if (!editForm.bunga_persen.trim()) missing.push("Bunga (%)");
    return missing;
  }

  function editItemsNumeric() {
    return editForm.items.map((it) => ({
      jenis_perhiasan: it.jenis_perhiasan,
      nama_barang: it.nama_barang.trim(),
      berat_gram: parseFloat(it.berat_gram) || 0,
      kadar: it.kadar,
      kondisi_barang: it.kondisi_barang.trim() || null,
      deskripsi: it.deskripsi.trim() || null,
      foto_barang_url: it.foto_barang_url.trim() || null,
    }));
  }

  async function saveEdit() {
    if (!item) return;
    const missing = editMissingFields();
    if (missing.length > 0) { setEditMsg(`Lengkapi dulu: ${missing.join(", ")}.`); return; }

    setBusy(true);
    setEditMsg("");

    const summary = summarizeBarang(editItemsNumeric());
    const { error } = await supabase.from("gadai").update({
      pelanggan_nama: editForm.pelanggan_nama.trim(),
      pelanggan_hp: editForm.pelanggan_hp.trim(),
      pelanggan_alamat: editForm.pelanggan_alamat.trim(),
      foto_ktp_url: editForm.foto_ktp_url.trim() || null,
      ...summary,
      nilai_taksiran: Math.round(parseFloat(editForm.nilai_taksiran) || 0),
      nilai_pinjaman: Math.round(parseFloat(editForm.nilai_pinjaman) || 0),
      bunga_persen: parseFloat(editForm.bunga_persen) || 0,
      jangka_waktu_bulan: editForm.jangka_waktu_bulan,
      tanggal_gadai: editForm.tanggal_gadai,
      tanggal_jatuh_tempo: editForm.tanggal_jatuh_tempo,
      opsi_pembayaran: editForm.opsi_pembayaran,
      catatan: editForm.catatan.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", item.id);
    if (error) { setBusy(false); setEditMsg("Gagal menyimpan: " + error.message); return; }

    await supabase.from("gadai_barang").delete().eq("gadai_id", item.id);
    const { error: barangError } = await supabase.from("gadai_barang").insert(
      editItemsNumeric().map((it, i) => ({ ...it, gadai_id: item.id, urutan: i + 1 }))
    );
    if (barangError) { setBusy(false); setEditMsg("Data tersimpan, tapi gagal menyimpan data barang: " + barangError.message); return; }

    // Cicilan HANYA digenerate kalau baru sekarang berubah jadi "Cicilan" & belum ada jadwal
    // sama sekali — kalau jadwal sudah ada (opsi_pembayaran sudah "Cicilan" sejak awal),
    // tidak disentuh supaya cicilan yang sudah lunas tidak ikut ter-reset.
    if (item.opsi_pembayaran !== "Cicilan" && editForm.opsi_pembayaran === "Cicilan" && cicilan.length === 0) {
      const schedule = buildCicilanSchedule(
        parseFloat(editForm.nilai_pinjaman) || 0,
        parseFloat(editForm.bunga_persen) || 0,
        editForm.jangka_waktu_bulan,
        editForm.tanggal_gadai
      );
      const { error: cicilanError } = await supabase.from("gadai_cicilan").insert(
        schedule.map((c) => ({ ...c, gadai_id: item.id }))
      );
      if (cicilanError) { setBusy(false); setEditMsg("Data tersimpan, tapi gagal membuat jadwal cicilan: " + cicilanError.message); return; }
    }

    setBusy(false);
    editForm.items.forEach((it) => recordNamaBarang(it.nama_barang));
    setEditMode(false);
    onChanged();
    onClose();
  }

  async function hapusGadai() {
    if (!item) return;
    setDeleting(true);
    const { error } = await supabase.from("gadai").delete().eq("id", item.id);
    setDeleting(false);
    if (error) { alert("Gagal menghapus pengajuan gadai: " + error.message); return; }
    setShowDeleteConfirm(false);
    onChanged();
    onClose();
  }

  const tandaiCicilanLunas = async (cicilanId: string) => {
    setBusy(true);
    setMsg("");
    const { error } = await supabase
      .from("gadai_cicilan")
      .update({ status: "Lunas", tanggal_bayar: new Date().toISOString().split("T")[0] })
      .eq("id", cicilanId);
    if (error) { setMsg("Gagal menyimpan: " + error.message); setBusy(false); return; }

    const updated = cicilan.map((c) => c.id === cicilanId ? { ...c, status: "Lunas" as const } : c);
    setCicilan(updated);

    if (updated.every((c) => c.status === "Lunas")) {
      await supabase.from("gadai").update({ status: "Lunas", updated_at: new Date().toISOString() }).eq("id", item.id);
      onChanged();
    }
    setBusy(false);
  };

  const tandaiGadaiLunas = async () => {
    setBusy(true);
    setMsg("");
    const { error } = await supabase
      .from("gadai")
      .update({ status: "Lunas", updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setBusy(false);
    if (error) { setMsg("Gagal menyimpan: " + error.message); return; }
    onChanged();
    onClose();
  };

  const invoiceData: InvoiceGadaiData = {
    no_gadai: item.no_gadai,
    items: barangItems,
    nilai_pinjaman: item.nilai_pinjaman,
    bunga_persen: item.bunga_persen,
    tanggal_gadai: item.tanggal_gadai,
    tanggal_jatuh_tempo: item.tanggal_jatuh_tempo,
    catatan: item.catatan ?? undefined,
  };

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body *:not(#invoice-print):not(#invoice-print *) { display: none !important; }
          .flex.min-h-screen { display: none !important; }
          #invoice-print { display: block !important; }
          html, body { height: auto !important; margin: 0; background: white !important; }
          @page { size: ${invoiceSize.widthMm + 2 * invoiceSize.marginMm}mm ${invoiceSize.heightMm + 2 * invoiceSize.marginMm}mm; margin: ${invoiceSize.marginMm}mm; }
        }
      `}</style>
      {/* Invoice — hidden on screen, visible on print. Di-portal ke document.body supaya
          #invoice-print tidak ikut tersembunyi kalau AppLayout (ancestor popup ini) di-hide
          via CSS print — popup ini dipanggil di dalam <AppLayout>, bukan sibling-nya. */}
      {typeof document !== "undefined" && createPortal(
        <div id="invoice-print" style={{ display: "none" }}>
          <InvoicePrintFrame widthMm={invoiceSize.widthMm} heightMm={invoiceSize.heightMm} marginMm={invoiceSize.marginMm}>
            <InvoiceGadai mode="print" data={invoiceData} />
          </InvoicePrintFrame>
        </div>,
        document.body
      )}

    <div id="gadai-detail-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Detail Pengajuan Gadai
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{item.no_gadai}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors font-bold text-xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {!editMode && (
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <Badge status={item.status} />
            <span className="text-sm text-gray-500">
              Tgl Gadai: {new Date(item.tanggal_gadai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>

          {/* Data Pelanggan */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Data Pelanggan</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400">Nama</p><p className="font-semibold text-gray-800">{item.pelanggan_nama}</p></div>
              <div><p className="text-gray-400">No. HP</p><p className="font-semibold text-gray-800">{item.pelanggan_hp || "-"}</p></div>
              <div className="col-span-2"><p className="text-gray-400">Alamat</p><p className="font-semibold text-gray-800">{item.pelanggan_alamat || "-"}</p></div>
            </div>
          </div>

          {/* Data Barang */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Data Barang {barangItems.length > 1 ? `(${barangItems.length} item)` : ""}
            </h3>
            {loadingBarang ? (
              <div className="h-16 bg-gray-100 animate-pulse rounded-lg" />
            ) : (
              <div className="space-y-3">
                {barangItems.map((b, i) => (
                  <div key={i} className={barangItems.length > 1 ? "border border-gray-200 rounded-lg p-3" : ""}>
                    {barangItems.length > 1 && (
                      <p className="text-xs font-semibold text-gray-400 mb-1.5">Barang #{i + 1}</p>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-gray-400">Jenis</p><p className="font-semibold text-gray-800">{b.jenis_perhiasan}</p></div>
                      <div><p className="text-gray-400">Nama Barang</p><p className="font-semibold text-gray-800">{b.nama_barang}</p></div>
                      <div><p className="text-gray-400">Berat</p><p className="font-semibold text-gray-800">{b.berat_gram} gram</p></div>
                      <div><p className="text-gray-400">Kadar</p><p className="font-semibold text-gray-800">{b.kadar}</p></div>
                      {b.kondisi_barang && (
                        <div className="col-span-2"><p className="text-gray-400">Kondisi</p><p className="font-semibold text-gray-800">{b.kondisi_barang}</p></div>
                      )}
                      {b.deskripsi && (
                        <div className="col-span-2"><p className="text-gray-400">Deskripsi</p><p className="text-gray-700">{b.deskripsi}</p></div>
                      )}
                    </div>
                  </div>
                ))}
                {barangItems.length > 1 && (
                  <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t border-gray-100">
                    <span className="text-gray-500">Total Berat</span>
                    <span className="text-gray-800">{barangItems.reduce((s, b) => s + (b.berat_gram || 0), 0)} gram</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data Pinjaman */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Data Pinjaman</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400">Nilai Taksiran</p><p className="font-semibold text-gray-800">{fmtRupiah(item.nilai_taksiran)}</p></div>
              <div><p className="text-gray-400">Nilai Pinjaman</p><p className="font-semibold" style={{ color: "#C99A36" }}>{fmtRupiah(item.nilai_pinjaman)}</p></div>
              <div><p className="text-gray-400">Bunga</p><p className="font-semibold text-gray-800">{item.bunga_persen}% / bulan</p></div>
              <div><p className="text-gray-400">Jangka Waktu</p><p className="font-semibold text-gray-800">{item.jangka_waktu_bulan} bulan</p></div>
              <div><p className="text-gray-400">Jatuh Tempo</p><p className="font-semibold text-gray-800">{new Date(item.tanggal_jatuh_tempo).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p></div>
              <div><p className="text-gray-400">Opsi Pembayaran</p><p className="font-semibold text-gray-800">{item.opsi_pembayaran}</p></div>
            </div>
          </div>

          {/* Jadwal Cicilan */}
          {item.opsi_pembayaran === "Cicilan" && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Jadwal Cicilan</h3>
              {loadingCicilan ? (
                <div className="space-y-2">
                  {[1,2,3].map((i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {cicilan.map((c) => (
                    <div key={c.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-semibold text-gray-800">Cicilan ke-{c.no_cicilan}</p>
                        <p className="text-gray-400">
                          Jatuh tempo: {new Date(c.tanggal_jatuh_tempo).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">{fmtRupiah(c.jumlah_bayar)}</p>
                        {c.status === "Lunas" ? (
                          <span className="text-xs font-semibold text-green-600">✓ Lunas</span>
                        ) : (
                          <button
                            onClick={() => tandaiCicilanLunas(c.id)}
                            disabled={busy}
                            className="text-xs font-semibold text-[#C99A36] hover:underline disabled:opacity-50"
                          >
                            Tandai Lunas
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {item.catatan && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Catatan</h3>
              <p className="text-sm text-gray-700">{item.catatan}</p>
            </div>
          )}

          {msg && (
            <p className="text-sm font-semibold py-2.5 px-4 rounded-xl bg-red-50 text-red-600">{msg}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={() => setShowInvoicePreview(true)}
              className="flex-1 py-3 rounded-xl border-2 font-semibold text-base transition-colors hover:bg-amber-50"
              style={{ borderColor: "#C99A36", color: "#C99A36" }}
            >
              🖨️ Cetak Invoice
            </button>
            {item.status !== "Lunas" && (
              <button
                onClick={tandaiGadaiLunas}
                disabled={busy}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#C99A36" }}
              >
                Tandai Lunas (Gadai)
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={openEdit}
              className="flex-1 py-2.5 rounded-xl border-2 border-amber-400 text-amber-600 font-semibold text-sm hover:bg-amber-50 transition-colors"
            >
              ✏️ Edit Data Gadai
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 py-2.5 rounded-xl border-2 border-red-300 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors"
            >
              🗑️ Hapus
            </button>
          </div>

          {item.status === "Aktif" && (
            <button
              onClick={() => router.push(
                `/hutang-piutang/tambah-piutang?sumber=Gadai&nama=${encodeURIComponent(item.pelanggan_nama)}&jumlah=${item.nilai_pinjaman}&kategori=Customer&referensi=${encodeURIComponent(item.no_gadai)}`
              )}
              className="w-full py-3 rounded-xl border-2 border-dashed font-semibold text-sm transition-colors hover:bg-amber-50"
              style={{ borderColor: "#C99A36", color: "#C99A36" }}
            >
              📋 Catat Pinjaman sebagai Piutang
            </button>
          )}
        </div>
        )}

        {/* Body: Edit mode */}
        {editMode && (
        <div className="px-6 py-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Data Pelanggan</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nama Pelanggan</label>
                  <input value={editForm.pelanggan_nama} onChange={(e) => setEdit("pelanggan_nama", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">No. HP</label>
                  <input value={editForm.pelanggan_hp} onChange={(e) => setEdit("pelanggan_hp", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Alamat</label>
                <textarea value={editForm.pelanggan_alamat} onChange={(e) => setEdit("pelanggan_alamat", e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Foto KTP</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {editForm.foto_ktp_url ? (
                      <StorageImage src={editForm.foto_ktp_url} alt="Foto KTP" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border-2 cursor-pointer transition-colors hover:bg-amber-50"
                    style={{ borderColor: "#C99A36", color: "#C99A36" }}>
                    {uploadingKtp ? "Mengunggah..." : "Ganti Foto"}
                    <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploadingKtp}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFotoKtpEdit(f); }} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Data Barang {editForm.items.length > 1 ? `(${editForm.items.length} item)` : ""}
            </h3>
            <div className="space-y-3">
              {editForm.items.map((it, idx) => (
                <div key={idx} className={editForm.items.length > 1 ? "border border-gray-200 rounded-lg p-3 space-y-2" : "space-y-2"}>
                  {editForm.items.length > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-400">Barang #{idx + 1}</p>
                      <button type="button" onClick={() => removeEditItem(idx)} className="text-xs font-semibold text-red-500 hover:underline">
                        Hapus
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Jenis Perhiasan</label>
                    <MasterDataPicker
                      value={it.jenis_perhiasan}
                      onChange={(v) => setEditItem(idx, "jenis_perhiasan", v)}
                      options={jenisOptions}
                      onAddNew={addCustomJenis}
                      modalTitle="Tambah Jenis Perhiasan Baru"
                      modalLabel="Nama Jenis Perhiasan"
                      inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nama Barang</label>
                    <AutocompleteField
                      value={it.nama_barang}
                      onChange={(v) => setEditItem(idx, "nama_barang", v)}
                      onSelect={(v) => setEditItem(idx, "nama_barang", v)}
                      suggestions={namaBarangOptions.filter((n) => n.toLowerCase().includes(it.nama_barang.trim().toLowerCase())).slice(0, 8)}
                      renderLabel={(n) => n}
                      inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Berat (gram)</label>
                      <input type="number" min="0" step="0.01" value={it.berat_gram} onChange={(e) => setEditItem(idx, "berat_gram", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Kadar Emas</label>
                      <MasterDataPicker
                        value={it.kadar}
                        onChange={(v) => setEditItem(idx, "kadar", v)}
                        options={kadarOptions}
                        onAddNew={addCustomKadar}
                        modalTitle="Tambah Kadar Baru"
                        modalLabel="Kadar Emas"
                        inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Kondisi Barang</label>
                    <input value={it.kondisi_barang} onChange={(e) => setEditItem(idx, "kondisi_barang", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Deskripsi</label>
                    <textarea value={it.deskripsi} onChange={(e) => setEditItem(idx, "deskripsi", e.target.value)} rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36] resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Foto Barang</label>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                        {it.foto_barang_url ? (
                          <StorageImage src={it.foto_barang_url} alt="Foto Barang" className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border-2 cursor-pointer transition-colors hover:bg-amber-50"
                        style={{ borderColor: "#C99A36", color: "#C99A36" }}>
                        {uploadingBarangIdx === idx ? "Mengunggah..." : "Ganti Foto"}
                        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploadingBarangIdx === idx}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFotoBarangEdit(f, idx); }} />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addEditItem}
                className="w-full py-2.5 rounded-xl border-2 border-dashed font-semibold text-sm transition-colors hover:bg-amber-50"
                style={{ borderColor: "#C99A36", color: "#C99A36" }}
              >
                + Tambah Barang Lain
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Data Pinjaman</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nilai Taksiran (Rp)</label>
                  <input type="number" min="0" value={editForm.nilai_taksiran} onChange={(e) => setEdit("nilai_taksiran", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nilai Pinjaman (Rp)</label>
                  <input type="number" min="0" value={editForm.nilai_pinjaman} onChange={(e) => setEdit("nilai_pinjaman", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bunga (% per bulan)</label>
                <input type="number" min="0" step="0.1" value={editForm.bunga_persen} onChange={(e) => setEdit("bunga_persen", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Jangka Waktu</label>
                <div className="flex flex-wrap gap-2">
                  {JANGKA_WAKTU_OPTIONS.map((bulan) => (
                    <button key={bulan} type="button" onClick={() => setEdit("jangka_waktu_bulan", bulan)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                        editForm.jangka_waktu_bulan === bulan ? "bg-[#C99A36] border-[#C99A36] text-white" : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                      }`}>
                      {bulan} Bulan
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tanggal Gadai</label>
                  <input type="date" value={editForm.tanggal_gadai} onChange={(e) => setEdit("tanggal_gadai", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tanggal Jatuh Tempo</label>
                  <input type="date" value={editForm.tanggal_jatuh_tempo} onChange={(e) => setEdit("tanggal_jatuh_tempo", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Opsi Pembayaran</label>
                <div className="flex flex-wrap gap-2">
                  {(["Tunai", "Cicilan"] as const).map((opsi) => (
                    <button key={opsi} type="button" onClick={() => setEdit("opsi_pembayaran", opsi)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                        editForm.opsi_pembayaran === opsi ? "bg-[#C99A36] border-[#C99A36] text-white" : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                      }`}>
                      {opsi}
                    </button>
                  ))}
                </div>
                {item.opsi_pembayaran === "Cicilan" ? (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Jadwal cicilan yang sudah ada tidak otomatis disesuaikan — cek kembali manual jika perlu.
                  </p>
                ) : editForm.opsi_pembayaran === "Cicilan" && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Jadwal cicilan baru akan dibuat otomatis sebanyak {editForm.jangka_waktu_bulan} bulan saat disimpan.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Catatan</label>
            <textarea value={editForm.catatan} onChange={(e) => setEdit("catatan", e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36] resize-none" />
          </div>

          {editMsg && (
            <p className="text-sm font-semibold py-2.5 px-4 rounded-xl bg-red-50 text-red-600">{editMsg}</p>
          )}

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={() => { setEditMode(false); setEditMsg(""); }}
              disabled={busy}
              className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={saveEdit}
              disabled={busy}
              className="flex-1 py-3 rounded-xl text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
              style={{ backgroundColor: "#C99A36" }}
            >
              {busy ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Hapus Pengajuan Gadai Ini?"
        message={<>Pengajuan gadai <strong>{item.no_gadai}</strong> beserta seluruh data barang & jadwal cicilannya akan dihapus permanen.</>}
        confirming={deleting}
        onConfirm={hapusGadai}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* ── MODAL: PREVIEW / CETAK INVOICE ── */}
      {showInvoicePreview && (
        <div id="gadai-invoice-preview-overlay" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Preview Invoice Gadai</h2>
                <p className="text-xs text-gray-400">{item.no_gadai}</p>
              </div>
              <button
                onClick={() => setShowInvoicePreview(false)}
                className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold"
              >
                ×
              </button>
            </div>
            <div className="px-6 pt-4">
              <InvoiceSizePicker value={invoiceSize} onChange={setInvoiceSize} />
            </div>
            <div className="p-6">
              <InvoicePagePreview widthMm={invoiceSize.widthMm} heightMm={invoiceSize.heightMm} marginMm={invoiceSize.marginMm}>
                <InvoiceGadai mode="preview" data={invoiceData} />
              </InvoicePagePreview>
            </div>
            <div className="px-6 pb-6 sticky bottom-0 bg-white pt-3 border-t border-gray-100 rounded-b-2xl space-y-2">
              <p className="text-[11px] text-gray-400 text-center">
                Pertama kali print di komputer ini? Di kotak dialog print, klik “Lainnya” / “More settings” lalu matikan “Header dan footer” supaya alamat web tidak ikut tercetak.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowInvoicePreview(false)}
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

/* ═══ Main Page ═══ */
export default function PegadaianPage() {
  const supabase = createClient();
  const router = useRouter();

  const [gadaiList, setGadaiList] = useState<GadaiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailItem, setDetailItem] = useState<GadaiRow | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("today");
  const [showDateMenu, setShowDateMenu] = useState(false);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
        setShowDateMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    // .select("*") tanpa .range() kepotong diam-diam di baris ke-1000 (default
    // Supabase Max Rows) — fetchAllRows memastikan semua riwayat gadai kebaca.
    const data = await fetchAllRows<GadaiRow>((from, to) =>
      supabase
        .from("gadai")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    );
    setGadaiList(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const todayStr = new Date().toISOString().split("T")[0];

  const stats = useMemo(() => {
    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(weekAhead.getDate() + 7);

    const pengajuan = gadaiList.filter((g) => g.status === "Menunggu" || g.status === "Diproses");
    const baruHariIni = gadaiList.filter((g) => g.created_at.startsWith(todayStr));
    const aktif = gadaiList.filter((g) => g.status === "Aktif");
    const jatuhTempoMingguIni = gadaiList.filter((g) => {
      if (g.status === "Lunas" || g.status === "Disita") return false;
      const due = new Date(g.tanggal_jatuh_tempo);
      return due >= now && due <= weekAhead;
    });
    const danaHariIni = gadaiList
      .filter((g) => g.tanggal_gadai === todayStr)
      .reduce((s, g) => s + (g.nilai_pinjaman ?? 0), 0);

    return {
      pengajuanCount: pengajuan.length,
      baruHariIni: baruHariIni.length,
      aktifCount: aktif.length,
      jatuhTempoCount: jatuhTempoMingguIni.length,
      danaHariIni,
    };
  }, [gadaiList, todayStr]);

  const dateLabels: Record<string, string> = {
    today: "Hari ini",
    week:  "Minggu ini",
    month: "Bulan ini",
    all:   "Semua",
  };

  const dateFiltered = useMemo(() => {
    if (dateFilter === "all") return gadaiList;
    const now = new Date();
    let fromDate: Date;
    if (dateFilter === "today") {
      fromDate = new Date(todayStr);
    } else if (dateFilter === "week") {
      fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 6);
    } else {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return gadaiList.filter((g) => new Date(g.tanggal_gadai) >= fromDate);
  }, [gadaiList, dateFilter, todayStr]);

  const filtered = useMemo(() => {
    if (!search.trim()) return dateFiltered;
    const q = search.toLowerCase();
    return dateFiltered.filter((g) =>
      g.pelanggan_nama.toLowerCase().includes(q) ||
      g.nama_barang.toLowerCase().includes(q) ||
      g.jenis_perhiasan.toLowerCase().includes(q)
    );
  }, [dateFiltered, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statCards = [
    {
      label: "Pengajuan Gadai", value: String(stats.pengajuanCount),
      sublabel: `${stats.baruHariIni} baru`,
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#C99A36" strokeWidth="2" fill="none"/><path d="M7 9h10M7 13h10M7 17h6" stroke="#C99A36" strokeWidth="2" strokeLinecap="round"/></svg>,
    },
    {
      label: "Total Gadai Aktif", value: String(stats.aktifCount), suffix: "item",
      sublabel: "masih berjalan",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9"><rect x="3" y="10" width="18" height="10" rx="2" stroke="#C99A36" strokeWidth="2" fill="none"/><path d="M7 10V7a5 5 0 0110 0v3" stroke="#C99A36" strokeWidth="2" fill="none"/><circle cx="12" cy="15" r="1.5" fill="#C99A36"/></svg>,
    },
    {
      label: "Jatuh Tempo Minggu Ini", value: String(stats.jatuhTempoCount), suffix: "item",
      sublabel: stats.jatuhTempoCount > 0 ? "perlu ditagih" : "tidak ada",
      alert: stats.jatuhTempoCount > 0,
      icon: <svg viewBox="0 0 32 32" fill="none" className="w-10 h-10"><path d="M16 4L30 28H2L16 4z" fill="#EF4444" opacity="0.15" stroke="#EF4444" strokeWidth="2"/><path d="M16 14v6M16 23v1" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/></svg>,
    },
    {
      label: "Dana Tersalurkan Hari Ini", value: fmtRupiah(stats.danaHariIni),
      sublabel: "pencairan hari ini",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9"><path d="M3 20V10M9 20V4M15 20v-7M21 20V8" stroke="#C99A36" strokeWidth="2.5" strokeLinecap="round"/></svg>,
    },
  ];

  return (
    <AppLayout>
      <div id="pegadaian-screen" className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-4 sm:px-6 pb-8 space-y-6 pt-4">

          {/* Title + date filter */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Gadai Emas
            </h1>
            <div ref={dateMenuRef} className="relative">
              <button
                onClick={() => setShowDateMenu(!showDateMenu)}
                className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:border-[#C99A36] transition-colors"
              >
                {dateLabels[dateFilter]}
                <svg className={`w-4 h-4 transition-transform ${showDateMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {showDateMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 min-w-[140px]">
                  {(["today","week","month","all"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => { setDateFilter(key); setShowDateMenu(false); setPage(1); }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                        dateFilter === key ? "bg-amber-50 text-[#C99A36]" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {dateLabels[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-gray-500 text-sm font-medium mb-1">{card.label}</p>
                  <div className="flex items-baseline gap-2">
                    {loading
                      ? <span className="h-8 w-16 bg-gray-200 animate-pulse rounded block" />
                      : <span className="font-bold leading-none" style={{ color: card.alert ? "#EF4444" : "#C99A36", fontSize: card.value.length > 8 ? "1.3rem" : "1.8rem" }}>
                          {card.value}
                        </span>
                    }
                    {"suffix" in card && card.suffix && <span className="text-gray-500 text-base font-medium">{card.suffix}</span>}
                  </div>
                  {card.sublabel && (
                    <p className={`text-xs font-semibold mt-0.5 ${card.alert ? "text-red-500" : "text-gray-400"}`}>
                      {card.sublabel}
                    </p>
                  )}
                </div>
                <div className="opacity-75 flex-shrink-0">{card.icon}</div>
              </div>
            ))}
          </div>

          {/* Pengajuan Gadai section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FDF6E3" }}>
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><ellipse cx="9" cy="9" rx="4" ry="4" stroke="#C99A36" strokeWidth="2" fill="none"/><ellipse cx="16" cy="9" rx="4" ry="4" stroke="#C99A36" strokeWidth="2" fill="none"/><path d="M2 21c0-3.866 3.134-7 7-7h2c3.866 0 7 3.134 7 7" stroke="#C99A36" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
                    Pengajuan Gadai
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">Antrian Hari Ini: {stats.baruHariIni} Item</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/pegadaian/tambah")}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: "#C99A36" }}
              >
                <span className="text-lg leading-none font-bold">+</span> Tambah Pengajuan Gadai
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pb-3">
              <div className="relative max-w-sm">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Cari nama pelanggan atau barang..."
                  className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-base bg-white focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20 transition-colors"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
              </div>
            </div>

            {/* Table */}
            <div className="px-6 pb-2">
              <h3 className="text-base font-bold text-gray-800 mb-2">Antrian Pengajuan Gadai Terbaru</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr style={{ backgroundColor: "#FDF6E3" }}>
                    {["No","Tanggal","Nama Pelanggan","Jenis Barang","Estimasi Pengajuan","Status","Detail"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5"><div className="h-4 bg-gray-200 animate-pulse rounded w-full"/></td>
                        ))}
                      </tr>
                    ))
                  ) : paged.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center">
                        <p className="text-gray-400 text-base">
                          {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada pengajuan gadai"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paged.map((g, idx) => (
                      <tr key={g.id} className="border-t border-gray-100 hover:bg-amber-50/60 transition-colors">
                        <td className="px-4 py-3.5 text-sm text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(g.tanggal_gadai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3.5 text-sm font-medium text-gray-800 whitespace-nowrap">{g.pelanggan_nama}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">{g.jenis_perhiasan}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-gray-800 whitespace-nowrap">{fmtRupiah(g.nilai_pinjaman)}</td>
                        <td className="px-4 py-3.5"><Badge status={g.status} /></td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setDetailItem(g)}
                            className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-amber-50"
                            style={{ borderColor: "#C99A36", color: "#C99A36" }}
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-6 py-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  Prev
                </button>
                <span className="text-sm text-gray-500">Halaman {page} dari {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: "#C99A36" }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DetailGadaiPopup
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        item={detailItem}
        onChanged={load}
      />
    </AppLayout>
  );
}
