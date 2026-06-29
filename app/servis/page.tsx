"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fmtRupiah } from "@/lib/servis";
import type { InvoiceServisData } from "@/lib/servis";
import { InvoiceServis } from "@/components/InvoiceServis";
import { printClean } from "@/lib/print";

/* ─── Types ─── */
interface ServisRow {
  id: string;
  no_servis: string;
  jenis_servis: "Cuci" | "Perbaikan";
  pelanggan_nama: string;
  pelanggan_hp: string | null;
  pelanggan_alamat: string | null;
  jenis_perhiasan: string;
  nama_barang: string;
  berat_gram: number;
  kadar: string;
  kondisi_awal: string | null;
  deskripsi: string | null;
  foto_barang_url: string | null;
  jenis_kerusakan: string | null;
  jenis_tindakan: string | null;
  prioritas: string | null;
  catatan_kerusakan: string | null;
  estimasi_biaya: number;
  uang_muka: number;
  status: "Menunggu" | "Diproses" | "Selesai" | "Diambil";
  tanggal_masuk: string;
  estimasi_selesai: string | null;
  tanggal_selesai: string | null;
  catatan_tambahan: string | null;
  created_at: string;
}

const PAGE_SIZE = 5;

const STATUS_STYLE: Record<string, string> = {
  "Menunggu": "bg-orange-100 text-orange-600 border border-orange-200",
  "Diproses": "bg-blue-100 text-blue-600 border border-blue-200",
  "Selesai":  "bg-green-100 text-green-700 border border-green-200",
  "Diambil":  "bg-gray-100 text-gray-600 border border-gray-200",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

/* ═══ Popup: Detail Servis ═══ */
function DetailServisPopup({
  open, onClose, item, onChanged,
}: {
  open: boolean;
  onClose: () => void;
  item: ServisRow | null;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);

  useEffect(() => {
    if (open) setMsg("");
  }, [open]);

  if (!open || !item) return null;

  const tandaiSelesai = async () => {
    setBusy(true);
    setMsg("");
    const { error } = await supabase
      .from("servis")
      .update({ status: "Selesai", tanggal_selesai: new Date().toISOString().split("T")[0], updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setBusy(false);
    if (error) { setMsg("Gagal menyimpan: " + error.message); return; }
    onChanged();
    onClose();
  };

  const tandaiDiambil = async () => {
    setBusy(true);
    setMsg("");
    const { error } = await supabase
      .from("servis")
      .update({ status: "Diambil", uang_muka: item.estimasi_biaya, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setBusy(false);
    if (error) { setMsg("Gagal menyimpan: " + error.message); return; }
    onChanged();
    onClose();
  };

  const invoiceData: InvoiceServisData = {
    no_servis: item.no_servis,
    tanggal_masuk: item.tanggal_masuk,
    jenis_servis: item.jenis_servis,
    nama_barang: item.nama_barang,
    berat_gram: item.berat_gram,
    kadar: item.kadar,
    estimasi_selesai: item.estimasi_selesai ?? item.tanggal_masuk,
    estimasi_biaya: item.estimasi_biaya,
    uang_muka: item.uang_muka,
  };

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          aside, nav, #servis-screen, #servis-detail-overlay, #servis-invoice-preview-overlay { display: none !important; }
          #invoice-print { display: block !important; }
          html, body { background: white !important; margin: 0; }
          @page { size: A5 landscape; margin: 10mm; }
        }
      `}</style>
      {/* Invoice — hidden on screen, visible on print */}
      <InvoiceServis mode="print" data={invoiceData} />

    <div id="servis-detail-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Detail Servis {item.jenis_servis}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{item.no_servis}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors font-bold text-xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <Badge status={item.status} />
            <span className="text-sm text-gray-500">
              Tgl Masuk: {new Date(item.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
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

          {/* Data Perhiasan */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Data Perhiasan</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400">Jenis</p><p className="font-semibold text-gray-800">{item.jenis_perhiasan}</p></div>
              <div><p className="text-gray-400">Nama Barang</p><p className="font-semibold text-gray-800">{item.nama_barang}</p></div>
              <div><p className="text-gray-400">Berat</p><p className="font-semibold text-gray-800">{item.berat_gram} gram</p></div>
              <div><p className="text-gray-400">Kadar</p><p className="font-semibold text-gray-800">{item.kadar}</p></div>
              {item.kondisi_awal && (
                <div className="col-span-2"><p className="text-gray-400">Kondisi Awal</p><p className="font-semibold text-gray-800">{item.kondisi_awal}</p></div>
              )}
              {item.deskripsi && (
                <div className="col-span-2"><p className="text-gray-400">Deskripsi</p><p className="text-gray-700">{item.deskripsi}</p></div>
              )}
            </div>
          </div>

          {/* Detail Perbaikan */}
          {item.jenis_servis === "Perbaikan" && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Detail Perbaikan</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-400">Jenis Kerusakan</p><p className="font-semibold text-gray-800">{item.jenis_kerusakan || "-"}</p></div>
                <div><p className="text-gray-400">Jenis Tindakan</p><p className="font-semibold text-gray-800">{item.jenis_tindakan || "-"}</p></div>
                <div><p className="text-gray-400">Prioritas</p><p className="font-semibold text-gray-800">{item.prioritas || "-"}</p></div>
                {item.catatan_kerusakan && (
                  <div className="col-span-2"><p className="text-gray-400">Catatan Kerusakan</p><p className="text-gray-700">{item.catatan_kerusakan}</p></div>
                )}
              </div>
            </div>
          )}

          {/* Biaya */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Biaya & Estimasi</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400">Estimasi Biaya</p><p className="font-semibold" style={{ color: "#C99A36" }}>{fmtRupiah(item.estimasi_biaya)}</p></div>
              <div><p className="text-gray-400">Uang Muka</p><p className="font-semibold text-gray-800">{fmtRupiah(item.uang_muka)}</p></div>
              <div><p className="text-gray-400">Sisa Pembayaran</p><p className="font-semibold text-gray-800">{fmtRupiah(item.estimasi_biaya - item.uang_muka)}</p></div>
              <div>
                <p className="text-gray-400">Estimasi Selesai</p>
                <p className="font-semibold text-gray-800">
                  {item.estimasi_selesai ? new Date(item.estimasi_selesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                </p>
              </div>
              {item.tanggal_selesai && (
                <div>
                  <p className="text-gray-400">Tanggal Selesai</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(item.tanggal_selesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {item.catatan_tambahan && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Catatan Tambahan</h3>
              <p className="text-sm text-gray-700">{item.catatan_tambahan}</p>
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
              🖨️ Cetak Invoice Servis
            </button>
            {(item.status === "Menunggu" || item.status === "Diproses") && (
              <button
                onClick={tandaiSelesai}
                disabled={busy}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#C99A36" }}
              >
                Tandai Selesai
              </button>
            )}
            {item.status === "Selesai" && (
              <button
                onClick={tandaiDiambil}
                disabled={busy}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#C99A36" }}
              >
                Tandai Diambil & Lunas
              </button>
            )}
          </div>

          {item.status !== "Diambil" && (item.estimasi_biaya - item.uang_muka) > 0 && (
            <button
              onClick={() => router.push(
                `/hutang-piutang/tambah-piutang?sumber=Servis&nama=${encodeURIComponent(item.pelanggan_nama)}&jumlah=${item.estimasi_biaya - item.uang_muka}&kategori=Customer&referensi=${encodeURIComponent(item.no_servis)}`
              )}
              className="w-full py-3 rounded-xl border-2 border-dashed font-semibold text-sm transition-colors hover:bg-amber-50"
              style={{ borderColor: "#C99A36", color: "#C99A36" }}
            >
              📋 Catat Sisa Pembayaran sebagai Piutang
            </button>
          )}
        </div>
      </div>
    </div>

      {/* ── MODAL: PREVIEW / CETAK INVOICE ── */}
      {showInvoicePreview && (
        <div id="servis-invoice-preview-overlay" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Preview Invoice Servis</h2>
                <p className="text-xs text-gray-400">{item.no_servis}</p>
              </div>
              <button
                onClick={() => setShowInvoicePreview(false)}
                className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="bg-white rounded-xl shadow-md p-5 mx-auto" style={{ maxWidth: 620 }}>
                <InvoiceServis mode="preview" data={invoiceData} />
              </div>
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
export default function ServisPage() {
  const supabase = createClient();
  const router = useRouter();

  const [servisList, setServisList] = useState<ServisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState<"Semua" | "Cuci" | "Perbaikan">("Semua");
  const [pageAntrian, setPageAntrian] = useState(1);
  const [pageRiwayat, setPageRiwayat] = useState(1);
  const [detailItem, setDetailItem] = useState<ServisRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("servis")
      .select("*")
      .order("created_at", { ascending: false });
    setServisList(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const aktif = servisList.filter((s) => s.status !== "Diambil");
    return {
      totalServis: aktif.length,
      diproses: servisList.filter((s) => s.status === "Diproses").length,
      selesai: servisList.filter((s) => s.status === "Selesai").length,
      estimasiPendapatan: aktif.reduce((sum, s) => sum + (s.estimasi_biaya ?? 0), 0),
    };
  }, [servisList]);

  const filtered = useMemo(() => {
    let result = servisList;
    if (filterJenis !== "Semua") {
      result = result.filter((s) => s.jenis_servis === filterJenis);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.pelanggan_nama.toLowerCase().includes(q) ||
        s.nama_barang.toLowerCase().includes(q) ||
        s.no_servis.toLowerCase().includes(q)
      );
    }
    return result;
  }, [servisList, filterJenis, search]);

  const antrian = useMemo(() => filtered.filter((s) => s.status !== "Diambil"), [filtered]);
  const riwayat = useMemo(() => filtered.filter((s) => s.status === "Diambil"), [filtered]);

  const totalPagesAntrian = Math.max(1, Math.ceil(antrian.length / PAGE_SIZE));
  const pagedAntrian = antrian.slice((pageAntrian - 1) * PAGE_SIZE, pageAntrian * PAGE_SIZE);

  const totalPagesRiwayat = Math.max(1, Math.ceil(riwayat.length / PAGE_SIZE));
  const pagedRiwayat = riwayat.slice((pageRiwayat - 1) * PAGE_SIZE, pageRiwayat * PAGE_SIZE);

  const statCards = [
    {
      label: "Total Servis", value: String(stats.totalServis), suffix: "servis",
      sublabel: "sedang berjalan",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#C99A36" strokeWidth="2" fill="none"/><path d="M7 9h10M7 13h10M7 17h6" stroke="#C99A36" strokeWidth="2" strokeLinecap="round"/></svg>,
    },
    {
      label: "Servis Diproses", value: String(stats.diproses), suffix: "servis",
      sublabel: "sedang dikerjakan",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2-2 2.5-2.5z" stroke="#C99A36" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round"/></svg>,
    },
    {
      label: "Servis Selesai", value: String(stats.selesai), suffix: "item",
      sublabel: "siap diambil",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9"><path d="M5 13l4 4L19 7" stroke="#22C55E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      label: "Estimasi Pendapatan", value: fmtRupiah(stats.estimasiPendapatan),
      sublabel: "dari servis aktif",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9"><path d="M3 20V10M9 20V4M15 20v-7M21 20V8" stroke="#C99A36" strokeWidth="2.5" strokeLinecap="round"/></svg>,
    },
  ];

  const renderTable = (
    title: string,
    rows: ServisRow[],
    page: number,
    setPage: (p: number) => void,
    totalPages: number,
    actionLabel: string,
    emptyText: string,
  ) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-base font-bold text-gray-800">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr style={{ backgroundColor: "#FDF6E3" }}>
              {["No","Tanggal","Nama Pelanggan","Jenis Servis","Biaya","Status","Aksi"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-4 bg-gray-200 animate-pulse rounded w-full"/></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center">
                  <p className="text-gray-400 text-base">{emptyText}</p>
                </td>
              </tr>
            ) : (
              rows.map((s, idx) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-amber-50/60 transition-colors">
                  <td className="px-4 py-3.5 text-sm text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(s.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-gray-800 whitespace-nowrap">{s.pelanggan_nama}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">{s.jenis_servis}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-gray-800 whitespace-nowrap">{fmtRupiah(s.estimasi_biaya)}</td>
                  <td className="px-4 py-3.5"><Badge status={s.status} /></td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => setDetailItem(s)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-amber-50"
                      style={{ borderColor: "#C99A36", color: "#C99A36" }}
                    >
                      {actionLabel}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && rows.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">Halaman {page} dari {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: "#C99A36" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div id="servis-screen" className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-4 sm:px-6 pb-8 space-y-6 pt-4">

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
            Servis Perhiasan
          </h1>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-gray-500 text-sm font-medium mb-1">{card.label}</p>
                  <div className="flex items-baseline gap-2">
                    {loading
                      ? <span className="h-8 w-16 bg-gray-200 animate-pulse rounded block" />
                      : <span className="font-bold leading-none" style={{ color: "#C99A36", fontSize: card.value.length > 8 ? "1.3rem" : "1.8rem" }}>
                          {card.value}
                        </span>
                    }
                    {"suffix" in card && card.suffix && <span className="text-gray-500 text-base font-medium">{card.suffix}</span>}
                  </div>
                  {card.sublabel && <p className="text-xs font-semibold mt-0.5 text-gray-400">{card.sublabel}</p>}
                </div>
                <div className="opacity-75 flex-shrink-0">{card.icon}</div>
              </div>
            ))}
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FDF6E3" }}>
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M7 3v4M12 3v4M17 3v4" stroke="#C99A36" strokeWidth="2" strokeLinecap="round"/><path d="M4 9h16l-1.5 9.5A2 2 0 0116.5 20h-9A2 2 0 015.5 18.5L4 9z" stroke="#C99A36" strokeWidth="2" fill="none" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>Cuci Perhiasan</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Pembersihan & pemolesan perhiasan</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/servis/tambah?jenis=Cuci")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] whitespace-nowrap"
                style={{ backgroundColor: "#C99A36" }}
              >
                <span className="text-lg leading-none font-bold">+</span> Tambah Servis Cuci
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FDF6E3" }}>
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2-2 2.5-2.5z" stroke="#C99A36" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>Perbaikan Perhiasan</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Servis perbaikan kerusakan perhiasan</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/servis/tambah?jenis=Perbaikan")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] whitespace-nowrap"
                style={{ backgroundColor: "#C99A36" }}
              >
                <span className="text-lg leading-none font-bold">+</span> Tambah Servis Perbaikan
              </button>
            </div>
          </div>

          {/* Filter tab Cuci / Perbaikan */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl max-w-sm">
            {(["Semua", "Cuci", "Perbaikan"] as const).map((tab) => {
              const count = tab === "Semua"
                ? servisList.length
                : servisList.filter((s) => s.jenis_servis === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => { setFilterJenis(tab); setPageAntrian(1); setPageRiwayat(1); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-semibold text-sm transition-all ${
                    filterJenis === tab
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "Cuci" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M7 3v4M12 3v4M17 3v4" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M4 9h16l-1.5 9.5A2 2 0 0116.5 20h-9A2 2 0 015.5 18.5L4 9z" strokeWidth="2" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {tab === "Perbaikan" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2-2 2.5-2.5z" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                    </svg>
                  )}
                  {tab}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    filterJenis === tab ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-500"
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPageAntrian(1); setPageRiwayat(1); }}
              placeholder="Cari nama pelanggan, barang, atau no. servis..."
              className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-base bg-white focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20 transition-colors"
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
          </div>

          {/* Antrian Servis Terbaru */}
          {renderTable(
            "Antrian Servis Terbaru",
            pagedAntrian, pageAntrian, setPageAntrian, totalPagesAntrian,
            "Detail",
            search ? `Tidak ada hasil untuk "${search}"` : "Belum ada servis dalam antrian"
          )}

          {/* Riwayat Servis Selesai */}
          {renderTable(
            "Riwayat Servis Selesai",
            pagedRiwayat, pageRiwayat, setPageRiwayat, totalPagesRiwayat,
            "Lihat Detail",
            search ? `Tidak ada hasil untuk "${search}"` : "Belum ada riwayat servis selesai"
          )}
        </div>
      </div>

      <DetailServisPopup
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        item={detailItem}
        onChanged={load}
      />
    </AppLayout>
  );
}
