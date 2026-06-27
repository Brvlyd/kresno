"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth-session";

/**
 * Menjaga semua halaman yang dibungkus AppLayout. Dicek ulang lewat event
 * "pageshow" (bukan cuma sekali saat mount) supaya kalau user menekan tombol
 * Back browser setelah logout — termasuk saat halaman direstore dari
 * bfcache tanpa remount React — tetap terdeteksi sesi sudah habis dan
 * langsung dilempar balik ke /login.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    function verify() {
      if (!isLoggedIn()) {
        router.replace("/login?expired=1");
      } else {
        setChecked(true);
      }
    }
    verify();
    window.addEventListener("pageshow", verify);
    return () => window.removeEventListener("pageshow", verify);
  }, [router]);

  if (!checked) return null;
  return <>{children}</>;
}
