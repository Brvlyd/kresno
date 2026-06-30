"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import DateField from "@/components/DateField";
import InvoiceCetak from "@/components/pos/InvoiceCetak";
import { DetailRiwayatModal, RiwayatRowItem } from "@/components/pos/DetailRiwayatModal";
import { createClient } from "@/lib/supabase/client";
import { printClean } from "@/lib/print";
import {
  RIWAYAT_SELECT,
  groupRiwayatRows,
  riwayatToInvoiceProps,
  type RiwayatRow,
  type RiwayatTransaksi,
} from "@/lib/riwayatTransaksi";

const BASE_LIMIT = 100;
const LOAD_MORE_STEP = 100;

export default function RiwayatTransaksiPage() {
  const supabase = createClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rowLimit, setRowLimit] = useState(BASE_LIMIT);

  const [riwayat, setRiwayat] = useState<RiwayatTransaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const [selectedRiwayat, setSelectedRiwayat] = useState<RiwayatTransaksi | null>(null);
  const [printRiwayat, setPrintRiwayat] = useState<RiwayatTransaksi | null>(null);

  async function loadRiwayat(opts: { search: string; dateFrom: string; dateTo: string; rowLimit: number }) {
    setLoading(true);

    let query = supabase
      .from("inventori_keluar")
      .select(RIWAYAT_SELECT)
      .not("no_invoice", "is", null)
      .order("created_at", { ascending: false })
      .limit(opts.rowLimit);

    // Karakter koma/tanda kurung dibuang dari kata kunci supaya tidak menabrak
    // sintaks filter .or() milik PostgREST/Supabase.
    const q = opts.search.trim().replace(/[,()]/g, "");
    if (q) {
      query = query.or(
        `pelanggan_nama.ilike.%${q}%,no_invoice.ilike.%${q}%,nama_produk.ilike.%${q}%,pelanggan_hp.ilike.%${q}%`
      );
    }
    if (opts.dateFrom) query = query.gte("created_at", `${opts.dateFrom}T00:00:00`);
    if (opts.dateTo) query = query.lte("created_at", `${opts.dateTo}T23:59:59`);

    const { data } = await query;
    setHasMore((data ?? []).length >= opts.rowLimit);
    setRiwayat(groupRiwayatRows((data ?? []) as RiwayatRow[]));
    setLoading(false);
  }

  // Debounce 300ms supaya tidak query ke Supabase di setiap ketukan keyboard.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadRiwayat({ search, dateFrom, dateTo, rowLimit });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, dateFrom, dateTo, rowLimit]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateSearch(v: string) {
    setSearch(v);
    setRowLimit(BASE_LIMIT);
  }
  function updateDateFrom(v: string) {
    setDateFrom(v);
    setRowLimit(BASE_LIMIT);
  }
  function updateDateTo(v: string) {
    setDateTo(v);
    setRowLimit(BASE_LIMIT);
  }
  function resetFilter() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setRowLimit(BASE_LIMIT);
  }

  const isFiltering = search.trim() !== "" || dateFrom !== "" || dateTo !== "";

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          aside, nav, #riwayat-screen, #riwayat-print-overlay { display: none !important; }
          #invoice-print { display: block !important; }
          html, body { background: white !important; margin: 0; }
          @page { size: A5 landscape; margin: 10mm; }
        }
      `}</style>

      {/* Invoice — hidden on screen, visible on print */}
      {printRiwayat && (
        <InvoiceCetak mode="print" {...riwayatToInvoiceProps(printRiwayat)} />
      )}

      <AppLayout title="Riwayat Transaksi" subtitle="Daftar lengkap transaksi penjualan">
        <div id="riwayat-screen" className="max-w-5xl mx-auto w-full space-y-5 px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Link href="/pos" className="text-xs font-semibold hover:underline" style={{ color: "#6F5333" }}>
                ← Kembali ke Kasir
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">Riwayat Transaksi</h1>
              <p className="text-sm text-gray-500 mt-0.5">Cari &amp; saring riwayat transaksi penjualan berdasarkan kata kunci atau tanggal.</p>
            </div>
          </div>

          {/* Filter bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Cari Transaksi</label>
                <div className="relative">
                  <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => updateSearch(e.target.value)}
                    placeholder="Nama pelanggan, no. HP, no. invoice, atau nama barang..."
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Dari Tanggal</label>
                <DateField value={dateFrom} onChange={updateDateFrom} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Sampai Tanggal</label>
                <DateField value={dateTo} onChange={updateDateTo} />
              </div>
            </div>
            {isFiltering && (
              <button
                type="button"
                onClick={resetFilter}
                className="mt-3 text-xs font-semibold hover:underline"
                style={{ color: "#6F5333" }}
              >
                ✕ Hapus Filter
              </button>
            )}
          </div>

          {/* List transaksi */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-5 rounded-full" style={{ backgroundColor: "#C99A36" }} />
              <h3 className="font-bold text-gray-800">
                Daftar Transaksi {!loading && `(${riwayat.length})`}
              </h3>
            </div>
            <p className="text-xs text-gray-400 -mt-1 mb-2 ml-3">Klik transaksi untuk melihat detail barangnya.</p>

            {loading ? (
              <p className="text-sm text-gray-400 py-4">Memuat riwayat...</p>
            ) : riwayat.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">
                {isFiltering ? "Tidak ada transaksi yang cocok dengan filter ini." : "Belum ada transaksi."}
              </p>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {riwayat.map((r) => (
                    <RiwayatRowItem key={r.noInvoice} r={r} onClick={() => setSelectedRiwayat(r)} />
                  ))}
                </div>
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setRowLimit((n) => n + LOAD_MORE_STEP)}
                    className="w-full text-center py-3 mt-2 text-sm font-semibold border-t border-dashed border-gray-200 hover:bg-amber-50 transition-colors"
                    style={{ color: "#6F5333" }}
                  >
                    Muat Lebih Banyak
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </AppLayout>

      {/* MODAL: DETAIL TRANSAKSI — popup per item yang sudah di-checkout */}
      {selectedRiwayat && (
        <DetailRiwayatModal
          r={selectedRiwayat}
          onClose={() => setSelectedRiwayat(null)}
          onPrint={() => {
            setPrintRiwayat(selectedRiwayat);
            setSelectedRiwayat(null);
          }}
        />
      )}

      {/* MODAL: PREVIEW & CETAK NOTA */}
      {printRiwayat && (
        <div id="riwayat-print-overlay" className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Nota Transaksi</h2>
                <p className="text-xs text-gray-400 font-mono">{printRiwayat.noInvoice}</p>
              </div>
              <button
                onClick={() => setPrintRiwayat(null)}
                className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="bg-white rounded-xl shadow-md p-5 mx-auto" style={{ maxWidth: 620 }}>
                <InvoiceCetak mode="preview" {...riwayatToInvoiceProps(printRiwayat)} />
              </div>
            </div>
            <div className="px-6 pb-6 sticky bottom-0 bg-white pt-3 border-t border-gray-100 rounded-b-2xl space-y-2">
              <p className="text-[11px] text-gray-400 text-center">
                Pertama kali print di komputer ini? Di kotak dialog print, klik “Lainnya” / “More settings” lalu matikan “Header dan footer” supaya alamat web tidak ikut tercetak.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPrintRiwayat(null)}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                >
                  ✕ Tutup
                </button>
                <button
                  onClick={() => printClean()}
                  className="flex-1 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-all"
                  style={{ backgroundColor: "#6F5333" }}
                >
                  🖨️ Print Nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
