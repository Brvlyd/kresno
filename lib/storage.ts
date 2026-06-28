import type { SupabaseClient } from "@supabase/supabase-js";

const PUBLIC_URL_MARKER = "/object/public/";

/**
 * URL yang tersimpan di kolom gambar_url/foto_*_url dibuat lewat getPublicUrl()
 * jaman bucket masih public. Sejak bucket dikunci jadi private (lihat migration
 * 021_lock_down_rls.sql), URL itu sendiri tidak lagi bisa diakses langsung —
 * harus ditukar jadi signed URL pakai bucket+path yang diekstrak darinya.
 */
function parseStoredUrl(url: string): { bucket: string; path: string } | null {
  const idx = url.indexOf(PUBLIC_URL_MARKER);
  if (idx === -1) return null;
  const rest = url.slice(idx + PUBLIC_URL_MARKER.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

export async function resolveImageUrl(
  supabase: SupabaseClient,
  storedUrl: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!storedUrl) return null;
  const parsed = parseStoredUrl(storedUrl);
  if (!parsed) return storedUrl;
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
