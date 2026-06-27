"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KADAR_PATOKAN_OPTIONS } from "@/lib/hutangPiutang";

/* ─── Types ─── */
interface HargaEmas {
  id?: string;
  karat: number;
  harga_beli: number;
  harga_jual: number;
  tanggal?: string;
}
interface InventoriRow {
  id: string;
  id_item: string;
  nama_produk: string;
  kategori: string;
  kadar: string;
  berat_gram: number;
  jumlah: number;
  status_laporan: string;
  tanggal_masuk: string;
}
interface Stats {
  totalItem: number;
  stokMenipis: number;
  hutangBelumLunas: number;
  piutangBelumLunas: number;
}

interface QuickMenuItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

const STATUS_STYLE: Record<string, string> = {
  "Draf":                       "bg-orange-100 text-orange-600 border border-orange-200",
  "Persetujuan Pemeriksa":      "bg-blue-100 text-blue-600 border border-blue-200",
  "Persetujuan Penandatangan":  "bg-stone-700 text-white",
  "Disetujui":                  "bg-green-100 text-green-600 border border-green-200",
  "Ditolak":                    "bg-red-100 text-red-600 border border-red-200",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

/* ═══ Input Rupiah: format ribuan otomatis sambil mengetik (mis. 1.050.000) ═══ */
function RupiahInput({
  value, onChange, placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  const display = value ? new Intl.NumberFormat("id-ID").format(value) : "";
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold select-none">
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? parseInt(digits, 10) : 0);
        }}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-xl py-3 pl-11 pr-4 text-base focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/30 transition-colors"
      />
    </div>
  );
}

/* ─── Draft input harga emas — disimpan di localStorage supaya tidak hilang
   kalau popup ditutup / halaman ditutup sebelum diklik "Simpan Harga". ─── */
const HARGA_DRAFT_KEY = "kresno_harga_emas_draft";

function emptyRow(): HargaEmas {
  return { karat: 0, harga_beli: 0, harga_jual: 0 };
}

// Baris awal: satu per satu (bukan langsung 24K/22K/18K) — atau lanjutkan dari yang
// sudah tersimpan hari ini di DB kalau ada.
function buildRowsFromExisting(existing: HargaEmas[]): HargaEmas[] {
  if (existing.length > 0) {
    return existing.map((e) => ({ karat: e.karat, harga_beli: e.harga_beli, harga_jual: e.harga_jual }));
  }
  return [emptyRow()];
}

function loadHargaDraft(today: string): HargaEmas[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HARGA_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tanggal: string; rows: HargaEmas[] };
    if (parsed.tanggal !== today || !Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return parsed.rows;
  } catch {
    return null;
  }
}

function saveHargaDraft(today: string, rows: HargaEmas[]) {
  try {
    localStorage.setItem(HARGA_DRAFT_KEY, JSON.stringify({ tanggal: today, rows }));
  } catch { /* storage penuh/disabled — abaikan */ }
}

function clearHargaDraft() {
  try { localStorage.removeItem(HARGA_DRAFT_KEY); } catch { /* ignore */ }
}

