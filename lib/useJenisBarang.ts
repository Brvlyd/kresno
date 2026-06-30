import { useCustomList } from "@/lib/useCustomList";

/**
 * Daftar jenis barang yang bisa ditambah user, disimpan di tabel `jenis_barang_custom`
 * sehingga jenis baru yang ditambahkan di satu halaman (Inventori/Gadai/Servis) langsung
 * tersedia di halaman lainnya juga.
 */
export function useJenisBarang(baseJenis: readonly string[]) {
  const { all, custom, addCustom, deleteCustom, reloadCustom } = useCustomList("jenis_barang_custom", baseJenis);
  return {
    allJenis: all,
    customJenis: custom,
    addCustomJenis: addCustom,
    deleteCustomJenis: deleteCustom,
    reloadCustomJenis: reloadCustom,
  };
}
