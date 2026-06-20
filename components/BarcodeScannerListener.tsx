"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Konfigurasi prefix scanner — program kedua scanner barcode untuk menambahkan
 * 1 karakter ini di awal setiap hasil scan (fitur "prefix character" di manual scanner):
 *  - Scanner 1 (cek cepat)       -> prefix "I" lalu kode barang, contoh: I CN0040
 *  - Scanner 2 (konfirmasi keluar) -> prefix "O" lalu kode barang, contoh: O CN0040
 */
const PREFIX_CEK = "I";
const PREFIX_KELUAR = "O";

// Scanner mengetik sangat cepat (umumnya <20-30ms/karakter).
// Ketikan manusia normal jauh lebih lambat, jadi dipakai untuk membedakan scan vs ketikan biasa.
const SCAN_GAP_MS = 50;
const MIN_CODE_LENGTH = 2;

export default function BarcodeScannerListener() {
  const router = useRouter();
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
        const idItem = code.slice(1).trim().toUpperCase();
        if (prefix !== PREFIX_CEK && prefix !== PREFIX_KELUAR) return;
        if (!idItem) return;

        const supabase = createClient();
        const { data } = await supabase
          .from("inventori")
          .select("id")
          .eq("id_item", idItem)
          .maybeSingle();

        if (!data) {
          window.alert(`Barang dengan ID "${idItem}" tidak ditemukan di inventori.`);
          return;
        }

        if (prefix === PREFIX_CEK) {
          router.push(`/inventori?id=${data.id}`);
        } else {
          router.push(`/inventori/konfirmasi-keluar?id=${data.id}`);
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
  }, [router]);

  return null;
}
