"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "kresno_keuangan_unlocked";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 4; // 4 jam

/**
 * Bandingkan PIN Keuangan di server (bukan di browser) supaya tidak bisa
 * dilewati lewat devtools. Server client di sini sudah membawa sesi login
 * asli lewat cookie — gerbang PIN ini cuma lapis tambahan di dalam aplikasi,
 * bukan identitas terpisah.
 */
export async function verifyKeuanganPin(pin: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("keuangan_pin")
    .select("pin")
    .eq("id", 1)
    .maybeSingle();

  const storedPin = data?.pin ?? "1234";
  if (pin !== storedPin) return false;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/keuangan",
  });
  return true;
}

export async function isKeuanganUnlocked(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === "1";
}

export async function lockKeuangan(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: COOKIE_NAME, path: "/keuangan" });
}
