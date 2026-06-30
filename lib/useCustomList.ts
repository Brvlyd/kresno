import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Daftar nilai master data yang bisa ditambah sendiri oleh user, disimpan di
 * sebuah tabel `{nama text unique}` (mis. jenis_barang_custom, kadar_master)
 * sehingga nilai baru yang ditambahkan di satu halaman langsung tersedia di
 * halaman lain yang memakai tabel yang sama.
 */
export function useCustomList(table: string, baseSeed: readonly string[]) {
  const supabase = createClient();
  const [custom, setCustom] = useState<string[]>([]);

  const loadCustom = useCallback(async () => {
    const { data } = await supabase.from(table).select("nama").order("nama");
    setCustom((data ?? []).map((d) => d.nama as string));
  }, [table]);

  useEffect(() => { loadCustom(); }, [loadCustom]);

  const all = [...baseSeed, ...custom];

  const addCustom = useCallback(async (nama: string): Promise<string | null> => {
    const trimmed = nama.trim();
    if (!trimmed) return null;
    const existingMatch = all.find((j) => j.toLowerCase() === trimmed.toLowerCase());
    if (existingMatch) return existingMatch;
    const { error } = await supabase.from(table).insert({ nama: trimmed });
    if (error) {
      // User lain bisa saja barusan menambah nilai yang sama duluan (unique constraint) —
      // itu bukan kegagalan dari sudut pandang pemanggil, nilainya sudah ada & terpakai.
      if (error.code === "23505") {
        setCustom((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        return trimmed;
      }
      return null;
    }
    setCustom((prev) => [...prev, trimmed]);
    return trimmed;
  }, [all, table]);

  const deleteCustom = useCallback(async (nama: string): Promise<boolean> => {
    const { error } = await supabase.from(table).delete().eq("nama", nama);
    if (error) return false;
    setCustom((prev) => prev.filter((j) => j !== nama));
    return true;
  }, [table]);

  return { all, custom, addCustom, deleteCustom, reloadCustom: loadCustom };
}
