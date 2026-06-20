import { createBrowserClient } from "@supabase/ssr";

// Fallback ke placeholder kalau env var belum di-set (misal lupa dikonfigurasi di Vercel).
// Tanpa ini, createBrowserClient() throw saat build/prerender dan menjatuhkan SELURUH halaman
// (termasuk yang tidak butuh Supabase). Dengan placeholder, build tetap jalan; hanya request
// ke Supabase yang gagal (network error yang sudah ditangani lewat `data ?? []`/pesan error
// di tiap halaman) — bukan seluruh build/deploy yang crash.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
