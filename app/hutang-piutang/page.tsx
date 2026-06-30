"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import PinGate from "@/components/PinGate";
import { createClient } from "@/lib/supabase/client";
import { fmtRupiah, fmtTanggal, jenisHutangLabel } from "@/lib/hutangPiutang";

/* ─── Types ─── */
interface HutangRow {
  id: string;
  no_hutang: string;
  jenis_hutang: string;
  nama: string;
  kategori: string;
  harga_total: number;
  pembayaran_pelunasan: string | null;
  status: string;
  tanggal_jatuh_tempo: string;
  tanggal_pelunasan: string | null;
  created_at: string;
}

interface PiutangRow {
  id: string;
  no_piutang: string;
  sumber: string;
  nama_debitur: string;
  kategori: string;
  jumlah_piutang: number;
  status: string;
  tanggal_jatuh_tempo: string;
  tanggal_pelunasan: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

function StatusBadge({ status }: { status: string }) {
  const isLunas = status === "Lunas";
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
      isLunas ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-600 border border-red-200"
    }`}>
      {status}
    </span>
  );
}

function HutangPiutangContent({ onLock, onOpenChangePin }: {
  onLock: () => void;
  onOpenChangePin: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<"hutang" | "piutang">("hutang");
  const [hutangList, setHutangList] = useState<HutangRow[]>([]);
  const [piutangList, setPiutangList] = useState<PiutangRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: hutang }, { data: piutang }] = await Promise.all([
      supabase.from("hutang").select("*").order("created_at", { ascending: false }),
      supabase.from("piutang").select("*").order("created_at", { ascending: false }),
    ]);
    setHutangList((hutang ?? []) as HutangRow[]);
    setPiutangList((piutang ?? []) as PiutangRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const filteredHutang = useMemo(() => {
    if (!search.trim()) return hutangList;
    const q = search.toLowerCase();
    return hutangList.filter((h) =>
      h.nama.toLowerCase().includes(q) ||
      h.kategori.toLowerCase().includes(q) ||
      h.no_hutang.toLowerCase().includes(q)
    );
  }, [hutangList, search]);

  const filteredPiutang = useMemo(() => {
    if (!search.trim()) return piutangList;
    const q = search.toLowerCase();
    return piutangList.filter((p) =>
      p.nama_debitur.toLowerCase().includes(q) ||
      p.kategori.toLowerCase().includes(q) ||
      p.no_piutang.toLowerCase().includes(q)
    );
  }, [piutangList, search]);

  const filtered = tab === "hutang" ? filteredHutang : filteredPiutang;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedHutang = filteredHutang.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedPiutang = filteredPiutang.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function switchTab(t: "hutang" | "piutang") {
    setTab(t);
    setSearch("");
    setPage(1);
  }

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="px-4 sm:px-6 pt-6 pb-10 space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
                Hutang &amp; Piutang Usaha
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Lacak hutang/pinjaman yang dilakukan toko dan piutang/pinjaman yang diberikan oleh toko.
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

          {/* Tabs */}
          <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
            {(["hutang", "piutang"] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold capitalize transition-all ${
                  tab === t ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
                style={tab === t ? { color: "#6F5333" } : {}}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-wrap gap-3">
              <h2 className="text-lg font-bold text-gray-800 capitalize">{tab}</h2>
              {tab === "hutang" ? (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => router.push("/hutang-piutang/tambah?jenis=supplier")}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: "#6F5333" }}
                  >
                    <span className="text-base leading-none font-bold">+</span> Hutang Supplier &amp; Sales
                  </button>
                  <button
                    onClick={() => router.push("/hutang-piutang/tambah?jenis=operasional")}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors hover:bg-amber-50"
                    style={{ borderColor: "#6F5333", color: "#6F5333" }}
                  >
                    <span className="text-base leading-none font-bold">+</span> Hutang Operasional &amp; Pihak ke-3
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push("/hutang-piutang/tambah-piutang")}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "#6F5333" }}
                >
                  <span className="text-base leading-none font-bold">+</span> Tambah Piutang
                </button>
              )}
            </div>

            {/* Search */}
            <div className="px-6 pb-3">
              <div className="relative max-w-sm">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder={tab === "hutang" ? "Cari nama/kreditur atau kategori..." : "Cari nama/debitur atau kategori..."}
                  className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-sm bg-white focus:outline-none focus:border-[#C99A36] focus:ring-1 focus:ring-[#C99A36]/20 transition-colors"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
              </div>
            </div>

            {/* Table: Hutang */}
            {tab === "hutang" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {["ID Hutang", "Jenis Hutang", "Nama / Kreditur", "Kategori", "Harga Total", "Pembayaran Pelunasan", "Status", "Jatuh Tempo", "Tanggal Pelunasan", "Aksi"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          {Array.from({ length: 10 }).map((_, j) => (
                            <td key={j} className="px-4 py-3.5"><div className="h-4 bg-gray-200 animate-pulse rounded w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : pagedHutang.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-10 text-center">
                          <p className="text-gray-400 text-sm">
                            {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada data hutang"}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      pagedHutang.map((h) => (
                        <tr key={h.id} className="border-t border-gray-100 hover:bg-amber-50/60 transition-colors">
                          <td className="px-4 py-3.5 text-sm font-mono text-gray-500 whitespace-nowrap">{h.no_hutang}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">{jenisHutangLabel(h.jenis_hutang)}</td>
                          <td className="px-4 py-3.5 text-sm font-medium text-gray-800 whitespace-nowrap">{h.nama}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{h.kategori}</td>
                          <td className="px-4 py-3.5 text-sm font-bold text-gray-800 whitespace-nowrap">{fmtRupiah(h.harga_total)}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{h.pembayaran_pelunasan ?? "-"}</td>
                          <td className="px-4 py-3.5"><StatusBadge status={h.status} /></td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{fmtTanggal(h.tanggal_jatuh_tempo)}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{h.tanggal_pelunasan ? fmtTanggal(h.tanggal_pelunasan) : "-"}</td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => router.push(`/hutang-piutang/tambah?id=${h.id}&jenis=${h.jenis_hutang}`)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-amber-50"
                              style={{ borderColor: "#C99A36", color: "#C99A36" }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table: Piutang */}
            {tab === "piutang" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {["ID Piutang", "Sumber", "Nama / Debitur", "Kategori", "Jumlah Piutang", "Status", "Jatuh Tempo", "Tanggal Pelunasan", "Aksi"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          {Array.from({ length: 9 }).map((_, j) => (
                            <td key={j} className="px-4 py-3.5"><div className="h-4 bg-gray-200 animate-pulse rounded w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : pagedPiutang.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center">
                          <p className="text-gray-400 text-sm">
                            {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada data piutang"}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      pagedPiutang.map((p) => (
                        <tr key={p.id} className="border-t border-gray-100 hover:bg-amber-50/60 transition-colors">
                          <td className="px-4 py-3.5 text-sm font-mono text-gray-500 whitespace-nowrap">{p.no_piutang}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{p.sumber}</td>
                          <td className="px-4 py-3.5 text-sm font-medium text-gray-800 whitespace-nowrap">{p.nama_debitur}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{p.kategori}</td>
                          <td className="px-4 py-3.5 text-sm font-bold text-gray-800 whitespace-nowrap">{fmtRupiah(p.jumlah_piutang)}</td>
                          <td className="px-4 py-3.5"><StatusBadge status={p.status} /></td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{fmtTanggal(p.tanggal_jatuh_tempo)}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{p.tanggal_pelunasan ? fmtTanggal(p.tanggal_pelunasan) : "-"}</td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => router.push(`/hutang-piutang/tambah-piutang?id=${p.id}`)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-amber-50"
                              style={{ borderColor: "#C99A36", color: "#C99A36" }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

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
    </AppLayout>
  );
}

export default function HutangPiutangPage() {
  return (
    <PinGate pageTitle="Halaman Hutang & Piutang">
      {({ lock, openChangePin }) => (
        <HutangPiutangContent onLock={lock} onOpenChangePin={openChangePin} />
      )}
    </PinGate>
  );
}
