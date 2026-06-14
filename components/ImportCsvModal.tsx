"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CSV_HEADERS,
  STATUS_OPTIONS,
  csvTemplate,
  parseCsv,
  parseNumber,
  parseDate,
  normalizeStatus,
  prefixForKategori,
  buildPrefixCounters,
  nextId,
} from "@/lib/csv";

interface ExistingItem {
  id_item: string;
}

interface ParsedRow {
  no: string;
  gambar: string;
  nama_produk: string;
  kategori: string;
  kadar: string;
  berat_gram: number;
  jumlah: number;
  harga_beli: number;
  harga_jual: number;
  status_inventori: string;
  supplier: string;
  tanggal_masuk: string;
  keterangan: string;
  errors: string[];
  id_item?: string;
}

function findColumn(header: string[], name: string): number {
  const target = name.trim().toLowerCase();
  return header.findIndex((h) => h.trim().toLowerCase() === target);
}

export default function ImportCsvModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ success: number; failed: number; message: string } | null>(null);

  const reset = () => {
    setRows([]);
    setFileName("");
    setParseError("");
    setResult(null);
    setProgress({ done: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const downloadTemplate = () => {
    // Tambahkan BOM agar Excel di Windows membuka file dengan encoding UTF-8 yang benar
    const blob = new Blob(["﻿" + csvTemplate()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_inventori.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setParseError("");
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    const table = parseCsv(text);

    if (table.length === 0) {
      setParseError("File CSV kosong atau tidak terbaca.");
      setRows([]);
      return;
    }

    const header = table[0];
    const dataRows = table.slice(1);

    const idx = {
      no: findColumn(header, "No"),
      gambar: findColumn(header, "Gambar"),
      nama: findColumn(header, "Nama Barang"),
      kategori: findColumn(header, "Kategori"),
      kadar: findColumn(header, "Kadar"),
      berat: findColumn(header, "Berat Gram"),
      jumlah: findColumn(header, "Jumlah"),
      hargaModal: findColumn(header, "Harga Modal"),
      hargaJual: findColumn(header, "Harga Jual"),
      status: findColumn(header, "Status"),
      supplier: findColumn(header, "Supplier"),
      tanggal: findColumn(header, "Tanggal Masuk"),
      keterangan: findColumn(header, "Keterangan"),
    };

    const missingRequired: string[] = [];
    if (idx.nama === -1) missingRequired.push("Nama Barang");
    if (idx.kategori === -1) missingRequired.push("Kategori");
    if (idx.kadar === -1) missingRequired.push("Kadar");
    if (missingRequired.length > 0) {
      setParseError(
        `Header CSV tidak sesuai. Kolom wajib tidak ditemukan: ${missingRequired.join(", ")}. ` +
          `Gunakan template untuk format yang benar.`
      );
      setRows([]);
      return;
    }

    const get = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");

    const parsed: ParsedRow[] = dataRows.map((r, i) => {
      const errors: string[] = [];
      const nama_produk = get(r, idx.nama);
      const kategori = get(r, idx.kategori);
      const kadar = get(r, idx.kadar);
      const beratRaw = get(r, idx.berat);
      const jumlahRaw = get(r, idx.jumlah);

      if (!nama_produk) errors.push("Nama Barang kosong");
      if (!kategori) errors.push("Kategori kosong");
      if (!kadar) errors.push("Kadar kosong");

      const berat_gram = parseNumber(beratRaw);
      if (beratRaw && berat_gram <= 0) errors.push("Berat Gram tidak valid");

      const jumlah = jumlahRaw ? Math.max(0, Math.round(parseNumber(jumlahRaw))) : 1;

      return {
        no: get(r, idx.no) || String(i + 1),
        gambar: get(r, idx.gambar),
        nama_produk,
        kategori,
        kadar,
        berat_gram,
        jumlah,
        harga_beli: parseNumber(get(r, idx.hargaModal)),
        harga_jual: parseNumber(get(r, idx.hargaJual)),
        status_inventori: normalizeStatus(get(r, idx.status)),
        supplier: get(r, idx.supplier),
        tanggal_masuk: parseDate(get(r, idx.tanggal)),
        keterangan: get(r, idx.keterangan),
        errors,
      };
    });

    setRows(parsed);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: validRows.length });

    // Ambil id_item yang sudah ada agar penomoran otomatis tidak bertabrakan
    const { data: existing } = await supabase.from("inventori").select("id_item");
    const counters = buildPrefixCounters((existing ?? []) as ExistingItem[]);

    const payloads = validRows.map((row) => {
      const prefix = prefixForKategori(row.kategori);
      const id_item = nextId(prefix, counters);
      return {
        id_item,
        nama_produk: row.nama_produk,
        kategori: row.kategori,
        jenis_barang: row.kategori,
        kadar: row.kadar,
        berat_gram: row.berat_gram,
        jumlah: row.jumlah,
        harga_beli: row.harga_beli,
        harga_jual: row.harga_jual,
        status_inventori: row.status_inventori,
        status_laporan: "Draft",
        supplier: row.supplier || null,
        keterangan: row.keterangan || null,
        gambar_url: row.gambar || null,
        tanggal_masuk: row.tanggal_masuk,
      };
    });

    const chunkSize = 200;
    let success = 0;
    let failed = 0;
    let lastError = "";

    for (let i = 0; i < payloads.length; i += chunkSize) {
      const chunk = payloads.slice(i, i + chunkSize);
      const { error } = await supabase.from("inventori").insert(chunk);
      if (error) {
        failed += chunk.length;
        lastError = error.message;
      } else {
        success += chunk.length;
      }
      setProgress({ done: Math.min(i + chunkSize, payloads.length), total: payloads.length });
    }

    setImporting(false);
    setResult({
      success,
      failed,
      message: failed > 0 ? `Sebagian gagal disimpan: ${lastError}` : "",
    });

    if (success > 0) onImported();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
            Import Barang dari CSV
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors font-bold text-lg"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Step 1: instructions + template */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-sm text-gray-700">
              Unggah file CSV dengan kolom: <strong>{CSV_HEADERS.join(", ")}</strong>.
              Kolom <strong>ID Barang dibuat otomatis</strong> berdasarkan Kategori.
              Status yang valid: {STATUS_OPTIONS.join(", ")}.
            </p>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors hover:bg-amber-100"
              style={{ borderColor: "#C99A36", color: "#C99A36" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/>
              </svg>
              Download Template CSV
            </button>
          </div>

          {/* File picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Pilih File CSV</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              disabled={importing}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-[#C99A36] focus:outline-none focus:border-[#C99A36]"
            />
            {fileName && <p className="text-xs text-gray-400 mt-1">File: {fileName}</p>}
          </div>

          {parseError && (
            <p className="text-sm font-semibold py-2.5 px-4 rounded-xl bg-red-50 text-red-600">
              {parseError}
            </p>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <p className="text-sm text-gray-600">
                  Total <strong>{rows.length}</strong> baris — valid{" "}
                  <span className="text-green-600 font-semibold">{validRows.length}</span>
                  {invalidCount > 0 && (
                    <>
                      , error <span className="text-red-600 font-semibold">{invalidCount}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {["No", "Nama Barang", "Kategori", "Kadar", "Berat", "Jumlah", "Modal", "Jual", "Status", "Supplier", "Tanggal", "Status Baris"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.errors.length > 0 ? "bg-red-50" : ""}>
                        <td className="px-3 py-2 whitespace-nowrap">{r.no}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.nama_produk || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.kategori || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.kadar || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.berat_gram}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.jumlah}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.harga_beli.toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.harga_jual.toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.status_inventori}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.supplier || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.tanggal_masuk}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.errors.length > 0 ? (
                            <span className="text-red-600 font-semibold">{r.errors.join(", ")}</span>
                          ) : (
                            <span className="text-green-600 font-semibold">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {invalidCount > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Baris dengan error akan dilewati dan tidak diimpor.
                </p>
              )}
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Mengimpor {progress.done} / {progress.total} barang...
              </p>
              <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, backgroundColor: "#C99A36" }}
                />
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 ${result.failed > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}>
              <p className="text-sm font-semibold text-gray-800">
                ✓ {result.success} barang berhasil diimpor.
                {result.failed > 0 && ` ${result.failed} baris gagal disimpan.`}
              </p>
              {result.message && <p className="text-xs text-gray-500 mt-1">{result.message}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100">
          <button
            onClick={handleClose}
            disabled={importing}
            className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {result ? "Tutup" : "Batal"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#C99A36" }}
            >
              {importing ? "Mengimpor..." : `Impor ${validRows.length} Barang`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
