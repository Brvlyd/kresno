import type { SupabaseClient } from "@supabase/supabase-js";

const PUBLIC_URL_MARKER = "/object/public/";

// Module-level cache: storedUrl → Promise<signedUrl | null>
// Prevents duplicate createSignedUrl calls when multiple components show the same image.
const signedUrlCache = new Map<string, Promise<string | null>>();

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

  if (signedUrlCache.has(storedUrl)) {
    return signedUrlCache.get(storedUrl)!;
  }

  const promise = supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresInSeconds)
    .then(({ data, error }) => {
      if (error || !data) { signedUrlCache.delete(storedUrl); return null; }
      // Evict cache slightly before the signed URL expires
      setTimeout(() => signedUrlCache.delete(storedUrl), (expiresInSeconds - 60) * 1000);
      return data.signedUrl;
    });

  signedUrlCache.set(storedUrl, promise);
  return promise;
}
