"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SESSION_KEY = "kresno_login_unlocked";
const DEFAULT_PASSWORD = "1111";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [storedPassword, setStoredPassword] = useState(DEFAULT_PASSWORD);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    supabase
      .from("login_password")
      .select("password")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data?.password) setStoredPassword(data.password);
      });
  }, [supabase]);

  function handleMasuk() {
    if (checking) return;
    setChecking(true);
    if (pin === storedPassword) {
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
      router.push("/dashboard");
    } else {
      setError(true);
      setChecking(false);
      setTimeout(() => { setPin(""); setError(false); inputRef.current?.focus(); }, 900);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-10 px-4"
      style={{ backgroundColor: "#6F5333" }}
    >
      {/* Logo Kresno */}
      <div className="flex flex-col items-center">
        <Image
          src="/logo-kresno.png"
          alt="Logo Toko Mas Kresno"
          width={240}
          height={280}
          priority
          className="object-contain drop-shadow-2xl"
        />
      </div>

      {/* Form Area */}
      <div className="flex flex-col items-center w-full max-w-lg gap-6">
        {/* Label */}
        <p className="text-white text-2xl font-medium tracking-wide">
          Masukkan PIN Anda
        </p>

        {/* PIN Input */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleMasuk(); }}
          autoFocus
          className={`w-full max-w-sm h-14 rounded-full bg-white px-6 text-2xl font-bold text-center text-gray-800 focus:outline-none focus:ring-4 shadow-lg transition-all ${
            error ? "ring-4 ring-red-400" : "focus:ring-white/50"
          }`}
        />

        {error && (
          <p className="text-red-300 text-sm font-semibold -mt-2">
            PIN salah. Coba lagi.
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-6 mt-2">
          {/* Masuk — bold */}
          <button
            onClick={handleMasuk}
            disabled={checking}
            className="min-w-[160px] h-14 rounded-2xl flex items-center justify-center text-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: "#FFFBE9", color: "#6F5333", border: "2px solid #C4A35A" }}
          >
            Masuk
          </button>

          {/* Reset Password */}
          <Link
            href="/reset-password"
            className="min-w-[200px] h-14 rounded-2xl flex items-center justify-center text-xl font-normal transition-all shadow-md active:scale-95"
            style={{ backgroundColor: "#FFFBE9", color: "#6F5333", border: "2px solid #C4A35A" }}
          >
            Reset Password
          </Link>
        </div>
      </div>
    </div>
  );
}
