"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, logout } from "@/lib/auth-session";
import { createClient } from "@/lib/supabase/client";
import { useIdleTimeout } from "@/lib/useIdleTimeout";

const IDLE_LOGOUT_MINUTES = 30;

/**
 * Menjaga semua halaman yang dibungkus AppLayout. Dicek ulang lewat event
 * "pageshow" (bukan cuma sekali saat mount) supaya kalau user menekan tombol
 * Back browser setelah logout — termasuk saat halaman direstore dari
 * bfcache tanpa remount React — tetap terdeteksi sesi sudah habis dan
 * langsung dilempar balik ke /login. middleware.ts adalah penjaga sungguhan
 * di server; guard ini cuma menutup celah bfcache yang tidak lewat request baru.
 *
 * Juga auto-logout kalau benar-benar idle (tanpa klik/keyboard/scroll sama
 * sekali) selama IDLE_LOGOUT_MINUTES menit — bukan tiap kali pindah halaman.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const handleIdle = useCallback(async () => {
    await logout();
    router.replace("/login?expired=1");
  }, [router]);
  useIdleTimeout(IDLE_LOGOUT_MINUTES, handleIdle);

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
