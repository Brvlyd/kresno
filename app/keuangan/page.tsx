"use client";

import { useState, useEffect, Fragment } from "react";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { printClean } from "@/lib/print";
import { hitungTotalBunga } from "@/lib/gadai";
import PinGate from "@/components/PinGate";

/* ═══════════════════════════════════════════════════════
   KONSTANTA & HELPER
═══════════════════════════════════════════════════════ */

const fmtRp = (n: number) =>
  "Rp " + Math.round(n || 0).toLocaleString("id-ID");

const fmtGram = (n: number) => (n || 0).toFixed(2) + " gr";

const fmtTgl = (d: string | Date) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });

const fmtTglShort = (d: string | Date) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

const fmtPersen = (n: number) => (n || 0).toFixed(1).replace(/\.0$/, "") + "%";

/** Cocokkan query pencarian (case-insensitive, partial) ke salah satu kolom suatu baris. */
function matchSearch(haystacks: (string | number | null | undefined)[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystacks.some((h) => String(h ?? "").toLowerCase().includes(q));
}

/** Rata-rata persentase modal/jual tertimbang berat — karena persen tidak bisa
 * dijumlah langsung antar barang yang beratnya beda-beda. */
function weightedAvgPersen(
  rows: { berat_gram: number; jumlah: number; persen_modal: number; persen_jual: number }[],
  field: "persen_modal" | "persen_jual",
): number {
  const totalBerat = rows.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
  if (totalBerat === 0) return 0;
  const weighted = rows.reduce((s, r) => s + (r[field] || 0) * r.berat_gram * r.jumlah, 0);
  return weighted / totalBerat;
}

/** Samakan format kadar dari berbagai sumber (inventori "24K", gadai/servis "24K (99.99%)")
 * supaya bisa dikelompokkan jadi satu bucket yang sama saat dipecah per karat. */
function normalizeKadar(k: string | null | undefined): string {
  if (!k || k === "—") return "—";
  const m = k.match(/(\d+(?:\.\d+)?)\s*[kK]/);
  return m ? `${m[1]}K` : k.trim();
}

/** Urutkan label karat dari yang tertinggi ke terendah (24K → 9K → "—" di akhir). */
function sortKadarDesc(keys: string[]): string[] {
  const sortValue = (k: string) => {
    const m = k.match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : -1;
  };
  return [...keys].sort((a, b) => sortValue(b) - sortValue(a));
}

/** Kelompokkan baris berdasarkan karat (sudah dinormalisasi), lalu jumlahkan nilainya. */
function sumByKadar<T>(rows: T[], kadarOf: (r: T) => string, value: (r: T) => number): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const r of rows) {
    const k = normalizeKadar(kadarOf(r));
    acc[k] = (acc[k] || 0) + value(r);
  }
  return acc;
}

/** Target jumlah baris per halaman tabel Sisa Stok di layar (cetakan tetap menampilkan semuanya). */
const STOK_PAGE_SIZE = 20;

/** Pecah daftar kelompok (mis. per karat atau per tanggal) jadi beberapa halaman tanpa
 * memutus satu kelompok di tengah, supaya baris header/subtotal tiap kelompok tidak
 * terpisah dari baris-barisnya saat dipaginasi di layar. */
function paginateGroups(
  groupKeys: string[],
  rowsByGroup: Record<string, unknown[]>,
  pageSize: number,
): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
  let count = 0;
  for (const k of groupKeys) {
    const n = rowsByGroup[k].length;
    if (current.length > 0 && count + n > pageSize) {
      pages.push(current);
      current = [];
      count = 0;
    }
    current.push(k);
    count += n;
  }
  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

/** Target jumlah baris per halaman untuk tabel datar (bukan yang dikelompokkan per karat). */
const LIST_PAGE_SIZE = 20;

/** Potong satu halaman dari daftar datar, sambil meredam nomor halaman ke rentang valid
 * kalau daftarnya menyusut (mis. setelah difilter pencarian). */
function paginateFlat<T>(items: T[], page: number, pageSize: number): { pageItems: T[]; totalPages: number; safePage: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  return { pageItems: items.slice(start, start + pageSize), totalPages, safePage };
}

/* ═══════════════════════════════════════════════════════
   TIPE DATA
═══════════════════════════════════════════════════════ */
type FilterMode =
  | "hari_ini" | "minggu_ini" | "bulan_ini" | "bulan_lalu"
  | "tahun_ini" | "tahun_lalu"
  | "tanggal" | "bulan" | "rentang";

type GroupBy = "harian" | "mingguan" | "bulanan" | "kuartal" | "tahunan";

const GROUP_BY_OPTIONS: [GroupBy, string][] = [
  ["harian", "Harian"],
  ["mingguan", "Mingguan"],
  ["bulanan", "Bulanan"],
  ["kuartal", "Per 3 Bulan"],
  ["tahunan", "Tahunan"],
];

/** Kunci & label kelompok tren laba-rugi — dipakai untuk mengelompokkan transaksi
 * dalam rentang yang dipilih jadi baris per-hari/minggu/bulan/kuartal/tahun. */
function bucketKey(d: Date, g: GroupBy): string {
  const y = d.getFullYear();
  if (g === "harian") return d.toISOString().slice(0, 10);
  if (g === "mingguan") {
    const dow = d.getDay();
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (dow === 0 ? 6 : dow - 1));
    return mon.toISOString().slice(0, 10);
  }
  if (g === "bulanan") return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (g === "kuartal") return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  return `${y}`;
}

function bucketLabel(key: string, g: GroupBy): string {
  if (g === "harian") return fmtTgl(new Date(key));
  if (g === "mingguan") {
    const start = new Date(key);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return fmtTglShort(start) + " — " + fmtTglShort(end);
  }
  if (g === "bulanan") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }
  if (g === "kuartal") {
    const [y, q] = key.split("-Q");
    const bulan = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Okt–Des"][Number(q) - 1];
    return `Kuartal ${q} ${y} (${bulan})`;
  }
  return key;
}

interface StokRow {
  id: string;
  id_item: string;
  nama_produk: string;
  kategori: string;
  kadar: string;
  berat_gram: number;
  jumlah: number;
  harga_beli: number;
  harga_jual: number;
  persen_modal: number;
  persen_jual: number;
  status_inventori: string;
  tanggal_masuk: string;
  jenis_inventori: string;
  sub_jenis_aset: string | null;
}

interface KeluarRow {
  id: string;
  id_item: string;
  nama_produk: string;
  jumlah_keluar: number;
  status_baru: string;
  catatan: string | null;
  created_at: string;
  berat_gram: number;
  kadar: string;
  harga_jual: number;
  harga_beli: number;
}

interface ServisRow {
  id: string;
  no_servis: string;
  jenis_servis: string;
  pelanggan_nama: string;
  nama_barang: string;
  kadar: string;
  estimasi_biaya: number;
  status: string;
  tanggal_masuk: string;
}

interface GadaiRow {
  id: string;
  no_gadai: string;
  pelanggan_nama: string;
  nama_barang: string;
  kadar: string;
  nilai_pinjaman: number;
  bunga_persen: number;
  jangka_waktu_bulan: number;
  status: string;
  tanggal_gadai: string;
}

/* ═══════════════════════════════════════════════════════
   DATE FILTER HELPERS
═══════════════════════════════════════════════════════ */
function getDateRange(
  mode: FilterMode,
  customDate: string,
  customMonth: string,
  rangeFrom: string,
  rangeTo: string,
): [Date, Date] {
  const now = new Date();
  const eod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (mode === "hari_ini") return [sod, eod];
  if (mode === "minggu_ini") {
    const dow = sod.getDay();
    const mon = new Date(sod);
    mon.setDate(sod.getDate() - (dow === 0 ? 6 : dow - 1));
    return [mon, eod];
  }
  if (mode === "bulan_ini") return [new Date(now.getFullYear(), now.getMonth(), 1), eod];
  if (mode === "bulan_lalu") return [
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
  ];
  if (mode === "tahun_ini") return [new Date(now.getFullYear(), 0, 1), eod];
  if (mode === "tahun_lalu") return [
    new Date(now.getFullYear() - 1, 0, 1),
    new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
  ];
  if (mode === "tanggal" && customDate) {
    const d = new Date(customDate);
    return [
      new Date(d.getFullYear(), d.getMonth(), d.getDate()),
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999),
    ];
  }
  if (mode === "bulan" && customMonth) {
    const [y, m] = customMonth.split("-").map(Number);
    return [new Date(y, m - 1, 1), new Date(y, m, 0, 23, 59, 59, 999)];
  }
  if (mode === "rentang" && rangeFrom && rangeTo) {
    const f = new Date(rangeFrom);
    const t = new Date(rangeTo);
    return [
      new Date(f.getFullYear(), f.getMonth(), f.getDate()),
      new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999),
    ];
  }
  return [sod, eod];
}

function filterLabel(
  mode: FilterMode,
  customDate: string,
  customMonth: string,
  rangeFrom: string,
  rangeTo: string,
): string {
  const now = new Date();
  if (mode === "hari_ini") return "Hari Ini, " + fmtTgl(now);
  if (mode === "minggu_ini") return "Minggu Ini";
  if (mode === "bulan_ini")
    return now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  if (mode === "bulan_lalu") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }
  if (mode === "tahun_ini") return "Tahun " + now.getFullYear();
  if (mode === "tahun_lalu") return "Tahun " + (now.getFullYear() - 1);
  if (mode === "tanggal" && customDate) return fmtTgl(new Date(customDate));
  if (mode === "bulan" && customMonth) {
    const [y, m] = customMonth.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }
  if (mode === "rentang" && rangeFrom && rangeTo)
    return fmtTglShort(rangeFrom) + " — " + fmtTglShort(rangeTo);
  return "Hari Ini";
}

/** Apakah akhir periode yang dipilih sudah lewat (di masa lalu) — dipakai untuk membedakan
 * tampilan stok/aset "real-time saat ini" vs "rekonstruksi per akhir periode". */
