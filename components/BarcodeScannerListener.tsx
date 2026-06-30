"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { idItemScanCandidates } from "@/lib/csv";

/**
 * Konfigurasi prefix scanner — program kedua scanner barcode untuk menambahkan
 * 1 karakter ini di awal setiap hasil scan (fitur "prefix character" di manual scanner):
 *  - Scanner 1 (cek cepat)       -> prefix "I" lalu kode barang, contoh: I CN0040
 *  - Scanner 2 (konfirmasi keluar) -> prefix "O" lalu kode barang, contoh: O CN0040
 *
 * Selain dua prefix di atas (tetap dipertahankan apa adanya), kedua scanner juga
 * dipakai untuk kegunaan yang sama: scan TANPA prefix. Untuk kasus ini, tujuannya
 * ditentukan dari halaman yang sedang dibuka saat itu:
 *  - Halaman /inventori -> langsung tampilkan detail barang hasil scan
 *  - Halaman /pos (penjualan) -> isi baris keranjang dgn barang hasil scan, siap diedit
 */
const PREFIX_CEK = "I";
const PREFIX_KELUAR = "O";

// Scanner mengetik sangat cepat (umumnya <20-30ms/karakter).
// Ketikan manusia normal jauh lebih lambat, jadi dipakai untuk membedakan scan vs ketikan biasa.
const SCAN_GAP_MS = 50;
const MIN_CODE_LENGTH = 2;
// Untuk scan tanpa prefix dipakai ambang lebih tinggi — supaya ketikan manual yang
// kebetulan cepat (mis. ketik harga lalu Enter) tidak salah terbaca sebagai barcode.
const MIN_AUTO_CODE_LENGTH = 4;

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

export default function BarcodeScannerListener() {
  const router = useRouter();
  const pathname = usePathname();
  const bufferRef = useRef("");
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const now = Date.now();
      const gap = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current;
        bufferRef.current = "";
        if (code.length < MIN_CODE_LENGTH) return;

        const prefix = code[0].toUpperCase();
        const isPrefixed = prefix === PREFIX_CEK || prefix === PREFIX_KELUAR;

        if (isPrefixed) {
          const idItem = code.slice(1).trim().toUpperCase();
          if (!idItem) return;

          if (prefix === PREFIX_CEK) {
            // Halaman /inventori sendiri yang mencari & menampilkan popup
            // konfirmasi (ditemukan / tidak ditemukan) berdasarkan ?scan=.
            // "&t=" dipakai sebagai nonce supaya scan barang yang sama dua kali
            // berturut-turut tetap memicu popup baru (bukan diabaikan sebagai duplikat).
            router.push(`/inventori?scan=${encodeURIComponent(idItem)}&t=${Date.now()}`);
            return;
          }

          const supabase = createClient();
          // Barcode baru meng-encode id_item TANPA "-" (lebih renggang/gampang discan),
          // label lama masih dengan "-". idItemScanCandidates mengembalikan kedua
          // kemungkinan bentuknya supaya keduanya tetap bisa ditemukan.
          const { data } = await supabase
            .from("inventori")
            .select("id")
            .in("id_item", idItemScanCandidates(idItem))
            .maybeSingle();

          if (!data) {
            window.alert(`Barang dengan ID "${idItem}" tidak ditemukan di inventori.`);
            return;
          }
          router.push(`/inventori/konfirmasi-keluar?id=${data.id}`);
          return;
        }

        // Scan tanpa prefix — tujuan ditentukan dari halaman yang sedang dibuka.
        if (isTypingTarget(document.activeElement)) return;
        const idItem = code.trim().toUpperCase();
        if (idItem.length < MIN_AUTO_CODE_LENGTH) return;

        if (pathname.startsWith("/pos")) {
          router.push(`/pos?scan=${encodeURIComponent(idItem)}&t=${Date.now()}`);
          return;
        }

        if (pathname.startsWith("/inventori")) {
          router.push(`/inventori?scan=${encodeURIComponent(idItem)}&t=${Date.now()}`);
        }
        return;
      }

      if (e.key.length !== 1) return;

      // Reset buffer jika jeda antar-ketikan terlalu lama (bukan hasil scan)
      if (gap > SCAN_GAP_MS) {
        bufferRef.current = "";
      }
      bufferRef.current += e.key;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, pathname]);

  return null;
}
