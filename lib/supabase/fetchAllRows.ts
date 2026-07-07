// Supabase/PostgREST membatasi jumlah baris per request (default 1000, diatur di
// Project Settings > API > Max Rows). Query ".select(...)" tanpa ".range()" akan
// diam-diam terpotong begitu tabel melewati batas itu — tidak ada error, cuma
// data yang hilang. Helper ini menge-loop pakai ".range()" sampai semua baris kebaca.
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
