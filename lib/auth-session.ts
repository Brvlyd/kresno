import { createClient } from "@/lib/supabase/client";

/** Cek sesi login asli (Supabase Auth), bukan lagi sessionStorage kosmetik. */
export async function isLoggedIn(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