function isPeriodeLewat(dateTo: Date): boolean {
  return dateTo.getTime() < new Date().getTime();
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: HEADER CETAK (hanya muncul saat print)
═══════════════════════════════════════════════════════ */
function PrintHeader({ label, forceShow }: { label: string; forceShow?: boolean }) {
  return (
    <div className={forceShow ? "block mb-6" : "hidden print:block mb-6"}>
      <div className="pb-4 mb-4" style={{ borderBottom: "2px solid #6F5333" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14pt" }}>
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-kresno.png"
            alt="Logo Toko Mas Kresno"
            style={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0 }}
          />
          {/* Info tengah */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <h1
              style={{ color: "#6F5333", fontFamily: "Georgia, serif", letterSpacing: "0.04em", fontSize: "22pt", fontWeight: 900, margin: 0 }}
            >
              TOKOMAS KRESNO
            </h1>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, margin: "3pt 0" }}>
              <div style={{ height: 1, width: 60, backgroundColor: "#C99A36" }} />
              <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#C99A36" }} />
              <div style={{ height: 1, width: 60, backgroundColor: "#C99A36" }} />
            </div>
            <p style={{ fontSize: "8pt", color: "#555", margin: "1pt 0" }}>Jl. Kios Pasar Grabag Petak Blok KA No. 7A-7B</p>
            <p style={{ fontSize: "8pt", color: "#555", margin: "1pt 0" }}>(Depan Terminal Lama), Grabag, Magelang, Jawa Tengah</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 3, fontSize: "8pt", color: "#555" }}>
              <span>☎ 0821-8501-3553</span>
              <span>✉ tokomaskresno5758@gmail.com</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, fontSize: "8pt", color: "#555" }}>
              <span>📷 tokomaskresno.grabag</span>
              <span>TikTok: Tk. Mas Kresno Grabag</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
            Laporan Keuangan
          </p>
          <p className="text-sm text-gray-600">Periode: {label}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Dicetak pada:</p>
          <p className="text-sm font-semibold text-gray-800">{fmtTgl(new Date())}</p>
        </div>
      </div>
      <div className="mt-3" style={{ borderBottom: "1px solid #ccc" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: SEARCH BAR PER BAGIAN
═══════════════════════════════════════════════════════ */
function SearchBar({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4 no-print">
      <div className="relative flex-1 max-w-sm">
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border-2 border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm bg-white focus:outline-none focus:border-[#C99A36] focus:ring-2 focus:ring-[#C99A36]/25 transition-colors"
        />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </div>
      {value && (
        <button
          onClick={() => onChange("")}
          className="text-sm font-semibold text-gray-500 hover:text-amber-700 px-3 py-2.5 rounded-lg hover:bg-amber-100 transition-colors"
        >
          Hapus
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: KONTROL PAGINASI TABEL — disembunyikan saat pratinjau/cetak,
   supaya laporan yang dicetak tetap memuat semua baris.
═══════════════════════════════════════════════════════ */
function Pager({ page, totalPages, total, pageSize, onPrev, onNext }: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  return (
    <div className="no-print flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50 text-sm flex-wrap">
      <p className="text-gray-500">
        Menampilkan {from}–{to} dari {total} item &bull; Halaman {page + 1} dari {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page === 0}
          className="px-3 py-1.5 rounded-lg border border-gray-300 font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
        >
          &lsaquo; Sebelumnya
        </button>
        <button
          onClick={onNext}
          disabled={page === totalPages - 1}
          className="px-3 py-1.5 rounded-lg border border-gray-300 font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
        >
          Selanjutnya &rsaquo;
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: KONTEN UTAMA KEUANGAN
═══════════════════════════════════════════════════════ */
function KeuanganContent({ onLock, onOpenChangePin }: {
  onLock: () => void;
  onOpenChangePin: () => void;
}) {
  const supabase = createClient();

  /* ── Filter ── */
  const [mode, setMode] = useState<FilterMode>("bulan_ini");
  const [customDate, setCustomDate] = useState("");
  const [customMonth, setCustomMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  /* ── Search per bagian/tab ── */
  const [searchStok, setSearchStok] = useState("");
  const [searchTransaksi, setSearchTransaksi] = useState("");
  const [searchAset, setSearchAset] = useState("");
  const [searchLog, setSearchLog] = useState("");

  /* ── Data ── */
  const [stokAll, setStokAll] = useState<StokRow[]>([]);
  const [stokKeluar, setStokKeluar] = useState<KeluarRow[]>([]);
  const [servisList, setServisList] = useState<ServisRow[]>([]);
  const [gadaiList, setGadaiList] = useState<GadaiRow[]>([]);
  const [gadaiAktifSemua, setGadaiAktifSemua] = useState<GadaiRow[]>([]);
  const [servisPending, setServisPending] = useState<ServisRow[]>([]);
  const [keluarRiwayat, setKeluarRiwayat] = useState<{ inventori_id: string | null; jumlah_keluar: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── UI ── */
  const [tab, setTab] = useState<"stok" | "transaksi" | "laba_rugi" | "aset" | "log">("stok");
  const [showPreview, setShowPreview] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("bulanan");
  const [pageByKey, setPageByKey] = useState<Record<string, number>>({});
  const [printSections, setPrintSections] = useState<Record<"stok" | "transaksi" | "laba_rugi" | "aset" | "log", boolean>>({
    stok: true, transaksi: true, laba_rugi: true, aset: true, log: false,
  });

  const label = filterLabel(mode, customDate, customMonth, rangeFrom, rangeTo);
  const [dateFrom, dateTo] = getDateRange(mode, customDate, customMonth, rangeFrom, rangeTo);

  /* ── Load data ── */
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      const [from, to] = getDateRange(mode, customDate, customMonth, rangeFrom, rangeTo);
      const fromISO = from.toISOString();
      const toISO = to.toISOString();
      // toISOString() konversi ke UTC dulu — untuk zona waktu di depan UTC (WIB/WITA/WIT)
      // ini menggeser tanggal mundur 1 hari saat di-slice. Kolom tanggal_masuk/tanggal_gadai
      // bertipe DATE polos (tanpa jam), jadi bandingkan pakai tanggal lokal apa adanya.
      const toLocalDateStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const fromDate = toLocalDateStr(from);
      const toDate = toLocalDateStr(to);

      const [
        { data: allStok },
        { data: keluar },
        { data: servis },
        { data: gadai },
        { data: gadaiAktif },
        { data: servisProses },
        { data: keluarSemua },
      ] = await Promise.all([
        supabase.from("inventori").select("*").order("tanggal_masuk", { ascending: false }),
        supabase
          .from("inventori_keluar")
          .select("*, inventori:inventori_id(berat_gram, kadar, harga_jual, harga_beli)")
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false }),
        supabase
          .from("servis")
          .select("*")
          .gte("tanggal_masuk", fromDate)
          .lte("tanggal_masuk", toDate)
          .order("tanggal_masuk", { ascending: false }),
        supabase
          .from("gadai")
          .select("*")
          .gte("tanggal_gadai", fromDate)
          .lte("tanggal_gadai", toDate)
          .order("tanggal_gadai", { ascending: false }),
        supabase
          .from("gadai")
          .select("*")
          .in("status", ["Aktif", "Menunggu", "Diproses"])
          .order("tanggal_gadai", { ascending: true }),
        supabase
          .from("servis")
          .select("*")
          .in("status", ["Menunggu", "Diproses"])
          .order("tanggal_masuk", { ascending: true }),
        supabase.from("inventori_keluar").select("inventori_id, jumlah_keluar, created_at"),
      ]);

      if (cancelled) return;

      setStokAll((allStok ?? []) as StokRow[]);
      setKeluarRiwayat(
        (keluarSemua ?? []) as { inventori_id: string | null; jumlah_keluar: number; created_at: string }[],
      );

      setStokKeluar(
        (keluar ?? []).map((k) => {
          const inv = (k as Record<string, unknown>).inventori as Record<string, unknown> | null;
          return {
            id: k.id as string,
            id_item: k.id_item as string,
            nama_produk: k.nama_produk as string,
            jumlah_keluar: k.jumlah_keluar as number,
            status_baru: k.status_baru as string,
            catatan: k.catatan as string | null,
            created_at: k.created_at as string,
            berat_gram: (inv?.berat_gram as number) ?? 0,
            kadar: inv?.kadar ? String(inv.kadar) : "—",
            harga_jual: (inv?.harga_jual as number) ?? 0,
            harga_beli: (inv?.harga_beli as number) ?? 0,
          };
        }),
      );

      setServisList((servis ?? []) as ServisRow[]);
      setGadaiList((gadai ?? []) as GadaiRow[]);
      setGadaiAktifSemua((gadaiAktif ?? []) as GadaiRow[]);
      setServisPending((servisProses ?? []) as ServisRow[]);
      setLoading(false);
    }

    run();
    return () => { cancelled = true; };
  }, [mode, customDate, customMonth, rangeFrom, rangeTo]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived values ── */
  // "Sisa Stok" sebenarnya direkonstruksi per akhir periode yang dipilih (dateTo), bukan
  // status_inventori saat ini — supaya filter periode lampau (mis. "Tahun Lalu", sebelum
  // sistem ini dipakai) tidak ikut menampilkan stok yang baru masuk/keluar setelahnya.
  // Item dihitung "tersedia per dateTo" kalau sudah masuk sebelum/pada dateTo DAN belum
  // pernah ada riwayat keluar (inventori_keluar) sebelum/pada dateTo.
  const dateToTime = dateTo.getTime();
  const periodeSudahLewat = isPeriodeLewat(dateTo);
  const keluarPerItem = new Map<string, { keluarPertama: number; totalKeluar: number }>();
  for (const k of keluarRiwayat) {
    if (!k.inventori_id) continue;
    const t = new Date(k.created_at).getTime();
    const acc = keluarPerItem.get(k.inventori_id) ?? { keluarPertama: Infinity, totalKeluar: 0 };
    acc.keluarPertama = Math.min(acc.keluarPertama, t);
    acc.totalKeluar += k.jumlah_keluar;
    keluarPerItem.set(k.inventori_id, acc);
  }
  const sisaStok = stokAll
    .filter((r) => new Date(r.tanggal_masuk).getTime() <= dateToTime)
    .filter((r) => {
      const keluar = keluarPerItem.get(r.id);
      return !keluar || keluar.keluarPertama > dateToTime;
    })
    .map((r) => {
      const keluar = keluarPerItem.get(r.id);
      return keluar ? { ...r, jumlah: r.jumlah + keluar.totalKeluar } : r;
    });
  const stokMasuk = stokAll.filter((r) => {
    const d = new Date(r.tanggal_masuk);
    return d >= dateFrom && d <= dateTo;
  });

  const totalGramSisa = sisaStok.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
  const totalNilaiModal = sisaStok.reduce((s, r) => s + (r.harga_beli || 0) * r.jumlah, 0);
  const totalNilaiJual = sisaStok.reduce((s, r) => s + (r.harga_jual || 0) * r.jumlah, 0);
  const totalPotensiLaba = totalNilaiJual - totalNilaiModal;

  const gramMasuk = stokMasuk.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
  const nilaiMasuk = stokMasuk.reduce((s, r) => s + (r.harga_beli || 0) * r.jumlah, 0);

  // Pisahkan buyback emas rosok dari pembelian stok biasa — supaya kas yang dibayarkan
  // tunai ke customer untuk buyback rosok kelihatan jelas sebagai pengeluaran sendiri,
  // bukan tercampur generik dengan pembelian stok dari supplier.
  const stokMasukRosok = stokMasuk.filter((r) => r.sub_jenis_aset === "Emas Rosok");
  const stokMasukReguler = stokMasuk.filter((r) => r.sub_jenis_aset !== "Emas Rosok");
  const gramMasukRosok = stokMasukRosok.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
  const nilaiMasukRosok = stokMasukRosok.reduce((s, r) => s + (r.harga_beli || 0) * r.jumlah, 0);
  const gramMasukReguler = stokMasukReguler.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
  const nilaiMasukReguler = stokMasukReguler.reduce((s, r) => s + (r.harga_beli || 0) * r.jumlah, 0);

  const gramKeluar = stokKeluar.reduce((s, k) => s + k.berat_gram * k.jumlah_keluar, 0);
  const keluarTerjual = stokKeluar.filter((k) => k.status_baru === "Terjual");
  const nilaiPenjualan = keluarTerjual.reduce((s, k) => s + k.harga_jual * k.jumlah_keluar, 0);
  const hppPenjualan = keluarTerjual.reduce((s, k) => s + k.harga_beli * k.jumlah_keluar, 0);

  const servisSelesai = servisList.filter((s) => s.status === "Diambil" || s.status === "Selesai");
  const pendapatanServis = servisSelesai.reduce((s, r) => s + r.estimasi_biaya, 0);

  const gadaiLunas = gadaiList.filter((g) => g.status === "Lunas");
  const pendapatanGadai = gadaiLunas.reduce(
    (s, g) => s + hitungTotalBunga(g.nilai_pinjaman, g.bunga_persen, g.jangka_waktu_bulan), 0,
  );

  const totalPemasukan = nilaiPenjualan + pendapatanServis + pendapatanGadai;
  const totalPengeluaran = nilaiMasuk;
  const labaBersih = totalPemasukan - totalPengeluaran;

  /* ── Hasil pencarian per bagian/tab — hanya menyaring baris yang ditampilkan,
   * kartu ringkasan & total global di atas tab tetap mencerminkan data periode utuh. ── */
  const sisaStokFiltered = sisaStok.filter((r) => matchSearch([r.nama_produk, r.id_item, r.kadar, r.kategori], searchStok));

  const stokMasukFiltered = stokMasuk.filter((r) => matchSearch([r.nama_produk, r.id_item, r.kadar], searchTransaksi));
  const stokKeluarFiltered = stokKeluar.filter((k) => matchSearch([k.nama_produk, k.id_item, k.kadar], searchTransaksi));
  const servisListFiltered = servisList.filter((s) => matchSearch([s.no_servis, s.pelanggan_nama, s.nama_barang, s.jenis_servis], searchTransaksi));
  const gadaiListFiltered = gadaiList.filter((g) => matchSearch([g.no_gadai, g.pelanggan_nama, g.nama_barang], searchTransaksi));

  const gramMasukF = stokMasukFiltered.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
  const nilaiMasukF = stokMasukFiltered.reduce((s, r) => s + (r.harga_beli || 0) * r.jumlah, 0);
  const gramKeluarF = stokKeluarFiltered.reduce((s, k) => s + k.berat_gram * k.jumlah_keluar, 0);
  const keluarTerjualF = stokKeluarFiltered.filter((k) => k.status_baru === "Terjual");
  const nilaiPenjualanF = keluarTerjualF.reduce((s, k) => s + k.harga_jual * k.jumlah_keluar, 0);
  const servisSelesaiF = servisListFiltered.filter((s) => s.status === "Diambil" || s.status === "Selesai");
  const pendapatanServisF = servisSelesaiF.reduce((s, r) => s + r.estimasi_biaya, 0);
  const gadaiLunasF = gadaiListFiltered.filter((g) => g.status === "Lunas");
  const pendapatanGadaiF = gadaiLunasF.reduce((s, g) => s + hitungTotalBunga(g.nilai_pinjaman, g.bunga_persen, g.jangka_waktu_bulan), 0);

  /* ── Paginasi tabel "Masuk & Keluar" di layar — pratinjau/cetak tetap menampilkan semua baris. ── */
  const stokMasukPg = paginateFlat(stokMasukFiltered, pageByKey["masuk"] ?? 0, LIST_PAGE_SIZE);
  const stokKeluarPg = paginateFlat(stokKeluarFiltered, pageByKey["keluar"] ?? 0, LIST_PAGE_SIZE);
  const servisTransaksiPg = paginateFlat(servisListFiltered, pageByKey["servisTransaksi"] ?? 0, LIST_PAGE_SIZE);
  const gadaiTransaksiPg = paginateFlat(gadaiListFiltered, pageByKey["gadaiTransaksi"] ?? 0, LIST_PAGE_SIZE);

  // Gadai/servis yang statusnya MASIH aktif/menunggu sekarang sudah pasti juga berstatus
  // belum-lunas/belum-selesai di setiap titik waktu sejak tanggal pengajuannya (status hanya
  // maju, tidak pernah mundur) — jadi cukup saring berdasarkan tanggal pengajuan <= dateTo
  // supaya entri yang baru diajukan setelah periode lampau tidak ikut muncul.
  const gadaiAktifAsOf = gadaiAktifSemua.filter((g) => new Date(g.tanggal_gadai).getTime() <= dateToTime);
  const servisPendingAsOf = servisPending.filter((s) => new Date(s.tanggal_masuk).getTime() <= dateToTime);

  const gadaiAktifSemuaFiltered = gadaiAktifAsOf.filter((g) => matchSearch([g.no_gadai, g.pelanggan_nama, g.nama_barang], searchAset));
  const servisPendingFiltered = servisPendingAsOf.filter((s) => matchSearch([s.no_servis, s.pelanggan_nama, s.nama_barang, s.jenis_servis], searchAset));
  const totalGadaiAktifF = gadaiAktifSemuaFiltered.reduce((s, g) => s + g.nilai_pinjaman, 0);
  const totalBungaPotensialF = gadaiAktifSemuaFiltered.reduce((s, g) => s + hitungTotalBunga(g.nilai_pinjaman, g.bunga_persen, g.jangka_waktu_bulan), 0);
  const totalNilaiServisPendingF = servisPendingFiltered.reduce((s, r) => s + r.estimasi_biaya, 0);

  /* ── Pecahan per Karat — untuk kartu ringkasan & banner total ── */
  const itemSisaPerKadar = sumByKadar(sisaStok, (r) => r.kadar, () => 1);
  const gramSisaPerKadar = sumByKadar(sisaStok, (r) => r.kadar, (r) => r.berat_gram * r.jumlah);
  const modalPerKadar = sumByKadar(sisaStok, (r) => r.kadar, (r) => (r.harga_beli || 0) * r.jumlah);
  const jualPerKadar = sumByKadar(sisaStok, (r) => r.kadar, (r) => (r.harga_jual || 0) * r.jumlah);
  const kadarKeysSisa = sortKadarDesc(Object.keys(gramSisaPerKadar));

  const itemMasukPerKadar = sumByKadar(stokMasuk, (r) => r.kadar, () => 1);
  const gramMasukPerKadar = sumByKadar(stokMasuk, (r) => r.kadar, (r) => r.berat_gram * r.jumlah);
  const nilaiMasukPerKadar = sumByKadar(stokMasuk, (r) => r.kadar, (r) => (r.harga_beli || 0) * r.jumlah);
  const kadarKeysMasuk = sortKadarDesc(Object.keys(gramMasukPerKadar));

  const itemKeluarPerKadar = sumByKadar(stokKeluar, (k) => k.kadar, () => 1);
  const gramKeluarPerKadar = sumByKadar(stokKeluar, (k) => k.kadar, (k) => k.berat_gram * k.jumlah_keluar);
  const nilaiPenjualanPerKadar = sumByKadar(keluarTerjual, (k) => k.kadar, (k) => k.harga_jual * k.jumlah_keluar);
  const kadarKeysKeluar = sortKadarDesc(Object.keys(gramKeluarPerKadar));

  const pendapatanServisPerKadar = sumByKadar(servisSelesai, (s) => s.kadar, (s) => s.estimasi_biaya);
  const pendapatanGadaiPerKadar = sumByKadar(gadaiLunas, (g) => g.kadar, (g) => hitungTotalBunga(g.nilai_pinjaman, g.bunga_persen, g.jangka_waktu_bulan));

  const kadarKeysLaba = sortKadarDesc(Array.from(new Set([
    ...Object.keys(nilaiPenjualanPerKadar),
    ...Object.keys(pendapatanServisPerKadar),
    ...Object.keys(pendapatanGadaiPerKadar),
    ...Object.keys(nilaiMasukPerKadar),
  ])));
  const labaBersihPerKadar: Record<string, number> = {};
  for (const k of kadarKeysLaba) {
    labaBersihPerKadar[k] =
      (nilaiPenjualanPerKadar[k] || 0) +
      (pendapatanServisPerKadar[k] || 0) +
      (pendapatanGadaiPerKadar[k] || 0) -
      (nilaiMasukPerKadar[k] || 0);
  }

  /* ── Tren Laba Rugi per Periode — kelompokkan transaksi periode aktif
   * berdasarkan pilihan harian/mingguan/bulanan/kuartal/tahunan. ── */
  const trendBuckets: Record<string, { pemasukan: number; pengeluaran: number }> = {};
  function addTrend(date: Date, field: "pemasukan" | "pengeluaran", value: number) {
    if (!value) return;
    const key = bucketKey(date, groupBy);
    if (!trendBuckets[key]) trendBuckets[key] = { pemasukan: 0, pengeluaran: 0 };
    trendBuckets[key][field] += value;
  }
  keluarTerjual.forEach((k) => addTrend(new Date(k.created_at), "pemasukan", k.harga_jual * k.jumlah_keluar));
  servisSelesai.forEach((s) => addTrend(new Date(s.tanggal_masuk), "pemasukan", s.estimasi_biaya));
  gadaiLunas.forEach((g) => addTrend(new Date(g.tanggal_gadai), "pemasukan", hitungTotalBunga(g.nilai_pinjaman, g.bunga_persen, g.jangka_waktu_bulan)));
  stokMasuk.forEach((r) => addTrend(new Date(r.tanggal_masuk), "pengeluaran", (r.harga_beli || 0) * r.jumlah));

  const trendRows = Object.keys(trendBuckets)
    .sort()
    .map((key) => {
      const b = trendBuckets[key];
      return {
        key,
        label: bucketLabel(key, groupBy),
        pemasukan: b.pemasukan,
        pengeluaran: b.pengeluaran,
        laba: b.pemasukan - b.pengeluaran,
      };
    });

  /* ── Log Transaksi Terpadu ── */
  type TxKind = "stok_masuk" | "stok_keluar" | "servis" | "gadai";
  const allTx: {
    id: string; kind: TxKind; date: Date;
    title: string; sub: string; note: string;
    nilai: number; nilaiLabel: string; isDebit: boolean;
    status: string;
  }[] = [
    ...stokMasuk.map((r) => ({
      id: "sm-" + r.id, kind: "stok_masuk" as TxKind,
      date: new Date(r.tanggal_masuk),
      title: r.nama_produk,
      sub: r.id_item + " · " + r.kadar + " · " + fmtGram(r.berat_gram) + "/unit × " + r.jumlah,
      note: r.jenis_inventori ?? "Stock Dalam",
      nilai: (r.harga_beli || 0) * r.jumlah,
      nilaiLabel: "Harga Beli", isDebit: true,
      status: "Masuk",
    })),
    ...stokKeluar.map((k) => ({
      id: "sk-" + k.id, kind: "stok_keluar" as TxKind,
      date: new Date(k.created_at),
      title: k.nama_produk,
      sub: k.id_item + " · " + (k.kadar !== "—" ? k.kadar + " · " : "") + fmtGram(k.berat_gram) + "/unit × " + k.jumlah_keluar,
      note: k.catatan ?? "",
      nilai: k.status_baru === "Terjual" ? k.harga_jual * k.jumlah_keluar : 0,
      nilaiLabel: k.status_baru === "Terjual" ? "Nilai Jual" : k.status_baru,
      isDebit: false,
      status: k.status_baru,
    })),
    ...servisList.map((s) => ({
      id: "sv-" + s.id, kind: "servis" as TxKind,
      date: new Date(s.tanggal_masuk),
      title: s.pelanggan_nama + " — " + s.nama_barang,
      sub: s.no_servis + " · " + s.jenis_servis,
      note: "",
      nilai: s.estimasi_biaya,
      nilaiLabel: s.status === "Diambil" || s.status === "Selesai" ? "Pendapatan" : "Est. Biaya",
      isDebit: false,
      status: s.status,
    })),
    ...gadaiList.map((g) => ({
      id: "gd-" + g.id, kind: "gadai" as TxKind,
      date: new Date(g.tanggal_gadai),
      title: g.pelanggan_nama + " — " + g.nama_barang,
      sub: g.no_gadai + " · Pinjaman " + fmtRp(g.nilai_pinjaman) + " · Bunga " + g.bunga_persen + "%",
      note: "",
      nilai: g.status === "Lunas" ? hitungTotalBunga(g.nilai_pinjaman, g.bunga_persen, g.jangka_waktu_bulan) : g.nilai_pinjaman,
      nilaiLabel: g.status === "Lunas" ? "Bunga Diterima" : "Nilai Pinjaman",
      isDebit: g.status !== "Lunas",
      status: g.status,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const TX_META: Record<TxKind, { label: string; bg: string; text: string; dot: string }> = {
    stok_masuk:  { label: "Stok Masuk",  bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500" },
    stok_keluar: { label: "Stok Keluar", bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-400" },
    servis:      { label: "Servis",      bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
    gadai:       { label: "Gadai",       bg: "bg-teal-100",   text: "text-teal-700",   dot: "bg-teal-500" },
  };

  /* ── Helpers UI ── */
  const TABS = [
    { id: "stok" as const, label: "Sisa Stok", icon: "📦" },
    { id: "transaksi" as const, label: "Masuk & Keluar", icon: "🔄" },
    { id: "laba_rugi" as const, label: "Laba Rugi", icon: "💰" },
    { id: "aset" as const, label: "Nilai Aset", icon: "📊" },
    { id: "log" as const, label: "Log Transaksi", icon: "📋" },
  ];

  const FILTER_BUTTONS: [FilterMode, string][] = [
    ["hari_ini", "Hari Ini"],
    ["minggu_ini", "Minggu Ini"],
    ["bulan_ini", "Bulan Ini"],
    ["bulan_lalu", "Bulan Lalu"],
    ["tahun_ini", "Tahun Ini"],
    ["tahun_lalu", "Tahun Lalu"],
    ["tanggal", "Pilih Tanggal"],
    ["bulan", "Pilih Bulan"],
    ["rentang", "Rentang Tanggal"],
  ];

  const sectionCls = (id: "stok" | "transaksi" | "laba_rugi" | "aset" | "log", pageBreak = false): string => {
    const enabled = printSections[id];
    const show = showPreview ? enabled : tab === id;
    const base = ["print-section", !enabled ? "print-exclude" : "", pageBreak && enabled ? "print-page-break" : ""].filter(Boolean).join(" ");
    return show ? `block ${base}` : (enabled ? `hidden print:block ${base}` : `hidden ${base}`);
  };

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          aside, nav, .no-print { display: none !important; }
          .print-full { display: block !important; }
          .print-exclude { display: none !important; }
          body { background: white !important; font-size: 9pt; color: #111; }
          @page { margin: 12mm 15mm; size: A4; }
          table { font-size: 7.5pt; border-collapse: collapse; width: 100%; }
          th { background: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          th, td { padding: 2pt 5pt !important; border-bottom: 0.5pt solid #e5e7eb; }
          .print-section { page-break-inside: avoid; margin-bottom: 8pt; }
          .print-page-break { page-break-before: always; }
          .rounded-2xl { border-radius: 4pt !important; }
          .shadow-sm { box-shadow: none !important; }
          h2 { font-size: 10pt; margin-bottom: 4pt; }
          h3 { font-size: 9pt; }
        }
      `}</style>

      <AppLayout>
        <div className="px-4 sm:px-6 pt-6 pb-12 flex flex-col gap-5 min-h-screen bg-gray-50">

          {/* ── Bar Kontrol Pratinjau Cetak ── */}
          {showPreview && (
            <div className="no-print sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-b border-gray-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧾</span>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Pratinjau Laporan Keuangan</p>
                    <p className="text-xs text-gray-500">Periode: {label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Tutup Pratinjau
                  </button>
                  <button
                    onClick={() => printClean()}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 shadow-sm"
                    style={{ backgroundColor: "#6F5333" }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Cetak Sekarang
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center pt-1.5 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-400 mr-1 whitespace-nowrap">Pilih bagian:</span>
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setPrintSections((p) => ({ ...p, [t.id]: !p[t.id] }))}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold border-2 transition-colors ${
                      printSections[t.id]
                        ? "text-white border-transparent"
                        : "bg-gray-50 text-gray-400 border-gray-200 line-through"
                    }`}
                    style={printSections[t.id] ? { backgroundColor: "#6F5333", borderColor: "#6F5333" } : {}}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
                <span className="text-xs text-gray-400 ml-1">
                  ({Object.values(printSections).filter(Boolean).length} bagian dipilih)
                </span>
              </div>
            </div>
          )}

          {/* ── Header Cetak ── */}
          <PrintHeader label={label} forceShow={showPreview} />

          {/* ── Ringkasan Cetak (hanya print / pratinjau) ── */}
          <div className={showPreview ? "block print-section" : "hidden print:block print-section"}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8pt", marginBottom: "8pt" }}>
              {[
                { l: "Stok Tersedia", v: sisaStok.length + " item", s: fmtGram(totalGramSisa), c: "#6F5333" },
                { l: "Total Penjualan Emas", v: fmtRp(nilaiPenjualan), s: keluarTerjual.length + " item terjual", c: "#16A34A" },
                { l: "Total Pemasukan", v: fmtRp(totalPemasukan), s: "Penjualan + Servis + Bunga", c: "#2563EB" },
                { l: "Laba Bersih", v: fmtRp(Math.abs(labaBersih)), s: labaBersih >= 0 ? "UNTUNG" : "RUGI", c: labaBersih >= 0 ? "#16A34A" : "#DC2626" },
              ].map((c) => (
                <div key={c.l} style={{ border: "1pt solid #d1d5db", borderRadius: "6pt", padding: "7pt 9pt" }}>
                  <p style={{ fontSize: "7pt", color: "#6b7280", marginBottom: "3pt", textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.l}</p>
                  <p style={{ fontSize: "12pt", fontWeight: 800, color: c.c, lineHeight: 1.2 }}>{c.v}</p>
                  <p style={{ fontSize: "7pt", color: "#6b7280", marginTop: "2pt" }}>{c.s}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8pt", marginBottom: "12pt" }}>
              {[
                { l: "Nilai Modal Stok", v: fmtRp(totalNilaiModal), s: "Estimasi jual: " + fmtRp(totalNilaiJual), c: "#92400E" },
                { l: "Modal Tertahan (Gadai Aktif)", v: fmtRp(gadaiAktifAsOf.reduce((s, g) => s + g.nilai_pinjaman, 0)), s: gadaiAktifAsOf.length + " gadai belum lunas", c: "#EA580C" },
                { l: "Servis Belum Selesai", v: servisPendingAsOf.length + " order", s: "Est. " + fmtRp(servisPendingAsOf.reduce((s, r) => s + r.estimasi_biaya, 0)), c: "#7C3AED" },
              ].map((c) => (
                <div key={c.l} style={{ border: "1pt solid #d1d5db", borderRadius: "6pt", padding: "7pt 9pt" }}>
                  <p style={{ fontSize: "7pt", color: "#6b7280", marginBottom: "3pt", textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.l}</p>
                  <p style={{ fontSize: "12pt", fontWeight: 800, color: c.c, lineHeight: 1.2 }}>{c.v}</p>
                  <p style={{ fontSize: "7pt", color: "#6b7280", marginTop: "2pt" }}>{c.s}</p>
                </div>
              ))}
            </div>
          </div>

          {!showPreview && (
          <>
          {/* ── Judul Halaman ── */}
          <div className="flex items-start justify-between flex-wrap gap-4 no-print">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                Laporan Keuangan
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Ringkasan keuangan, stok, dan aset Toko Mas Kresno
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
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 shadow-sm"
                style={{ backgroundColor: "#6F5333" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Pratinjau &amp; Cetak Laporan
              </button>
            </div>
          </div>

          {/* ── Filter Periode ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 no-print">
            <p className="text-sm font-bold text-gray-700 mb-3">Pilih Periode Laporan</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {FILTER_BUTTONS.map(([m, l]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${
                    mode === m
                      ? "text-white border-transparent"
                      : "border-gray-200 text-gray-600 hover:border-[#C99A36] hover:bg-amber-50 hover:text-amber-900 active:bg-amber-100"
                  }`}
                  style={mode === m ? { backgroundColor: "#6F5333" } : {}}
                >
                  {l}
                </button>
              ))}
            </div>

            {mode === "tanggal" && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36] mt-1"
              />
            )}
            {mode === "bulan" && (
              <input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36] mt-1"
              />
            )}
            {mode === "rentang" && (
              <div className="flex items-center gap-3 flex-wrap mt-1">
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                />
                <span className="text-gray-400 font-bold">sampai</span>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                />
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#C99A36" }} />
              <p className="text-xs text-gray-500">
                Periode aktif:{" "}
                <strong className="text-gray-800">{label}</strong>
              </p>
            </div>
          </div>

          {/* ── Kartu Ringkasan ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            {[
              {
                label: "Stok Tersedia",
                value: sisaStok.length + " item",
                sub: fmtGram(totalGramSisa),
                color: "border-l-[#C99A36]",
                breakdown: kadarKeysSisa.map((k) => ({
                  kadar: k,
                  text: `${fmtGram(gramSisaPerKadar[k])} · ${itemSisaPerKadar[k]} item`,
                })),
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
                ),
              },
              {
                label: "Stok Masuk (Periode)",
                value: stokMasuk.length + " item",
                sub: fmtGram(gramMasuk),
                color: "border-l-blue-500",
                breakdown: kadarKeysMasuk.map((k) => ({
                  kadar: k,
                  text: `${fmtGram(gramMasukPerKadar[k])} · ${itemMasukPerKadar[k]} item`,
                })),
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                  </svg>
                ),
              },
              {
                label: "Stok Keluar (Periode)",
                value: stokKeluar.length + " item",
                sub: fmtGram(gramKeluar),
                color: "border-l-red-400",
                breakdown: kadarKeysKeluar.map((k) => ({
                  kadar: k,
                  text: `${fmtGram(gramKeluarPerKadar[k])} · ${itemKeluarPerKadar[k]} item`,
                })),
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                  </svg>
                ),
              },
              {
                label: "Laba Bersih (Periode)",
                value: fmtRp(Math.abs(labaBersih)),
                sub: labaBersih >= 0 ? "Untung" : "Rugi",
                color: labaBersih >= 0 ? "border-l-green-500" : "border-l-red-500",
                breakdown: kadarKeysLaba.map((k) => ({
                  kadar: k,
                  text: (labaBersihPerKadar[k] >= 0 ? "+" : "−") + fmtRp(Math.abs(labaBersihPerKadar[k])),
                })),
                icon: labaBersih >= 0 ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
                  </svg>
                ),
              },
            ].map((c, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 border-l-4 ${c.color}`}
              >
                <div className="text-gray-400 mb-3" style={i === 0 ? { color: "#C99A36" } : {}}>
                  {c.icon}
                </div>
                <p className="text-xl font-extrabold text-gray-900">{c.value}</p>
                <p className="text-sm font-semibold text-gray-500 mt-0.5">{c.sub}</p>
                {c.breakdown.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                    {c.breakdown.map((b) => (
                      <p key={b.kadar} className="text-[11px] text-gray-400 flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-500">{b.kadar}</span>
                        <span>{b.text}</span>
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1.5">{c.label}</p>
              </div>
            ))}
          </div>

          {/* ── Sorotan Total Gram — dipecah per karat ── */}
          <div
            className="rounded-2xl p-5 text-white print:hidden"
            style={{ background: "linear-gradient(135deg, #6F5333 0%, #9A7248 100%)" }}
          >
            <p className="text-sm font-semibold opacity-75">
              {periodeSudahLewat
                ? `Total Berat Stok Emas Tersedia per Akhir Periode (${label}) — per Karat`
                : "Total Berat Semua Stok Emas Tersedia Saat Ini — per Karat"}
            </p>

            {kadarKeysSisa.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {kadarKeysSisa.map((k) => (
                  <div key={k} className="flex flex-wrap items-center justify-between gap-3 bg-white/10 rounded-xl px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/20 font-bold text-sm">{k}</span>
                      <span className="text-xs opacity-70">{itemSisaPerKadar[k]} item</span>
                    </div>
                    <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm">
                      <span className="font-bold">{fmtGram(gramSisaPerKadar[k])}</span>
                      <span className="opacity-80">Modal: {fmtRp(modalPerKadar[k])}</span>
                      <span className="opacity-80">Jual: {fmtRp(jualPerKadar[k])}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-white/20">
              <div>
                <p className="text-4xl font-black">{fmtGram(totalGramSisa)}</p>
                <p className="text-xs opacity-60 mt-1">
                  TOTAL dari {sisaStok.length} item &bull; Periode: {label}
                </p>
              </div>
              <div className="flex gap-6 sm:gap-8 sm:text-right">
                <div>
                  <p className="text-xs opacity-70">Nilai Modal</p>
                  <p className="text-lg font-bold">{fmtRp(totalNilaiModal)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-70">Estimasi Nilai Jual</p>
                  <p className="text-lg font-bold">{fmtRp(totalNilaiJual)}</p>
                  <p className="text-xs opacity-60">Potensi Laba: {fmtRp(totalPotensiLaba)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Navigasi Tab ── */}
          <div className="overflow-x-auto no-print">
          <div className="grid grid-cols-5 gap-1 p-1 bg-gray-100 rounded-2xl min-w-[380px]">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 px-2 rounded-xl font-bold text-sm transition-all ${
                  tab === t.id
                    ? "bg-white text-gray-900"
                    : "text-gray-500 hover:text-amber-800 hover:bg-amber-50/70"
                }`}
                style={tab === t.id ? { boxShadow: "0 1px 3px rgba(0,0,0,0.08), inset 0 -3px 0 0 #C99A36" } : {}}
              >
                <span className="text-base sm:text-sm">{t.icon}</span>
                <span className="text-xs sm:text-sm leading-tight text-center">{t.label}</span>
              </button>
            ))}
          </div>
          </div>{/* overflow-x-auto */}
          </>
          )}

          {/* ══════════════════════════════════════════════════════
              KONTEN TAB
          ══════════════════════════════════════════════════════ */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 rounded-full animate-spin"
                  style={{ borderColor: "#C99A36", borderTopColor: "transparent" }} />
                <p className="text-gray-500 text-sm font-medium">Memuat data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* ══ TAB 1: SISA STOK ══ */}
              <div className={sectionCls("stok")}>
                <div className="mb-3">
                  <h2 className="font-bold text-gray-800 text-lg">Sisa Stok Tersedia</h2>
                  <p className="text-sm text-gray-500 print:hidden">
                    {periodeSudahLewat
                      ? `Rekonstruksi stok yang tersedia per akhir periode "${label}", berdasarkan tanggal masuk & riwayat barang keluar.`
                      : "Data real-time seluruh barang yang masih tersedia di toko."}
                  </p>
                  <p className="hidden print:block text-xs text-gray-500">
                    {periodeSudahLewat ? `Data stok per akhir periode ${label}` : `Data stok real-time per ${fmtTgl(new Date())}`} — {sisaStok.length} item &bull; {fmtGram(totalGramSisa)} &bull; Nilai Modal: {fmtRp(totalNilaiModal)}
                  </p>
                </div>

                <SearchBar
                  value={searchStok}
                  onChange={setSearchStok}
                  placeholder="Cari nama barang, kode, atau kadar..."
                />

                {searchStok && sisaStok.length > 0 && sisaStokFiltered.length === 0 && (
                  <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100 mb-4 no-print">
                    <p className="text-gray-400">Tidak ditemukan stok yang cocok dengan pencarian &quot;{searchStok}&quot;.</p>
                  </div>
                )}

                {sisaStok.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
                    <p className="text-gray-400 text-lg">
                      {periodeSudahLewat
                        ? `Tidak ada stok yang sudah tersedia per akhir periode "${label}".`
                        : "Tidak ada stok tersedia saat ini."}
                    </p>
                  </div>
                ) : (
                  <>
                    {(["Stock Dalam", "Stock Display", "Aset"] as const).map((jenis) => {
                      const rows = sisaStokFiltered.filter(
                        (r) => (r.jenis_inventori ?? "Stock Dalam") === jenis,
                      );
                      if (rows.length === 0) return null;
                      const tBerat = rows.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
                      const tModalPersen = weightedAvgPersen(rows, "persen_modal");
                      const tJualPersen = weightedAvgPersen(rows, "persen_jual");

                      // Kelompokkan baris per karat (dinormalisasi) supaya tiap kelompok
                      // bisa diberi baris subtotal sendiri, sebelum subtotal gabungan di bawah.
                      const rowsByKadar: Record<string, typeof rows> = {};
                      for (const r of rows) {
                        const k = normalizeKadar(r.kadar);
                        if (!rowsByKadar[k]) rowsByKadar[k] = [];
                        rowsByKadar[k].push(r);
                      }
                      const kadarKeysJenis = sortKadarDesc(Object.keys(rowsByKadar));

                      // Flat pagination per-baris supaya satu kadar besar (mis. 78 item 8K)
                      // tetap dipotong tiap 20 baris, bukan jadi satu halaman raksasa.
                      const allRowsFlat = kadarKeysJenis.flatMap((k) => rowsByKadar[k]);
                      const { pageItems: stokPageItems, totalPages: stokTotalPages, safePage: stokSafePage } =
                        paginateFlat(allRowsFlat, pageByKey[`jenis:${jenis}`] ?? 0, STOK_PAGE_SIZE);
                      // Regroup hasil halaman ini per-kadar agar subtotal per-kadar tetap tampil.
                      const pageRowsByKadar: Record<string, typeof rows> = {};
                      for (const r of stokPageItems) {
                        const k = normalizeKadar(r.kadar);
                        if (!pageRowsByKadar[k]) pageRowsByKadar[k] = [];
                        pageRowsByKadar[k].push(r);
                      }
                      const visibleKadarKeys = sortKadarDesc(Object.keys(pageRowsByKadar));
                      const visibleItemCount = stokPageItems.length;
                      let rowNo = stokSafePage * STOK_PAGE_SIZE;

                      return (
                        <div key={jenis} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2"
                            style={{ backgroundColor: "#FEFCE8" }}>
                            <div>
                              <h3 className="font-extrabold text-gray-900">{jenis}</h3>
                              <p className="text-sm text-gray-600">
                                {rows.length} item &bull; {fmtGram(tBerat)}
                              </p>
                            </div>
                            <div className="text-sm text-right">
                              <p className="text-gray-600">Rata-rata % Modal: <span className="font-bold">{fmtPersen(tModalPersen)}</span></p>
                              <p className="text-green-700">Rata-rata % Jual: <span className="font-bold">{fmtPersen(tJualPersen)}</span></p>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  {["No.", "Kode", "Nama Barang", "Kadar", "Berat/unit", "Jml", "Total Berat", "% Modal", "% Jual"].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {visibleKadarKeys.map((k) => {
                                  const groupRows = pageRowsByKadar[k];
                                  const kBerat = groupRows.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
                                  const kModalPersen = weightedAvgPersen(groupRows, "persen_modal");
                                  const kJualPersen = weightedAvgPersen(groupRows, "persen_jual");
                                  return (
                                    <Fragment key={k}>
                                      {groupRows.map((r) => {
                                        rowNo += 1;
                                        return (
                                          <tr key={r.id} className="group hover:bg-amber-100 transition-colors">
                                            <td className="px-4 py-3 text-xs text-gray-400">{rowNo}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{r.id_item}</td>
                                            <td className="px-4 py-3 font-semibold text-gray-800">{r.nama_produk}</td>
                                            <td className="px-4 py-3">
                                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 group-hover:bg-amber-300 group-hover:text-amber-950 transition-colors">
                                                {r.kadar}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{fmtGram(r.berat_gram)}</td>
                                            <td className="px-4 py-3 font-bold text-gray-900 text-center">{r.jumlah}</td>
                                            <td className="px-4 py-3 font-bold text-gray-900">{fmtGram(r.berat_gram * r.jumlah)}</td>
                                            <td className="px-4 py-3 text-gray-600">{fmtPersen(r.persen_modal)}</td>
                                            <td className="px-4 py-3 font-semibold text-green-700">{fmtPersen(r.persen_jual)}</td>
                                          </tr>
                                        );
                                      })}
                                      <tr key={`subtotal-${k}`} style={{ backgroundColor: "#FFFBEB" }}>
                                        <td colSpan={3} />
                                        <td className="px-4 py-2 text-xs font-extrabold text-amber-800">
                                          SUBTOTAL {k}
                                        </td>
                                        <td />
                                        <td className="px-4 py-2 text-xs font-bold text-gray-600 text-center">
                                          {groupRows.reduce((s, r) => s + r.jumlah, 0)}
                                        </td>
                                        <td className="px-4 py-2 text-xs font-extrabold text-gray-800">{fmtGram(kBerat)}</td>
                                        <td className="px-4 py-2 text-xs font-bold text-gray-600">{fmtPersen(kModalPersen)}</td>
                                        <td className="px-4 py-2 text-xs font-bold text-green-700">{fmtPersen(kJualPersen)}</td>
                                      </tr>
                                    </Fragment>
                                  );
                                })}
                              </tbody>
                              <tfoot style={{ backgroundColor: "#FEF9C3", borderTop: "2px solid #FDE047" }}>
                                <tr>
                                  <td colSpan={6} className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">
                                    SUBTOTAL {jenis} (Semua Karat)
                                  </td>
                                  <td className="px-4 py-3 font-extrabold text-gray-900">{fmtGram(tBerat)}</td>
                                  <td className="px-4 py-3 font-bold text-gray-700">{fmtPersen(tModalPersen)}</td>
                                  <td className="px-4 py-3 font-bold text-green-700">{fmtPersen(tJualPersen)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                          {stokTotalPages > 1 && (
                            <div className="no-print flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50 text-sm flex-wrap">
                              <p className="text-gray-500">
                                Menampilkan {visibleItemCount} dari {rows.length} item &bull; Halaman {stokSafePage + 1} dari {stokTotalPages}
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setPageByKey((p) => ({ ...p, [`jenis:${jenis}`]: Math.max(0, stokSafePage - 1) }))}
                                  disabled={stokSafePage === 0}
                                  className="px-3 py-1.5 rounded-lg border border-gray-300 font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                                >
                                  &lsaquo; Sebelumnya
                                </button>
                                <button
                                  onClick={() => setPageByKey((p) => ({ ...p, [`jenis:${jenis}`]: Math.min(stokTotalPages - 1, stokSafePage + 1) }))}
                                  disabled={stokSafePage === stokTotalPages - 1}
                                  className="px-3 py-1.5 rounded-lg border border-gray-300 font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                                >
                                  Selanjutnya &rsaquo;
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Grand total */}
                    <div
                      className="rounded-2xl p-5 text-white flex flex-wrap justify-between gap-4"
                      style={{ background: "linear-gradient(135deg, #6F5333 0%, #9A7248 100%)" }}
                    >
                      <div>
                        <p className="text-xs uppercase font-bold opacity-70 tracking-wider">Total Keseluruhan Stok</p>
                        <p className="text-3xl font-black mt-1">{fmtGram(totalGramSisa)}</p>
                        <p className="text-xs opacity-60 mt-0.5">{sisaStok.reduce((s, r) => s + r.jumlah, 0)} unit dari {sisaStok.length} item</p>
                      </div>
                      <div className="flex gap-6 sm:gap-8 text-right">
                        <div>
                          <p className="text-xs opacity-70">Total Modal</p>
                          <p className="text-lg font-bold">{fmtRp(totalNilaiModal)}</p>
                        </div>
                        <div>
                          <p className="text-xs opacity-70">Estimasi Nilai Jual</p>
                          <p className="text-lg font-bold">{fmtRp(totalNilaiJual)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Stok Menumpuk / Perlu Perhatian */}
                    {(() => {
                      const now = new Date();
                      const batasHari = 90;
                      const stokLama = sisaStokFiltered
                        .filter((r) => {
                          const selisih = Math.floor((now.getTime() - new Date(r.tanggal_masuk).getTime()) / 86400000);
                          return selisih >= batasHari;
                        })
                        .sort((a, b) => new Date(a.tanggal_masuk).getTime() - new Date(b.tanggal_masuk).getTime());
                      if (stokLama.length === 0) return null;
                      return (
                        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                          <div className="px-5 py-4 border-b border-orange-100 flex flex-wrap items-center justify-between gap-2"
                            style={{ backgroundColor: "#FFF7ED" }}>
                            <div>
                              <h3 className="font-extrabold text-orange-800">Stok Belum Terjual &ge; {batasHari} Hari</h3>
                              <p className="text-xs text-orange-600 mt-0.5">
                                {stokLama.length} item perlu perhatian — pertimbangkan penyesuaian harga atau promosi
                              </p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                              {fmtRp(stokLama.reduce((s, r) => s + (r.harga_beli || 0) * r.jumlah, 0))} modal tertahan
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-orange-50">
                                <tr>
                                  {["No.", "Kode", "Nama Barang", "Kadar", "Berat", "Jml", "Tgl Masuk", "Hari di Toko", "% Modal"].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-orange-700 whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-orange-50">
                                {stokLama.map((r, idx) => {
                                  const hari = Math.floor((now.getTime() - new Date(r.tanggal_masuk).getTime()) / 86400000);
                                  return (
                                    <tr key={r.id} className="group hover:bg-orange-100/70 transition-colors">
                                      <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.id_item}</td>
                                      <td className="px-4 py-3 font-semibold text-gray-800">{r.nama_produk}</td>
                                      <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 group-hover:bg-amber-300 group-hover:text-amber-950 transition-colors">{r.kadar}</span>
                                      </td>
                                      <td className="px-4 py-3 text-gray-600">{fmtGram(r.berat_gram)}</td>
                                      <td className="px-4 py-3 font-bold text-center">{r.jumlah}</td>
                                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtTglShort(r.tanggal_masuk)}</td>
                                      <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${hari >= 180 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                                          {hari} hari
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-gray-700">{fmtPersen(r.persen_modal)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* ══ TAB 2: STOK MASUK & KELUAR ══ */}
              <div className={sectionCls("transaksi")}>
                <div className="mb-3">
                  <h2 className="font-bold text-gray-800 text-lg">Stok Masuk &amp; Keluar</h2>
                  <p className="text-sm text-gray-500 print:hidden">Pergerakan stok selama periode: {label}</p>
                  <p className="hidden print:block text-xs text-gray-500">Periode: {label}</p>
                </div>

                <SearchBar
                  value={searchTransaksi}
                  onChange={setSearchTransaksi}
                  placeholder="Cari nama barang, kode, pelanggan, atau no. servis/gadai..."
                />

                <div className="space-y-4">
                  {/* Stok Masuk */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2"
                      style={{ backgroundColor: "#EFF6FF" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <h3 className="font-extrabold text-gray-900">Stok Masuk</h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {stokMasukFiltered.length} item &bull; {fmtGram(gramMasukF)} &bull; Nilai Beli: <span className="font-bold">{fmtRp(nilaiMasukF)}</span>
                      </p>
                    </div>
                    {stokMasuk.length === 0 ? (
                      <p className="px-5 py-8 text-center text-gray-400">
                        Tidak ada stok masuk pada periode ini.
                      </p>
                    ) : stokMasukFiltered.length === 0 ? (
                      <p className="px-5 py-8 text-center text-gray-400">
                        Tidak ditemukan yang cocok dengan pencarian.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-blue-50">
                            <tr>
                              {["No.", "Tanggal", "Kode", "Nama Barang", "Kadar", "Berat", "Jml", "Total Berat", "% Modal", "Supplier"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {(showPreview ? stokMasukFiltered : stokMasukPg.pageItems).map((r, idx) => (
                              <tr key={r.id} className="group hover:bg-blue-100/60 transition-colors">
                                <td className="px-4 py-3 text-xs text-gray-400">
                                  {(showPreview ? 0 : stokMasukPg.safePage * LIST_PAGE_SIZE) + idx + 1}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtTglShort(r.tanggal_masuk)}</td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.id_item}</td>
                                <td className="px-4 py-3 font-semibold text-gray-800">{r.nama_produk}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 group-hover:bg-amber-300 group-hover:text-amber-950 transition-colors">{r.kadar}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{fmtGram(r.berat_gram)}</td>
                                <td className="px-4 py-3 font-bold text-center">{r.jumlah}</td>
                                <td className="px-4 py-3 font-bold text-blue-700">{fmtGram(r.berat_gram * r.jumlah)}</td>
                                <td className="px-4 py-3 text-gray-700">{fmtPersen(r.persen_modal)}</td>
                                <td className="px-4 py-3 text-xs text-gray-500">{(r as StokRow & { supplier?: string }).supplier ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-blue-100" style={{ borderTop: "2px solid #BFDBFE" }}>
                            <tr>
                              <td colSpan={7} className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">TOTAL MASUK</td>
                              <td className="px-4 py-3 font-extrabold text-blue-700">{fmtGram(gramMasukF)}</td>
                              <td className="px-4 py-3 font-extrabold text-gray-800">{fmtRp(nilaiMasukF)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                    {!showPreview && (
                      <Pager
                        page={stokMasukPg.safePage}
                        totalPages={stokMasukPg.totalPages}
                        total={stokMasukFiltered.length}
                        pageSize={LIST_PAGE_SIZE}
                        onPrev={() => setPageByKey((p) => ({ ...p, masuk: Math.max(0, stokMasukPg.safePage - 1) }))}
                        onNext={() => setPageByKey((p) => ({ ...p, masuk: Math.min(stokMasukPg.totalPages - 1, stokMasukPg.safePage + 1) }))}
                      />
                    )}
                  </div>

                  {/* Stok Keluar */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2"
                      style={{ backgroundColor: "#FEF2F2" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <h3 className="font-extrabold text-gray-900">Stok Keluar</h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {stokKeluarFiltered.length} transaksi &bull; {fmtGram(gramKeluarF)} &bull; Penjualan: <span className="font-bold text-green-700">{fmtRp(nilaiPenjualanF)}</span>
                      </p>
                    </div>
                    {stokKeluar.length === 0 ? (
                      <p className="px-5 py-8 text-center text-gray-400">
                        Tidak ada stok keluar pada periode ini.
                      </p>
                    ) : stokKeluarFiltered.length === 0 ? (
                      <p className="px-5 py-8 text-center text-gray-400">
                        Tidak ditemukan yang cocok dengan pencarian.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-red-50">
                            <tr>
                              {["No.", "Tanggal", "Kode", "Nama Barang", "Kadar", "Berat/unit", "Jml", "Total Berat", "Status", "Nilai Jual"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {(showPreview ? stokKeluarFiltered : stokKeluarPg.pageItems).map((k, idx) => (
                              <tr key={k.id} className="group hover:bg-red-100/60 transition-colors">
                                <td className="px-4 py-3 text-xs text-gray-400">
                                  {(showPreview ? 0 : stokKeluarPg.safePage * LIST_PAGE_SIZE) + idx + 1}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtTglShort(k.created_at)}</td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{k.id_item}</td>
                                <td className="px-4 py-3 font-semibold text-gray-800">{k.nama_produk}</td>
                                <td className="px-4 py-3">
                                  {k.kadar !== "—" && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 group-hover:bg-amber-300 group-hover:text-amber-950 transition-colors">{k.kadar}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-gray-600">{fmtGram(k.berat_gram)}</td>
                                <td className="px-4 py-3 font-bold text-center">{k.jumlah_keluar}</td>
                                <td className="px-4 py-3 font-bold text-red-600">{fmtGram(k.berat_gram * k.jumlah_keluar)}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    k.status_baru === "Terjual" ? "bg-green-100 text-green-700" :
                                    k.status_baru === "Retur" ? "bg-pink-100 text-pink-700" :
                                    "bg-gray-100 text-gray-600"
                                  }`}>{k.status_baru}</span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-green-700">
                                  {k.status_baru === "Terjual" ? fmtRp(k.harga_jual * k.jumlah_keluar) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-red-100" style={{ borderTop: "2px solid #FECACA" }}>
                            <tr>
                              <td colSpan={7} className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">TOTAL KELUAR</td>
                              <td className="px-4 py-3 font-extrabold text-red-600">{fmtGram(gramKeluarF)}</td>
                              <td />
                              <td className="px-4 py-3 font-extrabold text-green-700">{fmtRp(nilaiPenjualanF)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                    {!showPreview && (
                      <Pager
                        page={stokKeluarPg.safePage}
                        totalPages={stokKeluarPg.totalPages}
                        total={stokKeluarFiltered.length}
                        pageSize={LIST_PAGE_SIZE}
                        onPrev={() => setPageByKey((p) => ({ ...p, keluar: Math.max(0, stokKeluarPg.safePage - 1) }))}
                        onNext={() => setPageByKey((p) => ({ ...p, keluar: Math.min(stokKeluarPg.totalPages - 1, stokKeluarPg.safePage + 1) }))}
                      />
                    )}
                  </div>

                  {/* Servis */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2"
                      style={{ backgroundColor: "#F5F3FF" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <h3 className="font-extrabold text-gray-900">Servis (Periode)</h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {servisListFiltered.length} servis &bull; Selesai: {servisSelesaiF.length} &bull; Pendapatan: <span className="font-bold text-green-700">{fmtRp(pendapatanServisF)}</span>
                      </p>
                    </div>
                    {servisList.length === 0 ? (
                      <p className="px-5 py-8 text-center text-gray-400">Tidak ada servis pada periode ini.</p>
                    ) : servisListFiltered.length === 0 ? (
                      <p className="px-5 py-8 text-center text-gray-400">Tidak ditemukan yang cocok dengan pencarian.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-purple-50">
                            <tr>
                              {["No.", "No. Servis", "Pelanggan", "Barang", "Jenis", "Biaya", "Status"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {(showPreview ? servisListFiltered : servisTransaksiPg.pageItems).map((s, idx) => (
                              <tr key={s.id} className="hover:bg-purple-100/60 transition-colors">
                                <td className="px-4 py-3 text-xs text-gray-400">
                                  {(showPreview ? 0 : servisTransaksiPg.safePage * LIST_PAGE_SIZE) + idx + 1}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.no_servis}</td>
                                <td className="px-4 py-3 text-gray-700">{s.pelanggan_nama}</td>
                                <td className="px-4 py-3 text-gray-800">{s.nama_barang}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    s.jenis_servis === "Perbaikan" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                                  }`}>{s.jenis_servis}</span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-green-700">{fmtRp(s.estimasi_biaya)}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    s.status === "Diambil" ? "bg-green-100 text-green-700" :
                                    s.status === "Selesai" ? "bg-blue-100 text-blue-700" :
                                    s.status === "Diproses" ? "bg-orange-100 text-orange-700" :
                                    "bg-gray-100 text-gray-600"
                                  }`}>{s.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-purple-100" style={{ borderTop: "2px solid #DDD6FE" }}>
                            <tr>
                              <td colSpan={5} className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">TOTAL PENDAPATAN SERVIS</td>
                              <td className="px-4 py-3 font-extrabold text-green-700">{fmtRp(pendapatanServisF)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                    {!showPreview && (
                      <Pager
                        page={servisTransaksiPg.safePage}
                        totalPages={servisTransaksiPg.totalPages}
                        total={servisListFiltered.length}
                        pageSize={LIST_PAGE_SIZE}
                        onPrev={() => setPageByKey((p) => ({ ...p, servisTransaksi: Math.max(0, servisTransaksiPg.safePage - 1) }))}
                        onNext={() => setPageByKey((p) => ({ ...p, servisTransaksi: Math.min(servisTransaksiPg.totalPages - 1, servisTransaksiPg.safePage + 1) }))}
                      />
                    )}
                  </div>

                  {/* Gadai */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2"
                      style={{ backgroundColor: "#F0FDFA" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-teal-500" />
                        <h3 className="font-extrabold text-gray-900">Gadai (Periode)</h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {gadaiListFiltered.length} gadai &bull; Lunas: {gadaiLunasF.length} &bull; Pendapatan Bunga: <span className="font-bold text-green-700">{fmtRp(pendapatanGadaiF)}</span>
                      </p>
                    </div>
                    {gadaiList.length === 0 ? (
                      <p className="px-5 py-8 text-center text-gray-400">Tidak ada gadai pada periode ini.</p>
                    ) : gadaiListFiltered.length === 0 ? (
                      <p className="px-5 py-8 text-center text-gray-400">Tidak ditemukan yang cocok dengan pencarian.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-teal-50">
                            <tr>
                              {["No.", "No. Gadai", "Pelanggan", "Barang", "Pinjaman", "Bunga", "Pendapatan Bunga", "Status"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {(showPreview ? gadaiListFiltered : gadaiTransaksiPg.pageItems).map((g, idx) => (
                              <tr key={g.id} className="hover:bg-teal-100/60 transition-colors">
                                <td className="px-4 py-3 text-xs text-gray-400">
                                  {(showPreview ? 0 : gadaiTransaksiPg.safePage * LIST_PAGE_SIZE) + idx + 1}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{g.no_gadai}</td>
                                <td className="px-4 py-3 text-gray-700">{g.pelanggan_nama}</td>
                                <td className="px-4 py-3 text-gray-800">{g.nama_barang}</td>
                                <td className="px-4 py-3 font-semibold text-gray-700">{fmtRp(g.nilai_pinjaman)}</td>
                                <td className="px-4 py-3 text-gray-600">{g.bunga_persen}%</td>
                                <td className="px-4 py-3 font-semibold text-green-700">
                                  {g.status === "Lunas" ? fmtRp(hitungTotalBunga(g.nilai_pinjaman, g.bunga_persen, g.jangka_waktu_bulan)) : "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    g.status === "Lunas" ? "bg-green-100 text-green-700" :
                                    g.status === "Aktif" ? "bg-blue-100 text-blue-700" :
                                    g.status === "Disita" ? "bg-red-100 text-red-700" :
                                    "bg-gray-100 text-gray-600"
                                  }`}>{g.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-teal-100" style={{ borderTop: "2px solid #99F6E4" }}>
                            <tr>
                              <td colSpan={6} className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">TOTAL PENDAPATAN BUNGA</td>
                              <td className="px-4 py-3 font-extrabold text-green-700">{fmtRp(pendapatanGadaiF)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                    {!showPreview && (
                      <Pager
                        page={gadaiTransaksiPg.safePage}
                        totalPages={gadaiTransaksiPg.totalPages}
                        total={gadaiListFiltered.length}
                        pageSize={LIST_PAGE_SIZE}
                        onPrev={() => setPageByKey((p) => ({ ...p, gadaiTransaksi: Math.max(0, gadaiTransaksiPg.safePage - 1) }))}
                        onNext={() => setPageByKey((p) => ({ ...p, gadaiTransaksi: Math.min(gadaiTransaksiPg.totalPages - 1, gadaiTransaksiPg.safePage + 1) }))}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* ══ TAB 3: LABA RUGI ══ */}
              <div className={sectionCls("laba_rugi", true)}>
                <div className="mb-3">
                  <h2 className="font-bold text-gray-800 text-lg">Laporan Laba Rugi</h2>
                  <p className="text-sm text-gray-500 print:hidden">Rekapitulasi pemasukan dan pengeluaran periode: {label}</p>
                  <p className="hidden print:block text-xs text-gray-500">Periode: {label}</p>
                </div>

                <div className="space-y-4">
                  {/* Pemasukan */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3"
                      style={{ backgroundColor: "#F0FDF4" }}>
                      <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-gray-900">Pemasukan</h3>
                        <p className="text-xs text-gray-500">Semua sumber pendapatan periode {label}</p>
                      </div>
                    </div>
                    <div>
                      {[
                        {
                          label: "Penjualan Barang Emas",
                          value: nilaiPenjualan,
                          detail: `${keluarTerjual.length} item terjual &bull; HPP: ${fmtRp(hppPenjualan)} &bull; Laba Kotor: ${fmtRp(nilaiPenjualan - hppPenjualan)}`,
                        },
                        {
                          label: "Pendapatan Jasa Servis",
                          value: pendapatanServis,
                          detail: `${servisSelesai.length} order selesai/diambil`,
                        },
                        {
                          label: "Bunga Gadai (Lunas)",
                          value: pendapatanGadai,
                          detail: `${gadaiLunas.length} gadai terlunasi`,
                        },
                      ].map((item) => (
                        <div key={item.label} className="px-5 py-4 flex items-center justify-between border-b border-gray-50 last:border-0">
                          <div>
                            <p className="font-semibold text-gray-800">{item.label}</p>
                            <p
                              className="text-xs text-gray-500 mt-0.5"
                              dangerouslySetInnerHTML={{ __html: item.detail }}
                            />
                          </div>
                          <p className="text-lg font-extrabold text-green-700 ml-4 shrink-0">{fmtRp(item.value)}</p>
                        </div>
                      ))}
                      <div
                        className="px-5 py-4 flex items-center justify-between"
                        style={{ backgroundColor: "#DCFCE7", borderTop: "2px solid #86EFAC" }}
                      >
                        <p className="font-extrabold text-gray-900 text-base">TOTAL PEMASUKAN</p>
                        <p className="text-2xl font-black text-green-700">{fmtRp(totalPemasukan)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Pengeluaran */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3"
                      style={{ backgroundColor: "#FEF2F2" }}>
                      <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-gray-900">Pengeluaran</h3>
                        <p className="text-xs text-gray-500">Modal yang dikeluarkan periode {label}</p>
                      </div>
                    </div>
                    <div>
                      {[
                        {
                          label: "Pembelian Stok dari Supplier",
                          value: nilaiMasukReguler,
                          detail: `${stokMasukReguler.length} item dibeli &bull; ${fmtGram(gramMasukReguler)} total`,
                        },
                        {
                          label: "Buyback Emas Rosok",
                          value: nilaiMasukRosok,
                          detail: `${stokMasukRosok.length} item dibeli &bull; ${fmtGram(gramMasukRosok)} total`,
                        },
                      ].map((item) => (
                        <div key={item.label} className="px-5 py-4 flex items-center justify-between border-b border-gray-50 last:border-0">
                          <div>
                            <p className="font-semibold text-gray-800">{item.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                          </div>
                          <p className="text-lg font-extrabold text-red-600 ml-4 shrink-0">{fmtRp(item.value)}</p>
                        </div>
                      ))}
                      <div
                        className="px-5 py-4 flex items-center justify-between"
                        style={{ backgroundColor: "#FEE2E2", borderTop: "2px solid #FCA5A5" }}
                      >
                        <p className="font-extrabold text-gray-900 text-base">TOTAL PENGELUARAN</p>
                        <p className="text-2xl font-black text-red-600">{fmtRp(totalPengeluaran)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Laba Bersih */}
                  <div
                    className="rounded-2xl p-6 text-white"
                    style={{
                      background: labaBersih >= 0
                        ? "linear-gradient(135deg, #16A34A 0%, #22C55E 100%)"
                        : "linear-gradient(135deg, #DC2626 0%, #EF4444 100%)",
                    }}
                  >
                    <p className="text-sm font-bold opacity-80 uppercase tracking-wider">
                      Laba Bersih — {label}
                    </p>
                    <p className="text-5xl font-black mt-2">{fmtRp(Math.abs(labaBersih))}</p>
                    <p className="text-base font-semibold opacity-80 mt-1">
                      {labaBersih >= 0 ? "Toko mengalami KEUNTUNGAN" : "Toko mengalami KERUGIAN"} pada periode ini
                    </p>
                    <div className="flex gap-8 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.3)" }}>
                      <div>
                        <p className="text-xs opacity-70">Pemasukan</p>
                        <p className="text-lg font-bold">{fmtRp(totalPemasukan)}</p>
                      </div>
                      <div>
                        <p className="text-xs opacity-70">Pengeluaran</p>
                        <p className="text-lg font-bold">{fmtRp(totalPengeluaran)}</p>
                      </div>
                      <div>
                        <p className="text-xs opacity-70">Margin</p>
                        <p className="text-lg font-bold">
                          {totalPemasukan > 0
                            ? ((labaBersih / totalPemasukan) * 100).toFixed(1) + "%"
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tren Laba Rugi per Periode */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3"
                      style={{ backgroundColor: "#F8F7F4" }}>
                      <div>
                        <h3 className="font-extrabold text-gray-900">Tren Laba Rugi per Periode</h3>
                        <p className="text-xs text-gray-500 mt-0.5 print:hidden">
                          Rincian pemasukan &amp; pengeluaran dalam periode {label}, dikelompokkan per {GROUP_BY_OPTIONS.find(([g]) => g === groupBy)?.[1].toLowerCase()}.
                        </p>
                        <p className="hidden print:block text-xs text-gray-500 mt-0.5">
                          Dikelompokkan per {GROUP_BY_OPTIONS.find(([g]) => g === groupBy)?.[1].toLowerCase()}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-wrap no-print">
                        {GROUP_BY_OPTIONS.map(([g, l]) => (
                          <button
                            key={g}
                            onClick={() => setGroupBy(g)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                              groupBy === g
                                ? "text-white border-transparent"
                                : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                            }`}
                            style={groupBy === g ? { backgroundColor: "#6F5333" } : {}}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    {trendRows.length === 0 ? (
                      <p className="px-5 py-8 text-center text-gray-400">Tidak ada transaksi untuk dikelompokkan pada periode ini.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              {["No.", "Periode", "Pemasukan", "Pengeluaran", "Laba Bersih", "Margin %"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {trendRows.map((r, idx) => (
                              <tr key={r.key} className="hover:bg-gray-50/60">
                                <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                                <td className="px-4 py-3 font-semibold text-gray-800 capitalize whitespace-nowrap">{r.label}</td>
                                <td className="px-4 py-3 font-semibold text-green-700">{fmtRp(r.pemasukan)}</td>
                                <td className="px-4 py-3 font-semibold text-red-600">{fmtRp(r.pengeluaran)}</td>
                                <td className={`px-4 py-3 font-extrabold ${r.laba >= 0 ? "text-green-700" : "text-red-600"}`}>
                                  {r.laba >= 0 ? "+" : "−"}{fmtRp(Math.abs(r.laba))}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {r.pemasukan > 0 ? ((r.laba / r.pemasukan) * 100).toFixed(1) + "%" : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ backgroundColor: "#F3F4F6", borderTop: "2px solid #D1D5DB" }}>
                            <tr>
                              <td colSpan={2} className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">
                                TOTAL ({trendRows.length} {GROUP_BY_OPTIONS.find(([g]) => g === groupBy)?.[1].toLowerCase()})
                              </td>
                              <td className="px-4 py-3 font-extrabold text-green-700">{fmtRp(totalPemasukan)}</td>
                              <td className="px-4 py-3 font-extrabold text-red-600">{fmtRp(totalPengeluaran)}</td>
                              <td className={`px-4 py-3 font-extrabold ${labaBersih >= 0 ? "text-green-700" : "text-red-600"}`}>
                                {labaBersih >= 0 ? "+" : "−"}{fmtRp(Math.abs(labaBersih))}
                              </td>
                              <td className="px-4 py-3 font-extrabold text-gray-700">
                                {totalPemasukan > 0 ? ((labaBersih / totalPemasukan) * 100).toFixed(1) + "%" : "—"}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ══ TAB 4: NILAI ASET ══ */}
              <div className={sectionCls("aset", true)}>
                <div className="mb-3">
                  <h2 className="font-bold text-gray-800 text-lg">Nilai Aset &amp; Modal</h2>
                  <p className="text-sm text-gray-500 print:hidden">
                    {periodeSudahLewat
                      ? `Distribusi nilai stok & modal tertahan per akhir periode "${label}".`
                      : "Distribusi nilai stok berdasarkan kadar dan kategori."}
                  </p>
                  <p className="hidden print:block text-xs text-gray-500">
                    {periodeSudahLewat ? `Data per akhir periode ${label}` : `Data real-time per ${fmtTgl(new Date())}`}
                  </p>
                </div>

                <SearchBar
                  value={searchAset}
                  onChange={setSearchAset}
                  placeholder="Cari pelanggan, barang, atau no. gadai/servis..."
                />

                <div className="space-y-4">
                  {/* Per Kadar */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100" style={{ backgroundColor: "#FEFCE8" }}>
                      <h3 className="font-extrabold text-gray-900">Nilai Aset per Kadar Emas</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {periodeSudahLewat ? `Berdasarkan stok yang tersedia per akhir periode "${label}"` : "Berdasarkan seluruh stok tersedia saat ini"}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-amber-50">
                          <tr>
                            {["Kadar", "Jumlah Item", "Total Unit", "Total Gram", "Rata-rata % Modal", "Rata-rata % Jual", "Margin %"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(() => {
                            const byKadar = sisaStok.reduce((acc, r) => {
                              if (!acc[r.kadar]) acc[r.kadar] = [];
                              acc[r.kadar].push(r);
                              return acc;
                            }, {} as Record<string, StokRow[]>);
                            return Object.entries(byKadar)
                              .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                              .map(([kadar, rows]) => {
                                const gram = rows.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
                                const modalPersen = weightedAvgPersen(rows, "persen_modal");
                                const jualPersen = weightedAvgPersen(rows, "persen_jual");
                                return (
                                  <tr key={kadar} className="group hover:bg-amber-100 transition-colors">
                                    <td className="px-4 py-3">
                                      <span className="px-3 py-1 rounded-full font-black text-sm bg-amber-100 text-amber-900 group-hover:bg-amber-300 group-hover:text-amber-950 transition-colors">{kadar}</span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{rows.length}</td>
                                    <td className="px-4 py-3 font-semibold text-gray-800">{rows.reduce((s, r) => s + r.jumlah, 0)}</td>
                                    <td className="px-4 py-3 font-extrabold text-gray-900">{fmtGram(gram)}</td>
                                    <td className="px-4 py-3 text-gray-600">{fmtPersen(modalPersen)}</td>
                                    <td className="px-4 py-3 font-semibold text-green-700">{fmtPersen(jualPersen)}</td>
                                    <td className="px-4 py-3 font-semibold text-blue-700">{fmtPersen(jualPersen - modalPersen)}</td>
                                  </tr>
                                );
                              });
                          })()}
                        </tbody>
                        <tfoot style={{ backgroundColor: "#FEF9C3", borderTop: "2px solid #FDE047" }}>
                          <tr>
                            <td className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">TOTAL</td>
                            <td className="px-4 py-3 font-extrabold text-gray-800">{sisaStok.length}</td>
                            <td className="px-4 py-3 font-extrabold text-gray-800">{sisaStok.reduce((s, r) => s + r.jumlah, 0)}</td>
                            <td className="px-4 py-3 font-extrabold text-gray-900">{fmtGram(totalGramSisa)}</td>
                            <td className="px-4 py-3 font-extrabold text-gray-700">{fmtPersen(weightedAvgPersen(sisaStok, "persen_modal"))}</td>
                            <td className="px-4 py-3 font-extrabold text-green-700">{fmtPersen(weightedAvgPersen(sisaStok, "persen_jual"))}</td>
                            <td className="px-4 py-3 font-extrabold text-blue-700">
                              {fmtPersen(weightedAvgPersen(sisaStok, "persen_jual") - weightedAvgPersen(sisaStok, "persen_modal"))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Per Kategori */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="font-extrabold text-gray-900">Nilai Aset per Kategori Barang</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {["Kategori", "Jumlah Item", "Total Unit", "Total Gram", "Rata-rata % Modal", "Rata-rata % Jual", "Margin %"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(() => {
                            const byKat = sisaStok.reduce((acc, r) => {
                              const k = r.kategori || "Lainnya";
                              if (!acc[k]) acc[k] = [];
                              acc[k].push(r);
                              return acc;
                            }, {} as Record<string, StokRow[]>);
                            return Object.entries(byKat)
                              .sort((a, b) => {
                                const gramA = a[1].reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
                                const gramB = b[1].reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
                                return gramB - gramA;
                              })
                              .map(([kat, rows]) => {
                                const gram = rows.reduce((s, r) => s + r.berat_gram * r.jumlah, 0);
                                const modalPersen = weightedAvgPersen(rows, "persen_modal");
                                const jualPersen = weightedAvgPersen(rows, "persen_jual");
                                return (
                                  <tr key={kat} className="hover:bg-gray-50/60">
                                    <td className="px-4 py-3 font-semibold text-gray-800">{kat}</td>
                                    <td className="px-4 py-3 text-gray-700">{rows.length}</td>
                                    <td className="px-4 py-3 font-semibold text-gray-800">{rows.reduce((s, r) => s + r.jumlah, 0)}</td>
                                    <td className="px-4 py-3 font-extrabold text-gray-900">{fmtGram(gram)}</td>
                                    <td className="px-4 py-3 text-gray-600">{fmtPersen(modalPersen)}</td>
                                    <td className="px-4 py-3 font-semibold text-green-700">{fmtPersen(jualPersen)}</td>
                                    <td className="px-4 py-3 font-semibold text-blue-700">{fmtPersen(jualPersen - modalPersen)}</td>
                                  </tr>
                                );
                              });
                          })()}
                        </tbody>
                        <tfoot className="bg-gray-100" style={{ borderTop: "2px solid #E5E7EB" }}>
                          <tr>
                            <td className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">TOTAL</td>
                            <td className="px-4 py-3 font-extrabold text-gray-800">{sisaStok.length}</td>
                            <td className="px-4 py-3 font-extrabold text-gray-800">{sisaStok.reduce((s, r) => s + r.jumlah, 0)}</td>
                            <td className="px-4 py-3 font-extrabold text-gray-900">{fmtGram(totalGramSisa)}</td>
                            <td className="px-4 py-3 font-extrabold text-gray-700">{fmtPersen(weightedAvgPersen(sisaStok, "persen_modal"))}</td>
                            <td className="px-4 py-3 font-extrabold text-green-700">{fmtPersen(weightedAvgPersen(sisaStok, "persen_jual"))}</td>
                            <td className="px-4 py-3 font-extrabold text-blue-700">
                              {fmtPersen(weightedAvgPersen(sisaStok, "persen_jual") - weightedAvgPersen(sisaStok, "persen_modal"))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Gadai Aktif — disaring ke gadai yang sudah diajukan per akhir periode */}
                  {gadaiAktifAsOf.length > 0 && (() => {
                    if (searchAset && gadaiAktifSemuaFiltered.length === 0) {
                      return (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                          <p className="text-gray-400">Tidak ditemukan gadai aktif yang cocok dengan pencarian.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2"
                          style={{ backgroundColor: "#FFF7ED" }}>
                          <div>
                            <h3 className="font-extrabold text-gray-900">
                              {periodeSudahLewat ? `Modal Tertahan — Gadai Aktif per ${label}` : "Modal Tertahan — Gadai Aktif Saat Ini"}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {gadaiAktifSemuaFiltered.length} nasabah &bull; Potensi bunga: <span className="font-bold text-green-700">{fmtRp(totalBungaPotensialF)}</span>
                            </p>
                          </div>
                          <span className="text-lg font-black text-orange-600">{fmtRp(totalGadaiAktifF)}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-orange-50">
                              <tr>
                                {["No.", "No. Gadai", "Pelanggan", "Barang", "Tgl Gadai", "Pinjaman", "Bunga", "Pot. Bunga", "Status"].map((h) => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-orange-700 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {gadaiAktifSemuaFiltered.map((g, idx) => (
                                <tr key={g.id} className="hover:bg-orange-100/60 transition-colors">
                                  <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{g.no_gadai}</td>
                                  <td className="px-4 py-3 font-semibold text-gray-800">{g.pelanggan_nama}</td>
                                  <td className="px-4 py-3 text-gray-700">{g.nama_barang}</td>
                                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtTglShort(g.tanggal_gadai)}</td>
                                  <td className="px-4 py-3 font-semibold text-gray-800">{fmtRp(g.nilai_pinjaman)}</td>
                                  <td className="px-4 py-3 text-gray-600">{g.bunga_persen}%</td>
                                  <td className="px-4 py-3 font-semibold text-green-700">{fmtRp(hitungTotalBunga(g.nilai_pinjaman, g.bunga_persen, g.jangka_waktu_bulan))}</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                      g.status === "Aktif" ? "bg-blue-100 text-blue-700" :
                                      g.status === "Menunggu" ? "bg-yellow-100 text-yellow-700" :
                                      "bg-gray-100 text-gray-600"
                                    }`}>{g.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot style={{ backgroundColor: "#FFF7ED", borderTop: "2px solid #FED7AA" }}>
                              <tr>
                                <td colSpan={5} className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">TOTAL MODAL TERTAHAN</td>
                                <td className="px-4 py-3 font-extrabold text-orange-600">{fmtRp(totalGadaiAktifF)}</td>
                                <td />
                                <td className="px-4 py-3 font-extrabold text-green-700">{fmtRp(totalBungaPotensialF)}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Servis Dalam Proses — disaring ke servis yang sudah masuk per akhir periode */}
                  {servisPendingAsOf.length > 0 && (() => {
                    const now = new Date();
                    if (searchAset && servisPendingFiltered.length === 0) {
                      return (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                          <p className="text-gray-400">Tidak ditemukan servis dalam proses yang cocok dengan pencarian.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2"
                          style={{ backgroundColor: "#F5F3FF" }}>
                          <div>
                            <h3 className="font-extrabold text-gray-900">Servis Dalam Proses / Menunggu</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {servisPendingFiltered.length} order belum selesai &bull; Estimasi pendapatan: <span className="font-bold text-green-700">{fmtRp(totalNilaiServisPendingF)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-purple-50">
                              <tr>
                                {["No.", "No. Servis", "Pelanggan", "Barang", "Jenis", "Tgl Masuk", "Hari Tunggu", "Est. Biaya", "Status"].map((h) => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-purple-700 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {servisPendingFiltered.map((s, idx) => {
                                const hari = Math.floor((now.getTime() - new Date(s.tanggal_masuk).getTime()) / 86400000);
                                return (
                                  <tr key={s.id} className="hover:bg-purple-100/60 transition-colors">
                                    <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.no_servis}</td>
                                    <td className="px-4 py-3 font-semibold text-gray-800">{s.pelanggan_nama}</td>
                                    <td className="px-4 py-3 text-gray-700">{s.nama_barang}</td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                        s.jenis_servis === "Perbaikan" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                                      }`}>{s.jenis_servis}</span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtTglShort(s.tanggal_masuk)}</td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${hari >= 14 ? "bg-red-100 text-red-700" : hari >= 7 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                                        {hari} hari
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-green-700">{fmtRp(s.estimasi_biaya)}</td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                        s.status === "Diproses" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
                                      }`}>{s.status}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot style={{ backgroundColor: "#F5F3FF", borderTop: "2px solid #DDD6FE" }}>
                              <tr>
                                <td colSpan={7} className="px-4 py-3 font-extrabold text-gray-800 text-xs uppercase">TOTAL ESTIMASI PENDAPATAN</td>
                                <td className="px-4 py-3 font-extrabold text-green-700">{fmtRp(totalNilaiServisPendingF)}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Ringkasan Modal */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 print:hidden">
                    <h3 className="font-extrabold text-gray-900 mb-4">Ringkasan Modal Keseluruhan</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        {
                          label: "Modal dalam Stok", value: totalNilaiModal,
                          persen: weightedAvgPersen(sisaStok, "persen_modal"),
                          color: "bg-amber-50 text-amber-900", border: "border-amber-200",
                        },
                        {
                          label: "Estimasi Nilai Jual Stok", value: totalNilaiJual,
                          persen: weightedAvgPersen(sisaStok, "persen_jual"),
                          color: "bg-green-50 text-green-800", border: "border-green-200",
                        },
                        {
                          label: "Potensi Laba dari Stok", value: totalPotensiLaba,
                          persen: weightedAvgPersen(sisaStok, "persen_jual") - weightedAvgPersen(sisaStok, "persen_modal"),
                          color: "bg-blue-50 text-blue-800", border: "border-blue-200",
                        },
                      ].map((c) => (
                        <div key={c.label} className={`rounded-xl p-4 border ${c.color} ${c.border}`}>
                          <p className="text-xs font-semibold opacity-70 mb-1.5">{c.label}</p>
                          <p className="text-xl font-black">{fmtRp(c.value)}</p>
                          <p className="text-xs font-semibold opacity-70 mt-1">Rata-rata: {fmtPersen(c.persen)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ TAB 5: LOG TRANSAKSI ══ */}
              {(() => {
                const txFiltered = allTx.filter((tx) => matchSearch([tx.title, tx.sub, tx.note, tx.status], searchLog));

                const grouped = txFiltered.reduce<Record<string, typeof allTx>>((acc, tx) => {
                  const key = tx.date.toLocaleDateString("id-ID", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  });
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(tx);
                  return acc;
                }, {});

                const totalMasuk = allTx.filter((t) => t.isDebit).reduce((s, t) => s + t.nilai, 0);
                const totalKeluar = allTx.filter((t) => !t.isDebit && t.nilai > 0).reduce((s, t) => s + t.nilai, 0);

                // Flat pagination per-transaksi supaya satu tanggal ramai tidak jadi halaman raksasa.
                const { pageItems: logPageItems, totalPages: logTotalPages, safePage: logSafePage } =
                  paginateFlat(txFiltered, pageByKey["log"] ?? 0, LIST_PAGE_SIZE);
                const pageGrouped = logPageItems.reduce<Record<string, typeof allTx>>((acc, tx) => {
                  const key = tx.date.toLocaleDateString("id-ID", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  });
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(tx);
                  return acc;
                }, {});
                const visibleDateKeys = Object.keys(pageGrouped);
                const visibleTxCount = logPageItems.length;

                return (
                  <div className={sectionCls("log", true)}>
                    <div className="mb-3">
                      <h2 className="font-bold text-gray-800 text-lg">Log Seluruh Transaksi</h2>
                      <p className="text-sm text-gray-500 print:hidden">Semua aktivitas pada periode: {label}</p>
                      <p className="hidden print:block text-xs text-gray-500">Periode: {label}</p>
                    </div>

                    <SearchBar
                      value={searchLog}
                      onChange={setSearchLog}
                      placeholder="Cari nama, kode, atau catatan transaksi..."
                    />

                    {allTx.length === 0 ? (
                      <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
                        <p className="text-4xl mb-3">📭</p>
                        <p className="text-gray-400 font-semibold">Tidak ada transaksi pada periode ini.</p>
                      </div>
                    ) : txFiltered.length === 0 ? (
                      <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
                        <p className="text-gray-400 font-semibold">Tidak ditemukan transaksi yang cocok dengan pencarian &quot;{searchLog}&quot;.</p>
                      </div>
                    ) : (
                      <>
                        {/* Strip ringkasan */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                          {[
                            { label: "Total Transaksi", value: allTx.length + " aktivitas", sub: "", color: "border-gray-300" },
                            { label: "Stok Masuk", value: stokMasuk.length + " item", sub: fmtRp(totalMasuk), color: "border-blue-400" },
                            { label: "Stok Keluar", value: stokKeluar.length + " item", sub: fmtRp(nilaiPenjualan) + " penjualan", color: "border-red-400" },
                            { label: "Servis + Gadai", value: (servisList.length + gadaiList.length) + " aktivitas", sub: fmtRp(pendapatanServis + pendapatanGadai) + " pendapatan", color: "border-purple-400" },
                          ].map((c) => (
                            <div key={c.label} className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 border-l-4 ${c.color}`}>
                              <p className="text-xs text-gray-500 font-semibold mb-1">{c.label}</p>
                              <p className="text-base font-extrabold text-gray-900">{c.value}</p>
                              {c.sub && <p className="text-xs text-gray-500 mt-0.5">{c.sub}</p>}
                            </div>
                          ))}
                        </div>

                        {/* Grouped list */}
                        <div className="space-y-4">
                          {visibleDateKeys.map((dateLabel) => {
                            const txs = pageGrouped[dateLabel];
                            const dayIn = txs.filter((t) => t.isDebit).reduce((s, t) => s + t.nilai, 0);
                            const dayOut = txs.filter((t) => !t.isDebit && t.nilai > 0).reduce((s, t) => s + t.nilai, 0);
                            return (
                              <div key={dateLabel} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                {/* Date header */}
                                <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100"
                                  style={{ backgroundColor: "#F8F7F4" }}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#C99A36" }} />
                                    <span className="font-extrabold text-gray-800 text-sm capitalize">{dateLabel}</span>
                                    <span className="text-xs text-gray-400 ml-1">{txs.length} transaksi</span>
                                  </div>
                                  <div className="flex gap-4 text-xs">
                                    {dayIn > 0 && (
                                      <span className="text-red-600 font-semibold">Keluar: {fmtRp(dayIn)}</span>
                                    )}
                                    {dayOut > 0 && (
                                      <span className="text-green-700 font-semibold">Masuk: {fmtRp(dayOut)}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Transaction rows */}
                                <div className="divide-y divide-gray-50">
                                  {txs.map((tx) => {
                                    const meta = TX_META[tx.kind];
                                    const jam = tx.date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                                    return (
                                      <div key={tx.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50/60 transition-colors">
                                        {/* Dot */}
                                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${meta.bg} ${meta.text}`}>
                                              {meta.label}
                                            </span>
                                            <span className="font-semibold text-gray-800 text-sm truncate">{tx.title}</span>
                                          </div>
                                          <p className="text-xs text-gray-500 truncate">{tx.sub}</p>
                                          {tx.note && (
                                            <p className="text-xs text-gray-400 mt-0.5 italic truncate">{tx.note}</p>
                                          )}
                                          <p className="text-xs text-gray-400 mt-0.5">{jam}</p>
                                        </div>

                                        {/* Nilai & Status */}
                                        <div className="text-right shrink-0">
                                          {tx.nilai > 0 && (
                                            <p className={`font-extrabold text-sm ${tx.isDebit ? "text-red-600" : "text-green-700"}`}>
                                              {tx.isDebit ? "−" : "+"}{fmtRp(tx.nilai)}
                                            </p>
                                          )}
                                          {tx.nilai > 0 && (
                                            <p className="text-xs text-gray-400">{tx.nilaiLabel}</p>
                                          )}
                                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                            tx.status === "Terjual" || tx.status === "Diambil" || tx.status === "Selesai" || tx.status === "Lunas"
                                              ? "bg-green-100 text-green-700"
                                              : tx.status === "Masuk"
                                                ? "bg-blue-100 text-blue-700"
                                                : tx.status === "Retur"
                                                  ? "bg-pink-100 text-pink-700"
                                                  : tx.status === "Diproses" || tx.status === "Menunggu" || tx.status === "Aktif"
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : "bg-gray-100 text-gray-600"
                                          }`}>
                                            {tx.status}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {logTotalPages > 1 && (
                          <div className="no-print flex items-center justify-between gap-3 px-5 py-3 mt-4 rounded-xl border border-gray-200 bg-white shadow-sm text-sm flex-wrap">
                            <p className="text-gray-500">
                              Menampilkan {visibleTxCount} dari {txFiltered.length} transaksi &bull; Halaman {logSafePage + 1} dari {logTotalPages}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setPageByKey((p) => ({ ...p, log: Math.max(0, logSafePage - 1) }))}
                                disabled={logSafePage === 0}
                                className="px-3 py-1.5 rounded-lg border border-gray-300 font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                              >
                                &lsaquo; Sebelumnya
                              </button>
                              <button
                                onClick={() => setPageByKey((p) => ({ ...p, log: Math.min(logTotalPages - 1, logSafePage + 1) }))}
                                disabled={logSafePage === logTotalPages - 1}
                                className="px-3 py-1.5 rounded-lg border border-gray-300 font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                              >
                                Selanjutnya &rsaquo;
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Total footer */}
                        <div
                          className="rounded-2xl p-5 flex flex-wrap justify-between gap-4 text-white mt-4"
                          style={{ background: "linear-gradient(135deg, #6F5333 0%, #9A7248 100%)" }}
                        >
                          <div>
                            <p className="text-xs opacity-70 uppercase tracking-wider font-bold">Ringkasan Periode</p>
                            <p className="text-2xl font-black mt-1">{allTx.length} aktivitas</p>
                            <p className="text-xs opacity-60 mt-0.5">{label}</p>
                          </div>
                          <div className="flex gap-6 sm:gap-10 text-right">
                            <div>
                              <p className="text-xs opacity-70">Modal Keluar</p>
                              <p className="text-lg font-bold">{fmtRp(totalMasuk)}</p>
                              <p className="text-xs opacity-60">{stokMasuk.length} stok masuk</p>
                            </div>
                            <div>
                              <p className="text-xs opacity-70">Total Pendapatan</p>
                              <p className="text-lg font-bold">{fmtRp(totalKeluar)}</p>
                              <p className="text-xs opacity-60">Jual + Servis + Bunga</p>
                            </div>
                            <div>
                              <p className="text-xs opacity-70">Laba Bersih</p>
                              <p className={`text-lg font-bold ${labaBersih >= 0 ? "text-green-300" : "text-red-300"}`}>
                                {labaBersih >= 0 ? "+" : "−"}{fmtRp(Math.abs(labaBersih))}
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </AppLayout>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   EXPORT UTAMA — Gate PIN
═══════════════════════════════════════════════════════ */
export default function KeuanganPage() {
  return (
    <PinGate pageTitle="Halaman Keuangan">
      {({ lock, openChangePin }) => (
        <KeuanganContent onLock={lock} onOpenChangePin={openChangePin} />
      )}
    </PinGate>
  );
}
