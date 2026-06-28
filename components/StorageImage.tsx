"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveImageUrl } from "@/lib/storage";

/**
 * Pengganti <img src={...}> untuk foto yang disimpan di Supabase Storage.
 * Bucket foto sudah private (lihat migration 021), jadi URL yang tersimpan
 * di DB harus ditukar jadi signed URL dulu sebelum bisa ditampilkan.
 */
export default function StorageImage({
  src, alt, className, style,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!src) { setResolved(null); return; }
    resolveImageUrl(createClient(), src).then((url) => { if (active) setResolved(url); });
    return () => { active = false; };
  }, [src]);

  if (!resolved) return null;
  return <img src={resolved} alt={alt} className={className} style={style} />;
}
