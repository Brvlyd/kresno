"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth-session";
import { createClient } from "@/lib/supabase/client";

/**
 * Menjaga semua halaman yang dibungkus AppLayout. Dicek ulang lewat event
 * "pageshow" (bukan cuma sekali saat mount) supaya kalau user menekan tombol
 * Back browser setelah logout — termasuk saat halaman direstore dari
 * bfcache tanpa remount React — tetap terdeteksi sesi sudah habis dan
 * langsung dilempar balik ke /login. middleware.ts adalah penjaga sungguhan
 * di server; guard ini cuma menutup celah bfcache yang tidak lewat request baru.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    async function verify() {
      const ok = await isLoggedIn();
      if (!active) return;
      if (!ok) {
        router.replace("/login?expired=1");
      } else {
        setChecked(true);
      }
    }
    verify();
    window.addEventListener("pageshow", verify);

    const supabase = createClient();
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") verify();
    });

    return () => {
      active = false;
      window.removeEventListener("pageshow", verify);
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  if (!checked) return null;
  return <>{children}</>;
}
