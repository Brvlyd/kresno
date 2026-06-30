import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Riwayat nama barang/produk yang pernah diketik di Servis, Pegadaian, Pembelian,
 * atau Inventori (tabel `nama_barang_riwayat`) — dipakai sebagai sumber saran
 * pencarian di field Nama Barang/Nama Produk lewat AutocompleteField, bukan stok
 * asli (barang servis/gadai milik pelanggan, barang pembelian rosok bukan stok toko).
 */
export function useNamaBarangList() {
  const supabase = createClient();
  const [all, setAll] = useState<string[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("nama_barang_riwayat").select("nama").order("nama");
    setAll((data ?? []).map((d) => d.nama as string));
  }, []);

  useEffect(() => { load(); }, [load]);

  const record = useCallback(async (nama: string) => {
    const trimmed = nama.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("nama_barang_riwayat").upsert({ nama: trimmed }, { onConflict: "nama" });
    if (!error) setAll((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
  }, []);

  return { all, record, reload: load };
}
