import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Daftar jenis barang yang bisa ditambah user, disimpan di tabel `jenis_barang_custom`
 * sehingga jenis baru yang ditambahkan di satu halaman (Inventori/Gadai/Servis) langsung
 * tersedia di halaman lainnya juga.
 */
export function useJenisBarang(baseJenis: readonly string[]) {
  const supabase = createClient();
  const [customJenis, setCustomJenis] = useState<string[]>([]);

  const loadCustomJenis = useCallback(async () => {
    const { data } = await supabase.from("jenis_barang_custom").select("nama").order("nama");
    setCustomJenis((data ?? []).map((d) => d.nama as string));
  }, []);

  useEffect(() => { loadCustomJenis(); }, [loadCustomJenis]);

  const allJenis = [...baseJenis, ...customJenis];

  const addCustomJenis = useCallback(async (nama: string): Promise<string | null> => {
    const trimmed = nama.trim();
    if (!trimmed) return null;
    const existingMatch = allJenis.find((j) => j.toLowerCase() === trimmed.toLowerCase());
    if (existingMatch) return existingMatch;
    const { error } = await supabase.from("jenis_barang_custom").insert({ nama: trimmed });
    if (error) return null;
    setCustomJenis((prev) => [...prev, trimmed]);
    return trimmed;
  }, [allJenis]);

  const deleteCustomJenis = useCallback(async (nama: string): Promise<boolean> => {
    const { error } = await supabase.from("jenis_barang_custom").delete().eq("nama", nama);
    if (error) return false;
    setCustomJenis((prev) => prev.filter((j) => j !== nama));
    return true;
  }, []);

  return { allJenis, customJenis, addCustomJenis, deleteCustomJenis, reloadCustomJenis: loadCustomJenis };
}