/* ═══ Popup: Harga Emas ═══ */
function HargaPopup({
  open, onClose, existing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing: HargaEmas[];
  onSaved: () => void;
}) {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  const [rows, setRows] = useState<HargaEmas[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Saat popup dibuka: pakai draft yang belum disimpan kalau ada (supaya tidak perlu
  // ketik ulang), kalau tidak ada draft baru pakai data tersimpan di DB / satu baris kosong.
  useEffect(() => {
    if (!open) return;
    setRows(loadHargaDraft(today) ?? buildRowsFromExisting(existing));
    setMsg("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Simpan draft tiap kali baris diubah, supaya ketikan tidak hilang walau popup ditutup
  // atau halaman direfresh sebelum diklik "Simpan Harga".
  useEffect(() => {
    if (!open) return;
    saveHargaDraft(today, rows);
  }, [open, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (i: number, field: keyof HargaEmas, val: number) => {
    const nr = [...rows];
    nr[i] = { ...nr[i], [field]: val };
    setRows(nr);
  };

  const save = async () => {
    const valid = rows.filter((r) => r.karat > 0);
    if (valid.length === 0) { setMsg("Isi minimal satu baris karat."); return; }
    setSaving(true);
    setMsg("");
    for (const row of valid) {
      const { error } = await supabase
        .from("harga_emas")
        .upsert(
          { tanggal: today, karat: row.karat, harga_beli: row.harga_beli, harga_jual: row.harga_jual },
          { onConflict: "tanggal,karat" }
        );
      if (error) { setMsg("Gagal menyimpan: " + error.message); setSaving(false); return; }
    }
    clearHargaDraft();
    setSaving(false);
    setMsg("✓ Harga berhasil disimpan!");
    setTimeout(() => { onSaved(); onClose(); }, 900);
  };

  const reset = () => {
    clearHargaDraft();
    setRows(buildRowsFromExisting(existing));
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ background: "linear-gradient(135deg, #C99A36 0%, #E8C468 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.5 15c0 1.1 1.12 2 2.5 2s2.5-.9 2.5-2-1.12-1.5-2.5-1.5-2.5-.4-2.5-1.5 1.12-2 2.5-2 2.5.9 2.5 2M12 7.5v1M12 15.5v1" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
                Biaya Emas Hari Ini
              </h2>
              <p className="text-sm text-white/85 mt-0.5">
                {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/15 rounded-lg p-1.5 transition-colors"
            aria-label="Tutup"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Column headers */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {["Karat", "Harga Beli (Rp/gram)", "Harga Jual (Rp/gram)"].map((h) => (
              <span key={h} className="text-sm font-semibold text-gray-600">{h}</span>
            ))}
          </div>

          {/* Input rows */}
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-3">
                <select
                  value={row.karat || ""}
                  onChange={(e) => updateRow(i, "karat", Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl py-3 px-3 text-base font-semibold focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/30 transition-colors bg-white"
                >
                  <option value="" disabled>Pilih karat</option>
                  {KADAR_PATOKAN_OPTIONS.map((k) => (
                    <option key={k} value={k}>{k}K</option>
                  ))}
                </select>
                <RupiahInput
                  value={row.harga_beli}
                  onChange={(n) => updateRow(i, "harga_beli", n)}
                  placeholder="1.050.000"
                />
                <RupiahInput
                  value={row.harga_jual}
                  onChange={(n) => updateRow(i, "harga_jual", n)}
                  placeholder="1.100.000"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2.5">
            Tinggal pilih karat dan ketik angkanya — format Rupiah (mis. Rp 1.050.000) terisi otomatis.
          </p>

          {/* Add row */}
          <button
            onClick={() => setRows([...rows, emptyRow()])}
            className="mt-3 text-sm font-medium transition-colors"
            style={{ color: "#C99A36" }}
          >
            + Tambah baris
          </button>

          {/* Feedback */}
          {msg && (
            <p className={`mt-3 text-sm font-semibold py-2 px-3 rounded-lg ${
              msg.startsWith("✓")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            }`}>
              {msg}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#C99A36" }}
            >
              {saving ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              {saving ? "Menyimpan..." : "Simpan Harga"}
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-base border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white transition-colors active:scale-[0.98]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
            <button
              onClick={onClose}
              className="ml-auto px-5 py-3 rounded-xl font-semibold text-base text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Main Dashboard Page ═══ */
export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [stats, setStats] = useState<Stats>({ totalItem: 0, stokMenipis: 0, hutangBelumLunas: 0, piutangBelumLunas: 0 });
  const [hargaEmas, setHargaEmas] = useState<HargaEmas[]>([]);
  const [inventori, setInventori] = useState<InventoriRow[]>([]);
  const [allInventori, setAllInventori] = useState<InventoriRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHargaPopup, setShowHargaPopup] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "quarter" | "all">("today");
  const [showDateMenu, setShowDateMenu] = useState(false);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  // Close date menu on outside click
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
    try {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];

      // Date range for inventori table only
      let fromDate: string | null = null;
      if (dateFilter === "today") {
        fromDate = todayStr;
      } else if (dateFilter === "week") {
        const d = new Date(now); d.setDate(d.getDate() - 6);
        fromDate = d.toISOString().split("T")[0];
      } else if (dateFilter === "month") {
        const d = new Date(now); d.setDate(d.getDate() - 29);
        fromDate = d.toISOString().split("T")[0];
      } else if (dateFilter === "quarter") {
        const d = new Date(now); d.setMonth(d.getMonth() - 3);
        fromDate = d.toISOString().split("T")[0];
      }
      // "all": fromDate stays null

      let invQuery = supabase
        .from("inventori")
        .select("id,id_item,nama_produk,kategori,kadar,berat_gram,jumlah,status_laporan,tanggal_masuk")
        .order("tanggal_masuk", { ascending: false })
        .limit(100);
      if (fromDate) {
        invQuery = invQuery.gte("tanggal_masuk", fromDate).lte("tanggal_masuk", todayStr);
      }

      const [statsRes, invRes, hargaRes, hutangRes, piutangRes] = await Promise.all([
        // Stats selalu dari SEMUA data, tidak terpengaruh filter tanggal
        supabase.from("inventori").select("id,jumlah"),
        invQuery,
        supabase
          .from("harga_emas")
          .select("id,karat,harga_beli,harga_jual,tanggal")
          .eq("tanggal", todayStr)
          .order("karat", { ascending: false }),
        supabase.from("hutang").select("harga_total").eq("status", "Belum Lunas"),
        supabase.from("piutang").select("jumlah_piutang").eq("status", "Belum Lunas"),
      ]);

      const allData = statsRes.data ?? [];
      setStats({
        totalItem:   allData.reduce((s, r) => s + (r.jumlah ?? 0), 0),
        stokMenipis: allData.filter((r) => (r.jumlah ?? 0) <= 5).length,
        hutangBelumLunas:  (hutangRes.data ?? []).reduce((s, r) => s + (r.harga_total ?? 0), 0),
        piutangBelumLunas: (piutangRes.data ?? []).reduce((s, r) => s + (r.jumlah_piutang ?? 0), 0),
      });

      const inventoriData = invRes.data ?? [];
      setAllInventori(inventoriData);
      setInventori(inventoriData.slice(0, 10));
      setHargaEmas(hargaRes.data ?? []);
    } catch (e) {
      console.error("Load error:", e);
    }
    setLoading(false);
  }, [dateFilter]);

  useEffect(() => { load(); }, [load]);

  // Search filter on inventori
  const filteredInventori = search.trim()
    ? allInventori.filter((r) =>
        r.id_item.toLowerCase().includes(search.toLowerCase()) ||
        r.nama_produk.toLowerCase().includes(search.toLowerCase()) ||
        r.kadar.toLowerCase().includes(search.toLowerCase())
      )
    : inventori;

  const dateLabels: Record<string, string> = {
    today:   "Hari Ini",
    week:    "7 Hari Terakhir",
    month:   "30 Hari Terakhir",
    quarter: "3 Bulan Terakhir",
    all:     "Semua Data",
  };

  const quickMenu: QuickMenuItem[] = [
    {
      label: "Kasir / Penjualan", href: "/pos",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8"><path d="M3 6h18l-1.5 9h-15L3 6z" stroke="#C99A36" strokeWidth="2" fill="none" strokeLinejoin="round"/><circle cx="9" cy="20" r="1.3" fill="#C99A36"/><circle cx="17" cy="20" r="1.3" fill="#C99A36"/><path d="M3 6L2 3" stroke="#C99A36" strokeWidth="2" strokeLinecap="round"/></svg>,
    },
    {
      label: "Inventori Barang", href: "/inventori",
      icon: <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8"><path d="M16 3L29 10v12L16 29 3 22V10L16 3z" stroke="#C99A36" strokeWidth="2" fill="none"/><path d="M3 10l13 7M16 29V17M29 10l-13 7" stroke="#C99A36" strokeWidth="2"/></svg>,
    },
    {
      label: "Servis", href: "/servis",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2-2 2.5-2.5z" stroke="#C99A36" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round"/></svg>,
    },
    {
      label: "Pegadaian", href: "/pegadaian",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8"><rect x="3" y="10" width="18" height="10" rx="2" stroke="#C99A36" strokeWidth="2" fill="none"/><path d="M7 10V7a5 5 0 0110 0v3" stroke="#C99A36" strokeWidth="2" fill="none"/><circle cx="12" cy="15" r="1.5" fill="#C99A36"/></svg>,
    },
    {
      label: "Hutang Piutang", href: "/hutang-piutang",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#C99A36" strokeWidth="2" fill="none"/><path d="M7 9h10M7 13h10M7 17h6" stroke="#C99A36" strokeWidth="2" strokeLinecap="round"/></svg>,
    },
    {
      label: "Keuangan", href: "/keuangan",
      icon: <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8"><path d="M3 20V10M9 20V4M15 20v-7M21 20V8" stroke="#C99A36" strokeWidth="2.5" strokeLinecap="round"/></svg>,
    },
  ];

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-white min-h-screen">

        {/* ── Top spacer (no search bar here anymore) ── */}
        <div className="h-1" />

        <div className="px-4 sm:px-6 pb-8 space-y-6 pt-4">

          {/* ── Title ── */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
              Dashboard
            </h1>
          </div>

          {/* ── Ringkasan singkat: jumlah barang, peringatan stok, & hutang/piutang ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/inventori"
              className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-[#C99A36]/40 transition-all"
            >
              <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FDF6E3" }}>
                <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7"><path d="M16 3L29 10v12L16 29 3 22V10L16 3z" stroke="#C99A36" strokeWidth="2" fill="none"/><path d="M3 10l13 7M16 29V17M29 10l-13 7" stroke="#C99A36" strokeWidth="2"/></svg>
              </div>
              <div>
                <p className="text-gray-500 text-base font-medium mb-1">Jumlah Barang di Toko</p>
                {loading
                  ? <div className="h-9 w-20 bg-gray-200 animate-pulse rounded" />
                  : <p className="text-3xl font-bold leading-none" style={{ color: "#C99A36" }}>
                      {fmt(stats.totalItem)} <span className="text-base text-gray-500 font-medium">item</span>
                    </p>
                }
              </div>
            </Link>

            <Link
              href="/inventori?filter=menipis"
              className={`rounded-xl border px-6 py-5 flex items-center gap-4 shadow-sm transition-all hover:shadow-md ${
                stats.stokMenipis > 0
                  ? "bg-red-50 border-red-200 hover:border-red-300"
                  : "bg-white border-gray-200 hover:border-[#C99A36]/40"
              }`}
            >
              <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${stats.stokMenipis > 0 ? "bg-red-100" : "bg-green-50"}`}>
                {stats.stokMenipis > 0
                  ? <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7"><path d="M16 4L30 28H2L16 4z" fill="#EF4444" opacity="0.15" stroke="#EF4444" strokeWidth="2"/><path d="M16 14v6M16 23v1" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7"><path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </div>
              <div>
                <p className="text-gray-500 text-base font-medium mb-1">Barang yang Perlu Ditambah Stok</p>
                {loading
                  ? <div className="h-9 w-24 bg-gray-200 animate-pulse rounded" />
                  : stats.stokMenipis > 0
                    ? <p className="text-3xl font-bold leading-none text-red-500">
                        {stats.stokMenipis} <span className="text-base text-gray-500 font-medium">item — perlu restock</span>
                      </p>
                    : <p className="text-3xl font-bold leading-none text-green-600">
                        Aman <span className="text-base text-gray-500 font-medium">— stok cukup</span>
                      </p>
                }
              </div>
            </Link>

            <Link
              href="/hutang-piutang"
              className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-[#C99A36]/40 transition-all"
            >
              <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FDF6E3" }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#C99A36" strokeWidth="2" fill="none"/><path d="M7 9h10M7 13h10M7 17h6" stroke="#C99A36" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p className="text-gray-500 text-base font-medium mb-1">Hutang &amp; Piutang Belum Lunas</p>
                {loading
                  ? <div className="h-9 w-32 bg-gray-200 animate-pulse rounded" />
                  : (
                    <div className="flex items-baseline gap-3">
                      <p className="text-lg font-bold leading-none text-red-500">
                        {fmt(stats.hutangBelumLunas)} <span className="text-xs text-gray-500 font-medium">hutang</span>
                      </p>
                      <p className="text-lg font-bold leading-none text-blue-600">
                        {fmt(stats.piutangBelumLunas)} <span className="text-xs text-gray-500 font-medium">piutang</span>
                      </p>
                    </div>
                  )
                }
              </div>
            </Link>
          </div>

          {/* ── Menu Utama: akses cepat ke menu yang sering dipakai ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: "var(--font-playfair)" }}>
              Menu Utama
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {quickMenu.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-2.5 rounded-xl border border-gray-200 px-4 py-6 text-center shadow-sm transition-all hover:shadow-md hover:border-[#C99A36]/40 active:scale-[0.98]"
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FDF6E3" }}>
                    {item.icon}
                  </div>
                  <span className="text-base font-semibold text-gray-800">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Biaya Emas Hari Ini ── */}
          <div className="rounded-xl border-2 shadow-md overflow-hidden" style={{ borderColor: "#C99A36" }}>
            <div
              className="flex items-center justify-between gap-4 px-6 py-5 flex-wrap"
              style={{ background: "linear-gradient(135deg, #C99A36 0%, #E8C468 100%)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.5 15c0 1.1 1.12 2 2.5 2s2.5-.9 2.5-2-1.12-1.5-2.5-1.5-2.5-.4-2.5-1.5 1.12-2 2.5-2 2.5.9 2.5 2M12 7.5v1M12 15.5v1" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
                    Biaya Emas Hari Ini
                  </h2>
                  <p className="text-sm text-white/85 mt-0.5">
                    {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHargaPopup(true)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-bold bg-white shadow-sm hover:bg-amber-50 active:scale-95 transition-all"
                style={{ color: "#6F5333" }}
              >
                <span className="text-base leading-none font-bold">+</span> Tambah / Ubah Harga
              </button>
            </div>

            <div className="bg-white">
              {/* Column headers */}
              <div className="mx-6 mt-5 mb-2">
                <div className="grid grid-cols-3 gap-4 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide" style={{ backgroundColor: "#FDF6E3", color: "#6F5333" }}>
                  <span>Karat</span>
                  <span>Harga Beli / gram</span>
                  <span>Harga Jual / gram</span>
                </div>
              </div>

              {/* Rows */}
              <div className="mx-6 pb-5 space-y-2.5">
                {loading ? (
                  [1,2,3].map((i) => (
                    <div key={i} className="grid grid-cols-3 gap-4">
                      {[1,2,3].map((j) => <div key={j} className="h-14 bg-gray-100 animate-pulse rounded-lg"/>)}
                    </div>
                  ))
                ) : hargaEmas.length > 0 ? (
                  hargaEmas.map((row) => (
                    <div key={row.karat} className="grid grid-cols-3 gap-4">
                      <div className="relative border-2 rounded-lg px-4 py-3 flex items-center" style={{ borderColor: "#F0DDA8", backgroundColor: "#FDF6E3" }}>
                        <span className="text-lg font-extrabold" style={{ color: "#6F5333" }}>{row.karat}K</span>
                      </div>
                      <div className="border border-gray-200 rounded-lg px-4 py-3 bg-white text-gray-900 text-base font-bold">
                        Rp {fmt(row.harga_beli)}
                      </div>
                      <div className="border border-gray-200 rounded-lg px-4 py-3 bg-white text-gray-900 text-base font-bold">
                        Rp {fmt(row.harga_jual)}
                      </div>
                    </div>
                  ))
                ) : (
                <div className="py-6 text-center">
                  <p className="text-gray-400 text-sm mb-3">Belum ada harga emas hari ini.</p>
                  <button
                    onClick={() => setShowHargaPopup(true)}
                    className="text-sm font-semibold transition-colors"
                    style={{ color: "#C99A36" }}
                  >
                    + Tambah harga sekarang
                  </button>
                </div>
              )}

              {hargaEmas.length > 0 && (
                <div className="flex gap-3 pt-2">
                  {/* "Simpan Harga" opens the edit popup */}
                  <button
                    onClick={() => setShowHargaPopup(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: "#C99A36" }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                    </svg>
                    Ubah Harga
                  </button>
                  {/* "Reset" reloads from DB (discards unsaved local state) */}
                  <button
                    onClick={load}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-base border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white transition-colors active:scale-[0.98]"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    Refresh
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>

          {/* ── Inventori Terbaru ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Section header */}
            <div className="px-6 py-4 border-b border-gray-100">
              {/* Top row: title + date filter + link */}
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                    <path d="M12 2L22 7v10L12 22 2 17V7L12 2z" stroke="#C99A36" strokeWidth="1.5" fill="none"/>
                    <path d="M2 7l10 5M12 22V12M22 7l-10 5" stroke="#C99A36" strokeWidth="1.5"/>
                  </svg>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
                      {search ? `Hasil pencarian "${search}"` : "Inventori Terbaru"}
                    </h2>
                    {!loading && (
                      <p className="text-sm text-gray-400 font-normal mt-0.5">
                        {filteredInventori.length} item ditemukan
                        {dateFilter !== "all" ? ` — ${dateLabels[dateFilter].toLowerCase()}` : " — semua waktu"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Date range filter */}
                  <div ref={dateMenuRef} className="relative">
                    <button
                      onClick={() => setShowDateMenu(!showDateMenu)}
                      className="flex items-center gap-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 bg-white hover:border-[#C99A36] transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      {dateLabels[dateFilter]}
                      <svg className={`w-4 h-4 transition-transform ${showDateMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                    {showDateMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 min-w-[180px]">
                        {(["today","week","month","quarter","all"] as const).map((key) => (
                          <button
                            key={key}
                            onClick={() => { setDateFilter(key); setShowDateMenu(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                              dateFilter === key
                                ? "bg-amber-50 text-[#C99A36]"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {dateLabels[key]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link
                    href="/inventori"
                    className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-amber-50 active:scale-95"
                    style={{ borderColor: "#C99A36", color: "#C99A36" }}
                  >
                    Lihat Semua
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Search bar — placed here near the table */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama produk, ID item, atau kadar..."
                    className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-base bg-white focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20 transition-colors"
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                  </svg>
                </div>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr style={{ backgroundColor: "#FDF6E3" }}>
                    {["No","ID Item","Nama Produk","Kadar","Berat","Jumlah","Tanggal","Status Laporan"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-4 bg-gray-200 animate-pulse rounded w-full"/>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredInventori.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center">
                        <p className="text-gray-400 text-base">
                          {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada data inventori"}
                        </p>
                        {search && (
                          <button onClick={() => setSearch("")} className="mt-2 text-sm font-medium" style={{ color: "#C99A36" }}>
                            Hapus pencarian
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredInventori.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="border-t border-gray-100 hover:bg-amber-50/60 transition-colors cursor-pointer"
                        onClick={() => router.push(`/inventori?id=${item.id}`)}
                        title="Klik untuk lihat detail"
                      >
                        <td className="px-4 py-3.5 text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-gray-800">{item.id_item}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-800 whitespace-nowrap">{item.nama_produk}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-700">{item.kadar}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-700">{item.berat_gram} gr</td>
                        <td className="px-4 py-3.5 text-sm text-gray-700">{item.jumlah}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                          {new Date(item.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge status={item.status_laporan}/>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Harga Emas Popup */}
      <HargaPopup
        open={showHargaPopup}
        onClose={() => setShowHargaPopup(false)}
        existing={hargaEmas}
        onSaved={load}
      />
    </AppLayout>
  );
}
